"""Pinned Parakeet adapter. All assets local; CUDA is mandatory."""

from pathlib import Path
from typing import Any

import numpy as np  # type: ignore[import-not-found]
import onnx_asr  # type: ignore[import-not-found]
import onnxruntime as ort  # type: ignore[import-not-found]

from .assets import AssetError, verify_bundle
from .policy import AudioError, runtime_error_code


def load_local_model(root: Path) -> Any:
    try:
        return _load_local_model(root)
    except (AssetError, AudioError):
        raise
    except Exception as exc:
        raise AudioError(runtime_error_code(exc, loading=True)) from exc


def _load_local_model(root: Path) -> Any:
    verify_bundle(
        root / "runtime/parakeet-model", root / "docs/proposals/parakeet-model-manifest.json"
    )
    ort.disable_telemetry_events()
    ort.preload_dlls(directory="")
    if "CUDAExecutionProvider" not in ort.get_available_providers():
        raise AudioError("gpu_unavailable")
    options = ort.SessionOptions()
    options.log_severity_level = 4
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    options.enable_mem_pattern = False
    model = onnx_asr.load_model(
        "nemo-parakeet-tdt-0.6b-v2",
        path=root / "runtime/parakeet-model",
        providers=[
            (
                "CUDAExecutionProvider",
                {"gpu_mem_limit": 5 * 1024**3, "arena_extend_strategy": "kSameAsRequested"},
            )
        ],
        sess_options=options,
        preprocessor_config={"providers": ["CPUExecutionProvider"], "max_concurrent_workers": 1},
    )
    # These are the two inference sessions of the pinned onnx-asr 0.12.0 adapter.
    # Provider availability alone is insufficient: session creation can silently fall back.
    for session in (model.asr._encoder, model.asr._decoder_joint):
        if session.get_providers()[0] != "CUDAExecutionProvider":
            raise AudioError("gpu_unavailable")
        session.disable_fallback()
    timestamped = model.with_timestamps()
    timestamped.recognize(np.zeros(16000, dtype=np.float32), sample_rate=16000)
    return timestamped
