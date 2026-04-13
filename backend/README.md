# Kiro Agent Manager

A visual dashboard and API server for managing Kiro AI agents, MCP servers, commands, skills, and pipelines — a full GUI layer over the `~/.kiro` directory, no markdown editing required.

## Features

- **Agents** — Create, edit, and manage AI agents with configurable model, color, and memory settings
- **MCP Servers** — Add, remove, enable, and configure Model Context Protocol tool servers
- **Commands** — Define slash commands with optional agent linking and tool restrictions
- **Skills** — Reusable capabilities that extend agents with conditional or automatic context injection
- **Pipelines** — Multi-stage agent workflows with gates, template variables, and live tracking
- **Workplace** — Split-panel workspace with Azure DevOps integration and an embedded terminal
- **Dashboard** — Overview with stat cards, model distribution chart, and quick actions

## Stack

| Layer | Tech |
|-------|------|
| **Backend** | FastAPI, Python 3.10+, uvicorn, python-frontmatter, websockets, httpx |
| **Frontend** | React 18, TypeScript, Vite, Zustand, React Router v6, xterm.js |
| **Data** | YAML frontmatter markdown files in `~/.kiro/`, JSON for pipelines and settings |

## Installation

### From artifact feed

```bash
pip install kiro-agent-manager
```

### From source

```bash
cd backend
pip install .
```

## Usage

After installation, start the server with the `kiro-management` CLI:

```bash
kiro-management                   # start on http://localhost:8000
kiro-management --port 9000       # custom port
kiro-management --reload          # auto-reload for development
```

Or run directly with uvicorn:

```bash
uvicorn main:app --reload --port 8000
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KIRO_DIR` | `~/.kiro` | Override Kiro config directory |
| `KIRO_CLI_PATH` | auto-detect | Path to the Kiro CLI binary |

### In-App Settings

All settings are managed through the **Settings** page in the UI and persisted to `~/.kiro/settings.json`, including:

- Kiro directory and CLI path
- Default model (Sonnet / Opus / Haiku)
- Theme (Light / Dark / System)
- Permission mode (Auto / Ask / Deny)
- Azure DevOps integration (organization, project, PAT)
- Hooks (shell commands triggered by agent actions)

## API

### REST Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/agents` | Agent CRUD |
| `/api/commands` | Command CRUD |
| `/api/skills` | Skill CRUD |
| `/api/pipelines` | Pipeline CRUD + execution |
| `/api/mcp` | MCP server management |
| `/api/settings` | Settings + hooks |
| `/api/ado/pbis` | Azure DevOps work items |
| `/api/ado/pull-requests` | Azure DevOps PRs |
| `/api/health` | Health check |

### WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `/ws/terminal/{sessionId}` | Interactive PTY terminal |
| `/ws/pipeline-runs/{runId}` | Live pipeline run updates |

## Prerequisites

- **Python 3.10+**
- **Kiro CLI** — must be installed and on PATH, or configured in Settings

## License

MIT
