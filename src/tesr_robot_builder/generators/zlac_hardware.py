"""``tesr_zlac_hardware`` — ros2_control plugin for ZLTECH ZLAC8015D-family hub servo drivers.

Written into the workspace only when the robot's motor driver manifest says ``generated: zlac_hardware``.
The package is the same for every robot (fixed name, no robot-specific values): the wheel mapping, port and baud
rate live in the robot's URDF (``ros2_control.xacro``) and launch arguments.
"""
from __future__ import annotations

from .base import GenContext, GeneratedFile, register

PKG = "tesr_zlac_hardware"


class ZlacHardwareGenerator:
    id = "zlac_hardware"
    description = "ros2_control plugin for ZLAC hub servo drivers (RS485 Modbus RTU)"

    def render(self, ctx: GenContext) -> list[GeneratedFile]:
        if ctx.resolved.drive_hw_generated != "zlac_hardware":
            return []
        base = f"src/{PKG}"
        t = "zlac_hardware/"
        return [
            ctx.render(t + "package.xml.j2", f"{base}/package.xml"),
            ctx.render(t + "CMakeLists.txt.j2", f"{base}/CMakeLists.txt"),
            ctx.render(t + "plugin.xml.j2", f"{base}/tesr_zlac_hardware.xml"),
            ctx.render(t + "modbus_rtu.hpp.j2", f"{base}/include/{PKG}/modbus_rtu.hpp"),
            ctx.render(t + "zlac_system.hpp.j2", f"{base}/include/{PKG}/zlac_system.hpp"),
            ctx.render(t + "modbus_rtu.cpp.j2", f"{base}/src/modbus_rtu.cpp"),
            ctx.render(t + "zlac_system.cpp.j2", f"{base}/src/zlac_system.cpp"),
            ctx.render(t + "zlac_check.py.j2", f"{base}/tools/zlac_check.py", executable=True),
            ctx.render(t + "README.md.j2", f"{base}/README.md"),
        ]


register(ZlacHardwareGenerator())
