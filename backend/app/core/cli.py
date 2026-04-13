"""Unified Kiro CLI path resolution.

Priority order:
1. KIRO_CLI_PATH environment variable
2. kiroCLIPath from ~/.kiro/settings.json
3. 'kiro' on PATH
4. WSL: kiro.exe via Windows interop or common install locations
"""

import json
import os
import shutil
from pathlib import Path


def _settings_cli_path() -> str:
    """Read kiroCLIPath from ~/.kiro/settings.json."""
    try:
        from app.core.kiro_dir import get_kiro_dir
        p = get_kiro_dir() / "settings.json"
        if p.exists():
            return json.loads(p.read_text()).get("kiroCLIPath", "")
    except Exception:
        pass
    return ""


def _wsl_candidates() -> list[str]:
    """Auto-detect kiro.exe in common Windows install locations via WSL /mnt/c."""
    candidates: list[str] = []

    # WSL interop: kiro.exe may already be on the merged PATH
    found = shutil.which("kiro.exe")
    if found:
        candidates.append(found)

    mnt = Path("/mnt/c/Users")
    if not mnt.exists():
        return candidates

    for user_dir in mnt.iterdir():
        if not user_dir.is_dir():
            continue
        for rel in (
            "AppData/Local/Programs/Kiro/kiro.exe",
            "AppData/Local/Programs/kiro/kiro.exe",
            "AppData/Local/kiro/kiro.exe",
        ):
            p = user_dir / rel
            if p.exists():
                candidates.append(str(p))

    return candidates


def get_kiro_cli() -> str:
    """Return the resolved kiro CLI path."""
    # 1. Env var
    env = os.environ.get("KIRO_CLI_PATH", "")
    if env and Path(env).exists():
        return env

    # 2. Persisted setting
    saved = _settings_cli_path()
    if saved and Path(saved).exists():
        return saved

    # 3. Native PATH
    for name in ("kiro-cli", "kiro"):
        found = shutil.which(name)
        if found:
            return found

    # 4. WSL auto-detect
    for path in _wsl_candidates():
        return path

    # Not found — return bare name so callers get a clear "not found" error
    return "kiro"


def detect_kiro_cli() -> tuple[str, bool]:
    """Return (resolved_path, is_found) without raising."""
    # Same resolution but also checks kiro.exe in PATH directly
    env = os.environ.get("KIRO_CLI_PATH", "")
    if env:
        exists = Path(env).exists()
        return env, exists

    saved = _settings_cli_path()
    if saved:
        exists = Path(saved).exists()
        return saved, exists

    for name in ("kiro-cli", "kiro", "kiro.exe"):
        found = shutil.which(name)
        if found:
            return found, True

    for path in _wsl_candidates():
        return path, True

    return "", False
