import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

from app.models.mcp import McpServer, McpTool, McpToolsResponse
from app.services.mcp_discovery import discover_tools_async
from app.core.kiro_dir import get_kiro_dir, ensure_kiro_dir

router = APIRouter()


def _mcp_path() -> Path:
    """Check settings/mcp.json first (Kiro default), fall back to mcp.json."""
    kiro = get_kiro_dir()
    settings_path = kiro / "settings" / "mcp.json"
    if settings_path.exists():
        return settings_path
    return kiro / "mcp.json"


def _load_servers() -> list[McpServer]:
    path = _mcp_path()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text())
        # Support both formats:
        # 1. { "mcpServers": { "name": { command, args, ... } } }  (Kiro native)
        # 2. { "servers": [ { name, command, args, ... } ] }        (app format)
        if isinstance(data, dict) and "mcpServers" in data:
            servers = []
            for name, cfg in data["mcpServers"].items():
                if isinstance(cfg, dict):
                    servers.append(McpServer(
                        name=name,
                        command=cfg.get("command", ""),
                        args=cfg.get("args", []),
                        env=cfg.get("env", {}),
                        enabled=not cfg.get("disabled", False),
                    ))
            return servers
        servers = data.get("servers", data) if isinstance(data, dict) else data
        return [McpServer(**s) for s in servers]
    except Exception:
        return []


def _save_servers(servers: list[McpServer]) -> None:
    ensure_kiro_dir()
    path = _mcp_path()
    # Save in Kiro native format if that's what we're reading from
    if "settings" in str(path):
        payload: dict = {"mcpServers": {}}
        for s in servers:
            entry: dict = {"command": s.command, "args": s.args}
            if s.env:
                entry["env"] = s.env
            if not s.enabled:
                entry["disabled"] = True
            payload["mcpServers"][s.name] = entry
    else:
        payload = {"servers": [s.model_dump() for s in servers]}
    path.write_text(json.dumps(payload, indent=2))


@router.get("", response_model=list[McpServer])
def list_mcp_servers() -> list[McpServer]:
    return _load_servers()


@router.post("", response_model=McpServer, status_code=201)
def add_mcp_server(data: McpServer) -> McpServer:
    servers = _load_servers()
    if any(s.name == data.name for s in servers):
        raise HTTPException(status_code=409, detail=f"MCP server '{data.name}' already exists")
    servers.append(data)
    _save_servers(servers)
    return data


@router.put("/{name}", response_model=McpServer)
def update_mcp_server(name: str, data: McpServer) -> McpServer:
    servers = _load_servers()
    for i, s in enumerate(servers):
        if s.name == name:
            servers[i] = data
            _save_servers(servers)
            return data
    raise HTTPException(status_code=404, detail=f"MCP server '{name}' not found")


@router.delete("/{name}", status_code=204)
def delete_mcp_server(name: str) -> None:
    servers = _load_servers()
    new_servers = [s for s in servers if s.name != name]
    if len(new_servers) == len(servers):
        raise HTTPException(status_code=404, detail=f"MCP server '{name}' not found")
    _save_servers(new_servers)


@router.get("/{name}/tools", response_model=McpToolsResponse)
async def list_mcp_server_tools(name: str) -> McpToolsResponse:
    """Discover tools exposed by an MCP server.

    Spawns the server subprocess and queries it via the MCP stdio protocol.
    Best-effort: may be slow on first run (npm/pip downloads) and may fail
    entirely for servers with non-standard startup behavior.
    """
    servers = _load_servers()
    server = next((s for s in servers if s.name == name), None)
    if server is None:
        raise HTTPException(status_code=404, detail=f"MCP server '{name}' not found")

    result = await discover_tools_async(
        command=server.command,
        args=server.args,
        env=server.env,
    )
    return McpToolsResponse(
        server=name,
        tools=[McpTool(name=t.name, description=t.description) for t in result.tools],
        error=result.error,
        durationMs=result.durationMs,
    )


@router.post("/upload")
async def upload_mcp_config(file: UploadFile = File(...)) -> dict:
    """
    Accept a JSON file upload containing MCP server config.
    Expects an object with an `mcpServers` key at the top level.
    Merges extracted servers into ~/.kiro/mcp.json.
    """
    content = await file.read()
    try:
        imported = json.loads(content.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    # Both formats use mcpServers at top level
    new_servers_raw: dict = imported.get("mcpServers") or {}
    if not new_servers_raw or not isinstance(new_servers_raw, dict):
        raise HTTPException(status_code=400, detail="No 'mcpServers' found in uploaded file")

    existing = _load_servers()
    existing_map = {s.name: s for s in existing}

    added = 0
    updated = 0
    for name, cfg in new_servers_raw.items():
        if isinstance(cfg, dict):
            server = McpServer(
                name=name,
                command=cfg.get("command", ""),
                args=cfg.get("args", []),
                env=cfg.get("env", {}),
                enabled=cfg.get("enabled", True),
            )
            if name in existing_map:
                existing_map[name] = server
                updated += 1
            else:
                existing_map[name] = server
                added += 1

    _save_servers(list(existing_map.values()))
    return {"success": True, "added": added, "updated": updated, "total": len(existing_map)}
