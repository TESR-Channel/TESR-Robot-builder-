"""Entry point used by the web app when the engine runs in the browser (Pyodide).

The page loads this package + the registry into Pyodide's filesystem (see docs/build.js) and calls
:func:`build_json` with the YAML the user edited. Everything returned is plain JSON so the JS side
never touches Python objects. The same function is unit-tested under CPython, so what the browser
runs is exactly what CI runs.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

import yaml
from pydantic import ValidationError

from .generators.pipeline import render_all
from .registry.loader import Registry
from .schema.definition import RobotDefinition, _format_validation_error


def build_from_yaml(yaml_text: str, definition_name: str = "robot.yaml", registry_root: str | None = None,
                    extra_files: dict[str, str] | None = None) -> dict[str, Any]:
    reg = Registry.load(registry_root)
    try:
        data = yaml.safe_load(yaml_text)
    except yaml.YAMLError as exc:
        return {"ok": False, "stage": "yaml", "errors": [str(exc)], "report": [], "files": {}}
    if not isinstance(data, dict):
        return {"ok": False, "stage": "yaml", "errors": ["top level must be a mapping"], "report": [], "files": {}}
    try:
        defn = RobotDefinition.model_validate(data)
    except ValidationError as exc:
        return {"ok": False, "stage": "schema", "errors": _format_validation_error(exc), "report": [], "files": {}}
    digest = hashlib.sha256(yaml_text.encode("utf-8")).hexdigest()[:12]
    try:
        result = render_all(defn, reg, definition_name, digest)
    except Exception as exc:  # resolve errors (unknown hardware id, missing profile)
        return {"ok": False, "stage": "resolve", "errors": [str(exc)], "report": [], "files": {}}
    report = [
        {"rule": f.rule_id, "category": f.category, "severity": f.severity, "message": f.message, "path": f.path, "suggestion": f.suggestion}
        for f in result.report.findings
    ]
    files = {f.path: f.content for f in result.files}
    if files:
        files[f"{defn.meta.name}.robot.yaml"] = yaml_text
        for path, content in (extra_files or {}).items():
            files[path] = content
    r = result.resolved
    summary = {
        "name": defn.meta.name, "prefix": r.package_prefix, "drive": defn.drive.type, "robot_mass": r.robot_mass, "total_mass": r.total_mass,
        "controller": r.controller, "planner": r.planner, "nav_controller": r.nav_controller, "ekf": r.ekf,
        "costmap": r.costmap.model_dump(), "footprint": r.footprint, "versions": r.versions,
        "packages": sorted({p.split("/")[1] for p in files if p.startswith("src/")}),
    }
    return {"ok": result.report.ok, "stage": "generated" if result.report.ok else "rules", "errors": [], "report": report, "files": files, "summary": summary}


def build_json(yaml_text: str, definition_name: str = "robot.yaml", registry_root: str | None = None, extra_files_json: str | None = None) -> str:
    extra = json.loads(extra_files_json) if extra_files_json else None
    return json.dumps(build_from_yaml(yaml_text, definition_name, registry_root, extra), ensure_ascii=False)
