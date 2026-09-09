"""Pure, independently tested limits shared by the decoder and worker."""

from dataclasses import dataclass
from math import isfinite

RATE = 16_000
MAX_SECONDS = 7200
MAX_SAMPLES = RATE * MAX_SECONDS
MAX_BYTES = 16 * 1024**3
MAX_MESSAGE = 2 * 1024**2


class AudioError(Exception):
    pass


def runtime_error_code(error: Exception, *, loading: bool = False) -> str:
    """Inspect native errors only in memory; never expose their text or paths."""
    detail = str(error).lower()
    if isinstance(error, MemoryError) or any(
        term in detail
        for term in (
            "out of memory",
            "failed to allocate memory",
            "bad_alloc",
            "cuda failure 2:",
        )
    ):
        return "out_of_memory"
    return "gpu_unavailable" if loading else "worker_failed"


@dataclass
class SampleBudget:
    samples: int = 0

    def add(self, count: int) -> None:
        if count < 0:
            raise AudioError("invalid_file")
        if self.samples + count > MAX_SAMPLES:
            raise AudioError("too_long")
        self.samples += count

    @property
    def seconds(self) -> float:
        return self.samples / RATE


@dataclass(frozen=True)
class TimedWord:
    text: str
    start: float
    end: float


def owned_timed_words(
    tokens: list[str], timestamps: list[float], start: float, end: float, *, offset: float = 0
) -> list[TimedWord]:
    """Keep whole words whose start belongs to this window's non-overlap interval.

    Parakeet emits space-prefixed word starts and unprefixed continuation tokens.
    Matching ownership by time preserves repeated words; text is never globally deduplicated.
    """
    if len(tokens) != len(timestamps) or not isfinite(offset):
        raise AudioError("worker_failed")
    words: list[TimedWord] = []
    word = ""
    time = -1.0
    word_end = -1.0
    previous = -1.0
    for token, timestamp in zip(tokens, timestamps, strict=True):
        if not isfinite(timestamp) or timestamp < previous or len(token) > 1000:
            raise AudioError("worker_failed")
        previous = timestamp
        if token.startswith(" ") or not word:
            if word and start <= time < end:
                words.append(TimedWord(word.strip(), time + offset, word_end + offset))
            word, time = token, timestamp
        else:
            word += token
        word_end = timestamp
    if word and start <= time < end:
        words.append(TimedWord(word.strip(), time + offset, word_end + offset))
    return words


def owned_words(tokens: list[str], timestamps: list[float], start: float, end: float) -> str:
    return " ".join(word.text for word in owned_timed_words(tokens, timestamps, start, end))
