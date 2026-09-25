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
        return [
            ctx.render(t + "package.xml.j2", f"{base}/package.xml", pkg=pkg),
            ctx.render(t + "CMakeLists.txt.j2", f"{base}/CMakeLists.txt", pkg=pkg),
            ctx.render(t + "robot.launch.py.j2", f"{base}/launch/robot.launch.py", pkg=pkg),
            ctx.render(t + "sim.launch.py.j2", f"{base}/launch/sim.launch.py", pkg=pkg),
            GeneratedFile(f"{base}/config/capabilities.json", json.dumps(capabilities, indent=2, sort_keys=True) + "\n"),
            ctx.render(t + "README.md.j2", f"{base}/README.md", pkg=pkg),
        ]


register(BringupGenerator())
