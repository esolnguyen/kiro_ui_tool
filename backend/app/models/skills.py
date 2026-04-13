from pydantic import BaseModel
from typing import Literal


class SkillCreate(BaseModel):
    name: str
    description: str = ""
    context: Literal["when", "always"] | None = None
    agent: str | None = None
    body: str = ""


class SkillResponse(SkillCreate):
    slug: str
