"""Generate endpoint — builds prompt and writes to temp file for kiro-cli."""

import tempfile
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.generate import build_generation_prompt

router = APIRouter()


class GenerateRequest(BaseModel):
    entityType: str  # agent | skill | command
    description: str


@router.post("/prompt")
def get_generate_prompt(req: GenerateRequest) -> dict:
    """Build the prompt, write it to a temp file, return the path."""
    prompt = build_generation_prompt(req.entityType, req.description)
    tmp = tempfile.NamedTemporaryFile(
        mode="w", prefix="kiro-generate-", suffix=".txt", delete=False
    )
    tmp.write(prompt)
    tmp.close()
    return {"prompt": prompt, "tmpFile": tmp.name}
