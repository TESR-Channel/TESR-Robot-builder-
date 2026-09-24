"""Garage 3D exporters (docs/garage-core.js): every blueprint yields a valid Robot Definition and a well-formed
ROS 2 Jazzy package (URDF tree, Gazebo plugins/sensors, launch files, RViz configs, world)."""
import json
import py_compile
import shutil
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest
import yaml

from tesr_robot_builder.web_entry import build_from_yaml
from tests.conftest import ROOT

node = shutil.which("node")
pytestmark = pytest.mark.skipif(node is None, reason="node not installed")


@pytest.fixture(scope="module")
def garage():
    out = subprocess.run([node, str(ROOT / "tests" / "garage_helper.js")], check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def test_blueprints_pass_engine_rules(garage):
    for key, g in garage.items():
        name = next(p for p in g["files"] if p.endswith(".robot.yaml"))
        res = build_from_yaml(g["files"][name], name, str(ROOT / "registry"))
        assert res["ok"], (key, res["errors"], [r for r in res["report"] if r["severity"] == "ERROR"])
        assert g["errors"] == 0 and g["rank"] in "SAB", (key, g["rank"])


def test_urdf_is_a_single_tree_with_gazebo_plugins(garage):
    for key, g in garage.items():
        urdf = next(v for p, v in g["files"].items() if p.endswith(".urdf"))
        root = ET.fromstring(urdf)
        links = {l.get("name") for l in root.findall("link")}
        children = [j.find("child").get("link") for j in root.findall("joint")]
        assert set(j.find("parent").get("link") for j in root.findall("joint")) <= links and set(children) <= links
        assert links - set(children) == {"base_footprint"} and len(children) == len(set(children))
        plugins = [p.get("name") for p in root.iter("plugin")]
        assert "gz::sim::systems::JointStatePublisher" in plugins
        assert ("gz::sim::systems::MecanumDrive" if key == "mecanum_30" else "gz::sim::systems::DiffDrive") in plugins
        assert len(root.findall(".//sensor")) == len(g["sensors"])
        for link in root.findall("link"):
            m = link.find("inertial/mass")
            assert m is None or float(m.get("value")) > 0


def test_package_files_parse(garage, tmp_path):
    for g in garage.values():
        for p, content in g["files"].items():
            f = tmp_path / p
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(content)
            if p.endswith(".py"):
                py_compile.compile(str(f), doraise=True)
            elif p.endswith((".xml", ".sdf", ".urdf")):
                ET.parse(f)
            elif p.endswith(".rviz"):
                assert "Visualization Manager" in yaml.safe_load(content)
        assert any(p.endswith("launch/gazebo.launch.py") for p in g["files"]) and any(p.endswith("launch/display.launch.py") for p in g["files"])


def test_kuro_x_diagonal_lidars_cover_360(garage):
    assert garage["amr_300"]["coverage"] == 1.0 and garage["amr_300"]["sensors"][:2] == ["lidar_1", "lidar_2"]
