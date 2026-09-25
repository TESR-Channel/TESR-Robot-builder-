"""End-to-end pipeline: definition file → validated → generated workspace on disk.

Regenerate-safe behaviour (ADR-0002):

* every generated file carries a header naming the definition and registry version;
* ``.tesr/manifest.json`` stores the hash of every generated file — a file the user
  edited by hand is detected and never silently overwritten (``force=True`` to override);
* ``overrides/<same relative path>`` YAML files are deep-merged into generated YAML
  *at generate time*, so the final file is always complete;
* anything outside the generated set (``custom/``, user packages) is never touched.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from ..registry.loader import Registry
from ..resolve import ResolvedRobot, resolve
from ..rules import builtin as _builtin  # noqa: F401  (registers rules)
from ..rules.engine import Report, RuleContext, run_rules
from ..schema.definition import RobotDefinition, definition_digest, load_definition
from . import bringup as _bringup  # noqa: F401
from . import control as _control  # noqa: F401
from . import description as _description  # noqa: F401
from . import navigation as _navigation  # noqa: F401
from . import simulation as _simulation  # noqa: F401
from .base import GenContext, GeneratedFile, all_generators

MANIFEST = ".tesr/manifest.json"
LOCK = "robot.lock.yaml"


class UserEditedError(Exception):
    def __init__(self, paths: list[str]):
        super().__init__("generated files were modified by hand: " + ", ".join(paths))
        self.paths = paths


@dataclass
class GenerationResult:
    resolved: ResolvedRobot
    report: Report
    files: list[GeneratedFile] = field(default_factory=list)
    overridden: list[str] = field(default_factory=list)
    out_dir: Path | None = None

    @property
    def paths(self) -> list[str]:
        return [f.path for f in self.files]


def _sha(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def render_all(defn: RobotDefinition, reg: Registry, definition_name: str, digest: str) -> GenerationResult:
    """Resolve, validate and render in memory (no disk writes)."""
    resolved = resolve(defn, reg)
    report = run_rules(RuleContext(defn=defn, resolved=resolved, registry=reg))
    result = GenerationResult(resolved=resolved, report=report)
    if not report.ok:
        return result
    ctx = GenContext(resolved=resolved, definition_name=definition_name, definition_digest=digest)
    for gen in all_generators():
        result.files.extend(gen.render(ctx))
    result.files.append(GeneratedFile(LOCK, lock_yaml(resolved, definition_name, digest)))
    return result


def lock_yaml(resolved: ResolvedRobot, definition_name: str, digest: str) -> str:
    data = {
        "lock_version": 1,
        "definition": {"file": definition_name, "digest": digest},
        "versions": resolved.versions,
        "resolved": resolved.model_dump(mode="json", exclude={"definition"}),
    }
    return "# GENERATED lock file — records every resolved 'auto' value and the versions used\n" + yaml.safe_dump(
        data, sort_keys=True, allow_unicode=True
    )


def apply_overrides(files: list[GeneratedFile], overrides_dir: Path) -> tuple[list[GeneratedFile], list[str]]:
    if not overrides_dir.is_dir():
        return files, []
    merged, touched = [], []
    for f in files:
        ov = overrides_dir / f.path
        if f.path.endswith((".yaml", ".yml")) and ov.is_file():
            base = yaml.safe_load(f.content) or {}
            extra = yaml.safe_load(ov.read_text(encoding="utf-8")) or {}
            header = "\n".join(line for line in f.content.splitlines()[:2] if line.startswith("#"))
            content = (header + "\n" if header else "") + f"# overrides applied from {ov.as_posix()}\n" + yaml.safe_dump(
                deep_merge(base, extra), sort_keys=False, allow_unicode=True
            )
            merged.append(GeneratedFile(f.path, content, f.executable))
            touched.append(f.path)
        else:
            merged.append(f)
    return merged, touched


def write_workspace(result: GenerationResult, out_dir: Path, force: bool = False) -> None:
    out_dir = Path(out_dir)
    manifest_path = out_dir / MANIFEST
    old: dict[str, str] = {}
    if manifest_path.is_file():
        old = json.loads(manifest_path.read_text(encoding="utf-8")).get("files", {})
        edited = [p for p, h in old.items() if (out_dir / p).is_file() and _sha((out_dir / p).read_text(encoding="utf-8")) != h]
        if edited and not force:
            raise UserEditedError(edited)
    new_manifest = {"generator": result.resolved.versions["generator"], "files": {}}
    for f in result.files:
        target = out_dir / f.path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f.content, encoding="utf-8")
        if f.executable:
            target.chmod(0o755)
        new_manifest["files"][f.path] = _sha(f.content)
    # remove files we generated previously but no longer produce
    for p in old:
        if p not in new_manifest["files"] and (out_dir / p).is_file():
            (out_dir / p).unlink()
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(new_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    result.out_dir = out_dir


def generate(definition_path: str | Path, out_dir: str | Path, registry: Registry | None = None, force: bool = False) -> GenerationResult:
    """The command behind ``tesr-rb generate``."""
    definition_path = Path(definition_path)
    reg = registry or Registry.load()
    defn = load_definition(definition_path)
    digest = definition_digest(definition_path)
    result = render_all(defn, reg, definition_path.name, digest)
    if not result.report.ok:
        return result
    result.files, result.overridden = apply_overrides(result.files, definition_path.parent / defn.overrides_dir)
    write_workspace(result, Path(out_dir), force=force)
    return result
