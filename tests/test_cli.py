from pytest import CaptureFixture

from ascend_engine.__main__ import main


def test_engine_version_command_is_available_for_packaging_smoke(
    capsys: CaptureFixture[str],
) -> None:
    exit_code = main(["--version"])

    assert exit_code == 0
    assert capsys.readouterr().out == "Ascend engine 0.0.0\n"
