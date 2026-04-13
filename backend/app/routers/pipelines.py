import asyncio
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pathlib import Path

from app.models.pipelines import (
    PipelineCreate,
    PipelineResponse,
    PipelineRun,
    PipelineRunCreate,
)
from app.core.kiro_dir import ensure_kiro_dir
from app.core.slugify import slugify
from app.services import pipeline_engine

router = APIRouter()
ws_router = APIRouter()


# ── Pipeline template helpers ─────────────────────────────────────────────

def _pipelines_dir() -> Path:
    d = ensure_kiro_dir() / "pipelines"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _read_pipeline(path: Path) -> PipelineResponse:
    data = json.loads(path.read_text())
    return PipelineResponse(**data)


def _find_pipeline(pipeline_id: str) -> PipelineResponse:
    for path in _pipelines_dir().glob("*.json"):
        try:
            p = _read_pipeline(path)
            if p.id == pipeline_id:
                return p
        except Exception:
            continue
    raise HTTPException(status_code=404, detail=f"Pipeline '{pipeline_id}' not found")


# ── Pipeline template CRUD ────────────────────────────────────────────────

@router.get("", response_model=list[PipelineResponse])
def list_pipelines() -> list[PipelineResponse]:
    pipelines: list[PipelineResponse] = []
    for path in sorted(_pipelines_dir().glob("*.json")):
        try:
            pipelines.append(_read_pipeline(path))
        except Exception:
            continue
    return pipelines


@router.get("/{pipeline_id}", response_model=PipelineResponse)
def get_pipeline(pipeline_id: str) -> PipelineResponse:
    return _find_pipeline(pipeline_id)


@router.post("", response_model=PipelineResponse, status_code=201)
def create_pipeline(data: PipelineCreate) -> PipelineResponse:
    pipeline_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    slug = slugify(data.name)
    path = _pipelines_dir() / f"{slug}-{pipeline_id[:8]}.json"
    pipeline = PipelineResponse(
        id=pipeline_id,
        createdAt=created_at,
        **data.model_dump(),
    )
    path.write_text(pipeline.model_dump_json(indent=2))
    return pipeline


@router.put("/{pipeline_id}", response_model=PipelineResponse)
def update_pipeline(pipeline_id: str, data: PipelineCreate) -> PipelineResponse:
    for path in _pipelines_dir().glob("*.json"):
        try:
            existing = _read_pipeline(path)
            if existing.id == pipeline_id:
                updated = PipelineResponse(
                    id=pipeline_id,
                    createdAt=existing.createdAt,
                    **data.model_dump(),
                )
                path.write_text(updated.model_dump_json(indent=2))
                return updated
        except Exception:
            continue
    raise HTTPException(status_code=404, detail=f"Pipeline '{pipeline_id}' not found")


@router.delete("/{pipeline_id}", status_code=204)
def delete_pipeline(pipeline_id: str) -> None:
    for path in _pipelines_dir().glob("*.json"):
        try:
            p = _read_pipeline(path)
            if p.id == pipeline_id:
                path.unlink()
                return
        except Exception:
            continue
    raise HTTPException(status_code=404, detail=f"Pipeline '{pipeline_id}' not found")


# ── Pipeline Runs ─────────────────────────────────────────────────────────

# Active WebSocket subscribers per run_id
_run_subscribers: dict[str, list[WebSocket]] = {}


async def _broadcast(run: PipelineRun, event_type: str) -> None:
    """Send run state to all WebSocket subscribers."""
    sockets = _run_subscribers.get(run.id, [])
    msg = json.dumps({
        "type": event_type,
        "run": run.model_dump(),
    })
    dead: list[WebSocket] = []
    for ws in sockets:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        sockets.remove(ws)


@router.post("/runs", response_model=PipelineRun, status_code=201)
async def start_pipeline_run(data: PipelineRunCreate) -> PipelineRun:
    pipeline = _find_pipeline(data.pipelineId)
    run = await pipeline_engine.create_run(pipeline, data.input)

    # Start execution in background
    async def _run_in_background():
        await pipeline_engine.execute_run(run, pipeline, on_update=_broadcast)

    asyncio.create_task(_run_in_background())
    return run


@router.get("/runs", response_model=list[PipelineRun])
def list_pipeline_runs(pipeline_id: str | None = None) -> list[PipelineRun]:
    return pipeline_engine.list_runs(pipeline_id)


@router.get("/runs/{run_id}", response_model=PipelineRun)
def get_pipeline_run(run_id: str) -> PipelineRun:
    run = pipeline_engine.load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    return run


@router.delete("/runs/{run_id}", status_code=204)
def delete_pipeline_run(run_id: str) -> None:
    if not pipeline_engine.delete_run(run_id):
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")


@router.post("/runs/{run_id}/stages/{stage_id}/approve", response_model=PipelineRun)
async def approve_stage(run_id: str, stage_id: str) -> PipelineRun:
    run = await pipeline_engine.approve_stage(run_id, stage_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run or stage not found, or stage not waiting approval")

    # Resume execution from the next stage
    pipeline = _find_pipeline(run.pipelineId)

    async def _resume():
        await pipeline_engine.execute_run(run, pipeline, on_update=_broadcast)

    asyncio.create_task(_resume())
    return run


@router.post("/runs/{run_id}/stages/{stage_id}/reject", response_model=PipelineRun)
async def reject_stage(run_id: str, stage_id: str) -> PipelineRun:
    run = await pipeline_engine.reject_stage(run_id, stage_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run or stage not found, or stage not waiting approval")
    await _broadcast(run, "rejected")
    return run


@router.post("/runs/{run_id}/stages/{stage_id}/submit-input", response_model=PipelineRun)
async def submit_stage_input(run_id: str, stage_id: str, body: dict) -> PipelineRun:
    user_input = body.get("input", "")
    if not user_input:
        raise HTTPException(status_code=400, detail="'input' field is required")

    run = await pipeline_engine.submit_input(run_id, stage_id, user_input)
    if not run:
        raise HTTPException(status_code=404, detail="Run or stage not found, or stage not waiting input")

    # Resume execution
    pipeline = _find_pipeline(run.pipelineId)

    async def _resume():
        await pipeline_engine.execute_run(run, pipeline, on_update=_broadcast)

    asyncio.create_task(_resume())
    return run


@router.post("/runs/{run_id}/stages/{stage_id}/retry", response_model=PipelineRun)
async def retry_stage(run_id: str, stage_id: str) -> PipelineRun:
    run = await pipeline_engine.retry_stage(run_id, stage_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run or stage not found, or stage not failed")

    # Resume execution
    pipeline = _find_pipeline(run.pipelineId)

    async def _resume():
        await pipeline_engine.execute_run(run, pipeline, on_update=_broadcast)

    asyncio.create_task(_resume())
    return run


# ── WebSocket: live run updates ───────────────────────────────────────────

@ws_router.websocket("/pipeline-runs/{run_id}")
async def pipeline_run_ws(websocket: WebSocket, run_id: str) -> None:
    await websocket.accept()

    # Verify run exists
    run = pipeline_engine.load_run(run_id)
    if not run:
        await websocket.send_text(json.dumps({
            "type": "error",
            "error": f"Run '{run_id}' not found",
        }))
        await websocket.close()
        return

    # Send current state
    await websocket.send_text(json.dumps({
        "type": "snapshot",
        "run": run.model_dump(),
    }))

    # Subscribe to updates
    if run_id not in _run_subscribers:
        _run_subscribers[run_id] = []
    _run_subscribers[run_id].append(websocket)

    try:
        # Keep connection alive — wait for client disconnect
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        subs = _run_subscribers.get(run_id, [])
        if websocket in subs:
            subs.remove(websocket)
        if not subs:
            _run_subscribers.pop(run_id, None)
