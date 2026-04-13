import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.models.agents import AgentCreate, AgentResponse, McpServerConfig
from app.core.kiro_dir import safe_path
from app.core.frontmatter import parse_file
from app.services.frontmatter_crud import FrontmatterCRUD

router = APIRouter()

MAX_HISTORY_VERSIONS = 20


def _parse_mcp_servers(raw: object) -> dict[str, McpServerConfig]:
    if not isinstance(raw, dict):
        return {}
    parsed: dict[str, McpServerConfig] = {}
    for name, cfg in raw.items():
        if isinstance(cfg, dict):
            try:
                parsed[name] = McpServerConfig(
                    command=cfg.get("command", ""),
                    args=cfg.get("args", []) or [],
                    env=cfg.get("env", {}) or {},
                    autoApprove=cfg.get("autoApprove", []) or [],
                    disabledTools=cfg.get("disabledTools", []) or [],
                )
            except Exception:
                continue
    return parsed


def _read_json_config(md_path: Path) -> dict:
    """Read the companion .json config file for an agent."""
    json_path = md_path.with_suffix(".json")
    if not json_path.exists():
        return {}
    try:
        return json.loads(json_path.read_text())
    except Exception:
        return {}


def _write_json_config(md_path: Path, data: AgentCreate) -> None:
    """Write MCP servers, tools, and allowedTools to the companion .json config."""
    json_path = md_path.with_suffix(".json")
    existing = _read_json_config(md_path)

    # Update only the fields we manage
    if data.mcpServers:
        existing["mcpServers"] = {
            name: cfg.model_dump(exclude_none=True)
            for name, cfg in data.mcpServers.items()
        }
    elif "mcpServers" in existing:
        del existing["mcpServers"]

    if data.tools:
        existing["tools"] = data.tools
    if data.allowedTools:
        existing["allowedTools"] = data.allowedTools
    else:
        existing.pop("allowedTools", None)

    # Sync name/description into JSON as well
    existing["name"] = data.name or existing.get("name", "")
    existing["description"] = data.description or existing.get("description", "")

    # Ensure prompt points to the .md file
    slug = md_path.stem
    existing.setdefault("prompt", f"file://./{slug}.md")

    json_path.write_text(json.dumps(existing, indent=2) + "\n")


def _read_agent(path: Path) -> AgentResponse:
    slug = path.stem
    meta, body = parse_file(path)

    # Read MCP/tools config from companion .json (source of truth for Kiro CLI)
    json_cfg = _read_json_config(path)

    return AgentResponse(
        slug=slug,
        name=meta.get("name") or json_cfg.get("name", slug),
        description=meta.get("description") or json_cfg.get("description", ""),
        model=meta.get("model", "sonnet"),
        color=meta.get("color"),
        memory=meta.get("memory"),
        body=body,
        mcpServers=_parse_mcp_servers(json_cfg.get("mcpServers")),
        tools=list(json_cfg.get("tools") or meta.get("tools") or []),
        allowedTools=list(json_cfg.get("allowedTools") or meta.get("allowedTools") or []),
    )


def _agent_meta(data: AgentCreate) -> dict:
    """Build frontmatter metadata for the .md file (excludes MCP/tools — those go in .json)."""
    meta: dict = {
        "name": data.name,
        "description": data.description,
        "model": data.model,
    }
    if data.color:
        meta["color"] = data.color
    if data.memory:
        meta["memory"] = data.memory
    # MCP servers, tools, and allowedTools are stored in the .json config,
    # not in frontmatter — the Kiro CLI reads them from .json.
    return meta


def _agent_response(slug: str, data: AgentCreate) -> AgentResponse:
    return AgentResponse(slug=slug, **data.model_dump(exclude={"body"}), body=data.body)


crud = FrontmatterCRUD(
    entity_name="Agent",
    subdir="agents",
    read_fn=_read_agent,
    meta_fn=_agent_meta,
    response_fn=_agent_response,
)


# ── Standard CRUD ─────────────────────────────────────────────────────────

@router.get("", response_model=list[AgentResponse])
def list_agents() -> list[AgentResponse]:
    return crud.list_all()


@router.get("/{slug}", response_model=AgentResponse)
def get_agent(slug: str) -> AgentResponse:
    return crud.get(slug)


@router.post("", response_model=AgentResponse, status_code=201)
def create_agent(data: AgentCreate) -> AgentResponse:
    result = crud.create(data)
    md_path = safe_path(crud.base_dir(), f"{result.slug}.md")
    _write_json_config(md_path, data)
    return result


@router.put("/{slug}", response_model=AgentResponse)
def update_agent(slug: str, data: AgentCreate) -> AgentResponse:
    # Save history before overwriting
    path = safe_path(crud.base_dir(), f"{slug}.md")
    if path.exists():
        try:
            existing_meta, existing_body = parse_file(path)
            _save_history_version(slug, existing_meta, existing_body)
        except Exception:
            pass
    result = crud.update(slug, data)
    _write_json_config(path, data)
    return result


@router.delete("/{slug}", status_code=204)
def delete_agent(slug: str) -> None:
    # Also remove companion .json config
    md_path = safe_path(crud.base_dir(), f"{slug}.md")
    json_path = md_path.with_suffix(".json")
    crud.delete(slug)
    if json_path.exists():
        json_path.unlink()


# ── Agent history ─────────────────────────────────────────────────────────

def _save_history_version(slug: str, meta: dict, body: str) -> None:
    history_dir = crud.base_dir() / ".history" / slug
    history_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    version_path = history_dir / f"{timestamp}.json"
    version_path.write_text(
        json.dumps({"id": timestamp, "content": body, "metadata": meta, "savedAt": datetime.now(timezone.utc).isoformat()}, indent=2)
    )
    versions = sorted(history_dir.glob("*.json"))
    for old in versions[:-MAX_HISTORY_VERSIONS]:
        try:
            old.unlink()
        except Exception:
            pass


@router.get("/{slug}/history")
def list_agent_history(slug: str) -> list[dict]:
    path = safe_path(crud.base_dir(), f"{slug}.md")
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Agent '{slug}' not found")
    history_dir = safe_path(crud.base_dir(), ".history", slug)
    if not history_dir.exists():
        return []
    versions: list[dict] = []
    for f in sorted(history_dir.glob("*.json"), reverse=True):
        try:
            data = json.loads(f.read_text())
            versions.append({
                "id": data.get("id", f.stem),
                "savedAt": data.get("savedAt", ""),
                "metadata": data.get("metadata", {}),
            })
        except Exception:
            continue
    return versions


@router.get("/{slug}/history/{version_id}")
def get_agent_history_version(slug: str, version_id: str) -> dict:
    history_dir = safe_path(crud.base_dir(), ".history", slug)
    version_path = safe_path(history_dir, f"{version_id}.json")
    if not version_path.exists():
        raise HTTPException(status_code=404, detail=f"Version '{version_id}' not found")
    try:
        return json.loads(version_path.read_text())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{slug}/history/{version_id}", status_code=204)
def delete_agent_history_version(slug: str, version_id: str) -> None:
    history_dir = safe_path(crud.base_dir(), ".history", slug)
    version_path = safe_path(history_dir, f"{version_id}.json")
    if not version_path.exists():
        raise HTTPException(status_code=404, detail=f"Version '{version_id}' not found")
    version_path.unlink()


# ── Agent skills ──────────────────────────────────────────────────────────

@router.get("/{slug}/skills")
def list_agent_skills(slug: str) -> list[dict]:
    """Return skills that have agent: {slug} in their frontmatter."""
    path = safe_path(crud.base_dir(), f"{slug}.md")
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Agent '{slug}' not found")

    kiro_dir = path.parent.parent
    skills_dir = kiro_dir / "skills"
    linked: list[dict] = []

    if not skills_dir.exists():
        return []

    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir():
            continue
        skill_file = entry / "SKILL.md"
        if not skill_file.exists():
            candidates = list(entry.glob("*.md"))
            if not candidates:
                continue
            skill_file = candidates[0]
        try:
            meta, body = parse_file(skill_file)
            if meta.get("agent") == slug:
                linked.append({
                    "slug": entry.name,
                    "name": meta.get("name", entry.name),
                    "description": meta.get("description", ""),
                    "context": meta.get("context"),
                    "body": body,
                })
        except Exception:
            continue

    return linked
