"""The in-browser build path (Pyodide) calls web_entry.build_json — exercise it under CPython."""
import json

from tesr_robot_builder.web_entry import build_from_yaml, build_json
from tests.conftest import ROOT

REGISTRY = str(ROOT / "registry")


def test_build_json_generates_workspace():
    text = (ROOT / "examples" / "warehouse_amr_300.robot.yaml").read_text()
    out = json.loads(build_json(text, "warehouse_amr_300.robot.yaml", REGISTRY, json.dumps({"src/tesr_robot_description/meshes/body.stl": "solid x"})))
    assert out["ok"] and out["stage"] == "generated" and not out["errors"]
    assert "src/tesr_robot_description/urdf/robot.urdf.xacro" in out["files"] and "robot.lock.yaml" in out["files"]
    assert out["files"]["warehouse_amr_300.robot.yaml"] == text and out["files"]["src/tesr_robot_description/meshes/body.stl"] == "solid x"
    assert out["summary"]["packages"] == ["tesr_robot_bringup", "tesr_robot_control", "tesr_robot_description", "tesr_robot_gazebo", "tesr_robot_navigation"]
    assert any(r["severity"] == "PASS" for r in out["report"]) and out["summary"]["controller"].startswith("diff_drive")


def test_build_reports_schema_yaml_and_rule_errors():
    assert build_from_yaml("not: [valid", registry_root=REGISTRY)["stage"] == "yaml"
    bad = build_from_yaml("schema_version: 1\nmeta: {name: x}\n", registry_root=REGISTRY)
    assert bad["stage"] == "schema" and any(e.startswith("target") for e in bad["errors"])
    text = (ROOT / "examples" / "warehouse_amr_300.robot.yaml").read_text().replace("  - {id: estop, hw: generic_estop, io: DI1}\n", "").replace("DI: {1: estop, 2: bumper, 3: dock_sensor}", "DI: {2: bumper}")
    out = build_from_yaml(text, registry_root=REGISTRY)
    assert not out["ok"] and out["stage"] == "rules" and out["files"] == {}
    assert any(r["rule"] == "R-SAFE-001" and r["severity"] == "ERROR" for r in out["report"])
