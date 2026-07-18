"""Minimal executable entry point used by the early packaging spike."""

import sys
from collections.abc import Sequence

ENGINE_VERSION = "0.0.0"


def main(argv: Sequence[str] | None = None) -> int:
    """Return a deterministic result without starting product services."""
    arguments = tuple(sys.argv[1:] if argv is None else argv)
    if not arguments:
        return 0
    if arguments == ("--version",):
        print(f"Ascend engine {ENGINE_VERSION}")
        return 0

    print("Unsupported Ascend engine argument.", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
