import pytest

from ascend_engine.transcription.paragraphs import ParagraphFormatter
from ascend_engine.transcription.policy import TimedWord


def test_paragraph_waits_for_sentence_end_even_across_inference_windows() -> None:
    formatter = ParagraphFormatter()
    first = formatter.append(
        [TimedWord("First", 0, 0.4), TimedWord("sentence.", 12, 12.6), TimedWord("Still", 27, 27.5)]
    )
    assert first == "First sentence. Still"
    second = formatter.append([TimedWord("continuing", 30, 30.5), TimedWord("here.", 34, 34.5)])
    assert second == " continuing here."
    last = formatter.append([TimedWord("Next", 35, 35.5), TimedWord("paragraph.", 38, 38.5)])
    assert first + second + last == "First sentence. Still continuing here.\n\nNext paragraph."


@pytest.mark.parametrize("token", ["Dr.", "Ms.", "A.", "U.S.", "e.g.", "3.14", "waiting..."])
def test_abbreviations_initials_decimals_and_ellipses_do_not_split(token: str) -> None:
    formatter = ParagraphFormatter()
    text = formatter.append(
        [TimedWord("Begin", 0, 1), TimedWord(token, 31, 31.5), TimedWord("here.", 34, 35)]
    )
    text += formatter.append([TimedWord("Next.", 40, 41)])
    assert text == f"Begin {token} here.\n\nNext."


@pytest.mark.parametrize(
    "ending", ['done."', "done.\u2019", "done.)", "done?", "done!", "done.\u201d"]
)
def test_sentence_end_keeps_its_closing_quote_or_bracket(ending: str) -> None:
    formatter = ParagraphFormatter()
    text = formatter.append([TimedWord("Begin", 0, 1), TimedWord(ending, 31, 32)])
    assert text + formatter.append([TimedWord("Next", 33, 34)]) == f"Begin {ending}\n\nNext"


def test_no_mid_sentence_cut_or_lost_partial_text_and_repetition_survives() -> None:
    formatter = ParagraphFormatter()
    words = [TimedWord("again", second, second + 0.2) for second in range(10, 100)]
    first = formatter.append(words[:40])
    assert formatter.append([]) == ""
    second = formatter.append(words[40:])
    assert first + second == " ".join(word.text for word in words)
    assert not (first + second).endswith("\n")
    assert ParagraphFormatter().append([TimedWord("Fresh", 200, 200.5)]) == "Fresh"


def test_timing_starts_at_first_word_not_the_start_of_silence() -> None:
    formatter = ParagraphFormatter()
    text = formatter.append([TimedWord("Begin.", 100, 101), TimedWord("Continue.", 112, 113)])
    assert text == "Begin. Continue."
    assert formatter.append([TimedWord("Finish.", 132, 133)]) == " Finish."
    assert formatter.append([]) == ""
    assert formatter.append([TimedWord("After", 1000, 1001)]) == "\n\nAfter"
