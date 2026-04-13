"""Knowledge base management for agents.

Reads knowledge entries from ~/.kiro/knowledge_bases/{agent}/contexts.json.
Mutations are delegated to kiro-cli via subprocess.
"""

import asyncio
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.kiro_dir import get_kiro_dir
from app.core.cli import get_kiro_cli

router = APIRouter()


class KnowledgeEntry(BaseModel):
    id: str
    name: str
    path: str
    indexType: str = "Fast"
    fileCount: int = 0
    includePatterns: list[str] = []
    excludePatterns: list[str] = []


class KnowledgeAddRequest(BaseModel):
    name: str
    path: str
    indexType: str = "Fast"
    includePatterns: list[str] = []
    excludePatterns: list[str] = []


def _kb_dir(agent_slug: str) -> Path:
    """Return the knowledge base directory for an agent."""
    kiro = get_kiro_dir()
    kb_root = kiro / "knowledge_bases"
    if not kb_root.exists():
        return kb_root / "kiro_cli_default"
    # Find matching agent dir — kiro uses {slug}_{hash} format
    for d in kb_root.iterdir():
        if d.is_dir() and d.name.startswith(agent_slug):
            return d
    # Default agent
    default = kb_root / "kiro_cli_default"
    if default.exists():
        return default
    return kb_root / agent_slug


def _read_contexts(agent_slug: str) -> list[KnowledgeEntry]:
    """Read contexts.json for an agent's knowledge base."""
    kb = _kb_dir(agent_slug)
    ctx_file = kb / "contexts.json"
    if not ctx_file.exists():
        return []
    try:
        data = json.loads(ctx_file.read_text())
        entries = []
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = data.get("contexts", data.get("entries", []))
        else:
            return []
        for item in items:
            if not isinstance(item, dict):
                continue
            # Count files in the context directory
            ctx_id = item.get("id", item.get("context_id", ""))
            file_count = 0
            ctx_dir = kb / ctx_id
            if ctx_dir.exists():
                data_file = ctx_dir / "data.json"
                if data_file.exists():
                    try:
                        d = json.loads(data_file.read_text())
                        file_count = len(d.get("files", d.get("chunks", [])))
                    except Exception:
                        pass
            entries.append(KnowledgeEntry(
                id=ctx_id,
                name=item.get("name", item.get("label", ctx_id)),
                path=item.get("path", item.get("source_path", "")),
                indexType=item.get("index_type", item.get("indexType", "Fast")),
                fileCount=file_count,
                includePatterns=item.get("include_patterns", []),
                excludePatterns=item.get("exclude_patterns", []),
            ))
        return entries
    except Exception:
        return []


async def _run_kiro_knowledge(agent_slug: str, *args: str) -> str:
    cli = get_kiro_cli()
    cmd = [cli, "chat", "--agent", agent_slug, "--no-interactive"]
    # Build the /knowledge command as input
    knowledge_cmd = "/knowledge " + " ".join(args)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate(input=(knowledge_cmd + "\n/exit\n").encode())
    return stdout.decode("utf-8", errors="replace")


@router.get("/{agent_slug}/knowledge", response_model=list[KnowledgeEntry])
def list_knowledge(agent_slug: str) -> list[KnowledgeEntry]:
    return _read_contexts(agent_slug)


@router.post("/{agent_slug}/knowledge", status_code=201)
async def add_knowledge(agent_slug: str, req: KnowledgeAddRequest) -> dict:
    args = ["add", "--name", req.name, "--path", req.path, "--index-type", req.indexType]
    for p in req.includePatterns:
        args += ["--include", p]
    for p in req.excludePatterns:
        args += ["--exclude", p]
    output = await _run_kiro_knowledge(agent_slug, *args)
    return {"status": "submitted", "output": output}


@router.delete("/{agent_slug}/knowledge/{entry_name}", status_code=200)
async def remove_knowledge(agent_slug: str, entry_name: str) -> dict:
    output = await _run_kiro_knowledge(agent_slug, "remove", entry_name)
    return {"status": "removed", "output": output}


@router.post("/{agent_slug}/knowledge/{entry_name}/update", status_code=200)
async def update_knowledge(agent_slug: str, entry_name: str) -> dict:
    # /knowledge update re-indexes by path; we need to find the path first
    entries = _read_contexts(agent_slug)
    entry = next((e for e in entries if e.name == entry_name or e.id == entry_name), None)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Knowledge entry '{entry_name}' not found")
    output = await _run_kiro_knowledge(agent_slug, "update", entry.path)
    return {"status": "updating", "output": output}


@router.delete("/{agent_slug}/knowledge", status_code=200)
async def clear_knowledge(agent_slug: str) -> dict:
    """Clear all knowledge entries for an agent."""
    # Direct file deletion since /knowledge clear requires interactive confirmation
    kb = _kb_dir(agent_slug)
    ctx_file = kb / "contexts.json"
    if ctx_file.exists():
        import shutil
        # Remove all context subdirectories
        for item in kb.iterdir():
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
        ctx_file.write_text("[]")
    return {"status": "cleared"}
