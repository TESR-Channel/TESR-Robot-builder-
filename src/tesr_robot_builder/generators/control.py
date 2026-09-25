"""``<prefix>_control`` — ros2_control controllers (diff_drive / mecanum) and the hardware launch (mock or real driver)."""
from __future__ import annotations

from .base import GenContext, GeneratedFile, register


class ControlGenerator:
    id = "control"
    description = "ros2_control: controllers.yaml + control.launch.py (mock / real hardware)"

    def render(self, ctx: GenContext) -> list[GeneratedFile]:
        pkg = ctx.pkg("control")
        base, t = f"src/{pkg}", "control/"
        return [
            ctx.render(t + "package.xml.j2", f"{base}/package.xml", pkg=pkg),
            ctx.render("common/CMakeLists.txt.j2", f"{base}/CMakeLists.txt", pkg=pkg, dirs="config launch"),
            ctx.render(t + "controllers.yaml.j2", f"{base}/config/controllers.yaml", pkg=pkg),
            ctx.render(t + "control.launch.py.j2", f"{base}/launch/control.launch.py", pkg=pkg),
        ]


register(ControlGenerator())
