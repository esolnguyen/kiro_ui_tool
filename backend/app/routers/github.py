import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.models.github import ScanResult, ImportRequest, UpdateRequest
from app.services.github_sync import (
    git_clone, git_get_head, git_pull, git_ls_remote,
    detect_skills, detect_agents, parse_github_url,
    copy_items_to_kiro, load_imports, save_imports,
)
from app.core.kiro_dir import get_kiro_dir, ensure_kiro_dir

router = APIRouter()


@router.post("/scan", response_model=ScanResult)
async def scan_github_repo(body: dict) -> ScanResult:
    url: str = body.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    parsed = parse_github_url(url)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid GitHub URL")

    owner, repo, subpath = parsed
    repo_url = f"https://github.com/{owner}/{repo}.git"
    target_path = subpath or ""

    with tempfile.TemporaryDirectory(prefix="kiro-scan-") as tmp:
        try:
            git_clone(repo_url, tmp)
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=f"Clone failed: {exc}")

        base = Path(tmp)
        skills, detection_method = detect_skills(base, target_path)
        agents = detect_agents(base, target_path)

        kiro_dir = get_kiro_dir()
        for skill in skills:
            skill.conflict = (kiro_dir / "skills" / skill.slug / "SKILL.md").exists()
        for agent in agents:
            agent.conflict = (kiro_dir / "agents" / f"{agent.slug}.md").exists()

        return ScanResult(
            owner=owner,
            repo=repo,
            targetPath=target_path,
            skills=skills,
            agents=agents,
            totalSkills=len(skills),
            totalAgents=len(agents),
            detectionMethod=detection_method,
        )


@router.post("/import")
async def import_from_github(req: ImportRequest) -> dict:
    parsed = parse_github_url(req.repoUrl)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid GitHub URL")

    owner, repo, _ = parsed
    repo_url = f"https://github.com/{owner}/{repo}.git"
    kiro_dir = ensure_kiro_dir()

    clone_base = kiro_dir / "github" / owner / repo
    clone_base.parent.mkdir(parents=True, exist_ok=True)

    if not clone_base.exists():
        try:
            git_clone(repo_url, str(clone_base))
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=f"Clone failed: {exc}")

    sha = git_get_head(str(clone_base))
    now = datetime.now(timezone.utc).isoformat()

    copy_items_to_kiro(clone_base, req.targetPath, set(req.selectedItems))

    record = {
        "id": str(uuid.uuid4()),
        "repoUrl": req.repoUrl,
        "owner": owner,
        "repo": repo,
        "clonePath": str(clone_base),
        "importedAt": now,
        "lastChecked": now,
        "currentSha": sha,
        "remoteSha": sha,
        "selectedItems": req.selectedItems,
        "targetPath": req.targetPath,
        "itemType": req.type,
    }

    imports = load_imports()
    imports.append(record)
    save_imports(imports)

    return record


@router.get("/imports")
async def list_imports() -> list[dict]:
    return load_imports()


@router.post("/check-updates")
async def check_updates() -> list[dict]:
    imports = load_imports()
    results = []
    for record in imports:
        remote_sha = ""
        try:
            remote_sha = git_ls_remote(record["repoUrl"])
        except Exception:
            pass
        has_update = bool(remote_sha) and remote_sha != record.get("currentSha", "")
        record["remoteSha"] = remote_sha
        record["hasUpdate"] = has_update
        results.append(record)
    save_imports(results)
    return results


@router.post("/update")
async def update_import(req: UpdateRequest) -> dict:
    imports = load_imports()
    record = next((r for r in imports if r["id"] == req.importId), None)
    if not record:
        raise HTTPException(status_code=404, detail="Import not found")

    clone_path = record.get("clonePath", "")
    if not clone_path or not Path(clone_path).exists():
        raise HTTPException(status_code=400, detail="Clone path not found; re-import required")

    try:
        git_pull(clone_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=f"Pull failed: {exc}")

    sha = git_get_head(clone_path)
    target_path = record.get("targetPath", "")
    selected_set = set(req.selectedItems or record.get("selectedItems", []))

    copy_items_to_kiro(Path(clone_path), target_path, selected_set)

    record["currentSha"] = sha
    record["remoteSha"] = sha
    record["lastChecked"] = datetime.now(timezone.utc).isoformat()
    if req.selectedItems:
        record["selectedItems"] = req.selectedItems

    save_imports(imports)
    return record


@router.delete("/imports/{import_id}", status_code=204)
async def delete_import(import_id: str) -> None:
    imports = load_imports()
    record = next((r for r in imports if r["id"] == import_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Import not found")

    clone_path = record.get("clonePath", "")
    if clone_path and Path(clone_path).exists():
        try:
            shutil.rmtree(clone_path, ignore_errors=True)
        except Exception:
            pass

    new_imports = [r for r in imports if r["id"] != import_id]
    save_imports(new_imports)
