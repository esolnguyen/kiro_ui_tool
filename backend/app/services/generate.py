"""Generate agents/skills/commands via kiro-cli with full context."""

import json

from app.core.kiro_dir import get_kiro_dir
from app.routers.mcp import _load_servers


def _list_agents_summary() -> list[dict]:
    from app.routers.agents import crud as agents_crud
    try:
        return [{"slug": a.slug, "name": a.name, "description": a.description, "model": a.model} for a in agents_crud.list_all()]
    except Exception:
        return []


def _list_skills_summary() -> list[dict]:
    from app.routers.skills import list_skills
    try:
        return [{"slug": s.slug, "name": s.name, "description": s.description} for s in list_skills()]
    except Exception:
        return []


def _list_commands_summary() -> list[dict]:
    from app.routers.commands import crud as commands_crud
    try:
        return [{"slug": c.slug, "name": c.name, "description": c.description} for c in commands_crud.list_all()]
    except Exception:
        return []


def build_generation_prompt(entity_type: str, description: str) -> str:
    """Build the full prompt to send to kiro-cli."""
    parts: list[str] = []

    servers = _load_servers()
    if servers:
        parts.append(f"Available MCP servers:\n{json.dumps([{'name': s.name, 'command': s.command, 'args': s.args} for s in servers], indent=2)}")

    agents = _list_agents_summary()
    if agents:
        parts.append(f"Existing agents:\n{json.dumps(agents, indent=2)}")

    skills = _list_skills_summary()
    if skills:
        parts.append(f"Existing skills:\n{json.dumps(skills, indent=2)}")

    commands = _list_commands_summary()
    if commands:
        parts.append(f"Existing commands:\n{json.dumps(commands, indent=2)}")

    context = "\n\n".join(parts) if parts else "No existing entities or MCP servers found."
    kiro_dir = get_kiro_dir()

    return f"""Create a new Kiro {entity_type} based on the following description. Write the files directly to the kiro directory.

## Description
{description}

## Context
{context}

## Kiro Directory
{kiro_dir}

## Instructions
- For agents: create a .md file with frontmatter (name, description, model) and a .json config file in {kiro_dir}/agents/
- For skills: create a directory in {kiro_dir}/skills/<slug>/ with a SKILL.md file containing frontmatter (name, description, context)
- For commands: create a .md file with frontmatter (name, description) in {kiro_dir}/commands/
- Use the existing entities and MCP servers as reference for conventions and style
- Generate comprehensive instructions in the body
- Pick appropriate MCP servers from the available list if relevant to the {entity_type}'s purpose
"""
