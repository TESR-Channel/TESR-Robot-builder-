"""``tesr-rb`` command line.

    tesr-rb validate  examples/ironx_gen2.robot.yaml
    tesr-rb generate  examples/ironx_gen2.robot.yaml -o out/ironx_ws
    tesr-rb resolve   examples/ironx_gen2.robot.yaml
    tesr-rb schema    -o robot-definition.schema.json
    tesr-rb registry  [--category lidar]
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer
import yaml

from . import __version__
from .generators.pipeline import UserEditedError, generate, render_all
from .registry import Registry, RegistryError
from .resolve import ResolveError, resolve
from .rules.engine import Report
from .schema import DefinitionError, definition_digest, json_schema, load_definition

app = typer.Typer(add_completion=False, no_args_is_help=True, help="TESR Robot Builder — Robot Definition → validated ROS 2 workspace")

ICON = {"PASS": "✅", "WARN": "⚠️ ", "ERROR": "🔴"}
REGISTRY_OPT = typer.Option(None, "--registry", "-r", help="registry directory (default: $TESR_RB_REGISTRY or ./registry)")


def _load(definition: Path, registry: Optional[Path]):
    try:
        reg = Registry.load(registry)
        defn = load_definition(definition)
        return reg, defn
    except (RegistryError, DefinitionError) as exc:
        typer.secho("definition/registry error:", fg=typer.colors.RED, err=True)
        for line in str(exc).splitlines():
            typer.echo(f"  {line}", err=True)
        raise typer.Exit(2)


def _print_report(report: Report, show_pass: bool) -> None:
    for cat, findings in report.by_category().items():
        typer.secho(f"\n[{cat}]", bold=True)
        for f in findings:
            if f.severity == "PASS" and not show_pass:
                continue
            line = f"  {ICON[f.severity]} {f.rule_id}  {f.message}"
            if f.path:
                line += f"  ({f.path})"
            typer.echo(line)
            if f.suggestion and f.severity != "PASS":
                typer.echo(f"        → {f.suggestion}")
    typer.echo("")
    n_err, n_warn = len(report.errors), len(report.warnings)
    colour = typer.colors.RED if n_err else (typer.colors.YELLOW if n_warn else typer.colors.GREEN)
    typer.secho(f"{n_err} error(s), {n_warn} warning(s)", fg=colour, bold=True)


def _version_callback(value: bool):
    if value:
        typer.echo(f"tesr-rb {__version__}")
        raise typer.Exit()


@app.callback()
def _main(version: bool = typer.Option(False, "--version", callback=_version_callback, is_eager=True, help="print version and exit")):
    """TESR Robot Builder command line."""


@app.command()
def validate(
    definition: Path = typer.Argument(..., exists=True, readable=True, help="*.robot.yaml"),
    registry: Optional[Path] = REGISTRY_OPT,
    show_pass: bool = typer.Option(True, "--show-pass/--hide-pass"),
):
    """Structural + engineering validation. Exit code 1 on ERROR."""
    reg, defn = _load(definition, registry)
    try:
        result = render_all(defn, reg, definition.name, definition_digest(definition))
    except ResolveError as exc:
        typer.secho(f"resolve error: {exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(2)
    typer.secho(f"{defn.meta.name}  ({defn.drive.type}, ROS 2 {defn.target.ros_distro}, {defn.target.compute})", bold=True)
    _print_report(result.report, show_pass)
    raise typer.Exit(0 if result.report.ok else 1)


@app.command(name="generate")
def generate_cmd(
    definition: Path = typer.Argument(..., exists=True, readable=True, help="*.robot.yaml"),
    out: Path = typer.Option(..., "--out", "-o", help="workspace directory to create/update"),
    registry: Optional[Path] = REGISTRY_OPT,
    force: bool = typer.Option(False, "--force", help="overwrite generated files that were edited by hand"),
):
    """Validate, then generate the ROS 2 workspace (blocked on ERROR)."""
    reg, _ = _load(definition, registry)
    try:
        result = generate(definition, out, registry=reg, force=force)
    except ResolveError as exc:
        typer.secho(f"resolve error: {exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(2)
    except UserEditedError as exc:
        typer.secho("refusing to overwrite hand-edited generated files:", fg=typer.colors.RED, err=True)
        for p in exc.paths:
            typer.echo(f"  {p}", err=True)
        typer.echo("move your changes to overrides/ or rerun with --force", err=True)
        raise typer.Exit(3)
    _print_report(result.report, show_pass=False)
    if not result.report.ok:
        typer.secho("generation blocked — fix the errors above", fg=typer.colors.RED, bold=True)
        raise typer.Exit(1)
    typer.secho(f"\ngenerated {len(result.files)} files → {out}", fg=typer.colors.GREEN, bold=True)
    for p in result.paths:
        mark = " (overrides applied)" if p in result.overridden else ""
        typer.echo(f"  {p}{mark}")
    typer.echo("\nnext:  cd " + str(out) + " && rosdep install --from-paths src -y --ignore-src && colcon build --symlink-install")


@app.command(name="resolve")
def resolve_cmd(
    definition: Path = typer.Argument(..., exists=True, readable=True),
    registry: Optional[Path] = REGISTRY_OPT,
):
    """Print every resolved 'auto' value (what robot.lock.yaml will contain)."""
    reg, defn = _load(definition, registry)
    try:
        res = resolve(defn, reg)
    except ResolveError as exc:
        typer.secho(f"resolve error: {exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(2)
    typer.echo(yaml.safe_dump(res.model_dump(mode="json", exclude={"definition"}), sort_keys=True, allow_unicode=True))


@app.command()
def schema(out: Optional[Path] = typer.Option(None, "--out", "-o", help="write JSON Schema to this file")):
    """Export the Robot Definition JSON Schema (for the web UI / editors)."""
    text = json.dumps(json_schema(), indent=2, ensure_ascii=False) + "\n"
    if out:
        out.write_text(text, encoding="utf-8")
        typer.echo(f"wrote {out}")
    else:
        typer.echo(text)


@app.command(name="registry")
def registry_cmd(
    registry: Optional[Path] = REGISTRY_OPT,
    category: Optional[str] = typer.Option(None, "--category", "-c"),
):
    """List registry hardware (optionally one category)."""
    try:
        reg = Registry.load(registry)
    except RegistryError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(2)
    s = reg.summary()
    typer.secho(f"registry {s['root']}  hash {s['hash']}  {s['hardware']} hardware, {s['drivers']} drivers", bold=True)
    for rec in sorted(reg.hardware.values(), key=lambda r: (r.category, r.id)):
        if category and rec.category != category:
            continue
        drivers = [d for (h, d) in reg.drivers if h == rec.id]
        flag = "" if rec.verified else "  [unverified]"
        typer.echo(f"  {rec.category:13} {rec.id:26} {rec.name:34} drivers={','.join(drivers) or '-'}{flag}")


if __name__ == "__main__":  # pragma: no cover
    app()
