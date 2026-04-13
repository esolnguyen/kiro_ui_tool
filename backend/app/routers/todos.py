"""TODO list management.

Reads todo lists from {projectDir}/.kiro/cli-todo-lists/*.json.
"""

import json
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()


class TodoItem:
    pass


def _todo_dir(project_dir: str) -> Path:
    return Path(project_dir).expanduser() / ".kiro" / "cli-todo-lists"


def _read_todo(path: Path) -> dict:
    try:
        data = json.loads(path.read_text())
        tasks = data.get("tasks", data.get("items", []))
        total = len(tasks)
        done = sum(1 for t in tasks if t.get("completed", t.get("done", False)))
        return {
            "id": path.stem,
            "file": str(path),
            "description": data.get("description", data.get("title", path.stem)),
            "tasks": tasks,
            "totalTasks": total,
            "completedTasks": done,
            "finished": total > 0 and done == total,
            "modifiedFiles": data.get("modified_files", []),
        }
    except Exception:
        return {"id": path.stem, "file": str(path), "description": path.stem, "tasks": [], "totalTasks": 0, "completedTasks": 0, "finished": False, "modifiedFiles": []}


@router.get("")
def list_todos(projectDir: str = Query(..., description="Absolute path to the project directory")) -> list[dict]:
    td = _todo_dir(projectDir)
    if not td.exists():
        return []
    todos = []
    for f in sorted(td.glob("*.json"), reverse=True):
        todos.append(_read_todo(f))
    return todos


@router.get("/{todo_id}")
def get_todo(todo_id: str, projectDir: str = Query(...)) -> dict:
    td = _todo_dir(projectDir)
    path = td / f"{todo_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"TODO list '{todo_id}' not found")
    return _read_todo(path)


@router.delete("/{todo_id}", status_code=200)
def delete_todo(todo_id: str, projectDir: str = Query(...)) -> dict:
    td = _todo_dir(projectDir)
    path = td / f"{todo_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"TODO list '{todo_id}' not found")
    path.unlink()
    return {"deleted": todo_id}


@router.delete("", status_code=200)
def delete_all_todos(projectDir: str = Query(...), finishedOnly: bool = Query(False)) -> dict:
    td = _todo_dir(projectDir)
    if not td.exists():
        return {"deleted": 0}
    count = 0
    for f in td.glob("*.json"):
        if finishedOnly:
            todo = _read_todo(f)
            if not todo["finished"]:
                continue
        f.unlink()
        count += 1
    return {"deleted": count}
