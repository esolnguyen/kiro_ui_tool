import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.kiro_dir import ensure_kiro_dir
from app.routers import register_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    kiro_dir = ensure_kiro_dir()
    for extra in ("chat-sessions", "cli-history", "github", "pipelines", "pipeline-runs"):
        (kiro_dir / extra).mkdir(parents=True, exist_ok=True)
    from app.routers.terminal import _cleanup_idle_sessions
    cleanup_task = asyncio.create_task(_cleanup_idle_sessions())

    # Check kiro-cli availability on startup
    from app.services.kiro_session import session_manager
    import logging
    cli_status = session_manager.check_cli()
    if cli_status.cli_found:
        logging.getLogger(__name__).info("Kiro CLI found at %s", cli_status.cli_path)
    else:
        logging.getLogger(__name__).warning("Kiro CLI not found: %s", cli_status.error)

    yield

    cleanup_task.cancel()
    session_manager.terminate_all()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Kiro Agent Manager API",
        description="REST + WebSocket API for managing Kiro agents, commands, skills, and workflows.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:4173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_routers(app)

    @app.get("/api/health")
    def health_check() -> dict:
        from app.services.kiro_session import session_manager
        from app.services.ado_client import get_connection_status
        ado = get_connection_status()
        return {
            "status": "ok",
            "app": "kiro-agent-manager",
            "kiro": session_manager.health(),
            "ado": ado.model_dump(),
        }

    # Serve bundled frontend static files
    frontend_dist = Path(__file__).parent / "static"
    if frontend_dist.exists():
        app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")

    return app
