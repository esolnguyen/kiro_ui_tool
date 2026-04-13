from fastapi import APIRouter, HTTPException

from app.models.settings import HookConfig, Settings
from app.services import settings_store

router = APIRouter()


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("", response_model=Settings)
def get_settings() -> Settings:
    raw = settings_store.load()
    try:
        return Settings(**raw)
    except Exception:
        return Settings()


@router.put("", response_model=Settings)
def update_settings(data: Settings) -> Settings:
    settings_store.save(data.model_dump())
    return data


# ── Hooks management ───────────────────────────────────────────────────────

@router.get("/hooks", response_model=list[HookConfig])
def list_hooks() -> list[HookConfig]:
    raw = settings_store.load()
    hooks_data = raw.get("hooks", [])
    return [HookConfig(**h) for h in hooks_data]


@router.post("/hooks", response_model=HookConfig, status_code=201)
def add_hook(hook: HookConfig) -> HookConfig:
    raw = settings_store.load()
    hooks = raw.setdefault("hooks", [])
    hooks.append(hook.model_dump())
    settings_store.save(raw)
    return hook


@router.put("/hooks/{index}", response_model=HookConfig)
def update_hook(index: int, hook: HookConfig) -> HookConfig:
    raw = settings_store.load()
    hooks = raw.get("hooks", [])
    if index < 0 or index >= len(hooks):
        raise HTTPException(status_code=404, detail="Hook index out of range")
    hooks[index] = hook.model_dump()
    raw["hooks"] = hooks
    settings_store.save(raw)
    return hook


@router.delete("/hooks/{index}", status_code=204)
def delete_hook(index: int) -> None:
    raw = settings_store.load()
    hooks = raw.get("hooks", [])
    if index < 0 or index >= len(hooks):
        raise HTTPException(status_code=404, detail="Hook index out of range")
    hooks.pop(index)
    raw["hooks"] = hooks
    settings_store.save(raw)


@router.post("/hooks/{index}/toggle", response_model=HookConfig)
def toggle_hook(index: int) -> HookConfig:
    raw = settings_store.load()
    hooks = raw.get("hooks", [])
    if index < 0 or index >= len(hooks):
        raise HTTPException(status_code=404, detail="Hook index out of range")
    hooks[index]["enabled"] = not hooks[index].get("enabled", True)
    raw["hooks"] = hooks
    settings_store.save(raw)
    return HookConfig(**hooks[index])
