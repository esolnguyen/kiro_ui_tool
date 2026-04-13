from fastapi import APIRouter, HTTPException, Query

from app.models.ado import (
    AdoPbi, AdoPullRequest, AdoBoardColumn, AdoAreaPath, AdoConnectionStatus,
    AdoTestPlan, AdoTestSuite, AdoTestCase,
)
from app.services.ado_client import get_ado_client, get_connection_status

router = APIRouter()


def _require_client():
    client = get_ado_client()
    if not client:
        status = get_connection_status()
        raise HTTPException(
            status_code=503,
            detail=status.error or "Azure DevOps not configured. Set org, project, and PAT in Settings.",
        )
    return client


@router.get("/status", response_model=AdoConnectionStatus)
async def ado_status() -> AdoConnectionStatus:
    return get_connection_status()


@router.get("/pbis", response_model=list[AdoPbi])
async def list_pbis(
    work_item_type: str | None = Query(default=None),
    state: str | None = Query(default=None),
    area_path: str | None = Query(default=None),
    top: int = Query(default=50, ge=1, le=200),
) -> list[AdoPbi]:
    client = _require_client()
    try:
        return await client.list_pbis(work_item_type=work_item_type, state=state, area_path=area_path, top=top)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.get("/pbis/{work_item_id}", response_model=AdoPbi)
async def get_pbi(work_item_id: int) -> AdoPbi:
    client = _require_client()
    try:
        return await client.get_pbi(work_item_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.patch("/pbis/{work_item_id}/state", response_model=AdoPbi)
async def update_pbi_state(work_item_id: int, body: dict) -> AdoPbi:
    state = body.get("state", "")
    if not state:
        raise HTTPException(status_code=400, detail="'state' field is required")
    client = _require_client()
    try:
        return await client.update_pbi_state(work_item_id, state)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.get("/pull-requests", response_model=list[AdoPullRequest])
async def list_pull_requests(
    status: str = Query(default="active"),
    top: int = Query(default=50, ge=1, le=200),
) -> list[AdoPullRequest]:
    client = _require_client()
    try:
        return await client.list_pull_requests(status=status, top=top)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.get("/board/columns", response_model=list[AdoBoardColumn])
async def get_board_columns(team: str | None = Query(default=None)) -> list[AdoBoardColumn]:
    client = _require_client()
    try:
        return await client.get_board_columns(team=team)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.get("/area-paths", response_model=list[AdoAreaPath])
async def list_area_paths() -> list[AdoAreaPath]:
    client = _require_client()
    try:
        return await client.list_area_paths()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


# ── Test Plans ──────────────────────────────────────────────────────────────

@router.get("/test-plans", response_model=list[AdoTestPlan])
async def list_test_plans() -> list[AdoTestPlan]:
    client = _require_client()
    try:
        return await client.list_test_plans()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.get("/test-plans/{plan_id}", response_model=AdoTestPlan)
async def get_test_plan(plan_id: int) -> AdoTestPlan:
    client = _require_client()
    try:
        return await client.get_test_plan(plan_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.get("/test-plans/{plan_id}/suites", response_model=list[AdoTestSuite])
async def list_test_suites(plan_id: int) -> list[AdoTestSuite]:
    client = _require_client()
    try:
        return await client.list_test_suites(plan_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.get("/test-plans/{plan_id}/suites/{suite_id}/test-cases", response_model=list[AdoTestCase])
async def list_test_cases(plan_id: int, suite_id: int) -> list[AdoTestCase]:
    client = _require_client()
    try:
        return await client.list_test_cases(plan_id, suite_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.post("/test-plans", response_model=AdoTestPlan)
async def create_test_plan(body: dict) -> AdoTestPlan:
    name = body.get("name", "")
    if not name:
        raise HTTPException(status_code=400, detail="'name' field is required")
    client = _require_client()
    try:
        return await client.create_test_plan(
            name=name,
            area_path=body.get("areaPath", ""),
            iteration=body.get("iteration", ""),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.post("/test-plans/{plan_id}/suites", response_model=AdoTestSuite)
async def create_test_suite(plan_id: int, body: dict) -> AdoTestSuite:
    name = body.get("name", "")
    if not name:
        raise HTTPException(status_code=400, detail="'name' field is required")
    client = _require_client()
    try:
        return await client.create_test_suite(
            plan_id=plan_id,
            name=name,
            suite_type=body.get("suiteType", "staticTestSuite"),
            parent_suite_id=body.get("parentSuiteId"),
            requirement_id=body.get("requirementId"),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.post("/test-plans/{plan_id}/suites/{suite_id}/test-cases", response_model=list[AdoTestCase])
async def add_test_cases(plan_id: int, suite_id: int, body: dict) -> list[AdoTestCase]:
    test_case_ids = body.get("testCaseIds", [])
    if not test_case_ids:
        raise HTTPException(status_code=400, detail="'testCaseIds' list is required")
    client = _require_client()
    try:
        await client.add_test_case_to_suite(plan_id, suite_id, test_case_ids)
        return await client.list_test_cases(plan_id, suite_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")


@router.post("/test-cases", response_model=AdoTestCase)
async def create_test_case(body: dict) -> AdoTestCase:
    title = body.get("title", "")
    if not title:
        raise HTTPException(status_code=400, detail="'title' field is required")
    client = _require_client()
    try:
        return await client.create_test_case(
            title=title,
            steps=body.get("steps"),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure DevOps API error: {e}")
