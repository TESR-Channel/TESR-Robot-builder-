from pathlib import Path

import pytest

from tesr_robot_builder.registry import Registry
from tesr_robot_builder.schema import load_definition

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = sorted((ROOT / "examples").glob("*.robot.yaml"))


@pytest.fixture(scope="session")
def registry() -> Registry:
    return Registry.load(ROOT / "registry")


@pytest.fixture(params=EXAMPLES, ids=[p.stem.replace(".robot", "") for p in EXAMPLES])
def example_path(request) -> Path:
    return request.param


@pytest.fixture
def example(example_path):
    return load_definition(example_path)


@pytest.fixture
def warehouse():
    return load_definition(ROOT / "examples" / "warehouse_amr_300.robot.yaml")
