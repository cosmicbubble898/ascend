"""Create synthetic activity only in an explicitly isolated QA profile."""

import sys
from datetime import datetime
from pathlib import Path

from ascend_engine.storage.productivity import ProductivityStore

path = Path(sys.argv[1])
assert "productivity-qa" in path.parts
start = int(datetime.now().replace(hour=9, minute=0, second=0, microsecond=0).timestamp() * 1000)
with ProductivityStore(path) as store:
    for app, title, minutes in [
        ("code.exe", "Ascend development", 25),
        ("slack.exe", "Project handoff", 8),
        ("msedge.exe", "API documentation", 12),
    ]:
        for _ in range(minutes):
            store.add_segment(start, start + 60000, app, title, "Synthetic display 1", "active")
            start += 60000
    store.set_rule("msedge.exe", "Learning")
    store.save()
print("Synthetic productivity fixture ready")
