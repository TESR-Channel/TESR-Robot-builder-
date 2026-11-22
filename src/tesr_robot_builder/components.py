"""The parts every robot is made of — one checklist shared by the rules, the BOM and the web app (docs/garage-core.js).

Each component must be present in the definition. Who buys it is a separate question: components listed in
``supply.customer`` are brought by the customer, so the BOM / quotation shows them without a price.
"""
from __future__ import annotations

# (id, English, Thai, required)
COMPONENTS: list[tuple[str, str, str, bool]] = [
    ("drive", "Drive (motors + wheels)", "ระบบขับเคลื่อน (มอเตอร์ + ล้อ)", True),
    ("motor_driver", "Low-level control (motor driver)", "Low-level control (ไดรเวอร์มอเตอร์)", True),
    ("compute", "Main computer", "คอมพิวเตอร์ส่วนกลาง", True),
    ("lidar", "LiDAR", "LiDAR", True),
    ("imu", "IMU", "IMU", True),
    ("battery", "Battery", "แบตเตอรี่", True),
    ("power", "Power rails (DC-DC)", "ไฟเลี้ยงย่อย (DC-DC)", True),   # only when a device needs another voltage
    ("estop", "Emergency stop", "ปุ่มหยุดฉุกเฉิน (E-stop)", True),  # required above ESTOP_REQUIRED_KG
    ("camera", "Camera (optional)", "กล้อง (ไม่บังคับ)", False),
]
COMPONENT_IDS = [c[0] for c in COMPONENTS]

CATEGORY_COMPONENT = {
    "motor": "drive", "wheel": "drive",
    "motor_driver": "motor_driver", "encoder": "motor_driver", "comm": "motor_driver",  # comm = existing AGV base / PLC bridge
    "compute": "compute", "lidar": "lidar", "imu": "imu", "battery": "battery", "power_supply": "power",
    "estop": "estop", "depth_camera": "camera", "rgb_camera": "camera",
}

# an E-stop is required once the robot (with payload) weighs more than this, or carries more than ESTOP_REQUIRED_PAYLOAD_KG
ESTOP_REQUIRED_KG = 20.0
ESTOP_REQUIRED_PAYLOAD_KG = 10.0


def component_of(category: str) -> str | None:
    return CATEGORY_COMPONENT.get(category)
