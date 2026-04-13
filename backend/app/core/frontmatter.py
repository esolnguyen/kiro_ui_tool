import frontmatter as fm
from pathlib import Path


def parse_file(path: Path) -> tuple[dict, str]:
    """Returns (metadata_dict, body_string)."""
    post = fm.load(str(path))
    return dict(post.metadata), post.content


def write_file(path: Path, metadata: dict, body: str) -> None:
    """Write YAML frontmatter + markdown body to file."""
    post = fm.Post(body, **metadata)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        f.write(fm.dumps(post))
