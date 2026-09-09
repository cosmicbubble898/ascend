"""Public-fixture end-to-end proof through the production AppContainer and pipe broker."""

import base64
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / "runtime/parakeet-qa"


def run(source_path):
    command = [
        str(ROOT / "runtime/uv-python-0.11.29/cpython-3.13.14-windows-x86_64-none/pythonw.exe"),
        "-I",
        "-B",
        "-u",
        str(ROOT / "scripts/parakeet-sandbox.py"),
    ]
    started = time.monotonic()
    process = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    texts = []
    events = []
    try:
        with source_path.open("rb") as source:
            for line in process.stdout:
                event = json.loads(line)
                kind = event["type"]
                if kind == "read":
                    assert 0 <= event["offset"] <= source_path.stat().st_size
                    assert 0 < event["length"] <= 1024**2
                    source.seek(event["offset"])
                    response = {
                        "type": "data",
                        "data": base64.b64encode(source.read(event["length"])).decode("ascii"),
                    }
                elif kind == "ready":
                    response = {
                        "type": "start",
                        "bytes": source_path.stat().st_size,
                        "format": "mov"
                        if source_path.suffix.lower() in (".mp4", ".m4a")
                        else source_path.suffix.lstrip("."),
                    }
                    print("cuda_ready", round(time.monotonic() - started, 2), flush=True)
                else:
                    events.append(event)
                    if kind == "progress":
                        texts.append(event["text"])
                        print("processed_seconds", event["seconds"], flush=True)
                    elif kind in ("complete", "error"):
                        print(json.dumps(event), flush=True)
                    continue
                process.stdin.write(json.dumps(response) + "\n")
                process.stdin.flush()
        process.wait(timeout=10)
        assert events[-1]["type"] == "complete", events[-1]
        transcript = "".join(texts)
        assert "country" in transcript.lower(), "missing public fixture speech"
        report = {
            "elapsed_seconds": round(time.monotonic() - started, 2),
            "audio_seconds": events[-1]["seconds"],
            "chunks": len(texts),
            "first": texts[0],
            "middle": texts[len(texts) // 2],
            "last": texts[-1],
        }
        print(json.dumps(report), flush=True)
        return report
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=10)


if __name__ == "__main__":
    QA.mkdir(exist_ok=True)
    fixture = QA / "jfk.flac"
    if not fixture.exists():
        # Setup/QA only, before spawning the offline worker. This is public test speech.
        urllib.request.urlretrieve(
            "https://raw.githubusercontent.com/openai/whisper/main/tests/jfk.flac", fixture
        )
    run(Path(sys.argv[1]) if len(sys.argv) > 1 else fixture)
