import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.core.kiro_dir import get_kiro_dir, ensure_kiro_dir
from app.services.kiro_session import session_manager

router = APIRouter()
ws_router = APIRouter()  # mounted at /ws


# ── Helpers ────────────────────────────────────────────────────────────────

def _chat_sessions_dir() -> Path:
    kiro_dir = ensure_kiro_dir()
    d = kiro_dir / "chat-sessions"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _session_file(session_id: str) -> Path:
    return _chat_sessions_dir() / f"{session_id}.jsonl"


def _append_message(session_id: str, message: dict) -> None:
    path = _session_file(session_id)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(message, ensure_ascii=False) + "\n")


# ── Core: send message via KiroSessionManager ────────────────────────────

# Map chat session IDs to their background kiro-cli session IDs
_chat_to_kiro: dict[str, str] = {}


async def _run_kiro_query(
    message: str,
    agent_slug: str | None,
    websocket: WebSocket,
    chat_session_id: str,
) -> None:
    """
    Sends a message to a background kiro-cli session and streams output
    back to the WebSocket.
    """
    cli_status = session_manager.check_cli()
    if not cli_status.cli_found:
        await websocket.send_text(json.dumps({
            "type": "error",
            "error": cli_status.error or "Kiro CLI not found. Set KIRO_CLI_PATH or install kiro.",
        }))
        return

    # Get or create a kiro-cli session for this chat
    kiro_session_id = _chat_to_kiro.get(chat_session_id)
    handle = session_manager.get_session(kiro_session_id) if kiro_session_id else None

    if not handle:
        try:
            handle = session_manager.spawn_session(agent=agent_slug)
            _chat_to_kiro[chat_session_id] = handle.id
            # Drain startup output (banner, initial prompt)
            async for _ in session_manager.read_output(handle.id, idle_timeout=2.0):
                pass
        except Exception as e:
            await websocket.send_text(json.dumps({
                "type": "error",
                "error": f"Failed to start kiro-cli: {e}",
            }))
            return

    # Send the message to the pty (append newline to submit)
    session_manager.send_input(handle.id, message + "\n")

    # Stream output back to the WebSocket
    full_text = ""
    try:
        async for chunk in session_manager.read_output(handle.id):
            full_text += chunk
            await websocket.send_text(json.dumps({
                "type": "text_delta",
                "content": chunk,
            }))
    except Exception:
        pass

    # Save assistant message
    _append_message(chat_session_id, {
        "type": "assistant",
        "message": {"role": "assistant", "content": full_text},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sessionId": chat_session_id,
    })

    await websocket.send_text(json.dumps({
        "type": "complete",
        "sessionId": chat_session_id,
        "usage": {},
    }))


# ── WebSocket handler ──────────────────────────────────────────────────────

async def _chat_handler(websocket: WebSocket) -> None:
    await websocket.accept()

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "error": "Invalid JSON"}))
                continue

            if msg.get("type") != "start":
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "error": f"Unknown message type: {msg.get('type')}",
                }))
                continue

            chat_session_id: str = msg.get("sessionId") or str(uuid.uuid4())
            user_text: str = msg.get("message", "")
            agent_slug: str | None = msg.get("agentSlug")

            # Save user message
            _append_message(chat_session_id, {
                "type": "user",
                "message": {"role": "user", "content": user_text},
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "sessionId": chat_session_id,
            })

            await _run_kiro_query(user_text, agent_slug, websocket, chat_session_id)

    except WebSocketDisconnect:
        pass


# ── REST session endpoints ─────────────────────────────────────────────────

@router.get("/sessions")
async def list_chat_sessions() -> list[dict]:
    sessions_dir = _chat_sessions_dir()
    sessions: list[dict] = []
    for path in sorted(sessions_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True):
        session_id = path.stem
        message_count = 0
        last_activity = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
        summary = "New Session"
        try:
            with open(path, "r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        message_count += 1
                        if summary == "New Session" and entry.get("type") == "user":
                            content = entry.get("message", {}).get("content", "")
                            if isinstance(content, str) and content.strip():
                                summary = content.strip()[:80]
                                if len(content) > 80:
                                    summary += "..."
                    except Exception:
                        continue
        except Exception:
            pass
        sessions.append({
            "id": session_id,
            "summary": summary,
            "messageCount": message_count,
            "lastActivity": last_activity,
        })
    return sessions


@router.get("/sessions/{session_id}")
async def get_chat_session(
    session_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    path = _session_file(session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

    messages: list[dict] = []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    try:
                        messages.append(json.loads(line))
                    except Exception:
                        continue
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    total = len(messages)
    return {
        "id": session_id,
        "messages": messages[offset: offset + limit],
        "total": total,
        "hasMore": offset + limit < total,
    }


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_chat_session(session_id: str) -> None:
    path = _session_file(session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    # Also terminate the kiro-cli session if active
    kiro_sid = _chat_to_kiro.pop(session_id, None)
    if kiro_sid:
        session_manager.terminate_session(kiro_sid)
    path.unlink()


# ── WebSocket route decorators ─────────────────────────────────────────────

@router.websocket("/ws")
async def chat_ws_on_api_router(websocket: WebSocket) -> None:
    await _chat_handler(websocket)


@ws_router.websocket("/chat")
async def chat_ws_on_ws_router(websocket: WebSocket) -> None:
    await _chat_handler(websocket)
