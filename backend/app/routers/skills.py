from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.models.skills import SkillCreate, SkillResponse
from app.core.kiro_dir import ensure_kiro_dir, safe_path
from app.core.frontmatter import parse_file, write_file
from app.core.slugify import slugify

router = APIRouter()


def _skills_dir() -> Path:
    return ensure_kiro_dir() / "skills"


def _read_skill(path: Path) -> SkillResponse:
    slug = path.stem if path.name != "SKILL.md" else path.parent.name
    meta, body = parse_file(path)
    return SkillResponse(
        slug=slug,
        name=meta.get("name", slug),
        description=meta.get("description", ""),
        context=meta.get("context"),
        agent=meta.get("agent"),
        body=body,
    )


def _skill_meta(data: SkillCreate) -> dict:
    meta: dict = {"name": data.name, "description": data.description}
    if data.context:
        meta["context"] = data.context
    if data.agent:
        meta["agent"] = data.agent
    return meta


def _resolve_skill_path(slug: str) -> Path:
    """Find the .md file for a skill, checking flat and nested layouts."""
    skills_dir = _skills_dir()
    flat = safe_path(skills_dir, f"{slug}.md")
    if flat.exists():
        return flat
    nested = safe_path(skills_dir, slug, "SKILL.md")
    if nested.exists():
        return nested
    raise HTTPException(status_code=404, detail=f"Skill '{slug}' not found")


@router.get("", response_model=list[SkillResponse])
def list_skills() -> list[SkillResponse]:
    skills_dir = _skills_dir()
    skills: list[SkillResponse] = []
    seen: set[str] = set()
    for path in sorted(skills_dir.rglob("*.md")):
        try:
            skill = _read_skill(path)
            if skill.slug not in seen:
                seen.add(skill.slug)
                skills.append(skill)
        except Exception:
            continue
    return skills


@router.get("/{slug}", response_model=SkillResponse)
def get_skill(slug: str) -> SkillResponse:
    return _read_skill(_resolve_skill_path(slug))


@router.post("", response_model=SkillResponse, status_code=201)
def create_skill(data: SkillCreate) -> SkillResponse:
    skills_dir = _skills_dir()
    slug = slugify(data.name)
    path = safe_path(skills_dir, f"{slug}.md")
    if path.exists() or safe_path(skills_dir, slug, "SKILL.md").exists():
        raise HTTPException(status_code=409, detail=f"Skill '{slug}' already exists")
    write_file(path, _skill_meta(data), data.body)
    return SkillResponse(slug=slug, **data.model_dump(exclude={"body"}), body=data.body)


@router.put("/{slug}", response_model=SkillResponse)
def update_skill(slug: str, data: SkillCreate) -> SkillResponse:
    path = _resolve_skill_path(slug)
    write_file(path, _skill_meta(data), data.body)
    return SkillResponse(slug=slug, **data.model_dump(exclude={"body"}), body=data.body)


@router.delete("/{slug}", status_code=204)
def delete_skill(slug: str) -> None:
    path = _resolve_skill_path(slug)
    path.unlink()
