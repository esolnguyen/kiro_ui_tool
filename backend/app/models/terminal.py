from pydantic import BaseModel


class SessionInfo(BaseModel):
    id: str
    agentSlug: str | None = None
    workingDir: str
    shell: str
    status: str  # 'active' | 'idle' | 'terminated'
    createdAt: str
    lastActivity: str


class CreateSessionRequest(BaseModel):
    agentSlug: str | None = None
    workingDir: str | None = None
    cols: int = 80
    rows: int = 24
