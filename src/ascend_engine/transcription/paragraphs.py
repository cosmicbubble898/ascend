"""Whitespace-only paragraphs from recognized punctuation and existing token timing."""

import re

from .policy import TimedWord

ABBREVIATIONS = {
    "mr.",
    "mrs.",
    "ms.",
    "dr.",
    "prof.",
    "sr.",
    "jr.",
    "st.",
    "vs.",
    "etc.",
    "e.g.",
    "i.e.",
    "a.m.",
    "p.m.",
    "no.",
    "fig.",
    "dept.",
    "inc.",
    "ltd.",
}


def sentence_end(text: str) -> bool:
    ending = text.rstrip("\"'\u201d\u2019)]}")
    if ending.endswith(("?", "!")):
        return True
    return (
        ending.endswith(".")
        and not ending.endswith("..")
        and ending.casefold() not in ABBREVIATIONS
        and re.fullmatch(r"(?:[A-Za-z]\.)+", ending) is None
    )


class ParagraphFormatter:
    def __init__(self) -> None:
        self._start: float | None = None
        self._break_pending = False

    def append(self, words: list[TimedWord]) -> str:
        parts: list[str] = []
        for word in words:
            if not word.text:
                continue
            if self._start is None:
                separator = ""
                self._start = word.start
            elif self._break_pending:
                separator = "\n\n"
                self._start = word.start
            else:
                separator = " "
            parts.extend((separator, word.text))
            self._break_pending = word.end - self._start >= 30 and sentence_end(word.text)
        return "".join(parts)
