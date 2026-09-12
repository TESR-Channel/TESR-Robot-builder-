import copy

import pytest
import yaml

from tesr_robot_builder.schema import DefinitionError, RobotDefinition, json_schema, load_definition
from tests.conftest import ROOT


def test_examples_load(example_path):
    d = load_definition(example_path)
    assert d.schema_version == 1
    assert d.meta.name == example_path.name.split(".")[0]


def _warehouse_dict():
    return yaml.safe_load((ROOT / "examples" / "warehouse_amr_300.robot.yaml").read_text())


def test_unknown_key_is_rejected():
    data = _warehouse_dict()
    data["mechanical"]["dims_m"]["lenght"] = 1.0  # typo
    with pytest.raises(Exception) as exc:
        RobotDefinition.model_validate(data)
    assert "lenght" in str(exc.value)


def test_duplicate_hardware_id_rejected():
    data = _warehouse_dict()
    data["hardware"].append(copy.deepcopy(data["hardware"][0]))
    with pytest.raises(Exception, match="duplicate hardware ids"):
        RobotDefinition.model_validate(data)


def test_mecanum_requires_wheelbase_and_four_motors():
    data = _warehouse_dict()
    data["drive"]["type"] = "mecanum"
    data["drive"]["motor"]["count"] = 4
    with pytest.raises(Exception, match="wheelbase_m"):
        RobotDefinition.model_validate(data)
    data["drive"]["wheels"]["wheelbase_m"] = 0.5
    data["drive"]["motor"]["count"] = 2
    with pytest.raises(Exception, match="count == 4"):
        RobotDefinition.model_validate(data)


def test_rpy_in_degrees_is_rejected():
    data = _warehouse_dict()
    data["hardware"][0]["rpy"] = [0, 0, 180]
    with pytest.raises(Exception, match="looks like degrees"):
        RobotDefinition.model_validate(data)


def test_definition_error_is_readable(tmp_path):
    bad = tmp_path / "bad.robot.yaml"
    bad.write_text("schema_version: 1\nmeta: {name: x}\n")
    with pytest.raises(DefinitionError) as exc:
        load_definition(bad)
    assert any(line.startswith("target") for line in exc.value.errors)


def test_json_schema_exports():
    s = json_schema()
    assert s["title"] == "TESR Robot Definition v1"
    assert set(s["required"]) >= {"schema_version", "meta", "target", "requirements", "mechanical", "drive", "power"}
