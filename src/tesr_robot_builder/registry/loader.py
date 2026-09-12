"""Registry — hardware capability records, ROS driver manifests and profiles.

Three data sets, deliberately separate (see ADR-0003):

* ``registry/hardware/<category>/<id>.yaml``      engineering data (mass, power, interfaces, sensor specs)
* ``registry/drivers/<hw_id>/<distro>/manifest.yaml``  ROS driver profile per hardware × distro
* ``registry/profiles/{drive,nav}/<id>.yaml``     drive kinematics and navigation defaults

The commercial catalog (SKU, price, tesrshop URL) is a fourth set that links to
``hardware`` by id; it is not loaded by the engine.

The registry is plain YAML so that adding hardware never requires touching the
core. The loader validates every record and computes a content hash that is
written to ``robot.lock.yaml`` for reproducibility.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError

HardwareCategory = Literal[
    "compute", "motor", "gearbox", "motor_driver", "wheel", "lidar", "depth_camera",
    "rgb_camera", "imu", "encoder", "gnss", "safety_lidar", "ultrasonic", "bumper",
    "estop", "battery", "power_supply", "comm", "digital_io", "arm", "lift",
]

# Categories that need a ROS driver manifest for the target distro.
DRIVER_CATEGORIES = {"lidar", "depth_camera", "rgb_camera", "imu", "motor_driver", "gnss", "safety_lidar"}


class Electrical(BaseModel):
    model_config = ConfigDict(extra="forbid")
    voltage_v: float = Field(gt=0)
    typical_w: float = Field(ge=0)
    peak_w: float = Field(ge=0)


class SensorSpec(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: str
    range_m: float | None = None
    min_range_m: float | None = None
    fov_deg: float | None = None
    vfov_deg: float | None = None
    rate_hz: float | None = None


class ComputeSpec(BaseModel):
    model_config = ConfigDict(extra="allow")
    arch: Literal["arm64", "amd64"]
    ram_gb: float
    gpu: bool = False
    usb3_ports: int = 0
    ethernet_ports: int = 0
    supported_distros: list[str]
    supported_os: list[str]


class RosDefaults(BaseModel):
    model_config = ConfigDict(extra="allow")
    default_frame: str | None = None
    topic: str | None = None
    msg: str | None = None


class HardwareRecord(BaseModel):
    """One hardware component. Category-specific specs live in ``sensor`` / ``compute``."""

    model_config = ConfigDict(extra="allow")
    id: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    category: HardwareCategory
    name: str
    manufacturer: str = "unknown"
    mass_kg: float = Field(ge=0)
    dims_m: list[float] = Field(default=[0.05, 0.05, 0.05], min_length=3, max_length=3)
    electrical: Electrical | None = None
    interfaces: list[str] = []
    sensor: SensorSpec | None = None
    compute: ComputeSpec | None = None
    ros: RosDefaults | None = None
    verified: bool = Field(False, description="True once specs were checked against a datasheet")
    sources: list[str] = []
    catalog_ref: str | None = None
    notes: str | None = None


class DriverManifest(BaseModel):
    model_config = ConfigDict(extra="allow")
    hw: str
    distro: str
    package: str
    apt: list[str] = []
    pip: list[str] = []
    node: str | None = None
    launch_template: str | None = None  # Phase 1
    params_template: str | None = None  # Phase 1
    topics: dict[str, str] = {}
    frame: str | None = None
    ros2_control_plugin: str | None = None
    notes: str | None = None


class DriveProfile(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    kinematics: str
    controller: str
    joints: dict[str, str]
    wheel_count: int
    holonomic: bool = False
    nav_planner: str
    nav_controller: str


class NavProfile(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    resolution_m: float = 0.05
    local_costmap_min_m: float = 3.0
    local_costmap_max_m: float = 6.0
    inflation_extra_m: float = 0.10
    obstacle_range_factor: float = 0.9
    raytrace_extra_m: float = 0.5
    max_speed_cap: float | None = None


class RegistryError(Exception):
    pass


class Registry:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.hardware: dict[str, HardwareRecord] = {}
        self.drivers: dict[tuple[str, str], DriverManifest] = {}
        self.drive_profiles: dict[str, DriveProfile] = {}
        self.nav_profiles: dict[str, NavProfile] = {}
        self._files: list[Path] = []

    # ------------------------------------------------------------------ load
    @classmethod
    def load(cls, root: str | Path | None = None) -> "Registry":
        reg = cls(Path(root) if root else default_registry_path())
        if not reg.root.is_dir():
            raise RegistryError(f"registry directory not found: {reg.root}")
        errors: list[str] = []
        for path in sorted((reg.root / "hardware").rglob("*.yaml")):
            rec = reg._load_record(path, HardwareRecord, errors)
            if rec:
                if rec.id in reg.hardware:
                    errors.append(f"{path}: duplicate hardware id '{rec.id}'")
                reg.hardware[rec.id] = rec
        for path in sorted((reg.root / "drivers").rglob("manifest.yaml")):
            rec = reg._load_record(path, DriverManifest, errors)
            if rec:
                reg.drivers[(rec.hw, rec.distro)] = rec
        for path in sorted((reg.root / "profiles" / "drive").glob("*.yaml")):
            rec = reg._load_record(path, DriveProfile, errors)
            if rec:
                reg.drive_profiles[rec.id] = rec
        for path in sorted((reg.root / "profiles" / "nav").glob("*.yaml")):
            rec = reg._load_record(path, NavProfile, errors)
            if rec:
                reg.nav_profiles[rec.id] = rec
        if errors:
            raise RegistryError("\n".join(errors))
        return reg

    def _load_record(self, path: Path, model: type[BaseModel], errors: list[str]):
        self._files.append(path)
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            return model.model_validate(data)
        except (ValidationError, yaml.YAMLError) as exc:
            errors.append(f"{path.relative_to(self.root)}: {exc}")
            return None

    # ----------------------------------------------------------------- query
    def hw(self, hw_id: str) -> HardwareRecord | None:
        return self.hardware.get(hw_id)

    def driver(self, hw_id: str, distro: str) -> DriverManifest | None:
        return self.drivers.get((hw_id, distro))

    def by_category(self, category: str) -> list[HardwareRecord]:
        return [r for r in self.hardware.values() if r.category == category]

    def content_hash(self) -> str:
        """Hash of every registry file — changes whenever any record changes."""
        h = hashlib.sha256()
        for path in sorted(self._files):
            h.update(str(path.relative_to(self.root)).encode())
            h.update(path.read_bytes())
        return h.hexdigest()[:12]

    def summary(self) -> dict[str, Any]:
        return {
            "root": str(self.root),
            "hardware": len(self.hardware),
            "drivers": len(self.drivers),
            "drive_profiles": sorted(self.drive_profiles),
            "nav_profiles": sorted(self.nav_profiles),
            "hash": self.content_hash(),
        }


def default_registry_path() -> Path:
    """``$TESR_RB_REGISTRY`` → ``./registry`` → repository ``registry/`` next to the package."""
    env = os.environ.get("TESR_RB_REGISTRY")
    if env:
        return Path(env)
    cwd = Path.cwd() / "registry"
    if cwd.is_dir():
        return cwd
    return Path(__file__).resolve().parents[3] / "registry"
