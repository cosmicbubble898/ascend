from importlib import import_module


def test_engine_package_can_be_imported() -> None:
    engine_package = import_module("ascend_engine")

    assert engine_package.__name__ == "ascend_engine"
