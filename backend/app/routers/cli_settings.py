"""Router for managing kiro-cli settings via the CLI."""

import asyncio
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.cli import get_kiro_cli

router = APIRouter()


class CliSetting(BaseModel):
    key: str
    description: str
    type: str  # boolean, string, number, array
    value: str | None = None
    scope: str | None = None  # global, workspace, or None


class CliSettingUpdate(BaseModel):
    key: str
    value: str
    workspace: bool = False


class CliSettingDelete(BaseModel):
    key: str
    workspace: bool = False


# ── Setting definitions (from kiro-cli settings list --all) ────────────

SETTING_DEFS: list[dict] = [
    {"key": "telemetry.enabled", "description": "Enable/disable telemetry collection", "type": "boolean"},
    {"key": "telemetryClientId", "description": "Client identifier for telemetry", "type": "string"},
    {"key": "codeWhisperer.shareCodeWhispererContentWithAWS", "description": "Share content with CodeWhisperer service", "type": "boolean"},
    {"key": "chat.enableThinking", "description": "Enable thinking tool for complex reasoning", "type": "boolean"},
    {"key": "chat.enableKnowledge", "description": "Enable knowledge base functionality", "type": "boolean"},
    {"key": "chat.enableCodeIntelligence", "description": "Enable code intelligence with LSP integration", "type": "boolean"},
    {"key": "knowledge.defaultIncludePatterns", "description": "Default file patterns to include in knowledge base", "type": "array"},
    {"key": "knowledge.defaultExcludePatterns", "description": "Default file patterns to exclude from knowledge base", "type": "array"},
    {"key": "knowledge.maxFiles", "description": "Maximum number of files for knowledge indexing", "type": "number"},
    {"key": "knowledge.chunkSize", "description": "Text chunk size for knowledge processing", "type": "number"},
    {"key": "knowledge.chunkOverlap", "description": "Overlap between text chunks", "type": "number"},
    {"key": "knowledge.indexType", "description": "Type of knowledge index to use", "type": "string"},
    {"key": "chat.skimCommandKey", "description": "Key binding for fuzzy search command", "type": "string"},
    {"key": "chat.autocompletionKey", "description": "Key binding for autocompletion hint acceptance", "type": "string"},
    {"key": "chat.enableTangentMode", "description": "Enable tangent mode feature", "type": "boolean"},
    {"key": "chat.tangentModeKey", "description": "Key binding for tangent mode toggle", "type": "string"},
    {"key": "chat.enableSubagent", "description": "Enable subagent feature", "type": "boolean"},
    {"key": "chat.delegateModeKey", "description": "Key binding for delegate command", "type": "string"},
    {"key": "introspect.tangentMode", "description": "Auto-enter tangent mode for introspect questions", "type": "boolean"},
    {"key": "introspect.progressiveMode", "description": "Use progressive loading instead of semantic search", "type": "boolean"},
    {"key": "chat.greeting.enabled", "description": "Show greeting message on chat start", "type": "boolean"},
    {"key": "api.timeout", "description": "API request timeout in seconds", "type": "number"},
    {"key": "chat.editMode", "description": "Enable edit mode for chat interface", "type": "boolean"},
    {"key": "chat.enableNotifications", "description": "Enable desktop notifications", "type": "boolean"},
    {"key": "mcp.initTimeout", "description": "MCP server initialization timeout", "type": "number"},
    {"key": "mcp.noInteractiveTimeout", "description": "Non-interactive MCP timeout", "type": "number"},
    {"key": "mcp.loadedBefore", "description": "Track previously loaded MCP servers", "type": "boolean"},
    {"key": "chat.enableContextUsageIndicator", "description": "Show context usage percentage in prompt", "type": "boolean"},
    {"key": "chat.defaultModel", "description": "Default AI model for conversations", "type": "string"},
    {"key": "chat.disableMarkdownRendering", "description": "Disable markdown formatting in chat", "type": "boolean"},
    {"key": "chat.defaultAgent", "description": "Default agent configuration", "type": "string"},
    {"key": "chat.disableAutoCompaction", "description": "Disable automatic conversation summarization", "type": "boolean"},
    {"key": "compaction.excludeContextWindowPercent", "description": "Percentage of context window to exclude from compaction", "type": "number"},
    {"key": "compaction.excludeMessages", "description": "Minimum message pairs to exclude from compaction", "type": "number"},
    {"key": "chat.enableHistoryHints", "description": "Show conversation history hints", "type": "boolean"},
    {"key": "chat.enablePromptHints", "description": "Show rotating prompt hints on empty input", "type": "boolean"},
    {"key": "chat.enableTodoList", "description": "Enable the todo list feature", "type": "boolean"},
    {"key": "chat.enableCheckpoint", "description": "Enable the checkpoint feature", "type": "boolean"},
    {"key": "chat.enableDelegate", "description": "Enable the delegate tool for subagent management", "type": "boolean"},
    {"key": "chat.uiMode", "description": "Specify UI variant to use", "type": "string"},
    {"key": "chat.diffTool", "description": "External diff tool command", "type": "string"},
    {"key": "chat.ui", "description": "Chat UI mode: 'legacy' or 'tui'", "type": "string"},
    {"key": "chat.disableGranularTrust", "description": "Disable granular trust options for tool permissions", "type": "boolean"},
]

SETTING_DEFS_MAP = {d["key"]: d for d in SETTING_DEFS}


async def _run_cli(*args: str) -> str:
    cli = get_kiro_cli()
    proc = await asyncio.create_subprocess_exec(
        cli, "settings", *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=stderr.decode().strip() or "CLI error")
    return stdout.decode().strip()


def _parse_list_output(raw: str) -> list[CliSetting]:
    """Parse `kiro-cli settings list --all` output into structured settings."""
    settings: list[CliSetting] = []
    lines = raw.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Setting key line (not indented, no prefix)
        if line and not line.startswith("Description:") and not line.startswith("Current:"):
            key = line
            desc = ""
            val = None
            scope = None
            # Read description
            if i + 1 < len(lines) and lines[i + 1].strip().startswith("Description:"):
                desc = lines[i + 1].strip().removeprefix("Description:").strip()
                i += 1
            # Read current value
            if i + 1 < len(lines) and lines[i + 1].strip().startswith("Current:"):
                cur = lines[i + 1].strip().removeprefix("Current:").strip()
                i += 1
                if cur != "not set":
                    # Parse "value (scope)" pattern
                    m = re.match(r'^(.+?)\s+\((\w+)\)$', cur)
                    if m:
                        val = m.group(1)
                        scope = m.group(2)
                    else:
                        val = cur
            # Use definition metadata if available
            defn = SETTING_DEFS_MAP.get(key)
            stype = defn["type"] if defn else "string"
            if defn and not desc:
                desc = defn["description"]
            settings.append(CliSetting(key=key, description=desc, type=stype, value=val, scope=scope))
        i += 1
    return settings


@router.get("", response_model=list[CliSetting])
async def list_cli_settings() -> list[CliSetting]:
    """List all kiro-cli settings with current values."""
    try:
        raw = await _run_cli("list", "--all")
        return _parse_list_output(raw)
    except HTTPException:
        # CLI not available — return definitions with no values
        return [CliSetting(key=d["key"], description=d["description"], type=d["type"]) for d in SETTING_DEFS]


@router.put("")
async def set_cli_setting(update: CliSettingUpdate) -> CliSetting:
    """Set a kiro-cli setting."""
    args = [update.key, update.value]
    if update.workspace:
        args.append("--workspace")
    else:
        args.append("--global")
    await _run_cli(*args)
    defn = SETTING_DEFS_MAP.get(update.key, {"description": "", "type": "string"})
    return CliSetting(
        key=update.key,
        description=defn["description"],
        type=defn["type"],
        value=update.value,
        scope="workspace" if update.workspace else "global",
    )


@router.delete("")
async def delete_cli_setting(body: CliSettingDelete) -> dict:
    """Delete (unset) a kiro-cli setting."""
    args = ["--delete", body.key]
    if body.workspace:
        args.append("--workspace")
    else:
        args.append("--global")
    await _run_cli(*args)
    return {"deleted": body.key}
