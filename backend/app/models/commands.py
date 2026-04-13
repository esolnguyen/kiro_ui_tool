from pydantic import BaseModel


class CommandCreate(BaseModel):
    name: str
    description: str = ""
    argumentHint: str | None = None
    allowedTools: list[str] | None = None
    agent: str | None = None
    body: str = ""


class CommandResponse(CommandCreate):
    slug: str
