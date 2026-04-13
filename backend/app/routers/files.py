import os
from pathlib import Path

from fastapi import APIRouter, Query

from app.models.files import DirectoryEntry, FileEntry, SetupResult, ConfigResult
from app.core.kiro_dir import get_kiro_dir, ensure_kiro_dir

router = APIRouter()


@router.get("/directories", response_model=dict)
async def list_directories(path: str = Query(default="")) -> dict:
    """
    List subdirectories for path autocompletion.
    Restricted to user's home directory and below.
    """
    home = Path.home()
    input_path = path.replace("~", str(home)) if path else str(home)

    if not input_path or input_path == "/":
        dir_to_list = home
        prefix = ""
    elif input_path.endswith("/") or input_path.endswith(os.sep):
        dir_to_list = Path(input_path)
        prefix = ""
    else:
        candidate = Path(input_path)
        dir_to_list = candidate.parent
        prefix = candidate.name.lower()

    # Restrict to home directory
    if not str(dir_to_list.resolve()).startswith(str(home.resolve())):
        return {"directories": [], "basePath": str(home)}

    try:
        entries = list(dir_to_list.iterdir())
    except (PermissionError, FileNotFoundError):
        return {"directories": [], "basePath": str(dir_to_list)}

    dirs: list[DirectoryEntry] = []
    for entry in sorted(entries, key=lambda e: e.name):
        if not entry.is_dir():
            continue
        if entry.name.startswith("."):
            continue
        if prefix and not entry.name.lower().startswith(prefix):
            continue

        has_children = False
        try:
            has_children = any(
                c.is_dir() and not c.name.startswith(".")
                for c in entry.iterdir()
            )
        except (PermissionError, OSError):
            pass

        dirs.append(DirectoryEntry(
            name=entry.name,
            path=str(entry) + "/",
            isDir=True,
            hasChildren=has_children,
        ))
        if len(dirs) >= 15:
            break

    return {"directories": [d.model_dump() for d in dirs], "basePath": str(dir_to_list)}


@router.get("/files", response_model=list[FileEntry])
async def list_files(path: str = Query(default="")) -> list[FileEntry]:
    """List files in a directory. Restricted to user's home directory."""
    home = Path.home()
    resolved = Path(path.replace("~", str(home)) if path else str(home))

    if not resolved.exists() or not resolved.is_dir():
        return []

    # Restrict to home directory
    if not str(resolved.resolve()).startswith(str(home.resolve())):
        return []

    entries: list[FileEntry] = []
    try:
        for item in sorted(resolved.iterdir(), key=lambda e: (not e.is_dir(), e.name)):
            size: int | None = None
            if item.is_file():
                try:
                    size = item.stat().st_size
                except OSError:
                    pass
            entries.append(FileEntry(
                name=item.name,
                path=str(item),
                isDir=item.is_dir(),
                size=size,
            ))
    except (PermissionError, OSError):
        pass

    return entries


@router.post("/setup", response_model=SetupResult)
async def setup_kiro_dir() -> SetupResult:
    """Initialize ~/.kiro directory structure."""
    kiro_dir = get_kiro_dir()
    already_existed = kiro_dir.exists()
    ensure_kiro_dir()
    # Create additional subdirs
    for subdir in ("chat-sessions", "cli-history", "github"):
        (kiro_dir / subdir).mkdir(parents=True, exist_ok=True)
    return SetupResult(
        success=True,
        kiroDir=str(kiro_dir),
        created=not already_existed,
    )


@router.get("/config", response_model=ConfigResult)
async def get_config() -> ConfigResult:
    kiro_dir = get_kiro_dir()
    from app.core.cli import detect_kiro_cli
    cli_path, found = detect_kiro_cli()
    return ConfigResult(
        kiroDir=str(kiro_dir),
        kiroCLIPath=cli_path,
        kiroCLIFound=found,
    )
