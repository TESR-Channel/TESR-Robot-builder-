"""``<prefix>_base_bridge`` — only for ``drive.base: external`` (AGV -> AMR retrofit).

The robot brain (computer + LiDAR + IMU) sits on an existing AGV whose motors are driven by the customer's PLC.
This package is a small ROS 2 node that writes /cmd_vel into PLC holding registers over Modbus TCP and turns the PLC's
speed feedback into /odom + TF, with a watchdog that stops the AGV when commands stop arriving.
"""
from __future__ import annotations

from .base import GenContext, GeneratedFile, register


class BaseBridgeGenerator:
    id = "base_bridge"
    description = "PLC bridge package (Modbus TCP) for an existing AGV base"

    def render(self, ctx: GenContext) -> list[GeneratedFile]:
        if ctx.resolved.definition.drive.base != "external":
            return []
        pkg = ctx.resolved.package("base_bridge")
        base = f"src/{pkg}"
        t = "base_bridge/"
        return [
            ctx.render(t + "package.xml.j2", f"{base}/package.xml", pkg=pkg),
            ctx.render(t + "setup.py.j2", f"{base}/setup.py", pkg=pkg),
            GeneratedFile(f"{base}/setup.cfg", f"# {ctx.header}\n[develop]\nscript_dir=$base/lib/{pkg}\n[install]\ninstall_scripts=$base/lib/{pkg}\n"),
            GeneratedFile(f"{base}/resource/{pkg}", f"# {ctx.header}\n"),  # ament index marker (content is ignored)
            GeneratedFile(f"{base}/{pkg}/__init__.py", f"# {ctx.header}\n"),
            ctx.render(t + "plc_bridge.py.j2", f"{base}/{pkg}/plc_bridge.py", pkg=pkg),
            ctx.render(t + "plc_bridge.yaml.j2", f"{base}/config/plc_bridge.yaml", pkg=pkg),
            ctx.render(t + "README.md.j2", f"{base}/README.md", pkg=pkg),
        ]


register(BaseBridgeGenerator())
