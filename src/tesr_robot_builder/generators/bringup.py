"""``<prefix>_bringup`` — top-level launch files and the capabilities contract."""
from __future__ import annotations

import json

from .base import GenContext, GeneratedFile, register


class BringupGenerator:
    id = "bringup"
    description = "bringup package: robot.launch.py, capabilities.json"

    def render(self, ctx: GenContext) -> list[GeneratedFile]:
        pkg = ctx.resolved.package("bringup")
        base = f"src/{pkg}"
        t = "bringup/"
        capabilities = dict(ctx.resolved.capabilities)
        capabilities["generated_from"] = f"{ctx.definition_name}@{ctx.definition_digest}"
        files = [
            ctx.render(t + "package.xml.j2", f"{base}/package.xml", pkg=pkg),
            ctx.render(t + "CMakeLists.txt.j2", f"{base}/CMakeLists.txt", pkg=pkg),
            ctx.render(t + "robot.launch.py.j2", f"{base}/launch/robot.launch.py", pkg=pkg),
            ctx.render(t + "sim.launch.py.j2", f"{base}/launch/sim.launch.py", pkg=pkg),
            GeneratedFile(f"{base}/config/capabilities.json", json.dumps(capabilities, indent=2, sort_keys=True) + "\n"),
        ]
        repos = drivers_repos(ctx.resolved, ctx.header)
        repos_pkgs = sorted({h.driver_package for h in ctx.resolved.hardware if h.driver_source and h.driver_package})
        files.append(ctx.render(t + "README.md.j2", f"{base}/README.md", pkg=pkg, has_repos=bool(repos), repos_pkgs=", ".join(repos_pkgs)))
        if repos:
            files.append(GeneratedFile("drivers.repos", repos))
        return files


def drivers_repos(r, header: str = "") -> str:
    """vcstool file for sensor/motor drivers that are not on apt: `vcs import src < drivers.repos`."""
    seen: dict[str, dict] = {}
    for h in r.hardware:
        src = h.driver_source
        if src and h.driver_package and src.get("url"):
            seen.setdefault(h.driver_package, src)
    if not seen:
        return ""
    lines = ([f"# {header}"] if header else []) + ["# Drivers built from source - import them next to the generated packages:", "#   vcs import src < drivers.repos", "repositories:"]
    for pkg, src in sorted(seen.items()):
        lines += [f"  {pkg}:", f"    type: {src.get('type', 'git')}", f"    url: {src['url']}", f"    version: {src.get('version', 'main')}"]
    return "\n".join(lines) + "\n"


register(BringupGenerator())
