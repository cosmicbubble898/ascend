import os

import pytest

from ascend_engine.transcription.policy import AudioError
from ascend_engine.transcription.privacy import forbid_python_network_and_writes


def test_worker_audit_policy_denies_network_and_content_writes() -> None:
    forbid_python_network_and_writes("open", ("model.onnx", "r", os.O_RDONLY))
    for event, args in [
        ("socket.__new__", ()),
        ("socket.connect", ()),
        ("subprocess.Popen", ()),
        ("open", ("private.txt", "w", os.O_WRONLY)),
    ]:
        with pytest.raises(AudioError, match="privacy_boundary"):
            forbid_python_network_and_writes(event, args)
