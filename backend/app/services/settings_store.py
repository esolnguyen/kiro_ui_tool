"""Single source of truth for reading/writing ~/.kiro/settings.json.

Previously duplicated across routers/settings.py and routers/permissions.py.
"""

import json
from pathlib import Path

from app.core.kiro_dir import get_kiro_dir, ensure_kiro_dir


def settings_path() -> Path:
    return get_kiro_dir() / "settings.json"


def load() -> dict:
    path = settings_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def save(data: dict) -> None:
    ensure_kiro_dir()
    settings_path().write_text(json.dumps(data, indent=2))
