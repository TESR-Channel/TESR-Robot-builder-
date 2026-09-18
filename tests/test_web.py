"""Cross-check the browser calculators (docs/app.js) against the Python engine, and make sure the
robot.yaml the web page drafts is a valid Robot Definition that passes the rules."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from tesr_robot_builder.calc import geometry as g
from tesr_robot_builder.calc.drivetrain import size_drivetrain
from tesr_robot_builder.calc.power import size_battery
from tesr_robot_builder.generators.pipeline import render_all
from tesr_robot_builder.schema import RobotDefinition
import yaml

ROOT = Path(__file__).resolve().parents[1]
node = shutil.which("node")
pytestmark = pytest.mark.skipif(node is None, reason="node not installed")


def _node(mode: str, arg: str) -> str:
    return subprocess.run([node, str(ROOT / "tests" / "web_helper.js"), mode, arg], check=True, capture_output=True, text=True).stdout


def test_js_calculators_match_python():
    args = {
        "drivetrain": {"totalMass": 353.4, "vMax": 1.0, "aMax": 0.5, "wheelDiameter": 0.16, "nDrive": 2, "gearRatio": 20, "slopeDeg": 5, "floor": "concrete"},
        "power": {"runtimeH": 8, "busV": 48, "electronicsW": 16.2},
        "nav": {"length": 1.0, "width": 0.7, "margin": 0.05, "vMax": 1.0, "aMax": 0.5, "lidarRange": 40},
        "mass": [29.8, 1.0, 0.7, 0.45],
    }
    js = json.loads(_node("calc", json.dumps(args)))
    py = size_drivetrain(353.4, 1.0, 0.5, 0.16, 2, gear_ratio=20, slope_deg=5, floor="concrete")
    for js_key, py_key in [("forceCont", "force_cont_n"), ("forcePeak", "force_peak_n"), ("motorTorquePeak", "motor_torque_peak_nm"),
                           ("motorRpm", "motor_rpm"), ("requiredMotorRatedTorque", "required_motor_rated_torque_nm"), ("powerElecPeak", "power_elec_peak_w")]:
        assert abs(js["dt"][js_key] - getattr(py, py_key)) < 1e-6, js_key
    pw = size_battery(py.power_mech_cont_w, py.power_elec_peak_w, 8, 48, electronics_w=16.2)
    assert abs(js["pw"]["capacityAh"] - pw.capacity_ah) < 1e-6
    assert abs(js["pw"]["peakCurrentA"] - pw.peak_current_a) < 1e-6
    assert js["nav"]["footprint"] == g.footprint_polygon(1.0, 0.7, 0.05)
    assert js["nav"]["inflationRadius"] == g.inflation_radius(1.0, 0.7, 0.05)
    assert js["nav"]["localCostmap"] == g.local_costmap_size(1.0, 0.5, 1.0)
    assert js["nav"]["obstacleRange"] == g.obstacle_range(40, js["nav"]["localCostmap"])
    assert js["mass"] == g.estimate_robot_mass(29.8, 1.0, 0.7, 0.45)


def test_web_yaml_is_a_valid_definition(registry):
    design = {
        "name": "web_amr", "prefix": "web_amr", "description": "drafted in the browser", "application": "amr", "envType": "factory", "indoor": True,
        "floor": "concrete", "slopeDeg": 5, "minAisle": 1.2, "payload": 300, "cogOffsetZ": 0.25, "vMax": 1.0, "aMax": 0.5, "wMax": 1.0, "runtimeH": 8,
        "length": 1.0, "width": 0.7, "height": 0.45, "groundClearance": 0.05, "drive": "differential", "wheelDiameter": 0.16, "wheelWidth": 0.05,
        "track": 0.6, "wheelbase": 0.4, "gearRatio": 20, "busV": 48, "margin": 0.05, "compute": "rpi5", "arch": "arm64",
        "lidar": "slamtec_p3", "camera": "realsense_d455", "imu": "tesr_imu", "estop": True, "motor": "tesr_bldc_400w", "driver": "tesr_md400",
        "driverCount": 1, "battery": "lifepo4_48v_40ah", "robotMassManual": False, "robotMass": 0,
        "rails": [{"v": 5, "hw": "dcdc_48_5"}, {"v": 12, "hw": "dcdc_48_12"}],
    }
    text = _node("yaml", json.dumps(design))
    defn = RobotDefinition.model_validate(yaml.safe_load(text))
    result = render_all(defn, registry, "web_amr.robot.yaml", "test")
    assert result.report.ok, [f.message for f in result.report.errors]
    assert len(result.files) > 10
    # mecanum variant
    design.update({"drive": "mecanum", "driverCount": 2, "busV": 24, "motor": "generic_bldc_24v_100w", "driver": "generic_can_motor_driver",
                   "battery": "liion_24v_30ah", "compute": "x86_pc", "arch": "amd64", "rails": [{"v": 12, "hw": "dcdc_24_12"}, {"v": 5, "hw": "dcdc_24_5"}],
                   "payload": 30, "length": 0.6, "width": 0.5, "height": 0.3, "track": 0.44, "wheelDiameter": 0.152})
    defn2 = RobotDefinition.model_validate(yaml.safe_load(_node("yaml", json.dumps(design))))
    assert defn2.drive.type == "mecanum" and defn2.drive.motor.count == 4 and len(defn2.drive.casters) == 0


def test_js_csv_parser_handles_quotes_and_bom():
    csv_text = '\ufeffsku,hardware_ref,category,name_th,name_en,brand,price_thb,unit,stock_status,lead_time_days,shop_url,image_url,datasheet_url,spec_summary,compatible_with,recommended_for,notes,updated\r\n' \
               'TS-001,slamtec_p3,lidar,ไลดาร์,"Slamtec P3, 40 m","Slamtec","12,900",piece,in_stock,,https://tesrshop.com/p/1,,,"range 40 m; ""360"" FOV",,,,\r\n'
    rows = json.loads(_node("csv", csv_text))
    assert rows[0]["hardware_ref"] == "slamtec_p3" and rows[0]["price"] == 12900 and rows[0]["name"] == "Slamtec P3, 40 m"
    assert rows[0]["spec"] == 'range 40 m; "360" FOV' and rows[0]["shop_url"].startswith("https://")


def test_model_studio_exports_are_valid_urdf():
    import xml.etree.ElementTree as ET
    args = {"name": "amr", "prefix": "tesr_robot",
            "meshes": [{"name": "chassis", "file": "chassis.stl", "bboxSizeRaw": [1000, 700, 450], "triangles": 10, "set": {"position": [0.1, 0, 0.2], "rpy": [0, 0, 1.5708]}},
                       {"name": "bracket", "file": "bracket.stl", "bboxSizeRaw": [0.05, 0.02, 0.01], "triangles": 4}],
            "design": {"wheelDiameter": 0.16, "groundClearance": 0.05, "height": 0.45, "length": 1.0, "width": 0.7, "track": 0.6, "wheelWidth": 0.05, "drive": "mecanum", "wheelbase": 0.4, "lidar": "x", "camera": None}}
    out = json.loads(_node("model", json.dumps(args)))
    urdf = ET.fromstring(out["urdf"])
    meshes = urdf.findall(".//visual/geometry/mesh")
    assert len(meshes) == 2 and meshes[0].get("scale") == "0.001 0.001 0.001" and meshes[1].get("scale") == "1 1 1"  # mm auto-detected
    assert urdf.find(".//visual/origin").get("rpy") == "0 0 1.5708"
    xacro_root = ET.fromstring(out["xacro"])
    assert len(xacro_root.findall(".//joint")) == 2 and "$(find tesr_robot_description)" in out["xacro"]
    assert out["roundtrip"] == 2
    names = [p["name"] for p in out["prims"]]
    assert names == ["chassis", "wheel_0", "wheel_1", "wheel_2", "wheel_3", "lidar"]
