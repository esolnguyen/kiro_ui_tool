"""Pipeline execution engine.

Orchestrates sequential stage execution:
- Resolves prompt templates ({{input.X}}, {{stages.Y.output}})
- Spawns kiro-cli sessions per stage via KiroSessionManager
- Manages stage lifecycle (pending → running → completed/failed)
- Evaluates gates (auto / approval / manual_input)
- Persists run state to ~/.kiro/pipeline-runs/
- Broadcasts updates via callback for WebSocket streaming
"""

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Awaitable

from app.core.kiro_dir import ensure_kiro_dir
from app.models.pipelines import (
    PipelineResponse,
    PipelineRun,
    StageExecution,
)
from app.services.kiro_session import session_manager


# ── Persistence ───────────────────────────────────────────────────────────

def _runs_dir() -> Path:
    d = ensure_kiro_dir() / "pipeline-runs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _run_path(run_id: str) -> Path:
    return _runs_dir() / f"{run_id}.json"


def save_run(run: PipelineRun) -> None:
    _run_path(run.id).write_text(run.model_dump_json(indent=2))


def load_run(run_id: str) -> PipelineRun | None:
    path = _run_path(run_id)
    if not path.exists():
        return None
    try:
        return PipelineRun(**json.loads(path.read_text()))
    except Exception:
        return None


def list_runs(pipeline_id: str | None = None) -> list[PipelineRun]:
    runs: list[PipelineRun] = []
    for path in sorted(_runs_dir().glob("*.json"), reverse=True):
        try:
            run = PipelineRun(**json.loads(path.read_text()))
            if pipeline_id and run.pipelineId != pipeline_id:
                continue
            runs.append(run)
        except Exception:
            continue
    return runs


def delete_run(run_id: str) -> bool:
    path = _run_path(run_id)
    if path.exists():
        path.unlink()
        return True
    return False


# ── Template resolution ───────────────────────────────────────────────────

_VAR_RE = re.compile(r"\{\{(.+?)\}\}")


def resolve_template(template: str, run: PipelineRun) -> str:
    """Replace {{input.X}}, {{stages.Y.output}}, and {{ado.pbi.*}} in a prompt template."""
    def replacer(match: re.Match) -> str:
        var = match.group(1).strip()

        # {{input.fieldName}}
        if var.startswith("input."):
            field_name = var[len("input."):]
            return str(run.input.get(field_name, ""))

        # {{stages.stageId.field}}
        if var.startswith("stages."):
            parts = var.split(".")
            if len(parts) >= 3:
                stage_id = parts[1]
                field = parts[2]
                for stage in run.stages:
                    if stage.id == stage_id:
                        return getattr(stage, field, "")
            return ""

        # {{ado.pbi.fieldName}} — reads from run.input["_ado_pbi"]
        if var.startswith("ado.pbi."):
            field_name = var[len("ado.pbi."):]
            ado_pbi = run.input.get("_ado_pbi", {})
            return str(ado_pbi.get(field_name, ""))

        return match.group(0)  # leave unrecognized vars as-is

    return _VAR_RE.sub(replacer, template)


# ── Run creation ──────────────────────────────────────────────────────────

async def create_run(pipeline: PipelineResponse, input_data: dict) -> PipelineRun:
    """Create a new pipeline run from a pipeline template.

    If input_data contains a 'pbiId', fetches the PBI from Azure DevOps
    and stores it as '_ado_pbi' for {{ado.pbi.*}} template variables.
    """
    # Fetch ADO PBI if pbiId is provided
    pbi_id = input_data.get("pbiId")
    if pbi_id:
        from app.services.ado_client import get_ado_client
        client = get_ado_client()
        if client:
            try:
                pbi = await client.get_pbi(int(pbi_id))
                input_data["_ado_pbi"] = pbi.model_dump()
            except Exception:
                pass  # PBI fetch failed — continue without it

    now = datetime.now(timezone.utc).isoformat()
    run = PipelineRun(
        id=str(uuid.uuid4()),
        pipelineId=pipeline.id,
        pipelineName=pipeline.name,
        status="pending",
        input=input_data,
        stages=[
            StageExecution(id=stage.id)
            for stage in pipeline.stages
        ],
        startedAt=now,
    )
    save_run(run)
    return run


# ── Type for update callbacks ─────────────────────────────────────────────

UpdateCallback = Callable[[PipelineRun, str], Awaitable[None]]
"""Signature: async callback(run, event_type) where event_type is
   'stage_start' | 'stage_output' | 'stage_complete' | 'stage_failed' |
   'run_complete' | 'waiting_approval' | 'waiting_input' | 'rejected'
"""


# ── Engine ────────────────────────────────────────────────────────────────

async def execute_run(
    run: PipelineRun,
    pipeline: PipelineResponse,
    on_update: UpdateCallback | None = None,
) -> PipelineRun:
    """Execute a pipeline run stage by stage.

    This is the main engine loop. It runs stages sequentially, resolving
    templates, spawning kiro-cli sessions, and evaluating gates.

    If a stage has gate='approval', execution pauses and returns.
    Call resume_run() after approval to continue.
    """
    run.status = "running"
    save_run(run)

    for i, stage_def in enumerate(pipeline.stages):
        stage_exec = run.stages[i]

        # Skip already completed stages (for resume after approval)
        if stage_exec.status == "completed":
            continue

        # Skip if we hit a waiting stage that hasn't been resolved yet
        if stage_exec.status == "waiting_approval":
            run.status = "waiting_approval"
            save_run(run)
            if on_update:
                await on_update(run, "waiting_approval")
            return run

        if stage_exec.status == "waiting_input":
            run.status = "waiting_input"
            save_run(run)
            if on_update:
                await on_update(run, "waiting_input")
            return run

        # Mark stage as running
        stage_exec.status = "running"
        stage_exec.startedAt = datetime.now(timezone.utc).isoformat()
        save_run(run)
        if on_update:
            await on_update(run, "stage_start")

        # Resolve prompt template
        prompt = resolve_template(stage_def.prompt, run)

        # Execute via kiro-cli
        try:
            handle = session_manager.spawn_session(
                agent=stage_def.agentSlug,
            )

            # Drain startup output
            async for _ in session_manager.read_output(handle.id, idle_timeout=2.0):
                pass

            # Send the prompt
            session_manager.send_input(handle.id, prompt + "\n")

            # Collect output
            full_output = ""
            async for chunk in session_manager.read_output(handle.id, idle_timeout=10.0):
                full_output += chunk
                stage_exec.output = full_output
                save_run(run)
                if on_update:
                    await on_update(run, "stage_output")

            # Stage completed
            stage_exec.status = "completed"
            stage_exec.output = full_output
            stage_exec.completedAt = datetime.now(timezone.utc).isoformat()
            save_run(run)

            # Terminate this stage's session
            session_manager.terminate_session(handle.id)

            if on_update:
                await on_update(run, "stage_complete")

        except Exception as e:
            stage_exec.status = "failed"
            stage_exec.error = str(e)
            stage_exec.completedAt = datetime.now(timezone.utc).isoformat()
            run.status = "failed"
            save_run(run)
            if on_update:
                await on_update(run, "stage_failed")
            return run

        # Evaluate gate
        if stage_def.gate == "approval":
            stage_exec.status = "waiting_approval"
            run.status = "waiting_approval"
            save_run(run)
            if on_update:
                await on_update(run, "waiting_approval")
            return run

        if stage_def.gate == "manual_input":
            stage_exec.status = "waiting_input"
            run.status = "waiting_input"
            save_run(run)
            if on_update:
                await on_update(run, "waiting_input")
            return run

        # gate == "auto" → continue to next stage

    # All stages completed
    run.status = "completed"
    run.completedAt = datetime.now(timezone.utc).isoformat()
    save_run(run)
    if on_update:
        await on_update(run, "run_complete")
    return run


async def approve_stage(run_id: str, stage_id: str) -> PipelineRun | None:
    """Approve a waiting stage and prepare the run for resumption."""
    run = load_run(run_id)
    if not run:
        return None

    for stage in run.stages:
        if stage.id == stage_id and stage.status == "waiting_approval":
            stage.status = "completed"
            stage.completedAt = datetime.now(timezone.utc).isoformat()
            run.status = "running"
            save_run(run)
            return run

    return None


async def reject_stage(run_id: str, stage_id: str) -> PipelineRun | None:
    """Reject a waiting_approval stage, marking the run as failed."""
    run = load_run(run_id)
    if not run:
        return None

    for stage in run.stages:
        if stage.id == stage_id and stage.status == "waiting_approval":
            stage.status = "failed"
            stage.error = "Rejected by user"
            stage.completedAt = datetime.now(timezone.utc).isoformat()
            run.status = "failed"
            save_run(run)
            return run

    return None


async def submit_input(run_id: str, stage_id: str, user_input: str) -> PipelineRun | None:
    """Submit user input for a waiting_input stage and prepare for resumption."""
    run = load_run(run_id)
    if not run:
        return None

    for stage in run.stages:
        if stage.id == stage_id and stage.status == "waiting_input":
            stage.userInput = user_input
            stage.status = "completed"
            stage.completedAt = datetime.now(timezone.utc).isoformat()
            run.status = "running"
            save_run(run)
            return run

    return None


async def retry_stage(run_id: str, stage_id: str) -> PipelineRun | None:
    """Reset a failed stage to pending so it can be re-executed."""
    run = load_run(run_id)
    if not run:
        return None

    for stage in run.stages:
        if stage.id == stage_id and stage.status == "failed":
            stage.status = "pending"
            stage.output = ""
            stage.error = ""
            stage.startedAt = ""
            stage.completedAt = ""
            run.status = "running"
            save_run(run)
            return run

    return None
