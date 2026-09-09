import io

from ascend_engine.transcription.stream import BrokeredAudio


def test_decoder_reads_only_bounded_ranges_from_approved_capability() -> None:
    reads: list[tuple[int, int]] = []

    def read(offset: int, length: int) -> bytes:
        reads.append((offset, length))
        return b"abcdef"[offset : offset + length]

    stream = BrokeredAudio(6, read)
    assert stream.read(3) == b"abc"
    assert stream.seek(-2, io.SEEK_END) == 4
    assert stream.read(2_000_000) == b"ef"
    assert stream.read(5) == b""
    assert reads == [(0, 3), (4, 2)]
