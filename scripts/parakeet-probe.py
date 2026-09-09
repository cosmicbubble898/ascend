"""Public/synthetic development probe, executed inside the same Windows sandbox."""

import ctypes
import json
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "runtime/parakeet-env/Lib/site-packages"))


def main():
    from ascend_engine.transcription.privacy import require_appcontainer

    require_appcontainer()
    print("appcontainer_zero_capabilities_verified", flush=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateFileW.restype = ctypes.c_void_p
    kernel.CreateFileW.argtypes = [
        ctypes.c_wchar_p,
        ctypes.c_uint32,
        ctypes.c_uint32,
        ctypes.c_void_p,
        ctypes.c_uint32,
        ctypes.c_uint32,
        ctypes.c_void_p,
    ]
    for target, access, disposition in [
        (ROOT / "runtime/parakeet-qa/private-canary.txt", 0x80000000, 3),
        (ROOT / "runtime/parakeet-model/write-denial-canary.txt", 0x40000000, 1),
    ]:
        handle = kernel.CreateFileW(str(target), access, 1, None, disposition, 0, None)
        if handle != ctypes.c_void_p(-1).value or ctypes.get_last_error() != 5:
            raise RuntimeError("native_file_policy_failed")
    print("native_ungranted_read_and_model_write_denied", flush=True)
    blocked = []
    # Real Winsock calls (no mocks); loopback and external IPv4/IPv6 must be denied.
    for family, address in [
        (socket.AF_INET, ("1.1.1.1", 443)),
        (socket.AF_INET, ("127.0.0.1", 8765)),
        (socket.AF_INET6, ("2606:4700:4700::1111", 443)),
    ]:
        with socket.socket(family, socket.SOCK_STREAM) as connection:
            connection.settimeout(2)
            try:
                connection.connect(address)
                blocked.append(False)
            except OSError as exc:
                blocked.append(exc.winerror)
    print(json.dumps({"native_network_denied": blocked}), flush=True)
    if blocked[0] != 10013:
        raise RuntimeError("network_not_denied")
    from ascend_engine.transcription.privacy import forbid_python_network_and_writes

    attempts = {"network": 0, "content_write": 0}

    def audit(event, args):
        try:
            forbid_python_network_and_writes(event, args)
        except Exception:
            if event.startswith("socket."):
                attempts["network"] += 1
            if event == "open":
                attempts["content_write"] += 1
            raise

    sys.addaudithook(audit)
    import numpy as np

    from ascend_engine.transcription.model import load_local_model

    model = load_local_model(ROOT)
    result = model.recognize(np.zeros(16000, dtype=np.float32), sample_rate=16000)
    print(json.dumps({"warmup_text": result.text}), flush=True)
    # No real audio is opened in this initial readiness probe.
    print("gpu_warmup_passed", flush=True)
    print(
        json.dumps({"observed_python_attempts_during_model_load_and_inference": attempts}),
        flush=True,
    )
    assert attempts == {"network": 0, "content_write": 0}


if __name__ == "__main__":
    main()
