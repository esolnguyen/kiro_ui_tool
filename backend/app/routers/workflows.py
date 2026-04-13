import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pathlib import Path

from app.models.workflows import WorkflowCreate, WorkflowResponse
from app.core.kiro_dir import ensure_kiro_dir
from app.core.slugify import slugify

router = APIRouter()


def _workflows_dir() -> Path:
    return ensure_kiro_dir() / "workflows"


def _read_workflow(path: Path) -> WorkflowResponse:
    data = json.loads(path.read_text())
    return WorkflowResponse(**data)


@router.get("", response_model=list[WorkflowResponse])
def list_workflows() -> list[WorkflowResponse]:
    wf_dir = _workflows_dir()
    workflows: list[WorkflowResponse] = []
    for path in sorted(wf_dir.glob("*.json")):
        try:
            workflows.append(_read_workflow(path))
        except Exception:
            continue
    return workflows


@router.get("/{wf_id}", response_model=WorkflowResponse)
def get_workflow(wf_id: str) -> WorkflowResponse:
    wf_dir = _workflows_dir()
    for path in wf_dir.glob("*.json"):
        try:
            wf = _read_workflow(path)
            if wf.id == wf_id:
                return wf
        except Exception:
            continue
    raise HTTPException(status_code=404, detail=f"Workflow '{wf_id}' not found")


@router.post("", response_model=WorkflowResponse, status_code=201)
def create_workflow(data: WorkflowCreate) -> WorkflowResponse:
    wf_dir = _workflows_dir()
    wf_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    slug = slugify(data.name)
    path = wf_dir / f"{slug}-{wf_id[:8]}.json"
    wf = WorkflowResponse(
        id=wf_id,
        name=data.name,
        description=data.description,
        steps=data.steps,
        createdAt=created_at,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(wf.model_dump_json(indent=2))
    return wf


@router.put("/{wf_id}", response_model=WorkflowResponse)
def update_workflow(wf_id: str, data: WorkflowCreate) -> WorkflowResponse:
    wf_dir = _workflows_dir()
    for path in wf_dir.glob("*.json"):
        try:
            existing = _read_workflow(path)
            if existing.id == wf_id:
                updated = WorkflowResponse(
                    id=wf_id,
                    name=data.name,
                    description=data.description,
                    steps=data.steps,
                    createdAt=existing.createdAt,
                )
                path.write_text(updated.model_dump_json(indent=2))
                return updated
        except Exception:
            continue
    raise HTTPException(status_code=404, detail=f"Workflow '{wf_id}' not found")


@router.delete("/{wf_id}", status_code=204)
def delete_workflow(wf_id: str) -> None:
    wf_dir = _workflows_dir()
    for path in wf_dir.glob("*.json"):
        try:
            wf = _read_workflow(path)
            if wf.id == wf_id:
                path.unlink()
                return
        except Exception:
            continue
    raise HTTPException(status_code=404, detail=f"Workflow '{wf_id}' not found")
