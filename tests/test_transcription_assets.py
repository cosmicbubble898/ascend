import hashlib
import json
from pathlib import Path

import pytest

from ascend_engine.transcription.assets import AssetError, verify_bundle


def test_modified_model_is_rejected_before_loading(tmp_path: Path) -> None:
    model = tmp_path / "model.onnx"
    model.write_bytes(b"model")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "files": [
                    {
                        "name": "model.onnx",
                        "bytes": 5,
                        "sha256": hashlib.sha256(b"model").hexdigest(),
                    }
                ]
            }
        )
    )
    verify_bundle(tmp_path, manifest)
    model.write_bytes(b"other")
    with pytest.raises(AssetError, match="model_integrity"):
        verify_bundle(tmp_path, manifest)
