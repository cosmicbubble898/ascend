"""Fixed helper launch contract shared by checkout and packaged runtime."""

import sys
from pathlib import Path


def helper_args(module: str, *args: str) -> list[str]:
    if module not in ("accessibility", "local_classifier"):
        raise ValueError("invalid_helper")
    root = Path(__file__).resolve().parents[3]
    return [
        sys.executable,
        "-I",
        "-B",
        str(root / "scripts/productivity-entry.py"),
        "ascend_engine.productivity." + module,
        *args,
    ]
