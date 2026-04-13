import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

import ptyprocess

from app.models.terminal import SessionInfo, CreateSessionRequest
from app.core.kiro_dir import get_kiro_dir


ws_router = APIRouter()
rest_router = APIRouter()

_SAFE_ENV_KEYS = {
    "HOME", "USER", "SHELL", "PATH", "LANG", "LC_ALL", "TERM",
    "EDITOR", "VISUAL", "KIRO_DIR",
    "KIRO_API_KEY",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_REGION",
    "KIRO_CLI_PATH",
}
IDLE_TIMEOUT_SECONDS = 30 * 60

def _safe_env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if k in _SAFE_ENV_KEYS or k.startswith("LC_")}
    env["TERM"] = "xterm-256color"
    return env


MAX_OUTPUT_LINES = 10_000


class _SessionData:
    def __init__(self, info: SessionInfo, pty: ptyprocess.PtyProcess) -> None:
        self.info = info
        self.pty = pty
        self.output: list[str] = []
        self._idle_handle: asyncio.TimerHandle | None = None


active_sessions: dict[str, _SessionData] = {}


def _kiro_cli_path() -> str:
    from app.core.cli import get_kiro_cli
    return get_kiro_cli()


def _user_shell() -> str:
    """Return the user's default shell, falling back to /bin/bash."""
    return os.environ.get("SHELL", "/bin/bash")


def _history_dir() -> Path:
    d = get_kiro_dir() / "cli-history"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _save_session_history(session_data: _SessionData) -> None:
    history_file = _history_dir() / f"{session_data.info.id}.json"
    payload = {
        **session_data.info.model_dump(),
        "output": "".join(session_data.output),
    }
    try:
        history_file.write_text(json.dumps(payload, indent=2))
    except Exception:
        pass


async def _terminate_session(session_id: str) -> None:
    data = active_sessions.get(session_id)
    if not data:
        return
    data.info.status = "terminated"
    _save_session_history(data)
    try:
        data.pty.terminate(force=True)
    except Exception:
        pass
    active_sessions.pop(session_id, None)


async def _cleanup_idle_sessions() -> None:
    """Background task — terminates sessions idle for 30+ minutes."""
    while True:
        await asyncio.sleep(60)
        now = datetime.now(timezone.utc)
        to_terminate: list[str] = []
        for sid, data in active_sessions.items():
            try:
                last = datetime.fromisoformat(data.info.lastActivity)
                if (now - last).total_seconds() > IDLE_TIMEOUT_SECONDS:
                    to_terminate.append(sid)
            except Exception:
                pass
        for sid in to_terminate:
            await _terminate_session(sid)


# ── WebSocket endpoint (existing, kept intact) ─────────────────────────────

@ws_router.websocket("/terminal/{session_id}")
async def terminal_ws(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()

    shell = _user_shell()
    try:
        pty = ptyprocess.PtyProcess.spawn(
            [shell],
            dimensions=(24, 80),
            env=_safe_env(),
            cwd=str(Path.home()),
        )
    except Exception as e:
        await websocket.send_text(json.dumps({"type": "error", "error": str(e)}))
        await websocket.close()
        return

    now = datetime.now(timezone.utc).isoformat()
    info = SessionInfo(
        id=session_id,
        workingDir=str(Path.home()),
        shell=shell,
        status="active",
        createdAt=now,
        lastActivity=now,
    )
    data = _SessionData(info, pty)
    active_sessions[session_id] = data

    loop = asyncio.get_event_loop()

    async def read_pty() -> None:
        while True:
            try:
                chunk = await loop.run_in_executor(None, pty.read, 4096)
                if chunk:
                    text = chunk.decode("utf-8", errors="replace") if isinstance(chunk, bytes) else chunk
                    data.output.append(text)
                    if len(data.output) > MAX_OUTPUT_LINES:
                        data.output = data.output[-MAX_OUTPUT_LINES:]
                    data.info.lastActivity = datetime.now(timezone.utc).isoformat()
                    await websocket.send_bytes(chunk if isinstance(chunk, bytes) else chunk.encode())
            except Exception:
                break

    read_task = asyncio.create_task(read_pty())

    try:
        while True:
            msg = await websocket.receive()
            if "bytes" in msg:
                pty.write(msg["bytes"])
            elif "text" in msg:
                try:
                    parsed = json.loads(msg["text"])
                    if parsed.get("type") == "resize":
                        rows = int(parsed.get("rows", 24))
                        cols = int(parsed.get("cols", 80))
                        pty.setwinsize(rows, cols)
                    elif parsed.get("type") == "input":
                        pty.write(parsed.get("data", "").encode())
                    elif parsed.get("type") == "kill":
                        await _terminate_session(session_id)
                        break
                except (json.JSONDecodeError, ValueError):
                    pty.write(msg["text"].encode())
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        read_task.cancel()
        try:
            pty.terminate(force=True)
        except Exception:
            pass
        active_sessions.pop(session_id, None)


# ── REST endpoints ─────────────────────────────────────────────────────────

@rest_router.get("/sessions")
async def list_sessions() -> dict:
    active = [data.info.model_dump() for data in active_sessions.values()]

    # Also return history from disk
    history: list[dict] = []
    hist_dir = _history_dir()
    for f in sorted(hist_dir.glob("*.json"), reverse=True):
        try:
            record = json.loads(f.read_text())
            # Exclude 'output' from the listing
            record.pop("output", None)
            history.append(record)
        except Exception:
            continue

    return {"active": active, "history": history}


@rest_router.post("/sessions", status_code=201)
async def create_session(req: CreateSessionRequest) -> SessionInfo:
    session_id = str(uuid.uuid4())
    shell = _user_shell()
    working_dir = req.workingDir or str(Path.home())

    args: list[str] = [shell]

    try:
        pty = ptyprocess.PtyProcess.spawn(
            args,
            dimensions=(req.rows, req.cols),
            cwd=working_dir,
            env=_safe_env(),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to spawn process: {exc}")

    now = datetime.now(timezone.utc).isoformat()
    info = SessionInfo(
        id=session_id,
        agentSlug=req.agentSlug,
        workingDir=working_dir,
        shell=shell,
        status="active",
        createdAt=now,
        lastActivity=now,
    )
    active_sessions[session_id] = _SessionData(info, pty)
    return info


@rest_router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> SessionInfo:
    data = active_sessions.get(session_id)
    if data:
        return data.info
    # Check history
    hist_file = _history_dir() / f"{session_id}.json"
    if hist_file.exists():
        try:
            raw = json.loads(hist_file.read_text())
            raw.pop("output", None)
            return SessionInfo(**raw)
        except Exception:
            pass
    raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")


@rest_router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str) -> None:
    if session_id in active_sessions:
        await _terminate_session(session_id)
        return
    hist_file = _history_dir() / f"{session_id}.json"
    if hist_file.exists():
        hist_file.unlink()
        return
    raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")


@rest_router.get("/sessions/{session_id}/output")
async def get_session_output(session_id: str) -> dict:
    data = active_sessions.get(session_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found or not active")
    return {
        "sessionId": session_id,
        "output": "".join(data.output),
        "lineCount": len(data.output),
    }
