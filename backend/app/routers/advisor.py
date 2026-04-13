"""Advisor Strategy API endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.advisor import (
    create_advisor_session,
    ask_advisor,
    get_advisor_session,
    terminate_advisor_session,
    list_advisor_sessions,
)

router = APIRouter()


class CreateAdvisorRequest(BaseModel):
    executorSessionId: str
    advisorModel: str = "opus"
    advisorAgent: str | None = None


class AskAdvisorRequest(BaseModel):
    context: str
    question: str


@router.post("/sessions", status_code=201)
def create_session(req: CreateAdvisorRequest) -> dict:
    session = create_advisor_session(
        executor_session_id=req.executorSessionId,
        advisor_model=req.advisorModel,
        advisor_agent=req.advisorAgent,
    )
    return {"id": session.id, "advisorModel": session.advisor_model}


@router.get("/sessions")
def list_sessions() -> list[dict]:
    return list_advisor_sessions()


@router.post("/sessions/{session_id}/ask")
async def ask(session_id: str, req: AskAdvisorRequest) -> dict:
    try:
        advice = await ask_advisor(session_id, req.context, req.question)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"advice": advice}


@router.get("/sessions/{session_id}/history")
def get_history(session_id: str) -> list[dict]:
    session = get_advisor_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Advisor session not found")
    return session.history


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str) -> None:
    terminate_advisor_session(session_id)
