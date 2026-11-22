"""Every robot component must be present (rule R-SYS-001 / R-SAFE-001); customer-supplied ones stay in the design but leave the quotation."""
import csv
import io

import yaml

from tesr_robot_builder.catalog import Catalog, bill_of_materials, bom_csv
from tesr_robot_builder.components import COMPONENT_IDS, component_of
from tesr_robot_builder.resolve import resolve
from tesr_robot_builder.rules import builtin  # noqa: F401
from tesr_robot_builder.rules.engine import RuleContext, run_rules
from tesr_robot_builder.schema import RobotDefinition
from tests.conftest import ROOT

HUB = ROOT / "examples" / "service_hub_amr.robot.yaml"


def _data():
    return yaml.safe_load(HUB.read_text())


def _report(data, registry):
    defn = RobotDefinition.model_validate(data)
    return defn, run_rules(RuleContext(defn=defn, resolved=resolve(defn, registry), registry=registry))


def _errors(rep, rule):
    return [f for f in rep.findings if f.rule_id == rule and f.severity == "ERROR"]


def test_every_example_has_all_components(registry):
    for path in sorted((ROOT / "examples").glob("*.robot.yaml")):
        _, rep = _report(yaml.safe_load(path.read_text()), registry)
        assert not _errors(rep, "R-SYS-001"), path.name


def test_missing_imu_blocks(registry):
    data = _data()
    data["hardware"] = [h for h in data["hardware"] if h["id"] != "imu"]
    _, rep = _report(data, registry)
    assert any("IMU" in f.message for f in _errors(rep, "R-SYS-001")) and not rep.ok


def test_missing_lidar_blocks_even_without_navigation(registry):
    data = _data()
    data["hardware"] = [h for h in data["hardware"] if not h["id"].startswith("lidar")]
    data.setdefault("ros", {}).setdefault("navigation", {})["features"] = ["manual"]
    _, rep = _report(data, registry)
    assert any("LiDAR" in f.message for f in _errors(rep, "R-SYS-001"))


def test_estop_required_above_20_kg(registry):
    data = _data()  # service robot, ~80 kg with payload
    data["hardware"] = [h for h in data["hardware"] if h["id"] != "estop"]
    data["io"] = {"DI": {}}
    _, rep = _report(data, registry)
    assert _errors(rep, "R-SAFE-001")


def test_light_robot_estop_is_only_a_warning(registry):
    _, rep = _report(yaml.safe_load((ROOT / "examples" / "ironx_gen2.robot.yaml").read_text()), registry)
    assert not _errors(rep, "R-SAFE-001") and any(f.rule_id == "R-SAFE-001" and f.severity == "WARN" for f in rep.findings)


def test_customer_supplied_lines_are_not_priced(registry):
    data = _data()
    data["supply"] = {"customer": ["imu", "battery"], "notes": {"imu": "Xsens MTi-3 (customer stock)"}}
    defn, rep = _report(data, registry)
    assert rep.ok
    cat = Catalog.load(ROOT / "catalog" / "products.csv")
    lines = {l.hw_id: l for l in bill_of_materials(resolve(defn, registry), registry, cat)}
    imu = lines["witmotion_wt901cm"]
    assert imu.supplied_by == "customer" and imu.product is not None and imu.unit_price is None and imu.line_total is None
    assert lines["zltech_zllg80asm250"].supplied_by == "tesr" and lines["zltech_zllg80asm250"].line_total > 0
    rows = list(csv.DictReader(io.StringIO(bom_csv(list(lines.values())))))
    by_hw = {r["hw_id"]: r for r in rows}
    assert by_hw["witmotion_wt901cm"]["supplied_by"] == "customer" and by_hw["witmotion_wt901cm"]["component"] == "imu"
    assert by_hw["witmotion_wt901cm"]["line_total_thb"] == ""


def test_supply_note_without_customer_entry_warns(registry):
    data = _data()
    data["supply"] = {"customer": [], "notes": {"imu": "own"}}
    _, rep = _report(data, registry)
    assert any(f.rule_id == "R-SYS-001" and f.severity == "WARN" for f in rep.findings)


def test_component_map_matches_the_web_app():
    js = (ROOT / "docs" / "garage-core.js").read_text(encoding="utf-8")
    for cid in COMPONENT_IDS:
        assert f"id: '{cid}'" in js, cid
    for cat in ("motor", "wheel", "motor_driver", "compute", "lidar", "imu", "battery", "power_supply", "estop", "depth_camera"):
        assert component_of(cat) is not None, cat
