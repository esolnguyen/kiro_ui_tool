from pathlib import Path

from fastapi import APIRouter

from app.models.commands import CommandCreate, CommandResponse
from app.core.frontmatter import parse_file
from app.services.frontmatter_crud import FrontmatterCRUD

router = APIRouter()


def _read_command(path: Path) -> CommandResponse:
    slug = path.stem
    meta, body = parse_file(path)
    return CommandResponse(
        slug=slug,
        name=meta.get("name", slug),
        description=meta.get("description", ""),
        argumentHint=meta.get("argument-hint") or meta.get("argumentHint"),
        allowedTools=meta.get("allowed-tools") or meta.get("allowedTools"),
        agent=meta.get("agent"),
        body=body,
    )


def _command_meta(data: CommandCreate) -> dict:
    meta: dict = {"name": data.name, "description": data.description}
    if data.argumentHint:
        meta["argument-hint"] = data.argumentHint
    if data.allowedTools:
        meta["allowed-tools"] = data.allowedTools
    if data.agent:
        meta["agent"] = data.agent
    return meta


def _command_response(slug: str, data: CommandCreate) -> CommandResponse:
    return CommandResponse(slug=slug, **data.model_dump(exclude={"body"}), body=data.body)


crud = FrontmatterCRUD(
    entity_name="Command",
    subdir="commands",
    read_fn=_read_command,
    meta_fn=_command_meta,
    response_fn=_command_response,
    glob_pattern="**/*.md",
)


@router.get("", response_model=list[CommandResponse])
def list_commands() -> list[CommandResponse]:
    return crud.list_all()


@router.get("/{slug}", response_model=CommandResponse)
def get_command(slug: str) -> CommandResponse:
    return crud.get(slug)


@router.post("", response_model=CommandResponse, status_code=201)
def create_command(data: CommandCreate) -> CommandResponse:
    return crud.create(data)


@router.put("/{slug}", response_model=CommandResponse)
def update_command(slug: str, data: CommandCreate) -> CommandResponse:
    return crud.update(slug, data)


@router.delete("/{slug}", status_code=204)
def delete_command(slug: str) -> None:
    crud.delete(slug)
