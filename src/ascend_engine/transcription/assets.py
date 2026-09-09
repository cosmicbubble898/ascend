"""Fail closed before loading model files or opening selected audio."""

import hashlib
import json
from pathlib import Path


class AssetError(Exception):
    pass


def verify_bundle(directory: Path, manifest_path: Path) -> None:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for entry in manifest["files"]:
            name = entry["name"]
            if not isinstance(name, str) or Path(name).name != name or name in (".", ".."):
                raise AssetError("model_integrity")
            asset = directory / name
            if asset.is_symlink() or not asset.is_file() or asset.stat().st_size != entry["bytes"]:
                raise AssetError("model_integrity")
            with asset.open("rb") as source:
                digest = hashlib.file_digest(source, "sha256").hexdigest()
            if digest != entry["sha256"]:
                raise AssetError("model_integrity")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise AssetError("model_integrity") from exc
