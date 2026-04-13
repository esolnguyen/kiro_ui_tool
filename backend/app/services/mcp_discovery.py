"""Discover tools exposed by an MCP server by speaking the MCP protocol
over stdio (newline-delimited JSON-RPC).

This is best-effort: many servers are slow to start (npx download, Python
package install, etc.), so we allow a long initialize window but keep a
short per-message timeout after that. Failures return an empty list along
with an error string so the frontend can fall back to manual entry.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass


@dataclass
class McpTool:
    name: str
    description: str = ""


@dataclass
class McpToolDiscoveryResult:
    tools: list[McpTool]
    error: str | None
    durationMs: int


# Cache: {cache_key: (timestamp, result)}
_cache: dict[str, tuple[float, McpToolDiscoveryResult]] = {}
_CACHE_TTL_SECONDS = 60 * 60  # 1h


def _cache_key(command: str, args: list[str]) -> str:
    return command + "\0" + "\0".join(args)


async def _read_json_line(reader: asyncio.StreamReader, timeout: float) -> dict | None:
    raw = await asyncio.wait_for(reader.readline(), timeout=timeout)
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return None


async def _read_until_id(
    reader: asyncio.StreamReader, target_id: int, timeout: float
) -> dict | None:
    """Read messages until we get one whose ``id`` matches ``target_id``.

    Silently skips notifications and unrelated responses.
    """
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            return None
        msg = await _read_json_line(reader, timeout=remaining)
        if msg is None:
            return None
        if msg.get("id") == target_id:
            return msg
        # otherwise it's a notification or log — ignore


async def discover_tools_async(
    command: str,
    args: list[str],
    env: dict[str, str] | None = None,
    initialize_timeout: float = 60.0,
    list_timeout: float = 20.0,
) -> McpToolDiscoveryResult:
    started = time.monotonic()
    key = _cache_key(command, args)
    cached = _cache.get(key)
    if cached and (time.time() - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    full_env = os.environ.copy()
    if env:
        full_env.update(env)

    try:
        proc = await asyncio.create_subprocess_exec(
            command,
            *args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=full_env,
            limit=10 * 1024 * 1024,  # 10 MB – some MCP servers return large tool lists
        )
    except FileNotFoundError:
        return McpToolDiscoveryResult(
            tools=[],
            error=f"Command not found: {command}",
            durationMs=int((time.monotonic() - started) * 1000),
        )
    except Exception as exc:  # pragma: no cover
        return McpToolDiscoveryResult(
            tools=[],
            error=f"Failed to spawn server: {exc}",
            durationMs=int((time.monotonic() - started) * 1000),
        )

    assert proc.stdin is not None and proc.stdout is not None

    async def send(obj: dict) -> None:
        assert proc.stdin is not None
        proc.stdin.write((json.dumps(obj) + "\n").encode("utf-8"))
        await proc.stdin.drain()

    try:
        # 1. initialize
        await send({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "kiro-ui", "version": "0.1.0"},
            },
        })
        init_resp = await _read_until_id(proc.stdout, 1, timeout=initialize_timeout)
        if init_resp is None or "error" in init_resp:
            err = (
                init_resp.get("error", {}).get("message")
                if init_resp
                else "Initialize timed out"
            )
            return McpToolDiscoveryResult(
                tools=[],
                error=f"Initialize failed: {err}",
                durationMs=int((time.monotonic() - started) * 1000),
            )

        # 2. initialized notification
        await send({"jsonrpc": "2.0", "method": "notifications/initialized"})

        # 3. tools/list
        await send({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        list_resp = await _read_until_id(proc.stdout, 2, timeout=list_timeout)
        if list_resp is None:
            return McpToolDiscoveryResult(
                tools=[],
                error="tools/list timed out",
                durationMs=int((time.monotonic() - started) * 1000),
            )
        if "error" in list_resp:
            return McpToolDiscoveryResult(
                tools=[],
                error=f"tools/list failed: {list_resp['error'].get('message', 'unknown')}",
                durationMs=int((time.monotonic() - started) * 1000),
            )

        tools_raw = (list_resp.get("result") or {}).get("tools") or []
        tools = [
            McpTool(
                name=str(t.get("name", "")),
                description=str(t.get("description", "")),
            )
            for t in tools_raw
            if isinstance(t, dict) and t.get("name")
        ]
        result = McpToolDiscoveryResult(
            tools=tools,
            error=None,
            durationMs=int((time.monotonic() - started) * 1000),
        )
        _cache[key] = (time.time(), result)
        return result
    finally:
        try:
            if proc.returncode is None:
                proc.terminate()
                try:
                    await asyncio.wait_for(proc.wait(), timeout=3)
                except asyncio.TimeoutError:
                    proc.kill()
        except Exception:
            pass


def clear_cache() -> None:
    _cache.clear()
