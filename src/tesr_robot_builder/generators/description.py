"""``<prefix>_description`` — robot model package (URDF/Xacro, display launch, RViz)."""
from __future__ import annotations

from .base import GenContext, GeneratedFile, register


class DescriptionGenerator:
    id = "description"
    description = "URDF/Xacro robot model, display launch and RViz config"

    def render(self, ctx: GenContext) -> list[GeneratedFile]:
        pkg = ctx.resolved.package("description")
        base = f"src/{pkg}"
        t = "description/"
        return [
            ctx.render(t + "package.xml.j2", f"{base}/package.xml", pkg=pkg),
            ctx.render(t + "CMakeLists.txt.j2", f"{base}/CMakeLists.txt", pkg=pkg),
            ctx.render(t + "robot.urdf.xacro.j2", f"{base}/urdf/robot.urdf.xacro", pkg=pkg),
            ctx.render(t + "chassis.xacro.j2", f"{base}/urdf/chassis.xacro", pkg=pkg),
            ctx.render(t + "wheels.xacro.j2", f"{base}/urdf/wheels.xacro", pkg=pkg),
            ctx.render(t + "sensors.xacro.j2", f"{base}/urdf/sensors.xacro", pkg=pkg),
            ctx.render(t + "gazebo.xacro.j2", f"{base}/urdf/gazebo.xacro", pkg=pkg),
            ctx.render(t + "ros2_control.xacro.j2", f"{base}/urdf/ros2_control.xacro", pkg=pkg),
            ctx.render(t + "display.launch.py.j2", f"{base}/launch/display.launch.py", pkg=pkg),
            ctx.render(t + "robot.rviz.j2", f"{base}/rviz/robot.rviz", pkg=pkg),
            GeneratedFile(f"{base}/meshes/.gitkeep", ""),
        ]


register(DescriptionGenerator())
