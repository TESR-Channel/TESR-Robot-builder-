"""TESR Shop parts: ZLTECH hub motors, ZLAC drivers, Slamtec LiDARs, RealSense — rules, BOM and real-robot output."""
import xml.etree.ElementTree as ET

import pytest
import xacro
import yaml

from tesr_robot_builder.catalog import Catalog, bill_of_materials
from tesr_robot_builder.generators.pipeline import generate
from tesr_robot_builder.resolve import resolve
from tesr_robot_builder.rules import builtin  # noqa: F401
from tesr_robot_builder.rules.engine import RuleContext, run_rules
from tesr_robot_builder.schema import RobotDefinition
from tests.conftest import ROOT

HUB = ROOT / "examples" / "service_hub_amr.robot.yaml"


def _hub():
    return yaml.safe_load(HUB.read_text())


def _findings(data, registry, rule):
    defn = RobotDefinition.model_validate(data)
    rep = run_rules(RuleContext(defn=defn, resolved=resolve(defn, registry), registry=registry))
    return [f for f in rep.findings if f.rule_id == rule and f.severity != "PASS"]


def test_hub_example_is_clean(registry):
    defn = RobotDefinition.model_validate(_hub())
    rep = run_rules(RuleContext(defn=defn, resolved=resolve(defn, registry), registry=registry))
    assert rep.ok and not rep.warnings, [f.message for f in rep.errors + rep.warnings]


def test_hub_wheel_diameter_must_match_motor(registry):
    data = _hub()
    data["drive"]["wheels"]["diameter_m"] = 0.15  # the ZLLG80 tyre is 0.20 m
    assert any(f.severity == "ERROR" for f in _findings(data, registry, "R-MECH-005"))


def test_hub_motor_has_no_gearbox(registry):
    data = _hub()
    data["drive"]["motor"]["gear_ratio"] = 10
    assert any("gear" in f.message for f in _findings(data, registry, "R-MECH-005"))


def test_driver_channels_cover_the_motors(registry):
    data = _hub()
    data["drive"]["motor"]["driver"] = "zltech_zlac8015"  # single channel, one instance, two motors
    data["hardware"] = [h for h in data["hardware"] if h["id"] != "motor_driver"] + [{"id": "motor_driver", "hw": "zltech_zlac8015"}]
    assert any(f.severity == "ERROR" for f in _findings(data, registry, "R-HW-005"))


def test_hub_driver_rejects_geared_motor(registry):
    data = _hub()
    data["drive"]["motor"].update(hw="tesr_bldc_400w", gear_ratio=20)
    data["drive"]["wheels"]["diameter_m"] = 0.2
    assert any("hub" in f.message for f in _findings(data, registry, "R-HW-005"))


def test_hub_bom_has_no_separate_wheel(registry):
    defn = RobotDefinition.model_validate(_hub())
    bom = bill_of_materials(resolve(defn, registry), registry, Catalog.load(ROOT / "catalog" / "products.csv"))
    lines = {line.hw_id: line for line in bom}
    assert lines["zltech_zllg80asm250"].qty == 2 and lines["zltech_zllg80asm250"].product is not None
    assert not any(line.category == "wheel" for line in bom)


@pytest.mark.parametrize("hw", ["zltech_zllg80asm250", "zltech_zlac8015d", "rplidar_s2", "rplidar_a1m8", "slamtec_lpx_t1", "tesr_camera_3d",
                                "realsense_d435", "realsense_d415", "witmotion_wt901cm"])
def test_shop_parts_have_prices(hw):
    cat = Catalog.load(ROOT / "catalog" / "products.csv")
    rows = [p for p in cat.products if p.hardware_ref == hw]
    assert rows and all(p.price_thb and p.price_thb > 0 for p in rows), hw


def test_real_robot_output(registry, tmp_path):
    result = generate(HUB, tmp_path / "ws", registry=registry)
    ws = tmp_path / "ws"
    pkg = ws / "src" / "tesr_zlac_hardware"
    for f in ("package.xml", "CMakeLists.txt", "tesr_zlac_hardware.xml", "src/zlac_system.cpp", "src/modbus_rtu.cpp", "tools/zlac_check.py"):
        assert (pkg / f).is_file(), f
    desc = ws / "src" / f"{result.resolved.package_prefix}_description" / "urdf" / "robot.urdf.xacro"
    root = ET.fromstring(xacro.process_file(str(desc), mappings={"hardware": "real", "motor_port": "/dev/ttyUSB7"}).toxml())
    hw = root.find("ros2_control/hardware")
    assert hw.find("plugin").text == "tesr_zlac_hardware/ZlacSystem"
    params = {p.get("name"): p.text for p in hw.findall("param")}
    assert params["port"] == "/dev/ttyUSB7" and params["baud"] == "115200"
    joints = {j.get("name"): {p.get("name"): p.text for p in j.findall("param")} for j in root.findall("ros2_control/joint")}
    sides = sorted((v["channel"], v["invert"], v["node_id"]) for v in joints.values())
    assert sides == [("left", "false", "1"), ("right", "true", "1")]
    launch = (ws / "src" / f"{result.resolved.package_prefix}_bringup" / "launch" / "robot.launch.py").read_text()
    compile(launch, "robot.launch.py", "exec")
    assert "executable='sllidar_node'" in launch and "'serial_baudrate': 1000000" in launch
    assert "realsense2_camera_node" in launch and "DeclareLaunchArgument('motor_port', default_value='/dev/ttyUSB1'" in launch
    assert "sllidar_ros2" in (ws / "drivers.repos").read_text()


def test_mock_robot_has_no_zlac_package(registry, warehouse, tmp_path):
    generate(ROOT / "examples" / "warehouse_amr_300.robot.yaml", tmp_path / "ws", registry=registry)
    assert not (tmp_path / "ws" / "src" / "tesr_zlac_hardware").exists()


def test_wt901cm_imu_is_built_from_source(registry, tmp_path):
    data = yaml.safe_load((ROOT / "examples" / "service_hub_amr.robot.yaml").read_text())
    for h in data["hardware"]:
        if h.get("hw") == "tesr_imu":
            h["hw"] = "witmotion_wt901cm"
    if not any(h.get("hw") == "witmotion_wt901cm" for h in data["hardware"]):
        data["hardware"].append({"id": "imu", "hw": "witmotion_wt901cm", "frame": "imu_link", "parent": "base_link", "xyz": [0, 0, 0.1], "rpy": [0, 0, 0]})
    defn = RobotDefinition.model_validate(data)
    rep = run_rules(RuleContext(defn=defn, resolved=resolve(defn, registry), registry=registry))
    assert rep.ok, [f.message for f in rep.errors]
    p = tmp_path / "r.robot.yaml"
    p.write_text(yaml.safe_dump(data))
    generate(p, tmp_path / "ws", registry=registry)
    repos = (tmp_path / "ws" / "drivers.repos").read_text()
    assert "witmotion_IMU_ros.git" in repos and "version: ros2" in repos and "--recursive" in repos
