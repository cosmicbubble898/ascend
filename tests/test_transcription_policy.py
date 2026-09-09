import pytest

from ascend_engine.transcription.policy import (
    AudioError,
    SampleBudget,
    TimedWord,
    owned_timed_words,
    owned_words,
    runtime_error_code,
)


def test_two_hours_are_inclusive_but_one_extra_sample_fails() -> None:
    budget = SampleBudget()
    budget.add(115_200_000)
    assert budget.seconds == 7200
    with pytest.raises(AudioError, match="too_long"):
        budget.add(1)


def test_native_oom_error_is_typed_without_exposing_its_contents() -> None:
    error = RuntimeError("C:\\private.wav: CUDA failure 2: out of memory")
    assert runtime_error_code(error) == "out_of_memory"
    assert (
        runtime_error_code(RuntimeError("private driver message"), loading=True)
        == "gpu_unavailable"
    )


def test_overlap_keeps_whole_words_and_legitimate_repetition() -> None:
    tokens = [" again", " again", " pro", "duct", "ivity", " matters"]
    times = [0.2, 1.0, 1.4, 1.5, 1.6, 2.2]
    assert owned_words(tokens, times, 0, 2) == "again again productivity"
    assert owned_words(tokens, times, 2, 3) == "matters"


def test_owned_words_keep_punctuation_timing_and_absolute_offset() -> None:
    tokens = [" One", " thought", ".", " Next", " thought", "?"]
    times = [0.1, 3, 3.1, 4, 5, 5.2]
    assert owned_timed_words(tokens, times, 0, 4, offset=27) == [
        TimedWord("One", 27.1, 27.1),
        TimedWord("thought.", 30, 30.1),
    ]
    assert owned_words(tokens, times, 0, 4) == "One thought."
