"""Robot Definition v1 — the single source of truth of TESR Robot Builder.

Everything (URDF, ros2_control, Nav2, simulation, Docker, Node-RED, Studio Pro
blocks, BOM) is generated from an instance of :class:`RobotDefinition`.
The UI and the AI assistant may only modify this structure; they never touch
generated files.

Design rules
------------
* ``extra="forbid"`` everywhere — a typo in a key is an error, not silently ignored.
* Engineering checks (torque, power, TF, safety) live in ``rules``; this module
  only guarantees *structural* validity (types, ranges, uniqueness).
* Any field that may be ``"auto"`` is resolved by ``tesr_robot_builder.resolve``
  and the resolved value is written to ``robot.lock.yaml``.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from typing_extensions import Annotated

SCHEMA_VERSION = 1

Auto = Literal["auto"]
Vec3 = Annotated[list[float], Field(min_length=3, max_length=3)]
Ident = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


# --------------------------------------------------------------------------- #
# meta / target
# --------------------------------------------------------------------------- #
class Meta(StrictModel):
    name: Ident
    package_prefix: Ident = "tesr_robot"
    created_by: str | None = None
    description: str | None = None
    tags: list[str] = []


class Target(StrictModel):
    ros_distro: Literal["jazzy"] = "jazzy"  # humble: later profile
    os: Literal["ubuntu-24.04"] = "ubuntu-24.04"
    compute: Ident
    arch: Literal["arm64", "amd64"] = "arm64"
    deployment: Literal["docker", "native"] = "docker"


# --------------------------------------------------------------------------- #
# requirements
# --------------------------------------------------------------------------- #
class Environment(StrictModel):
    type: Literal[
        "factory", "warehouse", "hospital", "office", "laboratory", "outdoor", "custom"
    ] = "factory"
    indoor: bool = True
    floor: Literal["concrete", "epoxy", "tile", "carpet", "asphalt", "gravel", "mixed"] = "concrete"
    max_slope_deg: float = Field(0.0, ge=0, le=30)
    min_aisle_m: float | None = Field(None, gt=0)
    max_door_width_m: float | None = Field(None, gt=0)


class Payload(StrictModel):
    max_kg: float = Field(ge=0)
    dims_m: Vec3 | None = None
    cog_offset_m: Vec3 = [0.0, 0.0, 0.0]
    load_type: Literal[
        "fixed", "rack", "conveyor", "shelf", "arm", "lift", "fork", "custom"
    ] = "fixed"


class Motion(StrictModel):
    v_max: float = Field(gt=0, le=5.0, description="m/s")
    a_max: float = Field(gt=0, le=5.0, description="m/s^2")
    w_max: float = Field(gt=0, le=6.2832, description="rad/s")


class Requirements(StrictModel):
    application: Literal[
        "amr", "agv", "service", "delivery", "inspection", "research",
        "mobile_manipulator", "outdoor", "custom",
    ]
    environment: Environment = Environment()
    payload: Payload
    motion: Motion
    runtime_h: float = Field(gt=0)


# --------------------------------------------------------------------------- #
# mechanical / drive
# --------------------------------------------------------------------------- #
class Dims(StrictModel):
    length: float = Field(gt=0)
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    ground_clearance: float = Field(ge=0)


class Mass(StrictModel):
    robot: float | Auto = "auto"  # robot without payload
    total: float | Auto = "auto"  # robot + max payload


class Mechanical(StrictModel):
    dims_m: Dims
    mass_kg: Mass = Mass()


class Wheels(StrictModel):
    diameter_m: float = Field(gt=0)
    width_m: float = Field(gt=0)
    separation_m: float = Field(gt=0, description="track width, centre to centre")
    wheelbase_m: float | None = Field(None, gt=0, description="front-rear axle distance (4-wheel drives)")


class Caster(StrictModel):
    xyz: Vec3
    radius_m: float | Auto = "auto"


class Motor(StrictModel):
    hw: Ident
    count: int = Field(ge=1, le=8)
    gear_ratio: float = Field(1.0, gt=0)
    driver: Ident


DriveType = Literal["differential", "mecanum"]  # later: four_wheel_differential, omni, ackermann, tracked


class Drive(StrictModel):
    type: DriveType
    wheels: Wheels
    casters: list[Caster] = []
    motor: Motor

    @model_validator(mode="after")
    def _kinematic_consistency(self) -> "Drive":
        if self.type == "mecanum":
            if self.wheels.wheelbase_m is None:
                raise ValueError("drive.wheels.wheelbase_m is required for mecanum drive")
            if self.motor.count != 4:
                raise ValueError("mecanum drive requires drive.motor.count == 4")
        if self.type == "differential" and self.motor.count != 2:
            raise ValueError("differential drive requires drive.motor.count == 2")
        return self


# --------------------------------------------------------------------------- #
# hardware instances
# --------------------------------------------------------------------------- #
class HardwareInstance(StrictModel):
    id: Ident
    hw: Ident = Field(description="hardware id in the registry")
    frame: Ident | None = Field(None, description="TF frame; omit for devices without a pose")
    parent: Ident = "base_link"
    xyz: Vec3 = [0.0, 0.0, 0.0]
    rpy: Vec3 = [0.0, 0.0, 0.0]
    io: str | None = None
    options: dict[str, Any] = {}

    @model_validator(mode="after")
    def _rpy_is_radians(self) -> "HardwareInstance":
        if any(abs(v) > 6.2832 for v in self.rpy):
            raise ValueError(f"{self.id}: rpy {self.rpy} looks like degrees — use radians (180° = 3.14159)")
        return self


# --------------------------------------------------------------------------- #
# power / io / comms
# --------------------------------------------------------------------------- #
class Battery(StrictModel):
    hw: Ident


class Rail(StrictModel):
    v: float = Field(gt=0)
    hw: Ident | None = None


class Power(StrictModel):
    battery: Battery
    bus_v: float = Field(gt=0)
    rails: list[Rail] = []


class IO(StrictModel):
    DI: dict[int, Ident] = {}
    DO: dict[int, Ident] = {}


Comms = Literal["dds", "mqtt", "rest", "websocket", "modbus_tcp", "can", "ethercat"]


# --------------------------------------------------------------------------- #
# ros
# --------------------------------------------------------------------------- #
class Control(StrictModel):
    stack: Literal["ros2_control"] = "ros2_control"
    controller: str | Auto = "auto"


class Localization(StrictModel):
    slam: Literal["slam_toolbox", "none"] = "slam_toolbox"
    amcl: bool = True
    ekf: bool | Auto = "auto"


class Costmap(StrictModel):
    resolution_m: float = Field(0.05, gt=0)
    local_size_m: float = Field(gt=0)
    inflation_radius_m: float = Field(gt=0)
    obstacle_range_m: float = Field(gt=0)
    raytrace_range_m: float = Field(gt=0)


NavFeature = Literal["manual", "slam", "nav", "waypoints", "docking", "fleet"]


class Navigation(StrictModel):
    profile: Ident = "indoor_amr"
    planner: str | Auto = "auto"
    controller: str | Auto = "auto"
    costmap: Costmap | Auto = "auto"
    safety_margin_m: float = Field(0.05, ge=0)
    features: list[NavFeature] = ["manual", "slam", "nav"]


class Perception(StrictModel):
    depth_to_costmap: bool = False


class Ros(StrictModel):
    control: Control = Control()
    localization: Localization = Localization()
    navigation: Navigation = Navigation()
    perception: Perception = Perception()


# --------------------------------------------------------------------------- #
# sim / integrations
# --------------------------------------------------------------------------- #
class Sim(StrictModel):
    engine: Literal["gz_harmonic"] = "gz_harmonic"
    world: Ident = "empty"
    renderer: Literal["ogre1", "ogre2"] = "ogre1"


class Integrations(StrictModel):
    node_red: bool = False
    studio_pro: bool = False


# --------------------------------------------------------------------------- #
# root
# --------------------------------------------------------------------------- #
class RobotDefinition(StrictModel):
    schema_version: Literal[1]
    meta: Meta
    target: Target
    requirements: Requirements
    mechanical: Mechanical
    drive: Drive
    hardware: list[HardwareInstance] = []
    power: Power
    io: IO = IO()
    comms: list[Comms] = ["dds"]
    ros: Ros = Ros()
    sim: Sim = Sim()
    integrations: Integrations = Integrations()
    overrides_dir: str = "overrides/"

    @model_validator(mode="after")
    def _unique_ids_and_frames(self) -> "RobotDefinition":
        ids = [h.id for h in self.hardware]
        dup = sorted({i for i in ids if ids.count(i) > 1})
        if dup:
            raise ValueError(f"duplicate hardware ids: {dup}")
        frames = [h.frame for h in self.hardware if h.frame]
        dup = sorted({f for f in frames if frames.count(f) > 1})
        if dup:
            raise ValueError(f"duplicate hardware frames: {dup}")
        return self

    # convenience -------------------------------------------------------------
    def hardware_by_id(self, hw_instance_id: str) -> HardwareInstance | None:
        for h in self.hardware:
            if h.id == hw_instance_id:
                return h
        return None


class DefinitionError(Exception):
    """Raised when a definition file does not validate; ``errors`` is a list of readable lines."""

    def __init__(self, errors: list[str]):
        super().__init__("\n".join(errors))
        self.errors = errors


def _format_validation_error(exc: ValidationError) -> list[str]:
    lines = []
    for err in exc.errors():
        loc = ".".join(str(p) for p in err["loc"]) or "<root>"
        lines.append(f"{loc}: {err['msg']}")
    return lines


def load_definition(path: str | Path) -> RobotDefinition:
    """Load and structurally validate a ``*.robot.yaml`` file."""
    path = Path(path)
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise DefinitionError([f"{path}: top level must be a mapping"])
    try:
        return RobotDefinition.model_validate(data)
    except ValidationError as exc:
        raise DefinitionError(_format_validation_error(exc)) from exc


def definition_digest(path: str | Path) -> str:
    """Short content hash of the definition file — referenced in every generated file header."""
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:12]


def json_schema() -> dict[str, Any]:
    """JSON Schema of the Robot Definition (consumed by the web UI and editors)."""
    schema = RobotDefinition.model_json_schema()
    schema["$id"] = "https://tesr.co.th/schemas/robot-definition/v1.json"
    schema["title"] = "TESR Robot Definition v1"
    return schema
