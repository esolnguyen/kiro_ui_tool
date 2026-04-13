from pydantic import BaseModel, Field
from typing import Literal, Optional


class McpServerConfig(BaseModel):
    """Per-agent MCP server override. Mirrors the Kiro native format."""

    command: str
    args: list[str] = []
    env: dict[str, str] = {}
    autoApprove: list[str] = Field(default_factory=list)
    disabledTools: list[str] = Field(default_factory=list)


class AgentCreate(BaseModel):
    name: str
    description: str = ""
    model: Literal["sonnet", "opus", "haiku"] = "sonnet"
    color: str | None = None
    memory: Literal["user", "project", "none"] | None = None
    body: str = ""
    # MCP + tool permissions
    mcpServers: dict[str, McpServerConfig] = Field(default_factory=dict)
    tools: list[str] = Field(default_factory=list)
    allowedTools: list[str] = Field(default_factory=list)


class AgentResponse(AgentCreate):
    slug: str
