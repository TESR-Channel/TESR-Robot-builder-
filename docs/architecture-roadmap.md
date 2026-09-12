# TESR Robot Builder — Architecture & Roadmap

เวอร์ชัน 0.1 · 12 กันยายน 2026 · จัดทำโดย TESR Enterprise AI สำหรับ Anon (CEO, TESR Co., Ltd.)
อ้างอิง: สเปก "TESR Robot Builder" 29 modules (เอกสารต้นทาง), IRON-X Gen II, TESR Studio Pro, TESR Shop / Academy

---

## 1. Executive Summary (สรุปผู้บริหาร)

- สร้าง **TESR Robot Builder** เป็น Robot Engineering Configurator ที่มี **Robot Definition (`robot.yaml`) เป็น single source of truth** → Validation Engine → Deterministic Template Generators → ROS 2 Jazzy workspace + Gazebo Harmonic + Docker + Deploy. AI ทำหน้าที่ "วิศวกรที่ปรึกษา" (เข้าใจ requirement, คำนวณ, แนะนำ, เติม definition, อธิบาย) — ไม่ใช่ตัว generate source code
- สถาปัตยกรรม 3 ชั้นแยกกันชัด: **Registry (ข้อมูล)** → **Engine (schema / calc / rules / generators)** → **App (UI / API / AI / Deploy)** ดังนั้นเพิ่ม hardware ใหม่ = เพิ่มไฟล์ YAML + template ไม่แตะ core → เหมาะกับทีม ≤10 คน
- Roadmap 5 เฟส ~22 สัปดาห์ (ก.ย. 2026 – ก.พ. 2027) ถึงจุด "one-click deploy ลง IRON-X Gen II จริง" โดย **Phase 1 gate** (CLI generate → `colcon build` ผ่าน → sim วิ่ง SLAM + Nav2 ได้) เป็นด่านสำคัญที่สุด ต้องผ่านก่อนลงแรงกับ UI และ AI
- เชิงธุรกิจ Robot Builder คือ strategic idea #2 (AI Engineering Consultant) + #3 (Engineering Ecosystem) ในผลิตภัณฑ์เดียว — Definition เดียวออกได้ทั้ง BOM/Quotation (Shop), Spec/TOR (Project), Lab (Academy) และ Pro subscription / support contract (recurring revenue ที่ margin สูงกว่า net margin ~4.2% ของปี 2567)

---

## 2. Situation Analysis (วิเคราะห์สถานการณ์)

### สินทรัพย์ที่ TESR มีอยู่แล้ว (ฐานสำหรับต่อยอด)

| สินทรัพย์ | ใช้ใน Robot Builder อย่างไร |
|---|---|
| **IRON-X Gen II** — ROS 2 Jazzy, Gazebo Harmonic, Docker บนหุ่นจริง, `ironx_description / ironx_gazebo / ironx_slam / ironx_navigation2`, EKF + IMU calibration | **Reference robot #1** — package ที่ generate ต้องเทียบเท่า `ironx_*`; deploy pipeline ทดสอบกับตัวนี้ |
| **TESR Studio Pro** — Blockly, rosbridge :9090, Mosquitto MQTT ws :9001, Node-RED, PM2/systemd | ผู้บริโภค `capabilities.json` (block ต่อรุ่นอัตโนมัติ); runtime dashboard ใช้ transport เดียวกัน |
| **Beary-X / Kuro-X** — ROS 2 Humble / Ubuntu 22.04 | Definition ตัวอย่างสำหรับ Humble profile ในเฟสหลัง (registry key ด้วย distro) |
| บทเรียน Nav2/SLAM จริง — goal tolerance, loop closure, Ogre 1 บน CPU-only, cmd_vel watchdog 10 Hz | กลายเป็น default parameter และ validation rule ในตัว generator |
| TESR Shop + Academy + Brand (ดำ / แดงเข้ม #8B0000 / ทอง #C9A84C, Chakra Petch + IBM Plex Sans Thai) | Catalog registry, course lab, UI theme |

### ข้อจำกัดที่กำหนดสถาปัตยกรรม

- ทีม ≤10 คน, engineer ที่ทำ ROS ลึกมีจำกัด → core ต้องเล็ก, data-driven, ใช้ CI ตรวจแทนคน
- รายได้ปี 2567 = 8.47 ล้านบาท โตชะลอ (~7.6%), net margin ~4.2% เทียบ gross ~30.6% → ต้องการผลิตภัณฑ์ที่ขายซ้ำได้โดยไม่เพิ่ม man-hour ต่อดีล
- หุ่น 300 kg ที่ config ผิด = อันตรายและแบรนด์เสีย → safety validation และ sim-first gate ไม่ใช่ option
- AI vendor ปัจจุบันคือ OpenAI → ทำ LLM adapter ให้ใช้ vendor เดียวได้ โดย core ไม่ผูกกับ provider

### ทางเลือกสถาปัตยกรรมที่ตัดทิ้ง (พร้อมเหตุผล)

| ทางเลือก | เหตุผลที่ไม่เลือก |
|---|---|
| ให้ LLM generate ROS package ตรงจาก form | ควบคุม version ไม่ได้, audit ด้าน safety ไม่ได้, จ่าย token ทุกครั้ง, ผลลัพธ์ไม่ deterministic |
| Generated code เป็น master (user แก้ไฟล์ตรง) | regenerate แล้วทับงาน user → ใช้ overrides layer แทน |
| Cloud SaaS multi-tenant ตั้งแต่แรก | auth/billing/infra กินเวลาก่อน generator จะพิสูจน์ตัวเอง → local-first ก่อน |
| Web-only (generator ทำงานใน browser) | ต้องใช้ xacro / colcon / ssh / docker → ต้องมี backend Python อยู่ดี |
| รองรับ Humble + Jazzy พร้อมกันใน MVP | template ×2 ทุกชิ้น → Jazzy ผ่านก่อน, Humble เป็น profile ทีหลัง |

---

## 3. Opportunities (โอกาส)

เรียงตามมูลค่าต่อบริษัท:

1. **Definition → BOM → TESR Shop (CONVERT)** — ทุกหุ่นที่ออกแบบใน Builder คือใบเสนอราคา hardware อัตโนมัติพร้อมลิงก์สินค้า; lead ที่ qualified ที่สุด เพราะลูกค้าออกแบบเองแล้ว
2. **AI Robot Engineer = AI Engineering Consultant** (strategic idea #2) — requirement ภาษาไทย → design + BOM + risk → นัด engineer TESR ปิดดีล; ลดเวลา pre-sales ต่อดีลโดยไม่เพิ่มคน
3. **TESR Academy** — หลักสูตร "Build Your AMR with TESR Robot Builder": Learning by Doing ที่ผู้เรียนได้ workspace ที่ build และ simulate ผ่านจริง; Definition ของ IRON-X Gen II เป็น lab กลาง
4. **Recurring revenue** — Pro tier (hosted AI, deploy, fleet dashboard) + support contract ต่อหุ่นที่ deploy → ยก net margin
5. **Ecosystem / standard** — `*.robot.yaml` เป็นไฟล์กลางของหุ่น TESR ทุกตัว (kit ใน Shop ส่งพร้อม definition) → switching cost เชิงคุณค่า และขยายไป SI / ASEAN ผ่าน registry แบบเปิด

---

## 4. Recommendations (ข้อเสนอแนะ) — System Architecture

### 4.1 หลักการ 6 ข้อ (ไม่ประนีประนอม)

1. **Definition-first** — UI และ AI แก้ได้เฉพาะ Robot Definition; ทุกไฟล์ generate จากมัน
2. **Data over code** — hardware, driver, drive profile, nav profile เป็นข้อมูลใน registry; core ไม่รู้จัก "Slamtec P3" โดยตรง
3. **Deterministic generation** — definition เดียวกัน + registry/template version เดียวกัน = ไฟล์เดียวกัน byte-for-byte (snapshot test ได้)
4. **Validate before generate, simulate before deploy** — ERROR block ทั้งสองจุด
5. **Regenerate-safe** — overrides และ custom code อยู่นอกโซน generated
6. **AI = advisor ที่ใช้เครื่องมือ** (calc, registry, validator) แล้วเสนอ patch; มนุษย์กดยืนยัน

### 4.2 Component diagram

```
┌────────────────────────────── apps/web (React + TypeScript) ──────────────────────────────┐
│ Wizard 10 steps │ 2D Top/Side + 3D Preview (r3f) │ TF / ROS-graph editor (react-flow) │ Diff & Confirm │
└─────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                          │ REST + WebSocket (job progress)
┌─────────────────────────────── apps/api (FastAPI) ────────────────────────────────────────┐
│ Project Service    — Definition CRUD · Git versioning · robot.lock.yaml                     │
│ Registry Service   — catalog / hardware / drivers / profiles (SQLite index)                 │
│ Calc Service       — drivetrain · power/battery · CoG/stability · nav sizing                │
│ Validation Engine  — rule registry → PASS / WARN / ERROR                                    │
│ Generator Engine   — plugin pipeline (Jinja2) → workspace FileSet                          │
│ AI Assistant       — LLM adapter (OpenAI) + tools → JSON Patch proposals                    │
│ Job Runner         — build (colcon in ros:jazzy) · sim (gz harmonic) · deploy (ssh)         │
└───────────────┬───────────────────────────────────────┬────────────────────────────────────┘
        packages/* (pure Python, unit-tested)      tesr-robot-registry (YAML, public repo)
                │
   ┌────────────┴─────────────┐                 ┌──────────────────────────────────────┐
   │ generated workspace (git)│                 │ Robot: docker + tesr_robot_agent      │
   │ + overrides/ + custom/   │────── ssh ─────▶│ rosbridge :9090 · MQTT ws :9001       │
   └──────────────────────────┘                 │ diagnostics → Runtime Dashboard       │
                                                └──────────────────────────────────────┘
```

### 4.3 Data flow

```
NL requirement ─▶ AI (tools: calc · registry · validate) ─▶ JSON Patch ─▶ user confirm ─┐
                                                                                         │
Wizard forms ────────────────────────────────────────────────────────────────────────────┤
                                                                                         ▼
                                                              robot.yaml (Definition, git-versioned)
                                                                                         │
                                                        Validation Engine ── ERROR ──▶ stop
                                                                                         │
                          Generator pipeline: description → control → sensors → localization
                                              → navigation → simulation → bringup → deploy → integrations
                                                                                         │
                     ┌───────────────┬────────────────┬───────────────┬──────────────────┼───────────┐
                 ROS 2 ws       Gazebo + RViz      Docker        Node-RED / Studio Pro   BOM / Spec
                     │
          colcon build (CI container) → headless sim smoke test → deploy (ssh) → health check
```

### 4.4 Robot Definition v1 — skeleton

```yaml
schema_version: 1
meta: {name: warehouse_amr_300, created_by: anon, tags: [amr, factory]}

target:
  ros_distro: jazzy            # MVP: jazzy | later: humble
  os: ubuntu-24.04
  compute: rpi5                # hardware id in registry
  arch: arm64
  deployment: docker           # docker | native

requirements:
  application: amr
  environment: {indoor: true, floor: concrete, max_slope_deg: 5, min_aisle_m: 1.2}
  payload: {max_kg: 300, dims_m: [0.8, 0.6, 0.5], cog_offset_m: [0.0, 0.0, 0.6]}
  motion: {v_max: 1.0, a_max: 0.5, w_max: 1.0}
  runtime_h: 8

mechanical:
  dims_m: {length: 1.0, width: 0.7, height: 0.45, ground_clearance: 0.05}
  mass_kg: {self: auto, total: auto}

drive:
  type: differential           # MVP: differential | mecanum ; later: omni | ackermann | tracked
  wheels: {diameter_m: 0.16, width_m: 0.05, separation_m: 0.60, wheelbase_m: 0.75}
  casters: [{xyz: [0.40, 0.0, 0.0]}, {xyz: [-0.40, 0.0, 0.0]}]
  motor: {hw: tesr_bldc_400w, count: 2, gear_ratio: 20, driver: tesr_md400}

hardware:                      # instances — specs resolve from registry via `hw`
  - {id: lidar_front, hw: slamtec_p3,      frame: lidar_front, parent: base_link, xyz: [0.35, 0.0, 0.40], rpy: [0, 0, 0]}
  - {id: imu,         hw: tesr_imu,        frame: imu_link,    parent: base_link, xyz: [0.00, 0.0, 0.20], rpy: [0, 0, 0]}
  - {id: cam_front,   hw: realsense_d455,  frame: camera_link, parent: base_link, xyz: [0.45, 0.0, 0.30], rpy: [0, 0, 0]}
  - {id: encoders,    hw: tesr_md400_encoder}
  - {id: estop,       hw: generic_estop, io: DI1}

power:
  battery: {hw: lifepo4_48v_40ah}
  bus_v: 48
  rails: [{v: 5, hw: dcdc_48_5}, {v: 12, hw: dcdc_48_12}]

io: {DI: {1: estop, 2: bumper, 3: dock_sensor}, DO: {1: tower_light, 2: buzzer}}
comms: [dds, mqtt, rest]

ros:
  control:      {stack: ros2_control, controller: auto}          # auto → diff_drive_controller
  localization: {slam: slam_toolbox, amcl: true, ekf: auto}       # auto → EKF when encoder + imu present
  navigation:   {profile: indoor_amr, planner: auto, controller: auto, costmap: auto,
                 safety_margin_m: 0.05, features: [manual, slam, nav, waypoints]}   # + docking, fleet (later)
  perception:   {depth_to_costmap: true}

sim: {engine: gz_harmonic, world: warehouse_small, renderer: ogre1}
integrations: {node_red: true, studio_pro: true}
overrides_dir: overrides/      # user-owned, merged at generate time
```

กติกา: ทุกค่า `auto` ถูก resolve โดย calc/profile แล้วบันทึกค่าที่ resolve จริงใน `robot.lock.yaml` พร้อม version ของ registry / template / generator → reproducible และ diff ได้ทุกครั้ง

> **หมายเหตุ Phase 0 (13 ก.ย. 2026):** โค้ดจริงใช้ `mass_kg: {robot: auto, total: auto}` (คำว่า `self` ชนกับ Pydantic) และ `rpy` เป็น radian โดย schema จะ reject ค่าที่เกิน 2π ว่า "looks like degrees" — ดู `examples/*.robot.yaml` เป็นตัวอย่างที่ผ่าน validation จริง

### 4.5 Registries — แยก 3 ชุด เชื่อมด้วย id

```
tesr-robot-registry/                 (public data repo, CI validate schema ทุก PR)
├── catalog/products/*.yaml          # SKU · ราคา · URL tesrshop · รูป · stock → hardware_ref
├── hardware/<category>/*.yaml       # mass · dims · electrical (V, typ/peak W) · interfaces (usb3/eth/can/uart)
│                                    # sensor specs (range, fov, rate, min_range) · compute (cpu, ram, gpu, ports)
├── drivers/<hw_id>/<distro>/        # manifest.yaml (apt/pip deps · ros package · topics · frames · params)
│   ├── launch.py.j2 · params.yaml.j2 · rules.py (optional) · blocks.json (Studio Pro)
└── profiles/
    ├── drive/{differential,mecanum}.yaml     # controller · joint naming · kinematics · limits
    └── nav/{indoor_amr,service_robot}.yaml   # planner/controller/behavior defaults + sizing formulas
```

- Catalog ไม่รู้จัก ROS; drivers ไม่รู้จักราคา — catalog sync จาก TESR Shop (API/CSV) แยกจาก engineering data
- Registry เป็น public repo → partner / community เพิ่ม hardware ได้โดย TESR review (สร้าง trust และ authority)

### 4.6 Generator pipeline → workspace ที่ได้

| Generator (plugin) | อ่านจาก definition | ผลิต |
|---|---|---|
| `description` | mechanical · drive · hardware (pose) | `tesr_robot_description/urdf/{robot.urdf.xacro, chassis, wheels, sensors, gazebo}.xacro` — inertial คำนวณจาก mass/dims, mesh optional |
| `control` | drive · motor | `ros2_control.yaml` — `joint_state_broadcaster` + `diff_drive_controller` / `mecanum_drive_controller` (ros2_controllers, Jazzy), hardware interface ตาม driver, velocity/accel limits จาก motion |
| `sensors` | hardware[] | launch + params ต่อ device จาก driver template, frame/topic naming, multi-instance suffix (`_front`, `_rear`) |
| `localization` | ros.localization · hardware | `ekf.yaml` (robot_localization) · `slam_toolbox.yaml` · `amcl.yaml` |
| `navigation` | mechanical · motion · sensors · ros.navigation | `nav2_params.yaml` — footprint + margin, inflation, costmap size, obstacle/raytrace range, Smac/NavFn + MPPI ตาม kinematics, `velocity_smoother`, `collision_monitor` |
| `simulation` | ทั้งหมด | `tesr_robot_simulation` — gz world, `ros_gz_bridge` yaml, `gz_ros2_control`, spawn launch, `rviz/*.rviz` |
| `bringup` | ทั้งหมด | `tesr_robot_bringup/launch/{robot,sim,slam,nav}.launch.py` + `capabilities.json` |
| `deploy` | target | `Dockerfile` · `docker-compose.yaml` · `.env` · systemd unit · agent config |
| `integrations` | integrations · io · comms | `flows.json` (Node-RED) · `studio_pro/blocks.json` · `io_config.yaml` · `bom.csv` · `spec.md` |

Workspace layout ตามสเปก (`tesr_robot_ws/src/tesr_robot_{description,bringup,hardware,control,sensors,navigation,simulation,interfaces,iot}`) เพิ่ม `custom/` (user packages) และ `overrides/`

### 4.7 Regeneration-safe

- ไฟล์ generated ทุกไฟล์มี header `# GENERATED by TESR Robot Builder <ver> from robot.yaml@<git sha> — do not edit; use overrides/`
- `overrides/<config>.yaml` deep-merge ทับค่า generated **ตอน generate** → ไฟล์สุดท้ายสมบูรณ์เสมอ ไม่พึ่ง launch-time merge
- `.tesr/manifest.json` เก็บ hash ของไฟล์ generated; ถ้า user แก้ไฟล์ generated ตรง → เตือนก่อนทับ และเสนอย้ายเป็น override ให้อัตโนมัติ
- `custom/` ไม่ถูกแตะ; bringup launch include `custom/*.launch.py` อัตโนมัติ

### 4.8 Validation Engine — rule registry

Rule = `{id, category, severity, check(defn, registry, calc) → findings[]}`; driver plugin เพิ่ม rule ของตัวเองได้ (เช่น RealSense ต้องการ USB 3)

| Category | ตัวอย่าง rule | Severity |
|---|---|---|
| Mechanical | wheel/caster อยู่ใน chassis; ground clearance > 0; tipping acceleration > a_max และ v_max²/R_min | ERROR / WARN |
| Drivetrain | motor torque / RPM / power ≥ ค่าคำนวณ × safety factor 1.3 | ERROR |
| Power | Σ peak W ≤ battery และ DC-DC rating; rail voltage ตรงกับ device; runtime ≥ requirement | ERROR / WARN |
| Compute / Interface | USB bandwidth, port count (Ethernet สำหรับ Livox), serial conflict, RAM/CPU ต่อ stack | WARN / ERROR |
| TF | frame ไม่ซ้ำ; ทุก frame ต่อถึง `base_link`; camera มี optical frame; lidar rear yaw = 180° | ERROR |
| ROS graph | driver มีใน registry สำหรับ distro; topic ที่ nav ต้องใช้ (`/scan`, `/odom`, `/imu/data`) มี publisher | ERROR |
| Navigation | footprint ⊂ local costmap; inflation ≥ circumscribed radius; obstacle_range ≤ lidar range; min aisle ≥ width + 2·margin | ERROR / WARN |
| Safety | E-stop mapped; `collision_monitor` เปิดเมื่อ payload > 50 kg; v_max ตาม environment (hospital ≤ 0.8 m/s) | ERROR / WARN |

### 4.9 Engineering calculators — เป็น code ไม่ใช่ AI

- **Drivetrain:** F = m·g·(sin θ + C_rr·cos θ) + m·a → τ_wheel = F·r / n_drive → τ_motor = τ_wheel / (i·η) → RPM_motor = v_max·60·i / (π·d) → P = F·v_max → คัด motor จาก registry ที่ผ่าน × 1.3
- **Power / Battery:** Σ typical, Σ peak, Ah = typical·h / (V·DoD 0.8), runtime = Ah·V·DoD / typical
- **Stability:** h_cog (payload-weighted) → a_tip = g·(track/2) / h_cog → เทียบกับ v_max²/R_min และ a_max
- **Nav sizing:** footprint = L×W + margin; inflation = √((L/2)² + (W/2)²) + 0.1; local costmap = clamp(2·(v_max²/(2·a_max) + L), 3–6 m); obstacle_range = min(0.9·lidar_range, local/2); raytrace = obstacle_range + 0.5; MPPI vx_max / wz_max จาก motion

สูตรทั้งหมดอยู่ใน `packages/calc` มี unit test และคืนค่า "why" ให้ AI นำไปอธิบายกับผู้ใช้

### 4.10 AI Robot Engineer — contract

- LLM adapter (OpenAI function calling ตาม vendor ปัจจุบัน; interface กลางเปลี่ยน provider ได้โดยไม่แตะ core)
- Tools ที่ AI เรียกได้: `search_hardware(category, constraints)` · `calc_drivetrain(...)` · `calc_power(...)` · `size_nav(...)` · `validate(defn)` · `propose_patch(json_patch, rationale)`
- Output เดียวที่มีผลต่อระบบ = **JSON Patch (RFC 6902)** ต่อ definition → schema validate → rules → แสดง diff + rationale → user confirm ("Create this robot?")
- AI ห้ามเขียนไฟล์ ROS และห้ามอ้าง hardware นอก registry (tool-only grounding); ทุก patch/rationale ถูก log เพื่อ audit และเป็นข้อมูลปรับ default ของ recommendation
- UX: กล่อง NL requirement → "AI Draft" → wizard ถูก prefill พร้อม badge "AI-suggested" ทุกช่อง → ผู้ใช้แก้ / ยืนยัน

### 4.11 Simulation · Deploy · Runtime

- **Sim:** container `tesr-rb-sim` (ros:jazzy + gz-harmonic, renderer Ogre 1 สำหรับ CPU-only ตามบทเรียน IRON-X) — headless ใน CI (nav goal reached = pass); ผู้ใช้ดูภาพผ่าน RViz บน PC; web viewer (Foxglove / WebRTC) เฟสหลัง
- **Deploy:** SSH key only (asyncssh) → rsync workspace → remote `docker compose build/up` หรือ native `rosdep` + `colcon` → health check ผ่าน `tesr_robot_agent` (diagnostics → MQTT / rosbridge ชุดเดียวกับ Studio Pro) → rollback ไป bundle ก่อนหน้าได้
- **Runtime dashboard:** online/battery/CPU/RAM/sensor/motor driver/node health + quick links (RViz, Node-RED, Studio Pro, logs, terminal, restart services)

### 4.12 Tech stack (ตัดสินใจแล้ว)

| ชั้น | เลือก | เหตุผล / ทางเลือกที่ตัด |
|---|---|---|
| Backend | Python 3.12 · FastAPI · Pydantic v2 · Jinja2 · GitPython · asyncssh | ภาษาเดียวกับ ROS tooling, เรียก xacro/rosdep ตรง; ตัด Node backend |
| Frontend | React + TypeScript + Vite · Tailwind · Zustand · react-three-fiber · react-flow · Monaco (YAML) · i18n TH/EN | 3D preview จาก primitives (ไม่ต้อง CAD); theme TESR ดำ/แดง/ทอง, Chakra Petch + IBM Plex Sans Thai |
| Storage | SQLite (local) → Postgres (hosted) · Git repo ต่อ project · object store สำหรับ bundles | Definition ต้อง diff / rollback ได้ |
| Jobs | FastAPI BackgroundTasks (MVP) → Redis + RQ (hosted) | build / sim / deploy เป็น long-running |
| Packaging | Monorepo · `docker compose up` (api + web + sim) · CLI `tesr-rb` | local-first บน PC / WSL2 ก่อน SaaS |
| CI | GitHub Actions: unit (schema/calc/rules) · snapshot generation · `colcon build` ใน `ros:jazzy` · headless sim smoke | quality gate อัตโนมัติแทน man-hour |
| LLM | OpenAI ผ่าน adapter | ตาม vendor ปัจจุบัน |

### 4.13 Repo layout

```
tesr-robot-builder/                       (monorepo)
├── apps/web · apps/api
├── packages/schema · calc · rules · generators · registry · deploy · cli
├── examples/{ironx_gen2, mecanum_demo, warehouse_amr_300}.robot.yaml
└── tests/{unit, snapshot, integration}

tesr-robot-registry/                      (public data repo — ดู 4.5)
```

> **หมายเหตุ Phase 0:** repo จริงเริ่มด้วย distribution เดียว `src/tesr_robot_builder/{schema,registry,calc,rules,generators,cli}` และ `registry/` ฝังใน repo — แยกเป็น `packages/*` และ repo registry สาธารณะเมื่อผ่าน Phase 1 gate

### สิ่งที่ไม่ควรทำ

- ไม่ implement 29 modules พร้อมกัน — ยึด MVP scope ตามสเปก
- ไม่ให้ LLM แตะไฟล์ ROS; ไม่มี "free-text hardware"
- ไม่สร้าง CAD editor — 3D preview เป็น primitives + mesh optional
- ไม่ทำ hosted SaaS / billing ก่อน Phase 1 gate ผ่าน
- ไม่ทำ Humble ใน MVP — Beary-X / Kuro-X เข้าเป็น profile ในเฟสหลัง

---

## 5. Implementation (แผนลงมือทำ) — Roadmap

**Owner:** Anon = architect / product / AI layer · Dev A = backend + ROS generators · Dev B (หรือ Anon + AI coding agent) = frontend · Academy = registry data + docs
**ต้นทุน:** เงินสดต่ำ (LLM API + server) — ต้นทุนหลักคือเวลา ~1.5–2 FTE ตลอด 22 สัปดาห์

| Phase | ช่วงเวลา | ส่งมอบ | Exit gate |
|---|---|---|---|
| **0 · Foundation** | สัปดาห์ 1–2 (ก.ย. 2026) | monorepo + registry repo · schema v1 (Pydantic + JSON Schema) · lockfile · CLI `tesr-rb validate / generate` · examples 3 ตัว · CI skeleton | `tesr-rb generate examples/ironx_gen2.robot.yaml` ออก workspace ที่ `colcon build` ผ่านใน CI (description + bringup) |
| **1 · Core generators** | สัปดาห์ 3–8 (ต.ค. – กลาง พ.ย.) | generators: description · control (diff + mecanum) · sensors (Slamtec 2D LiDAR, IMU, encoder, RealSense) · EKF · slam_toolbox · AMCL · Nav2 auto-sizing · gz harmonic sim · RViz · docker; rules ชุดแรก (TF / ROS graph / nav / power); calc ครบ | หุ่น 2 แบบ (diff, mecanum) generate → build ผ่าน → sim: SLAM แล้ว nav ไป goal สำเร็จ headless ใน CI; regenerate ไม่ทับ overrides |
| **2 · Web app** | สัปดาห์ 9–14 (กลาง พ.ย. – ธ.ค.) | wizard 10 steps · 2D/3D preview · placement + TF editor · live metrics · compatibility panel · diff/confirm · download bundle · `docker compose up` | ผู้ใช้ใหม่สร้างหุ่นจาก requirement ถึง workspace ที่ build ผ่านภายใน 30 นาที โดยไม่แตะ YAML; demo ให้ทีมและลูกค้า 2 ราย |
| **3 · AI Robot Engineer** | สัปดาห์ 15–18 (ม.ค. 2027) | LLM adapter + tools · NL → patch → confirm · rationale panel · audit log | prompt "AMR 300 kg / 1 m/s / Pi 5 / Jazzy" ได้ definition ที่ validate ผ่านและ build + sim ผ่าน ≥ 9/10 ครั้ง |
| **4 · Deploy & Runtime** | สัปดาห์ 19–22 (ก.พ. 2027) | deploy service (ssh / docker) · `tesr_robot_agent` · health check · runtime dashboard | one-click deploy ลง IRON-X Gen II จริงแล้ว nav ได้; dashboard แสดง health; rollback ได้ |
| **5 · Ecosystem** | มี.ค. 2027 → | Shop catalog sync + BOM / quotation · Node-RED flows · Studio Pro blocks · multi-LiDAR merge · depth → voxel layer · docking (opennav_docking) · Humble profile · Jetson · AI vision · Academy course | KPI ข้อ 6 |

**Milestones ตลาด:** Demo ภายใน (สิ้น Phase 1) → Beta กับ Academy cohort + SI 1–2 ราย (Phase 2–3) → Launch พร้อมหลักสูตร (Phase 5)

**Definition of Done ของ MVP (ตามสเปก):** Differential + Mecanum · ROS 2 Jazzy · Ubuntu 24.04 · Pi 5 / x86 · 2D LiDAR + IMU + encoder + depth camera · ros2_control + robot_localization + slam_toolbox + AMCL + Nav2 · Gazebo Harmonic · Docker · Node-RED config — generate แล้ว build ผ่านและ simulation วิ่งได้จริง

---

## 6. KPI (ตัวชี้วัด)

**Engineering**
- build pass rate ของ generated workspace = 100% สำหรับ combo ที่รองรับ (CI เขียวทุก PR)
- requirement → simulation วิ่ง < 30 นาที (ผู้ใช้ใหม่)
- hardware ใน registry ≥ 30 รายการ ภายใน Phase 5; driver ต่อ distro ครบทุกตัว
- regenerate ทำ override หาย = 0 incident; validation จับ config อันตรายก่อน deploy = 100% ของ test case

**ธุรกิจ (ซื้อไหม / ทักมาไหม / กลับมาซ้ำไหม / บอกต่อไหม)**
- **ซื้อ:** BOM → order ใน TESR Shop conversion ≥ 5%; Pro / support subscription ≥ 10 หุ่นในปีแรก
- **ทัก:** lead จาก AI Robot Engineer ≥ 20 ราย/เดือน หลัง launch
- **กลับมา:** โครงการต่อผู้ใช้ ≥ 3; MAU ของ Builder เติบโตต่อเนื่อง
- **บอกต่อ:** registry PR จากภายนอก; course cohort เต็ม; case study 3 เรื่องภายใน 6 เดือนหลัง launch

---

## 7. Risks (ความเสี่ยง)

| ความเสี่ยง | ผลกระทบ | การจัดการ |
|---|---|---|
| Scope creep (สเปก 29 modules) | ไม่มีอะไรเสร็จ | Phase gate + plugin boundary; feature ใหม่ = plugin / profile ไม่แตะ core |
| Config ผิดบนหุ่นหนัก | อันตราย / แบรนด์เสีย | safety rules (ERROR block), `collision_monitor` default, sim-first, conservative defaults, commissioning checklist + disclaimer |
| ROS / Nav2 version drift | template พัง | pin distro, snapshot + colcon CI ทุก PR, registry key ตาม distro |
| Registry ดูแลไม่ไหว | ข้อมูลเก่า / ผิด | schema CI, ตัวอย่างต่อ category, Academy ป้อนข้อมูลจากคอร์ส, partner contribute |
| AI hallucinate | แนะนำของที่ไม่มี / ไม่เข้ากัน | tool-only grounding, patch ต้องผ่าน validator, human confirm |
| Bus factor (dev คนเดียว) | หยุดชะงัก | ADR + tests + docs ต่อ feature; AI coding agent ทำตาม convention ใน repo |
| PDPA / ความลับลูกค้า | definition ลูกค้ารั่ว | local-first, encryption at rest เมื่อ hosted, ไม่เก็บ password (SSH key), แยก tenant |
| Open-source boundary | คู่แข่งนำไปใช้ | เปิด registry + generated workspace (Apache-2.0) สร้าง trust และ community; hosted AI + deploy + Shop integration เป็น Pro |

---

## 8. Long-term Impact (ผลระยะยาว)

- `robot.yaml` กลายเป็นมาตรฐานไฟล์หุ่นยนต์ของ TESR: ทุก kit ใน Shop, ทุก lab ใน Academy, ทุกโครงการ R&D และทุกใบเสนอราคา อ้างอิง definition เดียว → BOM / TOR / Spec / Simulation / Deployment ออกจากแหล่งเดียว ลดเวลาต่อดีลและต่อคอร์ส
- **Thailand → ASEAN:** registry สาธารณะ + SI partner ใช้ Builder เป็นเครื่องมือมาตรฐาน; TESR ขายความไว้ใจ (validated templates, deploy จริง) ไม่ใช่ราคา
- **มูลค่าบริษัท:** recurring revenue (Pro / support), product IP (schema + generators + registry) และ data asset (definitions + audit log ของ recommendation) — สินทรัพย์ที่ scale โดยไม่เพิ่มคน ตรงกับ "ONE TEAM. MAX IMPACT."

---

## ขอคำยืนยัน 6 ข้อก่อนเริ่ม Phase 0

1. ชื่อ **TESR Robot Builder** (เลี่ยง "Studio" ที่ซ้ำกับ Studio Pro)
2. Local-first ก่อน hosted — ตามที่เสนอ
3. Open-source boundary: registry + generated workspace เปิด; core app เปิดหรือปิด?
4. LLM: OpenAI ผ่าน adapter
5. TESR Shop platform / API สำหรับ sync catalog (Phase 5)
6. Reference robots: IRON-X Gen II (differential) + mecanum ตัวไหน?
