"""Best-effort WinEvent, session, power, and display-change notifications."""

import ctypes as c
import threading
from ctypes import wintypes as w
from typing import Any, ClassVar

WM_DESTROY = 0x0002
WM_DISPLAYCHANGE = 0x007E
WM_POWERBROADCAST = 0x0218
WM_WTSSESSION_CHANGE = 0x02B1
PBT_APMSUSPEND = 4
PBT_APMRESUMESUSPEND = 7
PBT_APMRESUMEAUTOMATIC = 18
WTS_LOCKED = {2, 6, 7}
WTS_ACTIVE = {1, 5, 8}
EVENT_SYSTEM_FOREGROUND = 3
EVENT_OBJECT_NAMECHANGE = 0x800C
WINEVENT_OUTOFCONTEXT = 0
WINEVENT_SKIPOWNPROCESS = 2


def relevant_window_event(event: int, window: int, object_id: int, foreground: int) -> bool:
    """Accept foreground changes and title changes for the foreground window only."""
    return bool(
        window
        and (
            event == EVENT_SYSTEM_FOREGROUND
            or (event == EVENT_OBJECT_NAMECHANGE and object_id == 0 and window == foreground)
        )
    )


class Point(c.Structure):
    _fields_: ClassVar[list[tuple[str, Any]]] = [("x", c.c_long), ("y", c.c_long)]


class Message(c.Structure):
    _fields_: ClassVar[list[tuple[str, Any]]] = [
        ("window", w.HWND),
        ("message", w.UINT),
        ("wparam", w.WPARAM),
        ("lparam", w.LPARAM),
        ("time", w.DWORD),
        ("point", Point),
        ("private", w.DWORD),
    ]


class WindowClass(c.Structure):
    _fields_: ClassVar[list[tuple[str, Any]]] = [
        ("style", w.UINT),
        ("procedure", c.c_void_p),
        ("class_extra", c.c_int),
        ("window_extra", c.c_int),
        ("instance", w.HINSTANCE),
        ("icon", w.HICON),
        ("cursor", w.HANDLE),
        ("background", w.HBRUSH),
        ("menu", w.LPCWSTR),
        ("name", w.LPCWSTR),
    ]


class WindowsEvents:
    """Maintain a small state flag and generation counter; never capture content."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._generation = 0
        self._state = "active"
        self._ready = threading.Event()
        self._window = 0
        self._thread = threading.Thread(target=self._run, daemon=True, name="ascend-win-events")
        self._thread.start()
        self._ready.wait(1)

    def snapshot(self) -> tuple[str, int]:
        with self._lock:
            return self._state, self._generation

    def changed_since(self, generation: int) -> bool:
        with self._lock:
            return self._generation != generation

    def _signal(self, state: str | None = None) -> None:
        with self._lock:
            if state:
                self._state = state
            self._generation += 1

    def _run(self) -> None:
        user = c.WinDLL("user32", use_last_error=True)
        kernel = c.WinDLL("kernel32", use_last_error=True)
        wts = c.WinDLL("wtsapi32", use_last_error=True)
        wnd_type = c.WINFUNCTYPE(w.LPARAM, w.HWND, w.UINT, w.WPARAM, w.LPARAM)
        event_type = c.WINFUNCTYPE(
            None, w.HANDLE, w.DWORD, w.HWND, c.c_long, c.c_long, w.DWORD, w.DWORD
        )
        kernel.GetModuleHandleW.argtypes = [w.LPCWSTR]
        kernel.GetModuleHandleW.restype = w.HMODULE
        user.RegisterClassW.argtypes = [c.POINTER(WindowClass)]
        user.RegisterClassW.restype = w.ATOM
        user.CreateWindowExW.argtypes = [
            w.DWORD,
            w.LPCWSTR,
            w.LPCWSTR,
            w.DWORD,
            c.c_int,
            c.c_int,
            c.c_int,
            c.c_int,
            w.HWND,
            w.HMENU,
            w.HINSTANCE,
            c.c_void_p,
        ]
        user.CreateWindowExW.restype = w.HWND
        user.DefWindowProcW.argtypes = [w.HWND, w.UINT, w.WPARAM, w.LPARAM]
        user.DefWindowProcW.restype = w.LPARAM
        user.SetWinEventHook.argtypes = [
            w.DWORD,
            w.DWORD,
            w.HMODULE,
            event_type,
            w.DWORD,
            w.DWORD,
            w.DWORD,
        ]
        user.SetWinEventHook.restype = w.HANDLE
        user.GetForegroundWindow.argtypes = []
        user.GetForegroundWindow.restype = w.HWND
        user.GetMessageW.argtypes = [c.POINTER(Message), w.HWND, w.UINT, w.UINT]
        user.GetMessageW.restype = c.c_int
        wts.WTSRegisterSessionNotification.argtypes = [w.HWND, w.DWORD]
        wts.WTSRegisterSessionNotification.restype = w.BOOL

        @wnd_type  # type: ignore[untyped-decorator]
        def window_proc(window: int, message: int, wparam: int, lparam: int) -> int:
            if message == WM_WTSSESSION_CHANGE:
                if wparam in WTS_LOCKED:
                    self._signal("locked")
                elif wparam in WTS_ACTIVE:
                    self._signal("active")
            elif message == WM_POWERBROADCAST:
                if wparam == PBT_APMSUSPEND:
                    self._signal("suspended")
                elif wparam in (PBT_APMRESUMESUSPEND, PBT_APMRESUMEAUTOMATIC):
                    self._signal("active")
            elif message == WM_DISPLAYCHANGE:
                self._signal()
            elif message == WM_DESTROY:
                user.PostQuitMessage(0)
            return int(user.DefWindowProcW(window, message, wparam, lparam))

        @event_type  # type: ignore[untyped-decorator]
        def event_proc(
            _hook: int,
            event: int,
            window: int,
            object_id: int,
            _child: int,
            _thread: int,
            _time: int,
        ) -> None:
            if relevant_window_event(event, window, object_id, int(user.GetForegroundWindow())):
                self._signal()

        self._window_proc, self._event_proc = window_proc, event_proc
        try:
            instance = kernel.GetModuleHandleW(None)
            name = f"AscendActivityEvents{c.addressof(c.py_object(self)):x}"
            definition = WindowClass()
            definition.procedure = c.cast(window_proc, c.c_void_p).value
            definition.instance = instance
            definition.name = name
            if not user.RegisterClassW(c.byref(definition)):
                return
            window = user.CreateWindowExW(0, name, name, 0, 0, 0, 0, 0, 0, 0, instance, None)
            if not window:
                return
            self._window = int(window)
            wts.WTSRegisterSessionNotification(window, 0)
            flags = WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS
            foreground = user.SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, None, event_proc, 0, 0, flags
            )
            names = user.SetWinEventHook(
                EVENT_OBJECT_NAMECHANGE, EVENT_OBJECT_NAMECHANGE, None, event_proc, 0, 0, flags
            )
            self._ready.set()
            message = Message()
            while user.GetMessageW(c.byref(message), 0, 0, 0) > 0:
                user.TranslateMessage(c.byref(message))
                user.DispatchMessageW(c.byref(message))
            for hook in (foreground, names):
                if hook:
                    user.UnhookWinEvent(hook)
            wts.WTSUnRegisterSessionNotification(window)
            user.DestroyWindow(window)
            user.UnregisterClassW(name, instance)
        except Exception:
            return
        finally:
            self._ready.set()

    def close(self) -> None:
        if self._window:
            c.WinDLL("user32").PostMessageW(self._window, WM_DESTROY, 0, 0)
