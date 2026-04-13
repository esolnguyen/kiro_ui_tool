"""Git operations, repo scanning, and import/copy logic for GitHub integration.

Extracted from routers/github.py to keep the router thin.
"""

import json
import re
import shutil
import subprocess
from pathlib import Path

from app.models.github import ScannedSkill, ScannedAgent
from app.core.kiro_dir import get_kiro_dir, ensure_kiro_dir
from app.core.frontmatter import parse_file

SKIP_FILENAMES = {
    "README.md", "readme.md",
    "CHANGELOG.md", "changelog.md",
    "CONTRIBUTING.md", "contributing.md",
    "LICENSE.md", "license.md",
    "CODE_OF_CONDUCT.md",
}


# ── Git helpers ───────────────────────────────────────────────────────────

def run_git(args: list[str], cwd: str | None = None, timeout: int = 120) -> str:
    result = subprocess.run(
        ["git"] + args,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {args[0]} failed")
    return result.stdout.strip()


def git_clone(repo_url: str, dest: str, depth: int = 1) -> None:
    if not repo_url.startswith("https://github.com/"):
        raise RuntimeError("Only HTTPS GitHub URLs are allowed")
    run_git(["clone", "--depth", str(depth), repo_url, dest], timeout=120)


def git_get_head(repo_path: str) -> str:
    try:
        return run_git(["rev-parse", "HEAD"], cwd=repo_path)
    except Exception:
        return ""


def git_pull(repo_path: str) -> str:
    return run_git(["pull"], cwd=repo_path, timeout=60)


def git_ls_remote(repo_url: str) -> str:
    try:
        out = run_git(["ls-remote", repo_url, "HEAD"], timeout=15)
        return out.split("\t")[0] if "\t" in out else out.split()[0] if out else ""
    except Exception:
        return ""


# ── Import registry ──────────────────────────────────────────────────────

def imports_registry_path() -> Path:
    return get_kiro_dir() / ".imports.json"


def load_imports() -> list[dict]:
    path = imports_registry_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except Exception:
        return []


def save_imports(imports: list[dict]) -> None:
    ensure_kiro_dir()
    imports_registry_path().write_text(json.dumps(imports, indent=2))


# ── Scanning ─────────────────────────────────────────────────────────────

def walk_md_files(base_dir: Path) -> list[Path]:
    files: list[Path] = []
    for item in base_dir.rglob("*"):
        if item.is_file() and item.suffix.lower() == ".md":
            parts = item.parts
            if ".git" in parts or "node_modules" in parts:
                continue
            files.append(item)
    return files


def detect_skills(base_dir: Path, target_path: str) -> tuple[list[ScannedSkill], str]:
    scan_root = base_dir / target_path if target_path else base_dir

    index_path = base_dir / "skills-index.json"
    if index_path.exists():
        try:
            index = json.loads(index_path.read_text())
            skills = []
            for s in index.get("skills", []):
                slug = s.get("slug", "")
                if not slug:
                    continue
                tags = s.get("tags", [])
                if isinstance(tags, str):
                    tags = [tags]
                file_path = s.get("files", [s.get("path", "")])[0] if s.get("files") else s.get("path", "")
                if target_path and not file_path.startswith(target_path):
                    continue
                skills.append(ScannedSkill(
                    slug=slug,
                    name=s.get("name", slug),
                    description=str(s.get("description", "")).lstrip("> "),
                    category=s.get("category"),
                    tags=tags,
                    filePath=file_path,
                    hasSupporting=len(s.get("files", [])) > 1,
                ))
            return skills, "skills-index"
        except Exception:
            pass

    all_md = walk_md_files(scan_root)
    skill_files = [f for f in all_md if f.name.lower() == "skill.md"]
    skills = []
    for f in skill_files:
        try:
            meta, _ = parse_file(f)
            name = meta.get("name", "")
            description = meta.get("description", "")
            if not name or not description:
                continue
            rel = str(f.relative_to(base_dir))
            parts = rel.split("/")
            parent_dir = parts[-2] if len(parts) >= 2 else ""
            slug = parent_dir or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
            category_parts = parts[:-2]
            category = "/".join(category_parts) if category_parts else None
            sibling_count = sum(1 for _ in f.parent.iterdir()) if f.parent.exists() else 0
            skills.append(ScannedSkill(
                slug=slug,
                name=name,
                description=description,
                category=category,
                tags=[],
                filePath=rel,
                hasSupporting=sibling_count > 1,
            ))
        except Exception:
            continue
    return skills, "frontmatter"


def detect_agents(base_dir: Path, target_path: str) -> list[ScannedAgent]:
    scan_root = base_dir / target_path if target_path else base_dir
    all_md = walk_md_files(scan_root)
    agent_files = [f for f in all_md if f.name.lower() != "skill.md"]
    agents = []
    for f in agent_files:
        if f.name in SKIP_FILENAMES:
            continue
        try:
            meta, _ = parse_file(f)
            name = meta.get("name", "")
            description = meta.get("description", "")
            if not name or not description:
                continue
            rel = str(f.relative_to(base_dir))
            parts = rel.split("/")
            original_name = parts[-1]
            slug = original_name.replace(".md", "")
            if slug.lower() == "agent" and len(parts) > 1:
                slug = parts[-2]
            category_parts = parts[:-1]
            if original_name.lower() == "agent.md" and category_parts:
                category_parts = category_parts[:-1]
            category = "/".join(category_parts) if category_parts else None
            agents.append(ScannedAgent(
                slug=slug,
                name=name,
                description=description,
                category=category,
                filePath=rel,
            ))
        except Exception:
            continue
    return agents


def parse_github_url(url: str) -> tuple[str, str, str | None] | None:
    """Returns (owner, repo, subpath) or None."""
    m = re.match(
        r"^https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?(?:/(?:tree|blob)/[^/]+(?:/(.+))?)?$",
        url.strip(),
    )
    if not m:
        return None
    return m.group(1), m.group(2), m.group(3)


# ── Copy items into kiro dir ─────────────────────────────────────────────

def copy_items_to_kiro(
    base: Path,
    target_path: str,
    selected_items: set[str],
) -> None:
    """Copy scanned skills and agents into the kiro directory.

    Used by both initial import and update operations.
    """
    kiro_dir = ensure_kiro_dir()
    skills, _ = detect_skills(base, target_path)
    agents = detect_agents(base, target_path)

    for skill in skills:
        if selected_items and skill.slug not in selected_items:
            continue
        src = base / skill.filePath
        dest_dir = kiro_dir / "skills" / skill.slug
        dest_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest_dir / "SKILL.md")

    for agent in agents:
        if selected_items and agent.slug not in selected_items:
            continue
        src = base / agent.filePath
        dest = kiro_dir / "agents" / f"{agent.slug}.md"
        shutil.copy2(src, dest)
