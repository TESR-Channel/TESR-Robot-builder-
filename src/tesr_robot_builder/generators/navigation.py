"""``<prefix>_navigation`` — Nav2 + slam_toolbox parameters sized from the robot, launch and RViz layout."""
from __future__ import annotations

from .base import GenContext, GeneratedFile, register


class NavigationGenerator:
    id = "navigation"
    description = "Nav2 (MPPI + Smac) and slam_toolbox params, navigation.launch.py, RViz"

    def render(self, ctx: GenContext) -> list[GeneratedFile]:
        pkg = ctx.pkg("navigation")
        base, t = f"src/{pkg}", "navigation/"
        return [
            ctx.render(t + "package.xml.j2", f"{base}/package.xml", pkg=pkg),
            ctx.render("common/CMakeLists.txt.j2", f"{base}/CMakeLists.txt", pkg=pkg, dirs="config launch maps rviz"),
            ctx.render(t + "nav2_params.yaml.j2", f"{base}/config/nav2_params.yaml", pkg=pkg),
            ctx.render(t + "slam_toolbox.yaml.j2", f"{base}/config/slam_toolbox.yaml", pkg=pkg),
            ctx.render(t + "navigation.launch.py.j2", f"{base}/launch/navigation.launch.py", pkg=pkg),
            ctx.render(t + "navigation.rviz.j2", f"{base}/rviz/navigation.rviz", pkg=pkg),
            GeneratedFile(f"{base}/maps/.gitkeep", ""),
        ]


register(NavigationGenerator())
