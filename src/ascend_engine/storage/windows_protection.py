"""Small Windows current-user DPAPI adapter. No plaintext disk fallback."""

import ctypes as c
import os
import stat
from ctypes import wintypes as w
from pathlib import Path


class Blob(c.Structure):
    _fields_ = [("size", w.DWORD), ("data", c.c_void_p)]


def _crypt(data: bytes, entropy_value: bytes, *, decrypt: bool = False) -> bytes:
    crypt = c.WinDLL("crypt32", use_last_error=True)
    kernel = c.WinDLL("kernel32", use_last_error=True)
    function = crypt.CryptUnprotectData if decrypt else crypt.CryptProtectData
    function.argtypes = [
        c.POINTER(Blob),
        c.c_void_p,
        c.POINTER(Blob),
        c.c_void_p,
        c.c_void_p,
        w.DWORD,
        c.POINTER(Blob),
    ]
    function.restype = w.BOOL
    kernel.LocalFree.argtypes = [c.c_void_p]
    kernel.LocalFree.restype = c.c_void_p
    buffer = c.create_string_buffer(data)
    entropy_buffer = c.create_string_buffer(entropy_value)
    source = Blob(len(data), c.cast(buffer, c.c_void_p))
    entropy = Blob(len(entropy_buffer.raw), c.cast(entropy_buffer, c.c_void_p))
    output = Blob()
    if not function(c.byref(source), None, c.byref(entropy), None, None, 1, c.byref(output)):
        raise OSError("vault_protection_failed")
    try:
        return c.string_at(output.data, output.size)
    finally:
        kernel.LocalFree(output.data)


def protect(data: bytes, *, decrypt: bool = False) -> bytes:
    return _crypt(data, b"Ascend.Personal.Productivity.v1", decrypt=decrypt)


def local_vault_path() -> Path:
    # CSIDL_LOCAL_APPDATA resolves the Windows known folder rather than trusting
    # a renderer path or an environment override.
    shell = c.WinDLL("shell32", use_last_error=True)
    shell.SHGetFolderPathW.argtypes = [w.HWND, c.c_int, w.HANDLE, w.DWORD, w.LPWSTR]
    shell.SHGetFolderPathW.restype = c.c_long
    buffer = c.create_unicode_buffer(32768)
    if shell.SHGetFolderPathW(None, 0x1C, None, 0, buffer) != 0:
        raise OSError("local_storage_unavailable")
    root = Path(buffer.value)
    if not root.is_absolute() or str(root).startswith("\\\\"):
        raise OSError("local_storage_unavailable")
    return root / "Ascend" / "Productivity" / "activity.vault"


def anthropic_key_path() -> Path:
    return local_vault_path().with_name("anthropic.key")


def anthropic_analysis_key_path() -> Path:
    return local_vault_path().with_name("anthropic-analysis.key")


def save_anthropic_key(value: str) -> None:
    _save_anthropic_key(value, anthropic_key_path(), b"Ascend.Anthropic.Key.v1")


def save_anthropic_analysis_key(value: str) -> None:
    _save_anthropic_key(value, anthropic_analysis_key_path(), b"Ascend.Anthropic.Analysis.Key.v1")


def _save_anthropic_key(value: str, path: Path, entropy: bytes) -> None:
    if (
        not value.startswith("sk-ant-")
        or not 40 <= len(value) <= 250
        or any(ch.isspace() for ch in value)
    ):
        raise ValueError("invalid_anthropic_key")
    path.parent.mkdir(parents=True, exist_ok=True)
    for item in (path.parent, path):
        if item.exists() and item.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise OSError("secret_path_unsafe")
    pending = path.with_suffix(".pending")
    try:
        pending.write_bytes(b"ASCEND-ANTHROPIC-1\0" + _crypt(value.encode(), entropy))
        os.replace(pending, path)
    finally:
        pending.unlink(missing_ok=True)


def load_anthropic_key() -> str:
    return _load_anthropic_key(anthropic_key_path(), b"Ascend.Anthropic.Key.v1")


def load_anthropic_analysis_key() -> str:
    return _load_anthropic_key(anthropic_analysis_key_path(), b"Ascend.Anthropic.Analysis.Key.v1")


def _load_anthropic_key(path: Path, entropy: bytes) -> str:
    data = path.read_bytes()
    magic = b"ASCEND-ANTHROPIC-1\0"
    if not data.startswith(magic) or len(data) > 4096:
        raise ValueError("invalid_anthropic_key")
    return _crypt(data[len(magic) :], entropy, decrypt=True).decode("ascii")


def anthropic_key_configured() -> bool:
    try:
        return load_anthropic_key().startswith("sk-ant-")
    except (OSError, ValueError, UnicodeError):
        return False


def anthropic_analysis_key_configured() -> bool:
    try:
        return load_anthropic_analysis_key().startswith("sk-ant-")
    except (OSError, ValueError, UnicodeError):
        return False
