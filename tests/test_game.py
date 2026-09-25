"""Garage mission mode: the arena matches the Gazebo world closely enough to play, and the narrow aisle really filters wide robots."""
import json
import shutil
import subprocess

import pytest

from tests.conftest import ROOT


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_mission_geometry():
    out = json.loads(subprocess.run(["node", str(ROOT / "tests" / "game_helper.js")], capture_output=True, text=True, check=True).stdout)
    assert out["missions"] == 5 and out["pointsFree"]
    assert all(out["spawnFree"].values())
    assert out["gap"]["small"] and out["gap"]["amr300"] and not out["gap"]["too_wide"]  # 1.1 m aisle
    assert abs(out["rays"][0] - 2.925) < 1e-6 and abs(out["rays"][1] - 0.5) < 1e-6  # divider face / pallet top face
    assert out["levels"] == [1, 2, 3]
