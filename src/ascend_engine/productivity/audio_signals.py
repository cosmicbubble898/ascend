"""Privacy-safe Windows audio signal. It observes output activity, never audio content."""

import ctypes as c
import ntpath
from ctypes import wintypes as w
from typing import Any, cast


class GUID(c.Structure):
    _fields_ = [("Data1", w.DWORD), ("Data2", w.WORD), ("Data3", w.WORD), ("Data4", c.c_ubyte * 8)]


def guid(value: str) -> GUID:
    import uuid

    return GUID.from_buffer_copy(uuid.UUID(value).bytes_le)


def _call(pointer: c.c_void_p, slot: int, restype: object, *args: object) -> object:
    table = c.cast(pointer, c.POINTER(c.POINTER(c.c_void_p))).contents
    factory = cast(Any, c.WINFUNCTYPE)
    return factory(restype, c.c_void_p, *[type(a) for a in args])(table[slot])(pointer, *args)


def _process_name(process_id: int) -> str:
    kernel = c.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
    kernel.OpenProcess.restype = w.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes = [w.HANDLE, w.DWORD, w.LPWSTR, c.POINTER(w.DWORD)]
    kernel.QueryFullProcessImageNameW.restype = w.BOOL
    kernel.CloseHandle.argtypes = [w.HANDLE]
    handle = kernel.OpenProcess(0x1000, False, process_id)
    if not handle:
        return ""
    try:
        value, size = c.create_unicode_buffer(32768), w.DWORD(32768)
        return (
            ntpath.basename(value.value).lower()
            if kernel.QueryFullProcessImageNameW(handle, 0, value, c.byref(size))
            else ""
        )
    finally:
        kernel.CloseHandle(handle)


def _endpoint_active(direction: int, process_id: int, app: str = "") -> bool:
    ole = c.OleDLL("ole32")
    ole.CoInitializeEx(None, 0)
    enumerator = c.c_void_p()
    device = c.c_void_p()
    manager = c.c_void_p()
    sessions = c.c_void_p()
    try:
        if ole.CoCreateInstance(
            c.byref(guid("BCDE0395-E52F-467C-8E3D-C4579291692E")),
            None,
            1,
            c.byref(guid("A95664D2-9614-4F35-A746-DE8DB63617E6")),
            c.byref(enumerator),
        ):
            return False
        if _call(enumerator, 4, c.c_long, w.DWORD(direction), w.DWORD(1), c.byref(device)):
            return False
        if _call(
            device,
            3,
            c.c_long,
            c.byref(guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F")),
            w.DWORD(23),
            None,
            c.byref(manager),
        ):
            return False
        if _call(manager, 5, c.c_long, c.byref(sessions)):
            return False
        count = w.INT()
        _call(sessions, 3, c.c_long, c.byref(count))
        for index in range(min(count.value, 256)):
            control = c.c_void_p()
            control2 = c.c_void_p()
            if _call(sessions, 4, c.c_long, w.INT(index), c.byref(control)):
                continue
            try:
                state = w.DWORD()
                _call(control, 3, c.c_long, c.byref(state))
                if state.value != 1:
                    continue
                if _call(
                    control,
                    0,
                    c.c_long,
                    c.byref(guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D")),
                    c.byref(control2),
                ):
                    continue
                pid = w.DWORD()
                _call(control2, 14, c.c_long, c.byref(pid))
                if pid.value == process_id or (app and _process_name(pid.value) == app.lower()):
                    return True
            finally:
                if control2:
                    _call(control2, 2, w.ULONG)
                if control:
                    _call(control, 2, w.ULONG)
        return False
    except Exception:
        return False
    finally:
        for item in (sessions, manager, device, enumerator):
            if item:
                _call(item, 2, w.ULONG)
        ole.CoUninitialize()


def process_audio_signals(process_id: int, app: str = "") -> dict[str, bool]:
    """Report render and capture activity separately, without opening audio streams."""
    return {
        "output": _endpoint_active(0, process_id, app),
        "input": _endpoint_active(1, process_id, app),
    }


def foreground_audio_active(process_id: int, app: str = "") -> bool:
    signals = process_audio_signals(process_id, app)
    return signals["output"] or signals["input"]
