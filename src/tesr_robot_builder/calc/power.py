"""Power budget and battery sizing (mirrors docs/app.js).

    P_avg  = P_mech_cont · duty / η + P_electronics
    Wh     = P_avg · runtime_h / DoD
    Ah     = Wh / V_bus
    I_peak = (P_elec_peak + P_electronics) / V_bus
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

DEFAULT_DUTY = 0.6          # share of the mission spent moving near v_max
DEFAULT_DOD = 0.8           # usable depth of discharge
DEFAULT_ELECTRONICS_W = 30  # compute + sensors when nothing better is known


@dataclass(frozen=True)
class PowerResult:
    electronics_w: float
    drive_avg_w: float
    total_avg_w: float
    energy_wh: float
    capacity_ah: float
    peak_current_a: float

    def as_dict(self) -> dict[str, float]:
        return {k: round(v, 3) for k, v in asdict(self).items()}


def size_battery(
    power_mech_cont_w: float,
    power_elec_peak_w: float,
    runtime_h: float,
    bus_v: float,
    electronics_w: float = DEFAULT_ELECTRONICS_W,
    duty: float = DEFAULT_DUTY,
    efficiency: float = 0.85,
    dod: float = DEFAULT_DOD,
) -> PowerResult:
    drive_avg = power_mech_cont_w * duty / efficiency
    total_avg = drive_avg + electronics_w
    wh = total_avg * runtime_h / dod
    return PowerResult(
        electronics_w=electronics_w,
        drive_avg_w=drive_avg,
        total_avg_w=total_avg,
        energy_wh=wh,
        capacity_ah=wh / bus_v,
        peak_current_a=(power_elec_peak_w + electronics_w) / bus_v,
    )


def battery_fits(nominal_v: float, capacity_ah: float, max_discharge_a: float, bus_v: float, result: PowerResult) -> bool:
    return abs(nominal_v - bus_v) / bus_v <= 0.12 and capacity_ah >= result.capacity_ah and max_discharge_a >= result.peak_current_a
