"""Drivetrain sizing — the same formulas the web calculator (docs/app.js) implements.

Continuous case: level floor, constant speed  → F = m·g·C_rr
Peak case:       max slope + max acceleration → F = m·g·(sin θ + C_rr·cos θ) + m·a

    τ_wheel  = F · r / n_drive              torque per driven wheel
    τ_motor  = τ_wheel / (i · η)            before the gearbox
    RPM_motor = v_max · 60 · i / (π · d)
    P_mech   = F · v_max                    whole robot; P_elec = P_mech / η

Motor selection: rated torque · i · η ≥ τ_wheel_cont · SF and peak torque · i · η ≥ τ_wheel_peak.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass

G = 9.81
SAFETY_FACTOR = 1.3
DEFAULT_EFFICIENCY = 0.85

# Rolling-resistance coefficients (polyurethane/rubber wheel on the given floor) — estimates.
ROLLING_RESISTANCE = {
    "concrete": 0.015, "epoxy": 0.012, "tile": 0.012, "carpet": 0.030,
    "asphalt": 0.020, "gravel": 0.050, "mixed": 0.030,
}


@dataclass(frozen=True)
class DrivetrainResult:
    total_mass_kg: float
    c_rr: float
    force_cont_n: float
    force_peak_n: float
    wheel_torque_cont_nm: float
    wheel_torque_peak_nm: float
    motor_torque_cont_nm: float
    motor_torque_peak_nm: float
    wheel_rpm: float
    motor_rpm: float
    power_mech_cont_w: float
    power_mech_peak_w: float
    power_elec_peak_w: float  # whole robot, after efficiency
    required_motor_rated_torque_nm: float  # incl. safety factor, at the motor shaft
    required_motor_peak_torque_nm: float

    def as_dict(self) -> dict[str, float]:
        return {k: round(v, 4) for k, v in asdict(self).items()}


def size_drivetrain(
    total_mass_kg: float,
    v_max: float,
    a_max: float,
    wheel_diameter_m: float,
    n_drive_wheels: int,
    gear_ratio: float = 1.0,
    slope_deg: float = 0.0,
    floor: str = "concrete",
    efficiency: float = DEFAULT_EFFICIENCY,
    safety_factor: float = SAFETY_FACTOR,
) -> DrivetrainResult:
    c_rr = ROLLING_RESISTANCE.get(floor, 0.02)
    theta = math.radians(slope_deg)
    r = wheel_diameter_m / 2.0
    f_cont = total_mass_kg * G * c_rr
    f_peak = total_mass_kg * G * (math.sin(theta) + c_rr * math.cos(theta)) + total_mass_kg * a_max
    tw_cont = f_cont * r / n_drive_wheels
    tw_peak = f_peak * r / n_drive_wheels
    tm_cont = tw_cont / (gear_ratio * efficiency)
    tm_peak = tw_peak / (gear_ratio * efficiency)
    wheel_rpm = v_max * 60.0 / (math.pi * wheel_diameter_m)
    return DrivetrainResult(
        total_mass_kg=total_mass_kg,
        c_rr=c_rr,
        force_cont_n=f_cont,
        force_peak_n=f_peak,
        wheel_torque_cont_nm=tw_cont,
        wheel_torque_peak_nm=tw_peak,
        motor_torque_cont_nm=tm_cont,
        motor_torque_peak_nm=tm_peak,
        wheel_rpm=wheel_rpm,
        motor_rpm=wheel_rpm * gear_ratio,
        power_mech_cont_w=f_cont * v_max,
        power_mech_peak_w=f_peak * v_max,
        power_elec_peak_w=f_peak * v_max / efficiency,
        required_motor_rated_torque_nm=tm_cont * safety_factor,
        required_motor_peak_torque_nm=tm_peak,
    )


def motor_fits(rated_torque_nm: float, peak_torque_nm: float, rated_rpm: float, result: DrivetrainResult) -> bool:
    """True when a motor (torque at its own shaft) satisfies the sizing result."""
    return (
        rated_torque_nm >= result.required_motor_rated_torque_nm
        and peak_torque_nm >= result.required_motor_peak_torque_nm
        and rated_rpm >= result.motor_rpm
    )
