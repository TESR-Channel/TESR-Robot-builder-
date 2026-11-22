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


# Sensor drivers robot.launch.py starts on the real robot (packages whose parameters TESR has checked).
LAUNCHABLE = {"sllidar_ros2", "rplidar_ros", "realsense2_camera"}


def _serial_lidars(r) -> list:
    return [h for h in r.hardware if h.category == "lidar" and h.driver_package in LAUNCHABLE
            and (h.driver_params or {}).get("channel_type", "serial") == "serial"]


def _real_params(r) -> dict:
    """Driver-wide hardware parameters for the ros2_control tag (everything except the per-wheel mapping).
    The motor port defaults to the next /dev/ttyUSB after the serial LiDARs (USB adapters enumerate in plug-in order)."""
    hp = dict(r.drive_hw_params or {})
    insts = [h for h in r.definition.hardware if h.hw == r.definition.drive.motor.driver]
    if hp.get("port") == "/dev/ttyUSB0" and not any("port" in (h.options or {}) for h in insts):
        hp["port"] = f"/dev/ttyUSB{len(_serial_lidars(r))}"
    skip = {"node_ids", "invert_left", "invert_right"}
    return {k: (str(v).lower() if isinstance(v, bool) else v) for k, v in hp.items() if k not in skip}


@dataclass
class RealSensor:
    """A sensor driver node for hardware:=real, with the launch arguments a user may need to change."""
    id: str
    package: str
    executable: str
    params: dict
    arg_params: list  # [(launch arg, parameter name, default, description)]
    remaps: list
    static_tf: tuple | None = None  # (parent, child) identity transform when the driver names its own frame
    from_source: bool = False  # built from drivers.repos (no rosdep key) — not an exec_depend of bringup

    @property
    def params_src(self) -> str:
        """The fixed parameters as Python source for the launch file."""
        return "{" + ", ".join(f"{k!r}: {v!r}" for k, v in self.params.items()) + "}"


def _real_sensors(r, lidars) -> list:
    out = []
    topics = {s.id: s.topic for s in lidars}
    tty = 0
    for h in r.hardware:
        if h.driver_package not in LAUNCHABLE or not h.driver_node or not h.frame:
            continue
        prm = dict(h.driver_params or {})
        args = []
        if h.category == "lidar" and not prm:
            continue  # no checked parameters (baud rate, mode) in the registry yet: the user starts this driver
        if h.category == "lidar":
            prm["frame_id"] = h.frame
            if prm.get("channel_type", "serial") == "serial":
                port = h.options.get("port") or f"/dev/ttyUSB{tty}"
                tty += 1
                prm.pop("serial_port", None)
                args.append((f"{h.id}_port", "serial_port", port, f"serial port of {h.name}"))
            elif prm.get("channel_type") == "udp":
                ip = h.options.get("ip") or prm.pop("udp_ip", "192.168.11.2")
                prm.pop("udp_ip", None)
                args.append((f"{h.id}_ip", "udp_ip", ip, f"IP address of {h.name}"))
            out.append(RealSensor(h.id, h.driver_package, h.driver_node, prm, args, [("scan", topics.get(h.id, "/scan"))],
                                  from_source=bool(h.driver_source)))
        elif h.category in ("depth_camera", "rgb_camera"):
            name = h.frame[:-5] if h.frame.endswith("_link") else h.frame
            prm.update({"camera_name": name, "publish_tf": True})  # node name = instance id → topics /<id>/color/…
            args.append((f"{h.id}_serial", "serial_no", str(h.options.get("serial_no", "")), f"serial number of {h.name} (empty = the first camera found)"))
            out.append(RealSensor(h.id, h.driver_package, h.driver_node, prm, args, [],
                                  None if h.frame.endswith("_link") else (h.frame, f"{name}_link"), from_source=bool(h.driver_source)))
    return out


def _real_joint_params(r) -> dict:
    """Which driver node and channel turns each wheel. A dual-channel driver takes a left/right pair:
    differential → node 1 (left, right); mecanum → node 1 (front pair), node 2 (rear pair)."""
    hp = r.drive_hw_params or {}
    if not hp:
        return {}
    nodes = list(hp.get("node_ids") or [1])
    inv = {"left": bool(hp.get("invert_left", False)), "right": bool(hp.get("invert_right", True))}
    out = {}
    for key, joint in r.controller_joints.items():
        side = "right" if key.endswith("right") else "left"
        k = 1 if key.startswith("rear") else 0
        out[joint] = {"node_id": nodes[min(k, len(nodes) - 1)], "channel": side, "invert": str(inv[side]).lower()}
    return out


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
    real_params: dict = field(default_factory=dict)  # <hardware><param> of the real driver (port & baud become xacro args)
    real_joint_params: dict = field(default_factory=dict)  # joint -> {node_id, channel, invert}
    real_sensors: list = field(default_factory=list)  # sensor driver nodes for hardware:=real
    cameras: list[SensorPlan] = field(default_factory=list)
    imus: list[SensorPlan] = field(default_factory=list)
    footprint: str = ""
    robot_radius: float = 0.3
    xy_goal_tolerance: float = 0.15  # grows with the robot: a 1 m AMR cannot park to 15 cm with a_max 0.5
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


# Gazebo rays per scan. With the datasheet sampling rate this matches the real sensor (e.g. C1: 5 kHz / 10 Hz = 500
# points per turn); capped at 1440 so a 32 kHz S3 still simulates on a modest PC. Without it: 2 rays per degree.
SIM_MAX_SAMPLES = 1440


def lidar_samples(sample_rate_hz: float | None, rate_hz: float, fov_deg: float) -> int:
    if sample_rate_hz and rate_hz > 0:
        n = float(sample_rate_hz) / rate_hz * fov_deg / 360.0
        return int(max(90, min(SIM_MAX_SAMPLES, round(n))))
    return int(round(fov_deg * 2))


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
            rate = float(s.get("rate_hz") or 10.0)
            samples = lidar_samples(s.get("sample_rate_hz"), rate, fov)
            lidars.append(SensorPlan(h.id, h.frame, "lidar", topic, topic.lstrip("/"), rate,
                                     float(s.get("range_m") or 12.0), max(float(s.get("min_range_m") or 0.05), 0.02), fov,
                                     round(-half, 5), round(half, 5), samples, embedded))
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
        real_params=_real_params(r),
        real_joint_params=_real_joint_params(r),
        real_sensors=_real_sensors(r, lidars),
        v_max=m.v_max,
        w_max=m.w_max,
        a_max=m.a_max,
        alpha_max=round(max(m.a_max / max(circ, 0.1), 0.5), 3),
        lidars=lidars,
        cameras=cams,
        imus=imus,
        footprint=fp,
        robot_radius=round(circ, 3),
        xy_goal_tolerance=round(min(0.30, max(0.15, 0.4 * circ)), 2),
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
