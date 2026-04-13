from pydantic import BaseModel


class DirectoryEntry(BaseModel):
    name: str
    path: str
    isDir: bool
    hasChildren: bool = False


class FileEntry(BaseModel):
    name: str
    path: str
    isDir: bool
    size: int | None = None


class SetupResult(BaseModel):
    success: bool
    kiroDir: str
    created: bool


class ConfigResult(BaseModel):
    kiroDir: str
    kiroCLIPath: str
    kiroCLIFound: bool
