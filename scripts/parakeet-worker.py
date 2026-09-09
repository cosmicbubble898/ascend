"""Fixed offline worker entry point. Private pipes, no source paths and no content logs."""

import base64
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "runtime/parakeet-env/Lib/site-packages"))

# Keep the protocol on its own duplicated handle. Native-library stdout/stderr is discarded.
PROTOCOL = os.fdopen(os.dup(sys.stdout.fileno()), "w", encoding="utf-8", buffering=1)
with open(os.devnull, "w") as discard:
    os.dup2(discard.fileno(), 1)
    os.dup2(discard.fileno(), 2)
os.environ["CUDA_CACHE_DISABLE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"

from ascend_engine.transcription.assets import AssetError  # noqa: E402
from ascend_engine.transcription.paragraphs import ParagraphFormatter  # noqa: E402
from ascend_engine.transcription.policy import (  # noqa: E402
    MAX_MESSAGE,
    RATE,
    AudioError,
    owned_timed_words,
    runtime_error_code,
)
from ascend_engine.transcription.privacy import enforce_privacy  # noqa: E402
from ascend_engine.transcription.stream import BrokeredAudio  # noqa: E402


def emit(kind, **values):
    message = json.dumps({"type": kind, **values}, ensure_ascii=True)
    if len(message) > MAX_MESSAGE:
        raise AudioError("worker_failed")
    PROTOCOL.write(message + "\n")
    PROTOCOL.flush()


def receive():
    line = sys.stdin.buffer.readline(MAX_MESSAGE + 1)
    if not line or len(line) > MAX_MESSAGE:
        raise AudioError("worker_failed")
    message = json.loads(line)
    if not isinstance(message, dict):
        raise AudioError("worker_failed")
    if message.get("type") == "cancel":
        raise AudioError("canceled")
    return message


def read_range(offset, length):
    emit("read", offset=offset, length=length)
    message = receive()
    if message.get("type") != "data" or not isinstance(message.get("data"), str):
        raise AudioError("worker_failed")
    return base64.b64decode(message["data"], validate=True)


def main():
    enforce_privacy()
    from ascend_engine.transcription.model import load_local_model
    from ascend_engine.transcription.pipeline import decode_audio, windows

    model = load_local_model(ROOT)
    emit("ready", backend="CUDA", model="Parakeet TDT 0.6B v2")
    command = receive()
    if (
        command.get("type") != "start"
        or type(command.get("bytes")) is not int
        or command.get("format") not in {"wav", "flac", "mp3", "aac", "mov"}
    ):
        raise AudioError("invalid_file")
    source = BrokeredAudio(command["bytes"], read_range)
    blocks = decode_audio(
        source, command["format"], lambda duration: emit("metadata", seconds=duration)
    )
    count = 0
    seconds = 0.0
    formatter = ParagraphFormatter()
    for chunk in windows(blocks):
        result = model.recognize(chunk.audio, sample_rate=RATE)
        words = owned_timed_words(
            result.tokens or [],
            result.timestamps or [],
            (chunk.start - chunk.offset) / RATE,
            (chunk.end - chunk.offset) / RATE,
            offset=chunk.offset / RATE,
        )
        text = formatter.append(words)
        count += len(text)
        if count > 2 * 1024**2:
            raise AudioError("transcript_limit")
        seconds = chunk.end / RATE
        emit("progress", seconds=seconds, text=text)
    emit("complete", seconds=seconds)


if __name__ == "__main__":
    try:
        main()
    except (AudioError, AssetError) as exc:
        emit("error", code=str(exc))
        sys.exit(1)
    except MemoryError:
        emit("error", code="out_of_memory")
        sys.exit(1)
    except Exception as exc:
        emit("error", code=runtime_error_code(exc))
        sys.exit(1)
