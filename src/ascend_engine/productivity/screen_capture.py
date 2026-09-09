"""Ephemeral capture of exactly the monitor containing a verified foreground window."""

import ctypes as c
import struct
import zlib
from ctypes import wintypes as w


class MonitorInfo(c.Structure):
    _fields_ = [
        ("size", w.DWORD),
        ("monitor", w.RECT),
        ("work", w.RECT),
        ("flags", w.DWORD),
        ("device", w.WCHAR * 32),
    ]


class BitmapInfoHeader(c.Structure):
    _fields_ = [
        ("size", w.DWORD),
        ("width", c.c_long),
        ("height", c.c_long),
        ("planes", w.WORD),
        ("bits", w.WORD),
        ("compression", w.DWORD),
        ("image_size", w.DWORD),
        ("x", c.c_long),
        ("y", c.c_long),
        ("used", w.DWORD),
        ("important", w.DWORD),
    ]


class BitmapInfo(c.Structure):
    _fields_ = [("header", BitmapInfoHeader), ("colors", w.DWORD * 3)]


def _chunk(kind: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    )


def capture_monitor(window: int, expected_monitor: str, max_width: int = 1280) -> bytearray:
    user, gdi = c.WinDLL("user32", use_last_error=True), c.WinDLL("gdi32", use_last_error=True)
    user.GetForegroundWindow.restype = w.HWND
    user.MonitorFromWindow.argtypes = [w.HWND, w.DWORD]
    user.MonitorFromWindow.restype = w.HANDLE
    user.GetMonitorInfoW.argtypes = [w.HANDLE, c.POINTER(MonitorInfo)]
    user.GetMonitorInfoW.restype = w.BOOL
    user.GetDC.argtypes = [w.HWND]
    user.GetDC.restype = w.HDC
    user.ReleaseDC.argtypes = [w.HWND, w.HDC]
    gdi.CreateCompatibleDC.argtypes = [w.HDC]
    gdi.CreateCompatibleDC.restype = w.HDC
    gdi.CreateDIBSection.argtypes = [
        w.HDC,
        c.POINTER(BitmapInfo),
        w.UINT,
        c.POINTER(c.c_void_p),
        w.HANDLE,
        w.DWORD,
    ]
    gdi.CreateDIBSection.restype = w.HBITMAP
    gdi.SelectObject.argtypes = [w.HDC, w.HGDIOBJ]
    gdi.SelectObject.restype = w.HGDIOBJ
    gdi.StretchBlt.argtypes = [
        w.HDC,
        c.c_int,
        c.c_int,
        c.c_int,
        c.c_int,
        w.HDC,
        c.c_int,
        c.c_int,
        c.c_int,
        c.c_int,
        w.DWORD,
    ]
    gdi.StretchBlt.restype = w.BOOL
    gdi.SetStretchBltMode.argtypes = [w.HDC, c.c_int]
    gdi.SetStretchBltMode.restype = c.c_int
    gdi.DeleteObject.argtypes = [w.HGDIOBJ]
    gdi.DeleteObject.restype = w.BOOL
    gdi.DeleteDC.argtypes = [w.HDC]
    gdi.DeleteDC.restype = w.BOOL
    handle = user.GetForegroundWindow()
    if not handle or int(handle) != window:
        raise OSError("foreground_changed")
    monitor = user.MonitorFromWindow(handle, 2)
    info = MonitorInfo()
    info.size = c.sizeof(info)
    if not user.GetMonitorInfoW(monitor, c.byref(info)) or info.device != expected_monitor:
        raise OSError("monitor_changed")
    sw, sh = info.monitor.right - info.monitor.left, info.monitor.bottom - info.monitor.top
    scale = min(1, max_width / sw)
    width, height = max(1, int(sw * scale)), max(1, int(sh * scale))
    screen = user.GetDC(0)
    mem = gdi.CreateCompatibleDC(screen)
    bits = c.c_void_p()
    bi = BitmapInfo()
    bi.header = BitmapInfoHeader(
        c.sizeof(BitmapInfoHeader), width, -height, 1, 32, 0, width * height * 4, 0, 0, 0, 0
    )
    bitmap = gdi.CreateDIBSection(mem, c.byref(bi), 0, c.byref(bits), None, 0)
    old = gdi.SelectObject(mem, bitmap)
    try:
        gdi.SetStretchBltMode(mem, 4)
        if not gdi.StretchBlt(
            mem,
            0,
            0,
            width,
            height,
            screen,
            info.monitor.left,
            info.monitor.top,
            sw,
            sh,
            0x00CC0020,
        ):
            raise OSError("capture_failed")
        if int(user.GetForegroundWindow()) != window:
            raise OSError("foreground_changed")
        raw = c.string_at(bits, width * height * 4)
        scan = bytearray()
        for y in range(height):
            scan.append(0)
            row = raw[y * width * 4 : (y + 1) * width * 4]
            for x in range(0, len(row), 4):
                scan.extend((row[x + 2], row[x + 1], row[x]))
        header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
        output = bytearray(
            b"\x89PNG\r\n\x1a\n"
            + _chunk(b"IHDR", header)
            + _chunk(b"IDAT", zlib.compress(bytes(scan), 6))
            + _chunk(b"IEND", b"")
        )
        scan[:] = b"\0" * len(scan)
        return output
    finally:
        gdi.SelectObject(mem, old)
        gdi.DeleteObject(bitmap)
        gdi.DeleteDC(mem)
        user.ReleaseDC(0, screen)
