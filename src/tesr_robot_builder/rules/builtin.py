"""Built-in rules (Phase 0 set). Import this module to register them."""
from __future__ import annotations

import math

from ..registry.loader import DRIVER_CATEGORIES
from .engine import Finding, RuleContext, register

# --------------------------------------------------------------------- hardware
@register("R-HW-001", "hardware", "every hardware id exists in the registry")
def hw_exists(ctx: RuleContext) -> list[Finding]:
    out = []
    ids = [h.hw for h in ctx.defn.hardware] + [
        ctx.defn.drive.motor.hw, ctx.defn.drive.motor.driver, ctx.defn.power.battery.hw, ctx.defn.target.compute,
    ] + [r.hw for r in ctx.defn.power.rails if r.hw]
    for hw_id in ids:
        if ctx.registry.hw(hw_id) is None:
            out.append(Finding("R-HW-001", "hardware", "ERROR", f"hardware '{hw_id}' is not in the registry",
                               suggestion="add registry/hardware/<category>/<id>.yaml or pick a registered part"))
    return out


@register("R-HW-002", "hardware", "a ROS driver manifest exists for every sensor/driver on the target distro")
def driver_exists(ctx: RuleContext) -> list[Finding]:
    out = []
    distro = ctx.defn.target.ros_distro
    for h in ctx.resolved.hardware:
        if h.category in DRIVER_CATEGORIES and ctx.registry.driver(h.hw, distro) is None:
            out.append(Finding("R-HW-002", "hardware", "ERROR",
                               f"{h.id}: no ROS {distro} driver manifest for '{h.hw}'", path=f"hardware.{h.id}",
                               suggestion=f"add registry/drivers/{h.hw}/{distro}/manifest.yaml"))
    driver_hw = ctx.defn.drive.motor.driver
    if ctx.registry.driver(driver_hw, distro) is None:
        out.append(Finding("R-HW-002", "hardware", "ERROR",
                           f"motor driver '{driver_hw}' has no ROS {distro} manifest (ros2_control hardware interface)",
                           path="drive.motor.driver"))
    return out


@register("R-HW-003", "hardware", "target computer supports the requested ROS distro, OS and architecture")
def compute_supports_target(ctx: RuleContext) -> list[Finding]:
    rec = ctx.registry.hw(ctx.defn.target.compute)
    if rec is None or rec.compute is None:
        return [Finding("R-HW-003", "hardware", "ERROR", f"'{ctx.defn.target.compute}' is not a compute record", path="target.compute")]
    out = []
    t = ctx.defn.target
    if t.ros_distro not in rec.compute.supported_distros:
        out.append(Finding("R-HW-003", "hardware", "ERROR", f"{rec.name} does not support ROS 2 {t.ros_distro}", path="target.ros_distro"))
    if t.os not in rec.compute.supported_os:
        out.append(Finding("R-HW-003", "hardware", "ERROR", f"{rec.name} does not support {t.os}", path="target.os"))
    if t.arch != rec.compute.arch:
        out.append(Finding("R-HW-003", "hardware", "ERROR", f"{rec.name} is {rec.compute.arch}, target.arch says {t.arch}", path="target.arch"))
    return out


@register("R-HW-004", "hardware", "USB 3 devices do not exceed the computer's USB 3 ports")
def usb3_ports(ctx: RuleContext) -> list[Finding]:
    rec = ctx.registry.hw(ctx.defn.target.compute)
    if rec is None or rec.compute is None:
        return []
    need = sum(1 for h in ctx.resolved.hardware if "usb3" in (ctx.registry.hw(h.hw).interfaces if ctx.registry.hw(h.hw) else []))
    if need > rec.compute.usb3_ports:
        return [Finding("R-HW-004", "hardware", "WARN", f"{need} USB 3 devices but {rec.name} has {rec.compute.usb3_ports} USB 3 ports",
                        suggestion="use a powered USB 3 hub or move a device to Ethernet")]
    return []


# --------------------------------------------------------------------------- tf
@register("R-TF-001", "tf", "every hardware frame is unique and does not collide with generated frames")
def frames_unique(ctx: RuleContext) -> list[Finding]:
    reserved = {"base_footprint", "base_link", "odom", "map"} | {w.name for w in ctx.resolved.wheels} | {c.name for c in ctx.resolved.casters}
    out = []
    for h in ctx.resolved.hardware:
        if h.frame and h.frame in reserved:
            out.append(Finding("R-TF-001", "tf", "ERROR", f"{h.id}: frame '{h.frame}' is reserved", path=f"hardware.{h.id}.frame"))
    return out


@register("R-TF-002", "tf", "every parent frame exists and the TF tree is connected to base_link")
def frames_connected(ctx: RuleContext) -> list[Finding]:
    frames = {"base_link", "base_footprint"} | {h.frame for h in ctx.resolved.hardware if h.frame}
    parents = {h.frame: h.parent for h in ctx.resolved.hardware if h.frame}
    out = []
    for h in ctx.resolved.hardware:
        if h.frame is None:
            continue
        if h.parent not in frames:
            out.append(Finding("R-TF-002", "tf", "ERROR", f"{h.id}: parent frame '{h.parent}' does not exist", path=f"hardware.{h.id}.parent"))
            continue
        # walk up; detect cycles
        seen, cur = set(), h.frame
        while cur in parents:
            if cur in seen:
                out.append(Finding("R-TF-002", "tf", "ERROR", f"{h.id}: TF cycle through '{cur}'", path=f"hardware.{h.id}.parent"))
                break
            seen.add(cur)
            cur = parents[cur]
    return out


@register("R-TF-003", "tf", "sensor mounts are within the robot envelope")
def sensors_inside_envelope(ctx: RuleContext) -> list[Finding]:
    d = ctx.defn.mechanical.dims_m
    out = []
    for h in ctx.resolved.hardware:
        if h.frame is None or h.parent != "base_link":
            continue
        x, y, z = h.xyz
        if abs(x) > d.length / 2 + 0.05 or abs(y) > d.width / 2 + 0.05 or z > d.height + 1.0 or z < -ctx.resolved.wheel_radius:
            out.append(Finding("R-TF-003", "tf", "WARN", f"{h.id} mounted at {h.xyz} is outside the chassis envelope", path=f"hardware.{h.id}.xyz"))
    return out


# --------------------------------------------------------------------- mechanical
@register("R-MECH-001", "mechanical", "wheels sit within the chassis width")
def wheels_within_width(ctx: RuleContext) -> list[Finding]:
    w = ctx.defn.drive.wheels
    outer = w.separation_m / 2 + w.width_m / 2
    if outer > ctx.defn.mechanical.dims_m.width / 2 + 0.005:
        return [Finding("R-MECH-001", "mechanical", "WARN",
                        f"wheel outer edge at ±{outer:.3f} m exceeds chassis half-width {ctx.defn.mechanical.dims_m.width / 2:.3f} m "
                        "(footprint will be widened by the safety margin only)", path="drive.wheels.separation_m")]
    return []


@register("R-MECH-002", "mechanical", "ground clearance is below the wheel radius")
def clearance_vs_wheel(ctx: RuleContext) -> list[Finding]:
    d = ctx.defn.mechanical.dims_m
    if d.ground_clearance >= ctx.resolved.wheel_radius:
        return [Finding("R-MECH-002", "mechanical", "WARN",
                        f"ground clearance {d.ground_clearance} m ≥ wheel radius {ctx.resolved.wheel_radius} m — chassis sits above the axle line; "
                        "confirm wheel mounting", path="mechanical.dims_m.ground_clearance")]
    return []


@register("R-MECH-003", "mechanical", "casters and wheelbase fit inside the chassis length")
def casters_inside(ctx: RuleContext) -> list[Finding]:
    half = ctx.defn.mechanical.dims_m.length / 2
    out = []
    for c in ctx.resolved.casters:
        if abs(c.x) > half:
            out.append(Finding("R-MECH-003", "mechanical", "ERROR", f"{c.name} at x={c.x} is outside the chassis (±{half})", path="drive.casters"))
    wb = ctx.defn.drive.wheels.wheelbase_m
    if wb and wb / 2 > half:
        out.append(Finding("R-MECH-003", "mechanical", "ERROR", f"wheelbase {wb} m exceeds chassis length", path="drive.wheels.wheelbase_m"))
    return out


@register("R-MECH-004", "mechanical", "quasi-static tipping acceleration exceeds the requested lateral acceleration")
def tipping(ctx: RuleContext) -> list[Finding]:
    d = ctx.defn
    payload_h = d.mechanical.dims_m.height + d.requirements.payload.cog_offset_m[2]
    body_h = d.mechanical.dims_m.ground_clearance + d.mechanical.dims_m.height / 2
    m_body, m_load = ctx.resolved.robot_mass, d.requirements.payload.max_kg
    h_cog = (m_body * body_h + m_load * payload_h) / max(m_body + m_load, 1e-6)
    a_tip = 9.81 * (d.drive.wheels.separation_m / 2) / max(h_cog, 1e-3)
    a_lat = d.requirements.motion.v_max * d.requirements.motion.w_max  # v·ω at max speed and yaw rate
    if a_lat > 0.7 * a_tip:
        return [Finding("R-MECH-004", "mechanical", "WARN",
                        f"lateral accel at v_max·w_max = {a_lat:.2f} m/s² vs tipping limit {a_tip:.2f} m/s² (CoG {h_cog:.2f} m)",
                        suggestion="lower w_max/v_max, widen the track, or lower the payload CoG")]
    return []


# ------------------------------------------------------------------- navigation
@register("R-NAV-001", "navigation", "a 2D LiDAR is present when SLAM or navigation is requested")
def lidar_for_nav(ctx: RuleContext) -> list[Finding]:
    feats = set(ctx.defn.ros.navigation.features)
    if feats & {"slam", "nav", "waypoints"} and not any(h.category == "lidar" for h in ctx.resolved.hardware):
        return [Finding("R-NAV-001", "navigation", "ERROR", "SLAM/navigation requested but no LiDAR in hardware", path="hardware")]
    return []


@register("R-NAV-002", "navigation", "narrowest aisle admits the robot plus safety margins")
def aisle_width(ctx: RuleContext) -> list[Finding]:
    env = ctx.defn.requirements.environment
    if env.min_aisle_m is None:
        return []
    need = ctx.defn.mechanical.dims_m.width + 2 * ctx.defn.ros.navigation.safety_margin_m
    if need > env.min_aisle_m:
        return [Finding("R-NAV-002", "navigation", "ERROR", f"robot needs {need:.2f} m but min aisle is {env.min_aisle_m} m", path="mechanical.dims_m.width")]
    if need > 0.85 * env.min_aisle_m:
        return [Finding("R-NAV-002", "navigation", "WARN", f"robot uses {need / env.min_aisle_m:.0%} of the narrowest aisle — expect slow passages")]
    return []


@register("R-NAV-003", "navigation", "obstacle range does not exceed the LiDAR range")
def ranges_consistent(ctx: RuleContext) -> list[Finding]:
    cm, lr = ctx.resolved.costmap, ctx.resolved.lidar_range
    out = []
    if lr and cm.obstacle_range_m > lr:
        out.append(Finding("R-NAV-003", "navigation", "ERROR", f"obstacle_range {cm.obstacle_range_m} m > LiDAR range {lr} m", path="ros.navigation.costmap"))
    if cm.inflation_radius_m < math.hypot(ctx.defn.mechanical.dims_m.length / 2, ctx.defn.mechanical.dims_m.width / 2):
        out.append(Finding("R-NAV-003", "navigation", "WARN", "inflation radius is smaller than the circumscribed radius", path="ros.navigation.costmap"))
    return out


# ----------------------------------------------------------------------- safety
@register("R-SAFE-001", "safety", "an emergency stop is mapped for robots carrying more than 50 kg")
def estop_present(ctx: RuleContext) -> list[Finding]:
    heavy = ctx.defn.requirements.payload.max_kg > 50 or ctx.resolved.total_mass > 80
    has_estop = any(h.category == "estop" for h in ctx.resolved.hardware) or "estop" in ctx.defn.io.DI.values()
    if heavy and not has_estop:
        return [Finding("R-SAFE-001", "safety", "ERROR", "no emergency stop for a robot over 50 kg payload / 80 kg total", path="hardware",
                        suggestion="add an estop hardware instance and map it to a digital input")]
    if not has_estop:
        return [Finding("R-SAFE-001", "safety", "WARN", "no emergency stop configured")]
    return []


@register("R-SAFE-002", "safety", "maximum speed suits the operating environment")
def speed_for_environment(ctx: RuleContext) -> list[Finding]:
    caps = {"hospital": 0.8, "office": 1.0, "laboratory": 1.0}
    env = ctx.defn.requirements.environment.type
    v = ctx.defn.requirements.motion.v_max
    if env in caps and v > caps[env]:
        return [Finding("R-SAFE-002", "safety", "WARN", f"v_max {v} m/s exceeds the {caps[env]} m/s guideline for {env} environments", path="requirements.motion.v_max")]
    return []


# ------------------------------------------------------------------------ power
@register("R-PWR-001", "power", "every device voltage matches the bus or a configured rail")
def voltages_match(ctx: RuleContext) -> list[Finding]:
    rails = {ctx.defn.power.bus_v} | {r.v for r in ctx.defn.power.rails}
    out = []
    for h in ctx.resolved.hardware:
        rec = ctx.registry.hw(h.hw)
        if rec and rec.electrical and not any(abs(rec.electrical.voltage_v - r) < 0.5 for r in rails):
            out.append(Finding("R-PWR-001", "power", "ERROR", f"{h.id} needs {rec.electrical.voltage_v} V but no rail supplies it", path="power.rails",
                               suggestion=f"add a {rec.electrical.voltage_v} V rail (DC-DC) to power.rails"))
    return out


@register("R-PWR-002", "power", "battery pack voltage (nominal x series) matches the bus")
def battery_pack_matches_bus(ctx: RuleContext) -> list[Finding]:
    b = ctx.defn.power.battery
    rec = ctx.registry.hw(b.hw)
    ex = rec.model_dump() if rec else {}
    nominal = (ex.get("battery") or {}).get("nominal_v") or (rec.electrical.voltage_v if rec and rec.electrical else None)
    if not nominal:
        return [Finding("R-PWR-002", "power", "PASS", "battery has no nominal voltage on record", path="power.battery")]
    pack_v = nominal * b.series
    bus = ctx.defn.power.bus_v
    if abs(pack_v - bus) / bus <= 0.15:
        return [Finding("R-PWR-002", "power", "PASS", f"battery pack {pack_v:g} V ({nominal:g} V x {b.series} in series) matches bus {bus:g} V", path="power.battery")]
    n = max(1, round(bus / nominal))
    return [Finding("R-PWR-002", "power", "WARN", f"battery pack {pack_v:g} V ({nominal:g} V x {b.series}) does not match bus {bus:g} V", path="power.battery.series",
                    suggestion=f"set power.battery.series: {n} ({n} x {nominal:g} V = {n * nominal:g} V) or add a DC-DC converter between the pack and the bus")]
