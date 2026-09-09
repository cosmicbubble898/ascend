"""Synthetic-only fixture preparation and pause-expiry control for desktop QA."""

import sys
import time
from datetime import datetime
from pathlib import Path

from ascend_engine.storage.productivity import ProductivityStore

path = Path(sys.argv[1])
assert "productivity-qa" in path.parts
with ProductivityStore(path) as store:
    if len(sys.argv) == 3 and sys.argv[2] == "expire":
        store.set_setting("pausedUntil", int(time.time() * 1000) - 1000)
    else:
        start = int(
            datetime.now().replace(hour=11, minute=0, second=0, microsecond=0).timestamp() * 1000
        )
        for i in range(9):
            app, title = [
                ("whatsapp.exe", "Synthetic WhatsApp"),
                ("msedge.exe", "Synthetic ClickUp"),
                ("code.exe", "Synthetic edit"),
            ][i % 3]
            store.add_segment(
                start + i * 15000,
                start + (i + 1) * 15000,
                app,
                title,
                "Synthetic display",
                "active",
            )
        store.save()
print("Synthetic fixture updated")
