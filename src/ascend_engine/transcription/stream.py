"""Read-only seekable view of one broker-selected file. No paths or URLs."""

import io
from collections.abc import Callable

from .policy import MAX_BYTES, AudioError


class BrokeredAudio(io.RawIOBase):
    def __init__(self, size: int, read_range: Callable[[int, int], bytes]) -> None:
        super().__init__()
        if not 0 < size <= MAX_BYTES:
            raise AudioError("invalid_file")
        self.size = size
        self.position = 0
        self.read_range = read_range

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        bases = {io.SEEK_SET: 0, io.SEEK_CUR: self.position, io.SEEK_END: self.size}
        if whence not in bases or not 0 <= bases[whence] + offset <= self.size:
            raise AudioError("decode_failed")
        self.position = bases[whence] + offset
        return self.position

    def read(self, size: int = -1) -> bytes:
        if self.closed:
            raise AudioError("decode_failed")
        length = min(1024**2, self.size - self.position, size if size >= 0 else 1024**2)
        if length <= 0:
            return b""
        result = self.read_range(self.position, length)
        if len(result) != length:
            raise AudioError("source_changed")
        self.position += len(result)
        return result
