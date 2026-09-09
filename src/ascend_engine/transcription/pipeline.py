"""Streaming local decode and overlap windows; imported only in the worker environment."""

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from itertools import chain
from math import isfinite
from typing import Any, BinaryIO

import av  # type: ignore[import-not-found]
import numpy as np  # type: ignore[import-not-found]

from .policy import MAX_SECONDS, RATE, AudioError, SampleBudget

FORMATS = {"wav", "mp3", "flac", "aac", "mov"}
CODECS = {
    "mp3",
    "mp3float",
    "aac",
    "aac_fixed",
    "flac",
    "pcm_s16le",
    "pcm_s24le",
    "pcm_s32le",
    "pcm_u8",
    "pcm_f32le",
    "pcm_f64le",
    "pcm_s16be",
    "pcm_s24be",
}


def decode_audio(
    source: BinaryIO, format_name: str, metadata: Callable[[float | None], None]
) -> Iterator[Any]:
    if format_name not in FORMATS:
        raise AudioError("invalid_file")
    budget = SampleBudget()
    try:
        with av.open(
            source,
            mode="r",
            format=format_name,
            options={"protocol_whitelist": "", "max_alloc": "67108864"},
        ) as container:
            if len(container.streams.audio) != 1:
                raise AudioError("invalid_file")
            stream = container.streams.audio[0]
            codec = stream.codec_context
            if (
                codec.name not in CODECS
                or not 8000 <= codec.sample_rate <= 192000
                or codec.channels not in (1, 2)
            ):
                raise AudioError("invalid_file")
            duration = (
                float(stream.duration * stream.time_base) if stream.duration is not None else None
            )
            if duration is not None and (not isfinite(duration) or duration <= 0):
                raise AudioError("invalid_file")
            if duration is not None and duration > MAX_SECONDS:
                raise AudioError("too_long")
            metadata(duration)
            resampler = av.AudioResampler(format="fltp", layout="mono", rate=RATE)
            # Flush the resampler to account for all decoded samples, including its final delay.
            for frame in chain(container.decode(stream), (None,)):
                for converted in resampler.resample(frame):
                    samples = converted.to_ndarray().reshape(-1)
                    if not np.isfinite(samples).all():
                        raise AudioError("decode_failed")
                    budget.add(int(samples.size))
                    yield samples
            if not budget.samples:
                raise AudioError("invalid_file")
    except (AudioError, MemoryError):
        raise
    except Exception as exc:
        raise AudioError("decode_failed") from exc


@dataclass
class Window:
    audio: Any
    offset: int
    start: int
    end: int


def windows(blocks: Iterator[Any]) -> Iterator[Window]:
    """Own a contiguous timeline; one second of context on each side of a join.

    Prefer quiet 200 ms boundaries at 26-28 seconds. A hard boundary still keeps
    overlap and whole-word timestamp ownership. Buffer stays at most 30 seconds.
    """
    capacity = 30 * RATE
    buffer = np.empty(capacity, dtype=np.float32)
    used = 0
    offset = 0
    owned_start = 0
    for block in blocks:
        position = 0
        while position < block.size:
            count = min(capacity - used, int(block.size) - position)
            buffer[used : used + count] = block[position : position + count]
            used += count
            position += count
            if used == capacity:
                cut = 28 * RATE
                for candidate in range(28 * RATE, 26 * RATE - 1, -RATE // 10):
                    region = buffer[candidate - RATE // 10 : candidate + RATE // 10]
                    if float(np.sqrt(np.mean(region * region))) < 0.004:
                        cut = candidate
                        break
                end = offset + cut
                yield Window(buffer[: cut + RATE].copy(), offset, owned_start, end)
                advance = cut - RATE
                buffer[: used - advance] = buffer[advance:used]
                used -= advance
                offset += advance
                owned_start = end
    if offset + used > owned_start:
        yield Window(buffer[:used].copy(), offset, owned_start, offset + used)
