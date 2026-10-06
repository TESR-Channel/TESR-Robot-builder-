"""drive.base: external — brain kit on an existing AGV (PLC drives the motors), plus the Jetson computers."""
import py_compile

from tests.conftest import ROOT


def _gen(tmp_path, registry, name):
    from tesr_robot_builder.generators.pipeline import generate
    res = generate(ROOT / "examples" / f"{name}.robot.yaml", tmp_path / name, registry=registry)
    assert res.report.ok, [f.message for f in res.report.findings if f.severity == "ERROR"]
    return res, tmp_path / name


def test_jetsons_in_registry(registry):
    for hw in ("jetson_orin_nano", "jetson_xavier_nx"):
        rec = registry.hardware[hw]
        assert rec.category == "compute" and rec.compute.arch == "arm64" and rec.compute.gpu and "jazzy" in rec.compute.supported_distros


def test_retrofit_generates_plc_bridge_instead_of_ros2_control(registry, tmp_path):
    res, out = _gen(tmp_path, registry, "agv_retrofit")
    pre = res.resolved.package_prefix
    bridge = out / "src" / f"{pre}_base_bridge"
    for f in ("package.xml", "setup.py", "setup.cfg", f"resource/{pre}_base_bridge", f"{pre}_base_bridge/plc_bridge.py", "config/plc_bridge.yaml", "README.md"):
        assert (bridge / f).exists(), f
    py_compile.compile(str(bridge / f"{pre}_base_bridge" / "plc_bridge.py"), doraise=True)
    launch = (out / "src" / f"{pre}_bringup" / "launch" / "robot.launch.py").read_text()
    assert "plc_bridge" in launch and "control.launch.py" not in launch
    py_compile.compile(str(out / "src" / f"{pre}_bringup" / "launch" / "robot.launch.py"), doraise=True)
    assert f"{pre}_base_bridge" in (out / "src" / f"{pre}_bringup" / "package.xml").read_text()
    pwr = [f for f in res.report.findings if f.rule_id == "R-PWR-002"][0]
    assert pwr.severity == "PASS" and "existing AGV" in pwr.message


def test_own_base_has_no_bridge(registry, tmp_path):
    res, out = _gen(tmp_path, registry, "warehouse_amr_300")
    assert not (out / "src" / f"{res.resolved.package_prefix}_base_bridge").exists()
    assert "control.launch.py" in (out / "src" / f"{res.resolved.package_prefix}_bringup" / "launch" / "robot.launch.py").read_text()
