import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest
import xacro

from tesr_robot_builder.generators.pipeline import (
    LOCK, MANIFEST, GeneratedFile, UserEditedError, apply_overrides, deep_merge, generate, render_all,
)
from tesr_robot_builder.schema import definition_digest


def _expand(xacro_path: Path) -> ET.Element:
    doc = xacro.process_file(str(xacro_path))
    return ET.fromstring(doc.toxml())


def _check_urdf_tree(root: ET.Element):
    links = {l.get("name") for l in root.findall("link")}
    children = set()
    for j in root.findall("joint"):
        parent, child = j.find("parent").get("link"), j.find("child").get("link")
        assert parent in links and child in links, (j.get("name"), parent, child)
        children.add(child)
    roots = links - children
    assert roots == {"base_footprint"}, roots
    for link in root.findall("link"):
        mass = link.find("inertial/mass")
        if mass is not None:
            assert float(mass.get("value")) > 0, link.get("name")
            inertia = link.find("inertial/inertia")
            assert all(float(inertia.get(k)) > 0 for k in ("ixx", "iyy", "izz")), link.get("name")
    return links


def test_generate_example_and_expand_xacro(example_path, registry, tmp_path):
    result = generate(example_path, tmp_path / "ws", registry=registry)
    assert result.report.ok, [f.message for f in result.report.errors]
    prefix = result.resolved.package_prefix
    desc = tmp_path / "ws" / "src" / f"{prefix}_description"
    assert (desc / "package.xml").is_file() and (desc / "CMakeLists.txt").is_file()
    links = _check_urdf_tree(_expand(desc / "urdf" / "robot.urdf.xacro"))
    # every hardware frame and wheel made it into the model
    for h in result.resolved.hardware:
        if h.frame:
            assert h.frame in links
            if h.optical_frame:
                assert h.optical_frame in links
    for w in result.resolved.wheels:
        assert w.name in links
    # lock + manifest + capabilities
    assert (tmp_path / "ws" / LOCK).is_file()
    manifest = json.loads((tmp_path / "ws" / MANIFEST).read_text())
    assert set(manifest["files"]) == set(result.paths)
    caps = json.loads((tmp_path / "ws" / "src" / f"{prefix}_bringup" / "config" / "capabilities.json").read_text())
    assert caps["drive"] == result.resolved.definition.drive.type


def test_generation_is_deterministic(example, example_path, registry):
    digest = definition_digest(example_path)
    a = render_all(example, registry, example_path.name, digest)
    b = render_all(example, registry, example_path.name, digest)
    assert [(f.path, f.content) for f in a.files] == [(f.path, f.content) for f in b.files]


def test_every_generated_text_file_has_header(example, example_path, registry):
    result = render_all(example, registry, example_path.name, definition_digest(example_path))
    for f in result.files:
        if f.path.endswith((".json", ".gitkeep")):
            continue
        assert any("GENERATED" in line for line in f.content.splitlines()[:3]), f.path


def test_hand_edited_file_is_refused(warehouse, registry, tmp_path):
    src = Path(__file__).resolve().parents[1] / "examples" / "warehouse_amr_300.robot.yaml"
    generate(src, tmp_path / "ws", registry=registry)
    edited = tmp_path / "ws" / "src" / "tesr_robot_description" / "urdf" / "chassis.xacro"
    edited.write_text(edited.read_text() + "\n<!-- hand edit -->\n")
    with pytest.raises(UserEditedError) as exc:
        generate(src, tmp_path / "ws", registry=registry)
    assert "chassis.xacro" in exc.value.paths[0]
    generate(src, tmp_path / "ws", registry=registry, force=True)  # --force overwrites
    assert "hand edit" not in edited.read_text()


def test_stale_generated_file_is_removed(warehouse, registry, tmp_path):
    src = Path(__file__).resolve().parents[1] / "examples" / "warehouse_amr_300.robot.yaml"
    generate(src, tmp_path / "ws", registry=registry)
    manifest_path = tmp_path / "ws" / MANIFEST
    manifest = json.loads(manifest_path.read_text())
    ghost = tmp_path / "ws" / "src" / "old_pkg" / "old.yaml"
    ghost.parent.mkdir(parents=True)
    ghost.write_text("x: 1\n")
    import hashlib
    manifest["files"]["src/old_pkg/old.yaml"] = hashlib.sha256(b"x: 1\n").hexdigest()
    manifest_path.write_text(json.dumps(manifest))
    generate(src, tmp_path / "ws", registry=registry)
    assert not ghost.exists()


def test_overrides_deep_merge(tmp_path):
    files = [GeneratedFile("src/x_bringup/config/nav2.yaml", "# GENERATED header\na:\n  b: 1\n  c: 2\nd: 3\n")]
    ov = tmp_path / "overrides" / "src" / "x_bringup" / "config"
    ov.mkdir(parents=True)
    (ov / "nav2.yaml").write_text("a:\n  c: 20\ne: 5\n")
    merged, touched = apply_overrides(files, tmp_path / "overrides")
    assert touched == ["src/x_bringup/config/nav2.yaml"]
    body = merged[0].content
    assert "overrides applied" in body and "GENERATED" in body
    import yaml
    data = yaml.safe_load(body)
    assert data == {"a": {"b": 1, "c": 20}, "d": 3, "e": 5}
    assert deep_merge({"a": {"b": 1}}, {"a": {"c": 2}}) == {"a": {"b": 1, "c": 2}}


def test_generated_python_compiles_and_xml_parses(example, example_path, registry):
    result = render_all(example, registry, example_path.name, definition_digest(example_path))
    for f in result.files:
        if f.path.endswith(".py"):
            compile(f.content, f.path, "exec")
        elif f.path.endswith((".xml", ".xacro")):
            ET.fromstring(f.content)
        elif f.path.endswith((".yaml", ".rviz")):
            import yaml
            yaml.safe_load(f.content)
