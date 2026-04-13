import os
from pathlib import Path

from fastapi import HTTPException


def get_kiro_dir() -> Path:
    env_dir = os.environ.get("KIRO_DIR", "")
    if env_dir:
        return Path(env_dir).expanduser()
    return Path.home() / ".kiro"


def ensure_kiro_dir() -> Path:
    kiro_dir = get_kiro_dir()
    for subdir in ["agents", "commands", "skills", "workflows"]:
        (kiro_dir / subdir).mkdir(parents=True, exist_ok=True)
    return kiro_dir


def safe_path(base: Path, *segments: str) -> Path:
    """Resolve a path and ensure it stays within `base`. Raises 400 on traversal."""
    resolved = (base / Path(*segments)).resolve()
    if not str(resolved).startswith(str(base.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    return resolved
