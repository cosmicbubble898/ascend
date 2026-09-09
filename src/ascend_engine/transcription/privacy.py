"""Additional Python audit policy; Windows AppContainer enforces native networking."""

import ctypes
import os
import sys
from ctypes import wintypes

from .policy import AudioError


class PrivacyError(PermissionError, AudioError):
    """Behaves like an OS denial for optional platform probes in dependencies."""


def require_appcontainer() -> None:
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    security = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    security.OpenProcessToken.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.HANDLE),
    ]
    security.GetTokenInformation.argtypes = [
        wintypes.HANDLE,
        ctypes.c_int,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD),
    ]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    token = wintypes.HANDLE()
    if not security.OpenProcessToken(kernel.GetCurrentProcess(), 8, ctypes.byref(token)):
        raise AudioError("sandbox_unavailable")
    try:
        value = wintypes.DWORD()
        size = wintypes.DWORD()
        if (
            not security.GetTokenInformation(
                token, 29, ctypes.byref(value), ctypes.sizeof(value), ctypes.byref(size)
            )
            or value.value != 1
        ):
            raise AudioError("sandbox_unavailable")
        groups = ctypes.create_string_buffer(4096)
        if not security.GetTokenInformation(token, 30, groups, len(groups), ctypes.byref(size)):
            raise AudioError("sandbox_unavailable")
        if wintypes.DWORD.from_buffer(groups).value != 0:
            raise AudioError("sandbox_unavailable")
    finally:
        kernel.CloseHandle(token)


def forbid_python_network_and_writes(event: str, args: tuple[object, ...]) -> None:
    if event in {
        "socket.__new__",
        "socket.connect",
        "socket.bind",
        "socket.getaddrinfo",
        "subprocess.Popen",
        "os.system",
    }:
        raise PrivacyError("privacy_boundary")
    if event == "open" and len(args) == 3:
        if isinstance(args[0], str) and args[0].lower() == os.devnull.lower():
            return
        flags = args[2]
        if isinstance(flags, int) and flags & (
            os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND
        ):
            raise PrivacyError("privacy_boundary")


def enforce_privacy() -> None:
    require_appcontainer()
    sys.addaudithook(forbid_python_network_and_writes)
