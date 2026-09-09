"""Read only bounded UI Automation properties in a disposable helper process.

The caller enforces a timeout. No text/value pattern, input, or screenshot API is used.
COM slots follow Microsoft's UIAutomationClient.h interfaces.
"""

import ctypes as c
import json
import ntpath
import sys
from ctypes import wintypes as w
from typing import Any, ClassVar
from urllib.parse import urlsplit
from uuid import UUID


class Value(c.Union):
    _fields_: ClassVar[list[tuple[str, Any]]] = [
        ("integer", c.c_long),
        ("boolean", c.c_short),
        ("string", c.c_void_p),
        ("padding", c.c_byte * 16),
    ]


class Variant(c.Structure):
    _fields_ = [("type", c.c_ushort), ("reserved", c.c_ushort * 3), ("value", Value)]


def _method(pointer: c.c_void_p, slot: int, *arguments: Any) -> Any:
    table = c.cast(pointer, c.POINTER(c.POINTER(c.c_void_p))).contents
    return c.WINFUNCTYPE(c.c_long, c.c_void_p, *arguments)(table[slot])


def _property(element: c.c_void_p, identifier: int) -> int | bool | str:
    variant = Variant()
    clear = c.WinDLL("oleaut32").VariantClear
    clear.argtypes = [c.POINTER(Variant)]
    clear.restype = c.c_long
    try:
        code = _method(element, 10, c.c_int, c.POINTER(Variant))(
            element, identifier, c.byref(variant)
        )
        if code < 0:
            raise OSError("accessibility_unavailable")
        if variant.type == 3:
            return int(variant.value.integer)
        if variant.type == 11:
            return bool(variant.value.boolean)
        if variant.type == 8 and variant.value.string:
            return c.wstring_at(variant.value.string)[:2048]
        raise OSError("accessibility_unavailable")
    finally:
        clear(c.byref(variant))


def _domain(value: str) -> str:
    candidate = value.strip()
    if not candidate or len(candidate) > 2048:
        return ""
    parsed = urlsplit(candidate if "://" in candidate else "https://" + candidate)
    host = (parsed.hostname or "").casefold().rstrip(".")
    if (
        not host
        or len(host) > 253
        or not all(
            part and len(part) <= 63 and part.replace("-", "").isalnum() for part in host.split(".")
        )
    ):
        return ""
    return host


def _text_property(element: c.c_void_p, identifier: int) -> str:
    try:
        value = _property(element, identifier)
        return value if isinstance(value, str) else ""
    except OSError:
        return ""


def _process_name(process_id: int) -> str:
    kernel = c.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
    kernel.OpenProcess.restype = w.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes = [
        w.HANDLE,
        w.DWORD,
        w.LPWSTR,
        c.POINTER(w.DWORD),
    ]
    kernel.QueryFullProcessImageNameW.restype = w.BOOL
    kernel.CloseHandle.argtypes = [w.HANDLE]
    process = kernel.OpenProcess(0x1000, False, process_id)
    if not process:
        return ""
    try:
        value, size = c.create_unicode_buffer(32768), w.DWORD(32768)
        if not kernel.QueryFullProcessImageNameW(process, 0, value, c.byref(size)):
            return ""
        return ntpath.basename(value.value).casefold()
    finally:
        kernel.CloseHandle(process)


def inspect_focus(expected_process: int, app: str = "") -> dict[str, Any]:
    ole = c.WinDLL("ole32")
    ole.CoInitializeEx.argtypes = [c.c_void_p, c.c_ulong]
    ole.CoInitializeEx.restype = c.c_long
    ole.CoCreateInstance.argtypes = [
        c.c_void_p,
        c.c_void_p,
        c.c_ulong,
        c.c_void_p,
        c.POINTER(c.c_void_p),
    ]
    ole.CoCreateInstance.restype = c.c_long
    ole.CoUninitialize.argtypes = []
    ole.CoUninitialize.restype = None
    if ole.CoInitializeEx(None, 0) < 0:
        raise OSError("accessibility_unavailable")
    automation, element = c.c_void_p(), c.c_void_p()
    try:
        clsid = (c.c_byte * 16).from_buffer_copy(
            UUID("ff48dba4-60ef-4201-aa87-54103eef594e").bytes_le
        )
        iid = (c.c_byte * 16).from_buffer_copy(
            UUID("30cbe57d-d9d0-452a-ab13-7ac5ac4825ee").bytes_le
        )
        if ole.CoCreateInstance(c.byref(clsid), None, 1, c.byref(iid), c.byref(automation)) < 0:
            raise OSError("accessibility_unavailable")
        if (
            _method(automation, 8, c.POINTER(c.c_void_p))(automation, c.byref(element)) < 0
            or not element.value
        ):
            raise OSError("accessibility_unavailable")
        focused_process = _property(element, 30002)
        if not isinstance(focused_process, int) or (
            focused_process != expected_process
            and (not app or _process_name(focused_process) != app.casefold())
        ):
            raise OSError("accessibility_unavailable")
        password = _property(element, 30019)
        role = _property(element, 30003)
        result: dict[str, Any] = {"password": bool(password), "role": int(role)}
        if app.casefold() in {"chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe"}:
            name = _text_property(element, 30005)
            automation_id = _text_property(element, 30011)
            class_name = _text_property(element, 30012)
            marker = f"{name} {automation_id} {class_name}".casefold()
            if int(role) == 50004 and any(
                term in marker for term in ("address", "omnibox", "location", "urlbar", "search")
            ):
                domain = _domain(_text_property(element, 30045))
                if domain:
                    result["domain"] = domain
                    result["source"] = "focused_browser_address"
        return result
    finally:
        for pointer in (element, automation):
            if pointer.value:
                _method(pointer, 2)(pointer)
        ole.CoUninitialize()


if __name__ == "__main__":
    try:
        result = inspect_focus(int(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else "")
    except (OSError, ValueError, IndexError):
        result = {"unavailable": True}
    print(json.dumps(result), flush=True)
