"""Deterministic engineering calculators (geometry / Nav2 sizing / inertia).

These are *code*, not AI. The AI assistant calls them as tools and explains the
result; the generators consume the numbers. Every function is pure so it can be
unit-tested and snapshot-tested. Drivetrain, power and stability calculators
are added in Phase 1 (``calc/drivetrain.py``, ``calc/power.py``, ``calc/stability.py``).
"""
from __future__ import annotations

import math
from dataclasses import dataclass


def r4(x: float) -> float:
    """Round for stable YAML/URDF output (4 decimals = 0.1 mm)."""
    return float(f"{x:.4f}")


# ------------------------------------------------------------------ footprint
def footprint_polygon(length: float, width: float, margin: float = 0.0) -> list[list[float]]:
    """Rectangular Nav2 footprint (base_link centred), counter-clockwise, with safety margin."""
    hl, hw = length / 2 + margin, width / 2 + margin
    return [[r4(hl), r4(hw)], [r4(-hl), r4(hw)], [r4(-hl), r4(-hw)], [r4(hl), r4(-hw)]]


def circumscribed_radius(length: float, width: float, margin: float = 0.0) -> float:
    return r4(math.hypot(length / 2 + margin, width / 2 + margin))


def inflation_radius(length: float, width: float, margin: float = 0.0, extra: float = 0.10) -> float:
    """Inflation must reach past the circumscribed radius or the planner hugs walls."""
    return r4(circumscribed_radius(length, width, margin) + extra)


def stopping_distance(v_max: float, a_max: float) -> float:
    return v_max * v_max / (2.0 * a_max)


def local_costmap_size(v_max: float, a_max: float, length: float, lo: float = 3.0, hi: float = 6.0) -> float:
    """Local costmap edge (m): room to stop plus one robot length, clamped, rounded to 0.5 m."""
    raw = 2.0 * (stopping_distance(v_max, a_max) + length)
    clamped = min(max(raw, lo), hi)
    return r4(math.ceil(clamped * 2.0) / 2.0)


def obstacle_range(lidar_range: float, local_size: float, factor: float = 0.9) -> float:
    return r4(min(lidar_range * factor, local_size / 2.0))


def raytrace_range(obstacle: float, extra: float = 0.5) -> float:
    return r4(obstacle + extra)


# ------------------------------------------------------------------- inertia
@dataclass(frozen=True)
class Inertia:
    ixx: float
    iyy: float
    izz: float

    def as_dict(self) -> dict[str, float]:
        """Rounded to 1e-8 with a 1e-6 floor — a zero inertia is rejected by physics engines."""
        return {k: max(round(v, 8), 1e-6) for k, v in (("ixx", self.ixx), ("iyy", self.iyy), ("izz", self.izz))}


def box_inertia(mass: float, x: float, y: float, z: float) -> Inertia:
    k = mass / 12.0
    return Inertia(k * (y * y + z * z), k * (x * x + z * z), k * (x * x + y * y))


def cylinder_inertia(mass: float, radius: float, height: float) -> Inertia:
    """Cylinder with its axis along Z (rotate the link to make it a wheel)."""
    ixx = mass * (3.0 * radius * radius + height * height) / 12.0
    return Inertia(ixx, ixx, mass * radius * radius / 2.0)


# ----------------------------------------------------------------- placement
@dataclass(frozen=True)
class WheelPose:
    name: str  # link/joint base name, e.g. "left_wheel"
    x: float
    y: float
    side: int  # +1 left, -1 right


def wheel_poses(drive_type: str, separation: float, wheelbase: float | None) -> list[WheelPose]:
    """Wheel centres in the base_link frame (axle height, z = 0)."""
    hs = separation / 2.0
    if drive_type == "differential":
        return [WheelPose("left_wheel", 0.0, r4(hs), +1), WheelPose("right_wheel", 0.0, r4(-hs), -1)]
    if drive_type == "mecanum":
        if wheelbase is None:
            raise ValueError("mecanum needs wheelbase")
        hb = wheelbase / 2.0
        return [
            WheelPose("front_left_wheel", r4(hb), r4(hs), +1),
            WheelPose("front_right_wheel", r4(hb), r4(-hs), -1),
            WheelPose("rear_left_wheel", r4(-hb), r4(hs), +1),
            WheelPose("rear_right_wheel", r4(-hb), r4(-hs), -1),
        ]
    raise ValueError(f"unsupported drive type: {drive_type}")


def caster_radius(wheel_radius: float, ground_clearance: float) -> float:
    """Default caster ball radius: half the wheel radius, never above ground clearance."""
    return r4(max(0.01, min(wheel_radius / 2.0, ground_clearance if ground_clearance > 0 else wheel_radius / 2.0)))


def estimate_robot_mass(hardware_mass: float, length: float, width: float, height: float) -> float:
    """Phase-0 estimate of the robot's own mass: components + a structural allowance.

    Structural allowance = 30 kg per m^2 of footprint (steel frame + panels) scaled by
    height. Replaced by a proper structure model in Phase 1; kept explicit here so the
    lock file shows *how* the number was produced.
    """
    structure = 30.0 * length * width * max(1.0, height / 0.4)
    return r4(hardware_mass + structure)
