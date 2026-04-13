"""Central router registration.

Keeps main.py clean by collecting all route mounting in one place.
"""

from fastapi import FastAPI

from app.routers import (
    ado,
    agents,
    cli_settings,
    commands,
    generate,
    knowledge,
    skills,
    pipelines,
    settings,
    mcp,
    terminal,
    todos,
    github,
    chat_ws,
    files,
)


def register_routers(app: FastAPI) -> None:
    # ── REST routers ──────────────────────────────────────────────────────
    app.include_router(ado.router, prefix="/api/ado", tags=["ado"])
    app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
    app.include_router(knowledge.router, prefix="/api/agents", tags=["knowledge"])
    app.include_router(cli_settings.router, prefix="/api/cli-settings", tags=["cli-settings"])
    app.include_router(commands.router, prefix="/api/commands", tags=["commands"])
    app.include_router(skills.router, prefix="/api/skills", tags=["skills"])
    app.include_router(pipelines.router, prefix="/api/pipelines", tags=["pipelines"])
    app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
    app.include_router(mcp.router, prefix="/api/mcp", tags=["mcp"])
    app.include_router(todos.router, prefix="/api/todos", tags=["todos"])
    app.include_router(github.router, prefix="/api/github", tags=["github"])
    app.include_router(generate.router, prefix="/api/generate", tags=["generate"])
    app.include_router(chat_ws.router, prefix="/api/chat", tags=["chat"])
    app.include_router(chat_ws.ws_router, prefix="/ws", tags=["chat-ws"], include_in_schema=False)
    app.include_router(files.router, prefix="/api", tags=["files"])

    # ── Terminal: WebSocket + REST ────────────────────────────────────────
    app.include_router(terminal.ws_router, prefix="/ws", tags=["terminal"])
    app.include_router(terminal.rest_router, prefix="/api/terminal", tags=["terminal-rest"])

    # ── Pipeline runs: WebSocket ──────────────────────────────────────────
    app.include_router(pipelines.ws_router, prefix="/ws", tags=["pipeline-runs"], include_in_schema=False)
