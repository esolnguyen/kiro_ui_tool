"""Advisor Strategy service.

Implements the Executor/Advisor pattern:
- Executor (e.g. Sonnet) runs the main loop
- Advisor (e.g. Opus) is called on-demand for higher-level guidance
- Both share the same conversation context
"""

import asyncio
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field

from app.services.kiro_session import session_manager


@dataclass
class AdvisorSession:
    id: str
    executor_session_id: str
    advisor_kiro_session_id: str | None = None
    advisor_agent: str | None = None
    advisor_model: str = "opus"
    history: list[dict] = field(default_factory=list)


_advisor_sessions: dict[str, AdvisorSession] = {}


def create_advisor_session(
    executor_session_id: str,
    advisor_model: str = "opus",
    advisor_agent: str | None = None,
) -> AdvisorSession:
    session = AdvisorSession(
        id=str(uuid.uuid4()),
        executor_session_id=executor_session_id,
        advisor_model=advisor_model,
        advisor_agent=advisor_agent,
    )
    _advisor_sessions[session.id] = session
    return session


async def ask_advisor(
    advisor_session_id: str,
    context: str,
    question: str,
) -> str:
    """Send context + question to the advisor agent and return its advice."""
    session = _advisor_sessions.get(advisor_session_id)
    if not session:
        raise ValueError(f"Advisor session '{advisor_session_id}' not found")

    # Lazy-spawn the advisor's kiro-cli session
    if not session.advisor_kiro_session_id:
        handle = session_manager.spawn_session(agent=session.advisor_agent)
        session.advisor_kiro_session_id = handle.id
        # Drain startup
        async for _ in session_manager.read_output(handle.id, idle_timeout=2.0):
            pass

    prompt = f"""You are acting as an Advisor. A less powerful Executor model is handling the main work loop and has asked for your guidance.

## Shared Context
{context}

## Executor's Question
{question}

Provide clear, actionable advice. Be specific about what the Executor should do next."""

    session_manager.send_input(session.advisor_kiro_session_id, prompt + "\n")

    advice = ""
    async for chunk in session_manager.read_output(session.advisor_kiro_session_id, idle_timeout=10.0):
        advice += chunk

    session.history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "question": question,
        "advice": advice,
    })

    return advice


def get_advisor_session(advisor_session_id: str) -> AdvisorSession | None:
    return _advisor_sessions.get(advisor_session_id)


def terminate_advisor_session(advisor_session_id: str) -> None:
    session = _advisor_sessions.pop(advisor_session_id, None)
    if session and session.advisor_kiro_session_id:
        session_manager.terminate_session(session.advisor_kiro_session_id)


def list_advisor_sessions() -> list[dict]:
    return [
        {
            "id": s.id,
            "executorSessionId": s.executor_session_id,
            "advisorModel": s.advisor_model,
            "advisorAgent": s.advisor_agent,
            "historyCount": len(s.history),
        }
        for s in _advisor_sessions.values()
    ]
