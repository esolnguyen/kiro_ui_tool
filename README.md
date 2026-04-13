# Kiro Agent Manager

A visual dashboard for managing Kiro AI agents, commands, skills, and pipelines. A full GUI layer over the `~/.kiro` directory — no markdown editing required.

## Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 18, TypeScript, Vite, Zustand, React Router v6, xterm.js, ReactFlow, CodeMirror 6, Lucide icons |
| **Backend** | FastAPI, Python 3.11+, uvicorn, python-frontmatter, ptyprocess, websockets, httpx, GitPython |
| **Data** | YAML frontmatter markdown files in `~/.kiro/`, JSON for pipelines and runs |

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Kiro CLI** — the `kiro` (or `kiro.exe` on Windows/WSL) binary must be installed and available on PATH, or configured manually in Settings

## Installation & Local Development

### Option 1: Quick Start (both servers)

```bash
# 1. Clone the repo
git clone <repo-url> && cd kiro-agents-ui

# 2. Install backend dependencies
cd backend
pip install -r requirements.txt
cd ..

# 3. Install frontend dependencies
cd frontend
npm install
cd ..

# 4. Start both servers
./start.sh
```

This starts the backend on **http://localhost:8000** and the frontend dev server on **http://localhost:5173**, then waits for `Ctrl+C` to stop both.

### Option 2: Run backend and frontend separately

This is useful when you want to restart one without affecting the other.

**Backend:**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend (in a separate terminal):**

```bash
cd frontend
npm install
npm run dev
```

### Option 3: Install as a Python package

The backend can be installed as a package, which gives you the `kiro-management` CLI:

```bash
cd backend
pip install .

# Start the server
kiro-management                   # http://localhost:8000
kiro-management --port 9000       # custom port
kiro-management --reload          # auto-reload for development
```

You still need to build and serve the frontend separately for development, or build it for production (see below).

### Accessing the app

- **Development:** Open **http://localhost:5173**. The Vite dev server proxies `/api` and `/ws` requests to the backend at `localhost:8000`.
- **Production:** Build the frontend (`npm run build` in `frontend/`) and the FastAPI backend will serve the built files as static assets automatically from **http://localhost:8000**.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KIRO_DIR` | `~/.kiro` | Override Kiro config directory |
| `KIRO_CLI_PATH` | auto-detect | Path to the kiro-cli binary |

### Settings (In-App)

All settings are managed through the **Settings** page in the UI and persisted to `~/.kiro/settings.json`.

#### Kiro Directory

Override where Kiro stores agents, commands, and skills. Default: `~/.kiro`.

#### Kiro CLI Path

Path to the `kiro` binary. Leave empty for auto-detection. On WSL, point this to the Windows path, e.g. `/mnt/c/Users/you/AppData/Local/Programs/Kiro/kiro.exe`. The app shows a green/red status indicator to confirm if the CLI was found.

#### Default Model

Choose the default model for new agents and sessions:

- **Sonnet** — Fast and capable (default)
- **Opus** — Most capable
- **Haiku** — Fastest, lightweight

#### Theme

Choose between **Light**, **Dark**, or **System** (follows OS preference).

#### Behavior

- **Permission Mode** — Controls how Kiro handles tool usage:
  - `Auto` — Kiro decides which tools to use automatically
  - `Ask` — Kiro asks before using tools that modify files (default)
  - `Deny` — No tools allowed, text-only responses
- **Extended Thinking** — Enable extended thinking mode for all conversations

#### Status Line

Show dynamic status in the terminal status line. Set the type to **Command (bash)** and provide a shell command (e.g. `git branch --show-current`). Set to **None** to disable.

#### Azure DevOps Integration

Connect to Azure DevOps to browse work items and pull requests from the Workplace view:

1. **Organization** — Your Azure DevOps organization name (e.g. `mycompany`)
2. **Project** — The project containing your work items (e.g. `MyProject`)
3. **Personal Access Token** — Create one at `dev.azure.com/{org}` > User Settings > Personal Access Tokens. Required scope: **Work Items: Read & Write**
4. **API Version** — Azure DevOps REST API version (default: `7.1`)

#### Hooks

Run shell commands automatically when Kiro performs certain actions. Each hook has:

- **Event** — When to trigger:
  - `PreToolUse` — Before Kiro uses a tool
  - `PostToolUse` — After Kiro uses a tool
  - `Notification` — When the system sends a notification
  - `Stop` — When the session finishes
  - `SubagentStop` — When a background sub-agent finishes
- **Command** — The shell command to run (e.g. `echo 'tool used' >> ~/kiro-log.txt`)
- **Matcher** (optional) — Restrict to a specific tool (e.g. `Bash` to only trigger for Bash tool usage)

Hooks can be individually toggled on/off without removing them.

## Features

### Agents

Create, edit, and manage AI agents with configurable model (Sonnet/Opus/Haiku), color, and memory settings. Agents are stored as markdown with YAML frontmatter in `~/.kiro/agents/`. Edit history is tracked automatically with up to 20 versions.

### Commands

Define slash commands (e.g., `/analyze`, `/refactor`) with optional agent linking, tool restrictions via `allowedTools`, and argument hints. Stored in `~/.kiro/commands/`.

### Skills

Reusable capabilities that extend agents. Support conditional (`when`) or automatic (`always`) context injection. Stored in `~/.kiro/skills/`.

### Pipelines

Multi-stage agent workflows with sequential execution through the terminal:

- **Stage configuration** — Each stage has an assigned agent, a prompt template, and a gate type (`auto`, `approval`, `manual_input`)
- **Template variables** — Prompts support `{{input.fieldName}}` and `{{stages.stageId.output}}` resolution
- **Pipeline input** — Define typed input fields (text, textarea, ADO PBI reference)
- **Live tracking** — WebSocket-powered status bar with progress visualization
- **Gates** — Human-in-the-loop approval and manual input stages
- **Handoff context** — Auto-generated context block between stages so each agent knows what previous stages did

### Workplace (Azure DevOps + Terminal)

Split-panel workspace for executing work:

- **Left panel** — Browse Azure DevOps work items and pull requests with filtering by type, state, area, repo, and creator. Create new PBIs. View item details and kick off agent or pipeline execution.
- **Right panel** — Embedded xterm.js terminal with WebSocket PTY. Runs `kiro-cli chat --agent <slug>` sessions. Pipeline status bar sits above the terminal showing real-time stage progress with approve/reject/input controls.
- **Run modes** — Execute work items with a single agent or a full pipeline. The pipeline drives the terminal automatically — each stage launches the configured agent with a resolved prompt.

### MCP (Model Context Protocol)

Add, remove, enable, and configure MCP tool servers. Each server has a command, arguments, and environment variables. Stored in settings.

### GitHub Import

Scan GitHub repositories for agents and skills, auto-detect from standard directory structures, and import with conflict detection. Maintains local clones in `~/.kiro/github/`.

### Dashboard

Overview with animated stat cards (agents, commands, skills, pipelines), model distribution chart, recent agents list, and quick action shortcuts to pipelines, MCP, and skills.

## Architecture

### Data Storage

All data lives in `~/.kiro/`:

```
~/.kiro/
├── agents/              # Markdown + YAML frontmatter
│   └── .history/        # Version history (JSON)
├── commands/            # Markdown + YAML frontmatter
├── skills/              # Each skill in its own directory with SKILL.md
├── pipelines/           # JSON
├── pipeline-runs/       # JSON execution records
├── github/              # Cloned repos
├── settings.json        # Global settings + MCP + hooks
└── cli-history/         # Terminal session logs
```

### API

**REST** (FastAPI):

| Endpoint | Description |
|----------|-------------|
| `/api/agents` | Agent CRUD |
| `/api/commands` | Command CRUD |
| `/api/skills` | Skill CRUD |
| `/api/pipelines` | Pipeline CRUD |
| `/api/pipelines/runs` | Pipeline execution + stage management |
| `/api/ado/pbis` | Azure DevOps work items |
| `/api/ado/pull-requests` | Azure DevOps PRs |
| `/api/mcp` | MCP server management |
| `/api/settings` | Settings + hooks |
| `/api/github/scan` | Scan repo for importable items |
| `/api/github/import` | Import agents/skills from GitHub |
| `/api/relationships` | Entity relationship graph |
| `/api/health` | Health check with CLI + ADO status |

**WebSocket**:

| Endpoint | Description |
|----------|-------------|
| `/ws/terminal/{sessionId}` | Interactive PTY terminal |
| `/ws/pipeline-runs/{runId}` | Live pipeline run updates |
| `/ws/chat/{sessionId}` | Chat streaming |

### Frontend State

- **Zustand store** (`appStore`) — Global state for agents, commands, skills, pipelines, settings
- **WorkplaceContext** — Workplace-scoped state: tabs, modals, terminal, active pipeline run, stage dispatch
- **useTerminal hook** — xterm.js lifecycle, WebSocket connection, prompt detection, auto-send

## Project Structure

```
kiro-agents-ui/
├── start.sh                       # Launch both servers
├── backend/
│   ├── main.py                    # uvicorn entrypoint
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py            # FastAPI app factory, CORS, lifespan
│       ├── core/                  # kiro_dir, frontmatter, cli, slugify
│       ├── models/                # Pydantic schemas (one per domain)
│       ├── routers/               # API endpoints (one per domain)
│       └── services/              # Business logic + integrations
│           ├── frontmatter_crud.py    # Generic CRUD for .md entities
│           ├── pipeline_engine.py     # Pipeline orchestration
│           ├── ado_client.py          # Azure DevOps API client
│           ├── kiro_session.py        # Background CLI session mgmt
│           ├── github_sync.py         # Git clone/pull + detection
│           └── settings_store.py      # JSON settings persistence
└── frontend/
    ├── package.json
    ├── vite.config.ts             # Dev proxy to :8000
    └── src/
        ├── App.tsx                # Route definitions
        ├── api/                   # Typed axios clients
        ├── components/
        │   ├── common/            # Layout, Sidebar, PageHeader, EmptyState
        │   ├── workplace/         # WorkplaceContext, TerminalPanel, PipelineStatusBar
        │   ├── pipelines/         # PipelineBuilder (ReactFlow editor)
        │   └── ...
        ├── pages/                 # Route-level components
        │   ├── DashboardPage/
        │   ├── AgentsPage/
        │   ├── CommandsPage/
        │   ├── SkillsPage/
        │   ├── PipelinesPage/
        │   ├── WorkplacePage/
        │   ├── McpPage/
        │   └── SettingsPage/
        ├── hooks/                 # useTerminal, useWorkItems, usePullRequests
        ├── stores/                # Zustand (appStore)
        ├── types/                 # TypeScript interfaces
        └── utils/                 # models, colors, slugify
```

## Scripts

```bash
# Both servers
./start.sh               # Start backend + frontend together

# Frontend
npm run dev               # Start Vite dev server
npm run build             # Production build -> dist/
npm run typecheck         # TypeScript type checking
npm run lint              # ESLint

# Backend
uvicorn main:app --reload --port 8000   # Dev server with hot reload
```

## Security

- All file operations validated with `safe_path()` to prevent directory traversal
- Azure DevOps PAT stored locally in `~/.kiro/settings.json`
- Terminal sessions auto-terminate after 30 minutes of idle time
- CORS configured for local development only
