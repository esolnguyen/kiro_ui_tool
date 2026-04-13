"""Background kiro-cli session manager.

Manages the lifecycle of background kiro-cli processes:
- Auth check (credential validation before spawning)
- Spawn / terminate background pty sessions
- Send prompts and stream responses
- Health status reporting
"""

import asyncio
import os
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator

import ptyprocess

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b[()][AB012]|\x1b\[\??\d*[hlm]")

from app.core.cli import detect_kiro_cli


@dataclass
class CliStatus:
    cli_path: str
    cli_found: bool
    error: str = ""


@dataclass
class SessionHandle:
    id: str
    pty: ptyprocess.PtyProcess
    agent: str | None = None
    created_at: str = ""
    output_buffer: list[str] = field(default_factory=list)
    _stopped: bool = False


_SAFE_ENV_KEYS = {
    "HOME", "USER", "SHELL", "PATH", "LANG", "LC_ALL", "TERM",
    "EDITOR", "VISUAL", "KIRO_DIR", "KIRO_CLI_PATH",
}

MAX_OUTPUT_LINES = 10_000


def _safe_env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if k in _SAFE_ENV_KEYS or k.startswith("LC_")}
    env["TERM"] = "xterm-256color"
    return env


class KiroSessionManager:
    """Manages background kiro-cli processes."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionHandle] = {}

    # ── CLI detection ─────────────────────────────────────────────────────

    def check_cli(self) -> CliStatus:
        """Check if kiro-cli is available on the system."""
        cli_path, cli_found = detect_kiro_cli()
        if not cli_found:
            return CliStatus(
                cli_path=cli_path,
                cli_found=False,
                error="Kiro CLI not found. Set KIRO_CLI_PATH or install kiro.",
            )
        return CliStatus(cli_path=cli_path, cli_found=True)

    # ── Session lifecycle ─────────────────────────────────────────────────

    def spawn_session(self, agent: str | None = None, working_dir: str | None = None) -> SessionHandle:
        """Spawn a new background kiro-cli pty session."""
        from app.core.cli import get_kiro_cli

        cli = get_kiro_cli()
        cwd = working_dir or str(Path.home())

        env = _safe_env()

        # Build command — start an interactive kiro-cli session
        cmd = [cli]
        if agent:
            cmd += ["--agent", agent]

        pty = ptyprocess.PtyProcess.spawn(
            cmd,
            dimensions=(24, 120),
            env=env,
            cwd=cwd,
        )

        session_id = str(uuid.uuid4())
        handle = SessionHandle(
            id=session_id,
            pty=pty,
            agent=agent,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._sessions[session_id] = handle
        return handle

    def get_session(self, session_id: str) -> SessionHandle | None:
        return self._sessions.get(session_id)

    @property
    def active_sessions(self) -> dict[str, SessionHandle]:
        return self._sessions

    def terminate_session(self, session_id: str) -> None:
        """Terminate a background session."""
        handle = self._sessions.pop(session_id, None)
        if handle:
            handle._stopped = True
            try:
                handle.pty.terminate(force=True)
            except Exception:
                pass

    def terminate_all(self) -> None:
        """Terminate all background sessions. Called on app shutdown."""
        for sid in list(self._sessions):
            self.terminate_session(sid)

    # ── I/O ───────────────────────────────────────────────────────────────

    def send_input(self, session_id: str, text: str) -> None:
        """Send raw text input to a session's pty."""
        handle = self._sessions.get(session_id)
        if not handle:
            raise ValueError(f"Session '{session_id}' not found")
        handle.pty.write(text.encode())

    def _blocking_read(self, handle: SessionHandle, size: int = 4096) -> str | None:
        """Blocking read with a short internal timeout so the thread can check _stopped."""
        import select
        fd = handle.pty.fd
        # Wait up to 0.5s for data; return None if nothing available
        r, _, _ = select.select([fd], [], [], 0.5)
        if not r:
            return None
        chunk = os.read(fd, size)
        if not chunk:
            raise EOFError
        return chunk.decode("utf-8", errors="replace") if isinstance(chunk, bytes) else chunk

    async def read_output(
        self, session_id: str, idle_timeout: float = 3.0, strip_ansi: bool = True,
    ) -> AsyncIterator[str]:
        """Async generator that yields output chunks from the pty.

        Stops after *idle_timeout* seconds of silence (response complete).
        """
        handle = self._sessions.get(session_id)
        if not handle:
            raise ValueError(f"Session '{session_id}' not found")

        loop = asyncio.get_event_loop()
        idle_elapsed = 0.0
        poll_interval = 0.5  # matches select timeout in _blocking_read

        while not handle._stopped:
            try:
                text = await loop.run_in_executor(None, self._blocking_read, handle)
            except EOFError:
                break
            except Exception:
                break

            if handle._stopped:
                break

            if text is None:
                # No data this cycle — accumulate idle time
                idle_elapsed += poll_interval
                if idle_elapsed >= idle_timeout:
                    break
                continue

            # Got data — reset idle timer
            idle_elapsed = 0.0
            if strip_ansi:
                text = _ANSI_RE.sub("", text)
            handle.output_buffer.append(text)
            if len(handle.output_buffer) > MAX_OUTPUT_LINES:
                handle.output_buffer = handle.output_buffer[-MAX_OUTPUT_LINES:]
            yield text

    def get_output(self, session_id: str) -> str:
        """Get the buffered output for a session."""
        handle = self._sessions.get(session_id)
        if not handle:
            raise ValueError(f"Session '{session_id}' not found")
        return "".join(handle.output_buffer)

    # ── Health ────────────────────────────────────────────────────────────

    def health(self) -> dict:
        """Return health status dict for the /api/health endpoint."""
        status = self.check_cli()
        return {
            "cliPath": status.cli_path,
            "cliFound": status.cli_found,
            "activeSessions": len(self._sessions),
            "error": status.error,
        }


# ── Module-level singleton ────────────────────────────────────────────────

session_manager = KiroSessionManager()
