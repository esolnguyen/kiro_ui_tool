from pydantic import BaseModel


class McpServer(BaseModel):
    name: str
    command: str
    args: list[str] = []
    env: dict[str, str] = {}
    enabled: bool = True


class McpTool(BaseModel):
    name: str
    description: str = ""


class McpToolsResponse(BaseModel):
    server: str
    tools: list[McpTool]
    error: str | None = None
    durationMs: int = 0
