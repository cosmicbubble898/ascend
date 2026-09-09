"""Read an Anthropic key from stdin and protect it for this Windows user."""

import getpass
import sys

from ascend_engine.storage.windows_protection import (
    save_anthropic_analysis_key,
    save_anthropic_key,
)

purpose = "analysis" if "--analysis" in sys.argv[1:] else "vision"
value = getpass.getpass(f"Anthropic {purpose} key: ").strip().replace("\\_", "_")
(save_anthropic_analysis_key if purpose == "analysis" else save_anthropic_key)(value)
print(f"Anthropic {purpose} key configured with Windows protection.")
