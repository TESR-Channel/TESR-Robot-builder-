"""Phase 1 plan: one place that derives topics, sensor geometry and controller / Nav2 numbers from the resolved robot.

The control, simulation and navigation generators (and the description's ros2_control / Gazebo blocks) all read
this plan, so a topic name or a velocity limit is decided exactly once.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from ..resolve import ResolvedRobot


def _ns(plugin: str) -> str:
    """Registry plugin names use 'pkg/Class'; Nav2 Jazzy parameters use 'pkg::Class'."""
    return plugin.replace("/", "::")


@dataclass
class SensorPlan:
    id: str
    frame: str
    kind: str  # lidar | depth_camera | rgb_camera | imu
    topic: str  # ROS topic (absolute)
    gz_topic: str  # gz topic the simulated sensor publishes on
    rate: float
    range_max: float = 0.0
    range_min: float = 0.05
    fov_deg: float = 360.0
    min_angle: float = -math.pi
    max_angle: float = math.pi
    samples: int = 720
    embedded: bool = False


@dataclass
class Plan:
    name: str
    drive: str  # differential | mecanum
    holonomic: bool
    wheel_joints: dict[str, str]
    wheel_radius: float
    wheel_separation: float
    wheelbase: float
    sim_drive: str  # ros2_control | gz_mecanum
    controller_type: str
    controller_cmd_topic: str  # topic the drive controller listens on before remapping to /cmd_vel
    real_plugin: str | None
    v_max: float
    w_max: float
    a_max: float
    alpha_max: float
    lidars: list[SensorPlan] = field(default_factory=list)
    cameras: list[SensorPlan] = field(default_factory=list)
    imus: list[SensorPlan] = field(default_factory=list)
    footprint: str = ""
    robot_radius: float = 0.3
    inflation_radius: float = 0.5
    local_costmap_m: float = 3.0
    resolution: float = 0.05
    obstacle_range: float = 5.0
    raytrace_range: float = 5.5
    mppi_motion_model: str = "DiffDrive"
    nav_planner: str = "nav2_smac_planner::SmacPlanner2D"
    nav_controller: str = "nav2_mppi_controller::MPPIController"
    slam_scan_topic: str = "/scan"
    slam_max_range: float = 12.0

    @property
    def scan_topics(self) -> list[str]:
        return [s.topic for s in self.lidars]


def build_plan(r: ResolvedRobot) -> Plan:
    d = r.definition
    m = d.requirements.motion
    top = r.chassis.box_center_z + r.chassis.height / 2.0
    lidars, cams, imus = [], [], []
    lidar_hw = [h for h in r.hardware if h.category == "lidar" and h.frame]
    for h in r.hardware:
        if not h.frame:
            continue
        s = h.sensor or {}
        if h.category == "lidar":
            topic = "/scan" if len(lidar_hw) == 1 else f"/{h.id}/scan"
            fov = float(s.get("fov_deg") or 360.0)
            embedded = h.xyz[2] < top - 1e-3  # below the roof → the chassis blocks part of the view
            if embedded:
                fov = min(fov, 270.0)
            half = math.pi if fov >= 359.9 else math.radians(fov) / 2.0
            lidars.append(SensorPlan(h.id, h.frame, "lidar", topic, topic.lstrip("/"), float(s.get("rate_hz") or 10.0),
                                     float(s.get("range_m") or 12.0), max(float(s.get("min_range_m") or 0.05), 0.02), fov,
                                     round(-half, 5), round(half, 5), int(round(fov * 2)), embedded))
        elif h.category in ("depth_camera", "rgb_camera"):
            base = f"/{h.id}"
            cams.append(SensorPlan(h.id, h.frame, h.category, base, h.id, float(s.get("rate_hz") or 15.0),
                                   float(s.get("range_m") or 6.0), max(float(s.get("min_range_m") or 0.2), 0.05), float(s.get("fov_deg") or 87.0)))
        elif h.category == "imu":
            imus.append(SensorPlan(h.id, h.frame, "imu", "/imu/data" if len(imus) == 0 else f"/{h.id}/data",
                                   "imu" if len(imus) == 0 else f"{h.id}_imu", float(s.get("rate_hz") or 100.0)))

    wheelbase = d.drive.wheels.wheelbase_m or 0.0
    circ = math.hypot(d.mechanical.dims_m.length / 2.0, d.mechanical.dims_m.width / 2.0)
    fp = "[" + ", ".join(f"[{x:.3f}, {y:.3f}]" for x, y in r.footprint) + "]"
    cm = r.costmap
    mecanum = d.drive.type == "mecanum"
    return Plan(
        name=d.meta.name,
        drive=d.drive.type,
        holonomic=r.holonomic,
        wheel_joints=dict(r.controller_joints),
        wheel_radius=r.wheel_radius,
        wheel_separation=d.drive.wheels.separation_m,
        wheelbase=wheelbase,
        sim_drive="gz_mecanum" if mecanum else "ros2_control",
        controller_type=r.controller,
        controller_cmd_topic="/drive_controller/reference" if mecanum else "/drive_controller/cmd_vel",
        real_plugin=r.drive_hw_plugin,
        v_max=m.v_max,
        w_max=m.w_max,
        a_max=m.a_max,
        alpha_max=round(max(m.a_max / max(circ, 0.1), 0.5), 3),
        lidars=lidars,
        cameras=cams,
        imus=imus,
        footprint=fp,
        robot_radius=round(circ, 3),
        inflation_radius=cm.inflation_radius_m,
        local_costmap_m=cm.local_size_m,
        resolution=cm.resolution_m,
        obstacle_range=cm.obstacle_range_m,
        raytrace_range=cm.raytrace_range_m,
        mppi_motion_model="Omni" if mecanum else "DiffDrive",
        nav_planner=_ns(r.planner),
        nav_controller=_ns(r.nav_controller),
        slam_scan_topic=lidars[0].topic if lidars else "/scan",
        slam_max_range=round(min(lidars[0].range_max if lidars else 12.0, 20.0) * 0.9, 2),
    )
