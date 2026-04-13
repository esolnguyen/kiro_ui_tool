from pydantic import BaseModel


class HookConfig(BaseModel):
    event: str  # PreToolUse | PostToolUse | Stop | etc.
    command: str
    enabled: bool = True
    matcher: str | None = None


class StatuslineConfig(BaseModel):
    enabled: bool = True
    showModel: bool = True
    showTokens: bool = True
    showCost: bool = True


class AzureDevOpsConfig(BaseModel):
    organization: str = ""
    project: str = ""
    personalAccessToken: str = ""
    apiVersion: str = "7.1"


class Settings(BaseModel):
    kiroDir: str = "~/.kiro"
    kiroCLIPath: str = ""
    theme: str = "dark"
    defaultModel: str = "sonnet"
    permissionMode: str = "ask"
    alwaysThinking: bool = False
    hooks: list[HookConfig] = []
    extensions: list[str] = []
    statusline: StatuslineConfig = StatuslineConfig()
    azureDevOps: AzureDevOpsConfig = AzureDevOpsConfig()
