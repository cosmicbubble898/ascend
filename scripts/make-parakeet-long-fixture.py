"""Generate exactly two hours and one-sample-over fixtures using public JFK test speech."""

import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from ascend_engine.transcription.pipeline import decode_audio  # noqa: E402

QA = ROOT / "runtime/parakeet-qa"
with (QA / "jfk.flac").open("rb") as source:
    samples = np.concatenate(list(decode_audio(source, "flac", lambda _: None)))
pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
for name, count in [("two-hours.wav", 115200000), ("too-long.wav", 115200001)]:
    with wave.open(str(QA / name), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(16000)
        remaining = count * 2
        while remaining:
            chunk = pcm[:remaining]
            target.writeframesraw(chunk)
            remaining -= len(chunk)
    print(name, count, flush=True)
