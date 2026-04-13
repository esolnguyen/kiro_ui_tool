"""CLI entry point for kiro-management."""

import argparse
import uvicorn


def main():
    parser = argparse.ArgumentParser(prog="kiro-management", description="Kiro Agent Manager")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    args = parser.parse_args()

    url = f"http://{'localhost' if args.host == '0.0.0.0' else args.host}:{args.port}"
    print(f"\n  Kiro Agent Manager")
    print(f"  App running at: {url}\n")

    uvicorn.run("app:create_app", factory=True, host=args.host, port=args.port, reload=args.reload)
