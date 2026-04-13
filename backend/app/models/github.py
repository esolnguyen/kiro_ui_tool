from pydantic import BaseModel


class ScannedSkill(BaseModel):
    slug: str
    name: str
    description: str
    category: str | None = None
    tags: list[str] = []
    filePath: str
    hasSupporting: bool = False
    conflict: bool = False


class ScannedAgent(BaseModel):
    slug: str
    name: str
    description: str
    category: str | None = None
    filePath: str
    conflict: bool = False


class ScanResult(BaseModel):
    owner: str
    repo: str
    targetPath: str
    skills: list[ScannedSkill]
    agents: list[ScannedAgent]
    totalSkills: int
    totalAgents: int
    detectionMethod: str


class ImportItem(BaseModel):
    type: str  # 'skill' | 'agent'
    slug: str
    sourcePath: str


class ImportRequest(BaseModel):
    repoUrl: str
    clonePath: str
    owner: str
    repo: str
    targetPath: str = ""
    selectedItems: list[str] = []
    type: str = "skills"  # 'skills' | 'agents' | 'both'


class ImportRecord(BaseModel):
    id: str
    repoUrl: str
    owner: str
    repo: str
    clonePath: str
    importedAt: str
    lastChecked: str
    currentSha: str
    remoteSha: str
    selectedItems: list[str] = []
    targetPath: str = ""
    itemType: str = "skills"


class UpdateRequest(BaseModel):
    importId: str
    selectedItems: list[str] = []
