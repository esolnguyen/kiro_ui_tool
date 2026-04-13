"""Generic CRUD operations for frontmatter-based markdown entities.

Agents, commands, and skills all follow the same pattern:
  - stored as .md files with YAML frontmatter
  - identified by a slug derived from the filename
  - support list / get / create / update / delete

This module extracts the shared logic so each router only defines
the entity-specific field mapping.
"""

from pathlib import Path
from typing import Callable, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel

from app.core.frontmatter import parse_file, write_file
from app.core.kiro_dir import ensure_kiro_dir, safe_path
from app.core.slugify import slugify

T = TypeVar("T", bound=BaseModel)


class FrontmatterCRUD:
    """Reusable CRUD helper for frontmatter-backed entities.

    Parameters
    ----------
    entity_name : str
        Human-readable name used in error messages (e.g. "Agent").
    subdir : str
        Subdirectory under ~/.kiro (e.g. "agents").
    read_fn : callable
        ``(path: Path) -> T`` reads a file into a response model.
    meta_fn : callable
        ``(data) -> dict`` converts a create/update payload into frontmatter metadata.
    response_fn : callable
        ``(slug: str, data) -> T`` builds the response model after a write.
    glob_pattern : str
        Glob used when listing (default ``"*.md"``).
    """

    def __init__(
        self,
        *,
        entity_name: str,
        subdir: str,
        read_fn: Callable[[Path], T],
        meta_fn: Callable,
        response_fn: Callable,
        glob_pattern: str = "*.md",
    ) -> None:
        self.entity_name = entity_name
        self.subdir = subdir
        self.read_fn = read_fn
        self.meta_fn = meta_fn
        self.response_fn = response_fn
        self.glob_pattern = glob_pattern

    def base_dir(self) -> Path:
        return ensure_kiro_dir() / self.subdir

    def list_all(self) -> list[T]:
        items: list[T] = []
        for path in sorted(self.base_dir().glob(self.glob_pattern)):
            try:
                items.append(self.read_fn(path))
            except Exception:
                continue
        return items

    def get(self, slug: str) -> T:
        path = safe_path(self.base_dir(), f"{slug}.md")
        if not path.exists():
            raise HTTPException(404, f"{self.entity_name} '{slug}' not found")
        return self.read_fn(path)

    def create(self, data) -> T:
        base = self.base_dir()
        slug = slugify(data.name)
        path = safe_path(base, f"{slug}.md")
        if path.exists():
            raise HTTPException(409, f"{self.entity_name} '{slug}' already exists")
        write_file(path, self.meta_fn(data), data.body)
        return self.response_fn(slug, data)

    def update(self, slug: str, data) -> T:
        path = safe_path(self.base_dir(), f"{slug}.md")
        if not path.exists():
            raise HTTPException(404, f"{self.entity_name} '{slug}' not found")
        write_file(path, self.meta_fn(data), data.body)
        return self.response_fn(slug, data)

    def delete(self, slug: str) -> None:
        path = safe_path(self.base_dir(), f"{slug}.md")
        if not path.exists():
            raise HTTPException(404, f"{self.entity_name} '{slug}' not found")
        path.unlink()
