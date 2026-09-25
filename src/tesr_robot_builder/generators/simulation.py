"""``<prefix>_gazebo`` — Gazebo Harmonic world, ros_gz bridge and sim launch (gz_ros2_control or kinematic mecanum)."""
from __future__ import annotations

from .base import GenContext, GeneratedFile, register


class SimulationGenerator:
    id = "simulation"
    description = "Gazebo Harmonic: arena world, bridge.yaml, sim.launch.py"

    def render(self, ctx: GenContext) -> list[GeneratedFile]:
        pkg = ctx.pkg("gazebo")
        base, t = f"src/{pkg}", "simulation/"
        return [
            ctx.render(t + "package.xml.j2", f"{base}/package.xml", pkg=pkg),
            ctx.render("common/CMakeLists.txt.j2", f"{base}/CMakeLists.txt", pkg=pkg, dirs="config launch worlds"),
            ctx.render(t + "bridge.yaml.j2", f"{base}/config/bridge.yaml", pkg=pkg),
            ctx.render(t + "arena.sdf.j2", f"{base}/worlds/tesr_arena.sdf", pkg=pkg),
            ctx.render(t + "sim.launch.py.j2", f"{base}/launch/sim.launch.py", pkg=pkg),
        ]


register(SimulationGenerator())
