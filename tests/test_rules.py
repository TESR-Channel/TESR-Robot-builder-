import copy

import yaml

from tesr_robot_builder.resolve import resolve
from tesr_robot_builder.rules import builtin  # noqa: F401
from tesr_robot_builder.rules.engine import RuleContext, all_rules, run_rules
from tesr_robot_builder.schema import RobotDefinition
from tests.conftest import ROOT


def _run(data: dict, registry):
    defn = RobotDefinition.model_validate(data)
    res = resolve(defn, registry)
    return run_rules(RuleContext(defn=defn, resolved=res, registry=registry))


def _base():
    return yaml.safe_load((ROOT / "examples" / "warehouse_amr_300.robot.yaml").read_text())


def test_reference_example_is_clean(registry):
    report = _run(_base(), registry)
    assert report.ok and not report.warnings, [f.message for f in report.findings if f.severity != "PASS"]
    assert len(report.findings) == len(all_rules())  # every rule reports (PASS or findings)


def test_missing_estop_on_heavy_robot_is_error(registry):
    data = _base()
    data["hardware"] = [h for h in data["hardware"] if h["id"] != "estop"]
    data["io"]["DI"].pop(1)
    report = _run(data, registry)
    assert any(f.rule_id == "R-SAFE-001" and f.severity == "ERROR" for f in report.findings)


def test_narrow_aisle_is_error(registry):
    data = _base()
    data["requirements"]["environment"]["min_aisle_m"] = 0.75
    report = _run(data, registry)
    assert any(f.rule_id == "R-NAV-002" and f.severity == "ERROR" for f in report.findings)


def test_voltage_mismatch_is_error(registry):
    data = _base()
    data["power"]["rails"] = []  # 5 V devices have no rail
    report = _run(data, registry)
    errs = [f for f in report.findings if f.rule_id == "R-PWR-001" and f.severity == "ERROR"]
    assert errs and "5.0 V" in errs[0].message


def test_reserved_frame_is_error(registry):
    data = _base()
    data["hardware"][0]["frame"] = "base_link"
    report = _run(data, registry)
    assert any(f.rule_id == "R-TF-001" and f.severity == "ERROR" for f in report.findings)


def test_broken_parent_frame_is_error(registry):
    data = _base()
    data["hardware"][1]["parent"] = "nowhere"
    report = _run(data, registry)
    assert any(f.rule_id == "R-TF-002" and f.severity == "ERROR" for f in report.findings)


def test_nav_without_lidar_is_error(registry):
    data = _base()
    data["hardware"] = [h for h in data["hardware"] if h["id"] != "lidar_front"]
    report = _run(data, registry)
    assert any(f.rule_id == "R-NAV-001" and f.severity == "ERROR" for f in report.findings)


def test_tall_payload_triggers_tipping_warning(registry):
    data = _base()
    data["requirements"]["payload"]["cog_offset_m"] = [0.0, 0.0, 2.0]
    data["requirements"]["motion"]["w_max"] = 3.0
    data["requirements"]["motion"]["v_max"] = 1.5
    report = _run(data, registry)
    assert any(f.rule_id == "R-MECH-004" and f.severity == "WARN" for f in report.findings)


def test_every_rule_has_unique_id_and_category():
    rules = all_rules()
    assert len({r.id for r in rules}) == len(rules)
    assert all(r.description for r in rules)
