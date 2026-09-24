/* TESR Robot Builder — Garage core (docs/garage-core.js)
 *
 * Pure logic behind the 3D Garage (docs/garage.html): blueprints, auto-equip, game stats, and the exporters
 *   - toYaml()      Robot Definition v1 for `tesr-rb` / step 3 (validated by the same 16 engine rules)
 *   - toUrdf()      URDF with primitives or uploaded STL, inertials, and Gazebo Harmonic plugins/sensors
 *   - rosPackage()  complete ROS 2 Jazzy description package: RViz (display.launch.py) + Gazebo (gazebo.launch.py)
 * No three.js here — the same file runs in Node for tests (tests/test_garage.py) and in the browser (window.TESR_GARAGE).
 * Sizing formulas come from docs/app.js (window.TESR), which mirrors the Python engine.
 */
(function (root) {
  'use strict';
  let _T = null;
  const T = () => _T || (_T = (typeof module !== 'undefined' && module.exports) ? require('./app.js') : root.TESR);
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const voltMatch = (v, busV) => v == null || Math.abs(v - busV) / busV <= 0.12;
  const fmt = (x, d = 1) => (x == null || !isFinite(x) ? '—' : String(Number(x.toFixed(d))));
  const uid = () => Math.random().toString(36).slice(2, 9);

  const CHASSIS_COLORS = { gunmetal: [0.14, 0.15, 0.18], crimson: [0.45, 0.04, 0.04], gold: [0.55, 0.43, 0.17], white: [0.85, 0.84, 0.81], carbon: [0.07, 0.07, 0.09] };

  // Blueprints = ready-made starting robots (like picking a base car in a racing game). Everything stays editable.
  const BLUEPRINTS = {
    amr_300: {
      label: 'AMR โรงงาน 300 kg', icon: '🏭', desc: 'ลากรถเข็น/พาเลทในโรงงาน · 2 LiDAR เฉียงแบบ KURO-X / Beary-X', name: 'warehouse_amr_300', prefix: 'tesr_robot',
      mission: { application: 'amr', envType: 'factory', floor: 'concrete', payload: 300, vMax: 1.0, aMax: 0.5, wMax: 1.0, runtimeH: 8, slopeDeg: 5, minAisle: 1.2, cogOffsetZ: 0.25 },
      chassis: { shape: 'box', length: 1.0, width: 0.7, height: 0.35, clearance: 0.05, color: 'gunmetal' },
      drive: { type: 'differential', wheelDiameter: 0.16, wheelWidth: 0.05, track: 0.6, wheelbase: 0.4, gearRatio: 20, casterLayout: 'corners4', driverCount: 1 },
      compute: 'x86_pc', sensors: { lidar: ['slamtec_p3', 'diag2'], depth_camera: ['realsense_d455', 'front1'], imu: 'tesr_imu' }, estop: true,
    },
    service_60: {
      label: 'หุ่นบริการ 60 kg', icon: '🏥', desc: 'ส่งของในโรงพยาบาล/สำนักงาน · ตัวถังกลม เลี้ยวในที่แคบ', name: 'service_robot_60', prefix: 'tesr_service',
      mission: { application: 'service', envType: 'hospital', floor: 'tile', payload: 60, vMax: 0.8, aMax: 0.5, wMax: 1.2, runtimeH: 10, slopeDeg: 3, minAisle: 1.0, cogOffsetZ: 0.3 },
      chassis: { shape: 'round', length: 0.52, width: 0.52, height: 0.45, clearance: 0.04, color: 'white' },
      drive: { type: 'differential', wheelDiameter: 0.15, wheelWidth: 0.04, track: 0.42, wheelbase: 0.3, gearRatio: 15, casterLayout: 'front_rear', driverCount: 1 },
      compute: 'rpi5', sensors: { lidar: ['rplidar_s2', 'front1'], depth_camera: ['realsense_d435i', 'front1'], imu: 'tesr_imu' }, estop: true,
    },
    edu_small: {
      label: 'หุ่นเรียน IRON-X class', icon: '🎓', desc: 'หุ่นเล็กสำหรับ TESR Academy · 12 V · ราคาประหยัด', name: 'edu_robot', prefix: 'edu_robot',
      mission: { application: 'research', envType: 'laboratory', floor: 'tile', payload: 2, vMax: 0.5, aMax: 0.5, wMax: 1.5, runtimeH: 2, slopeDeg: 3, minAisle: 0, cogOffsetZ: 0.05 },
      chassis: { shape: 'box', length: 0.26, width: 0.24, height: 0.1, clearance: 0.02, color: 'crimson' },
      drive: { type: 'differential', wheelDiameter: 0.1, wheelWidth: 0.03, track: 0.2, wheelbase: 0.2, gearRatio: 10, casterLayout: 'rear1', driverCount: 1 },
      compute: 'rpi5', sensors: { lidar: ['ld19', 'front1'], imu: 'tesr_imu' }, estop: false,
    },
    mecanum_30: {
      label: 'Mecanum 30 kg', icon: '🧭', desc: 'เคลื่อนที่ทุกทิศ สไลด์ข้างได้ · งานวิจัย/แลป', name: 'mecanum_demo', prefix: 'mecanum_demo',
      mission: { application: 'research', envType: 'laboratory', floor: 'epoxy', payload: 30, vMax: 1.0, aMax: 0.8, wMax: 1.5, runtimeH: 4, slopeDeg: 2, minAisle: 1.0, cogOffsetZ: 0.15 },
      chassis: { shape: 'box', length: 0.6, width: 0.5, height: 0.25, clearance: 0.05, color: 'carbon' },
      drive: { type: 'mecanum', wheelDiameter: 0.152, wheelWidth: 0.05, track: 0.44, wheelbase: 0.4, gearRatio: 15, casterLayout: 'front_rear', driverCount: 2 },
      compute: 'x86_pc', sensors: { lidar: ['rplidar_s2', 'fr2'], depth_camera: ['realsense_d435i', 'front1'], imu: 'tesr_imu' }, estop: true,
    },
  };

  // ------------------------------------------------------------------ geometry helpers (all in base_link: x forward, z up, origin at axle height)
  function chassisZ(state) {
    const r = state.drive.wheelDiameter / 2;
    return { r, bottom: state.chassis.clearance - r, top: state.chassis.clearance + state.chassis.height - r };
  }
  // point on the chassis outline: fx/fy in {-1,0,1}; inset > 0 moves inward, < 0 outward
  function rimPoint(state, fx, fy, inset) {
    const c = state.chassis;
    if (c.shape === 'round') {
      const R = c.width / 2 - inset, a = Math.atan2(fy, fx);
      return [R * Math.cos(a), R * Math.sin(a)];
    }
    return [fx * (c.length / 2 - inset), fy * (c.width / 2 - inset)];
  }
  function wheelSpots(state, registry) {
    const dr = state.drive, prof = registry && registry.drive_profiles && registry.drive_profiles[dr.type];
    const joints = (prof && prof.joints) || (dr.type === 'mecanum'
      ? { front_left: 'front_left_wheel_joint', front_right: 'front_right_wheel_joint', rear_left: 'rear_left_wheel_joint', rear_right: 'rear_right_wheel_joint' }
      : { left: 'left_wheel_joint', right: 'right_wheel_joint' });
    const hs = dr.track / 2, hb = (dr.wheelbase || 0.4) / 2;
    const at = { left: [0, hs], right: [0, -hs], front_left: [hb, hs], front_right: [hb, -hs], rear_left: [-hb, hs], rear_right: [-hb, -hs] };
    return Object.entries(joints).map(([k, joint]) => ({ key: k, joint, link: joint.replace(/_joint$/, '_link'), x: r4(at[k][0]), y: r4(at[k][1]), left: at[k][1] > 0 }));
  }
  function casterSpots(state) {
    if (state.drive.type !== 'differential') return [];
    const lay = T().CASTER_LAYOUTS[state.drive.casterLayout] || T().CASTER_LAYOUTS.front_rear;
    const inset = state.chassis.length > 0.4 ? 0.1 : 0.06;
    return lay.map(([fx, fy]) => { const [x, y] = rimPoint(state, fx, fy, inset); return { x: r4(x), y: r4(y) }; });
  }
  function casterRadius(state) {
    const r = state.drive.wheelDiameter / 2;
    return r4(clamp(Math.min(r * 0.5, state.chassis.clearance / 2 + 0.01), 0.01, 0.05));
  }

  // Place sensors of one kind using a named layout (LIDAR_LAYOUTS / CAMERA_LAYOUTS from app.js).
  function placeLayout(cat, hw, layout, state, registry) {
    const rec = T().byId(registry)[hw];
    if (!rec) return [];
    const { bottom, top } = chassisZ(state), dm = rec.dims_m || [0.05, 0.05, 0.05];
    if (cat === 'lidar') {
      const spots = (T().LIDAR_LAYOUTS[layout] || T().LIDAR_LAYOUTS.front1).spots, onTop = layout === 'front1';
      return spots.map(([, fx, fy, yaw]) => {
        const [x, y] = rimPoint(state, fx, fy, onTop ? Math.min(0.1, state.chassis.length / 4) : 0.015);
        // on the roof → full 360°; in a corner cut-out below the roof → ~270° (the chassis blocks the rest)
        const z = onTop ? top + dm[2] / 2 : Math.max(bottom + dm[2] / 2 + 0.02, Math.min(bottom + 0.12, top - dm[2] / 2));
        return { uid: uid(), hw, category: 'lidar', pos: [r4(x), r4(y), r4(z)], yaw };
      });
    }
    if (cat === 'depth_camera' || cat === 'rgb_camera') {
      const spots = T().CAMERA_LAYOUTS[layout] || T().CAMERA_LAYOUTS.front1;
      return spots.map(([, fx, fy, yaw]) => {
        const [x, y] = rimPoint(state, fx, fy, -dm[1] / 2);
        const z = Math.min(bottom + state.chassis.height * 0.7, top - dm[2] / 2);
        return { uid: uid(), hw, category: cat, pos: [r4(x), r4(y), r4(z)], yaw };
      });
    }
    return [{ uid: uid(), hw, category: rec.category, pos: [0, 0, r4(bottom + 0.02 + dm[2] / 2)], yaw: 0 }];
  }

  // Stable ids / frames / topics used by YAML, URDF and the bridge
  function assignIds(state) {
    const count = {}, seen = {};
    const prefixOf = (s) => (s.category === 'lidar' ? 'lidar' : s.category === 'imu' ? 'imu' : /camera/.test(s.category) ? 'cam' : s.category);
    state.sensors.forEach((s) => { const p = prefixOf(s); count[p] = (count[p] || 0) + 1; });
    return state.sensors.map((s) => {
      const p = prefixOf(s); seen[p] = (seen[p] || 0) + 1;
      const id = p === 'imu' && count[p] === 1 ? 'imu' : `${p}_${seen[p]}`;
      const topic = p === 'lidar' ? (count[p] === 1 ? 'scan' : `scan_${seen[p]}`) : id;
      return { ...s, id, frame: `${id}_link`, topic };
    });
  }

  // ------------------------------------------------------------------ blueprints / auto-equip
  function applyBlueprint(key, registry) {
    const b = BLUEPRINTS[key] || BLUEPRINTS.amr_300;
    const state = {
      version: 1, blueprint: key, name: b.name, prefix: b.prefix, description: b.label,
      mission: { ...b.mission }, chassis: { ...b.chassis, shell: null },
      drive: { ...b.drive, motor: null, driver: null }, power: { busV: 24, battery: null },
      compute: b.compute, sensors: [], parts: [], estop: b.estop, user: {},
    };
    if (state.chassis.shape === 'round') state.chassis.length = state.chassis.width;
    const sn = b.sensors;
    if (sn.lidar) state.sensors.push(...placeLayout('lidar', sn.lidar[0], sn.lidar[1], state, registry));
    if (sn.depth_camera) state.sensors.push(...placeLayout('depth_camera', sn.depth_camera[0], sn.depth_camera[1], state, registry));
    if (sn.imu) state.sensors.push(...placeLayout('imu', sn.imu, null, state, registry));
    return autoResolve(state, registry);
  }

  // Parts the player has not picked by hand follow the sizing (like auto-equip in a game)
  function pickParts(state, registry) {
    const t = T(), busV = state.power.busV, u = state.user || (state.user = {});
    const dv = derive(state, registry, []);
    if (!u.motor || !state.drive.motor) {
      const ms = t.recommendMotors(registry, busV, dv.dt);
      const best = ms.find((m) => m.fits && m.voltOk) || ms.find((m) => m.voltOk) || ms[0];
      state.drive.motor = best ? best.hw.id : null;
    }
    if (!u.driver || !state.drive.driver) {
      const ds = t.byCategory(registry, 'motor_driver');
      const best = ds.find((h) => voltMatch(t.volt(h), busV) && h.manufacturer === 'TESR') || ds.find((h) => voltMatch(t.volt(h), busV)) || ds[0];
      state.drive.driver = best ? best.id : null;
    }
    if (!u.battery || !state.power.battery) {
      const bs = t.recommendBatteries(registry, busV, dv.pw);
      const best = bs.find((b) => b.fits) || bs.find((b) => voltMatch(b.hw.battery?.nominal_v ?? t.volt(b.hw), busV)) || bs[0];
      state.power.battery = best ? best.hw.id : null;
    }
    if (!state.compute) state.compute = (t.byCategory(registry, 'compute')[0] || {}).id || null;
  }
  function autoResolve(state, registry) {
    state.user = state.user || {};
    for (let k = 0; k < 4; k++) {
      pickParts(state, registry);
      if (state.user.busV) break;
      const sv = derive(state, registry, []).suggestedBusV;
      if (sv === state.power.busV) break;
      state.power.busV = sv;
    }
    pickParts(state, registry);
    return state;
  }

  // ------------------------------------------------------------------ everything the HUD shows
  function derive(state, registry, catalog = []) {
    const t = T(), ids = t.byId(registry), m = state.mission, c = state.chassis, dr = state.drive, busV = state.power.busV;
    const { r, bottom, top } = chassisZ(state), nDrive = dr.type === 'mecanum' ? 4 : 2;
    const sensors = assignIds(state).map((s) => ({ ...s, rec: ids[s.hw] || null }));
    sensors.forEach((s) => {
      if (s.category !== 'lidar') return;
      const f = (s.rec && s.rec.sensor && s.rec.sensor.fov_deg) || 360;
      s.embedded = s.pos[2] < top - 1e-3;
      s.fov = s.embedded ? Math.min(f, 270) : f;
    });
    const motor = ids[dr.motor] || null, driver = ids[dr.driver] || null, battery = ids[state.power.battery] || null, compute = ids[state.compute] || null;
    const devices = [compute, ...sensors.map((s) => s.rec)].filter(Boolean);
    const nominal = battery ? (battery.battery?.nominal_v ?? t.volt(battery)) : null;
    const series = nominal ? Math.max(1, Math.round(busV / nominal)) : 1;
    const cap = battery?.battery?.capacity_ah || 0;
    const partsMass = (state.parts || []).reduce((s, p) => s + (Number(p.mass) || 0), 0);
    const hwMass = (par) => devices.reduce((s, h) => s + (h.mass_kg || 0), 0) + (motor?.mass_kg || 0) * nDrive
      + (battery?.mass_kg || 0) * series * par + (driver?.mass_kg || 0) * dr.driverCount + partsMass + (state.estop ? 0.05 : 0);
    const electronicsW = devices.reduce((s, h) => s + (h.electrical?.typical_w || 0), 0) || 30;
    let parallel = 1, robotMass = 0, dt = null, pw = null;
    for (let k = 0; k < 3; k++) {
      robotMass = t.estimateRobotMass(hwMass(parallel), c.length, c.width, c.height);
      dt = t.sizeDrivetrain({ totalMass: robotMass + m.payload, vMax: m.vMax, aMax: m.aMax, wheelDiameter: dr.wheelDiameter, nDrive, gearRatio: dr.gearRatio, slopeDeg: m.slopeDeg, floor: m.floor });
      pw = t.sizeBattery({ powerMechCont: dt.powerMechCont, powerElecPeak: dt.powerElecPeak, runtimeH: m.runtimeH, busV, electronicsW });
      const p2 = cap ? Math.min(4, Math.max(1, Math.ceil(pw.capacityAh / cap))) : 1;
      if (p2 === parallel) break;
      parallel = p2;
    }
    const totalMass = robotMass + m.payload;
    const suggestedBusV = t.suggestBusV(dt.powerElecPeak, totalMass);
    const packV = nominal ? nominal * series : null;
    const packWh = packV ? packV * cap * parallel : 0;
    const runtimeAch = pw.totalAvgW > 0 ? packWh * 0.8 / pw.totalAvgW : 0;
    const margin = motor && motor.motor ? motor.motor.rated_torque_nm / Math.max(dt.requiredMotorRatedTorque, 1e-6) : 0;
    const motorOk = motor ? t.motorFits(motor, dt) : false;
    const lidars = sensors.filter((s) => s.category === 'lidar');
    const maxRange = Math.max(0, ...lidars.map((s) => s.rec?.sensor?.range_m || 0)) || 8;
    const nav = t.navSizing({ length: c.length, width: c.width, margin: 0.05, vMax: m.vMax, aMax: m.aMax, lidarRange: maxRange });
    // 360° coverage seen from the robot centre, 5° bins
    const bins = new Array(72).fill(false);
    lidars.forEach((s) => {
      for (let b = 0; b < 72; b++) {
        const a = (b + 0.5) * 5 * Math.PI / 180, d = Math.abs(((a - s.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        if (d <= (s.fov * Math.PI / 180) / 2 + 1e-9) bins[b] = true;
      }
    });
    const coverage = bins.filter(Boolean).length / 72;
    const tip = t.tipping({ height: c.height, cogOffsetZ: m.cogOffsetZ ?? 0.2, groundClearance: c.clearance, robotMass, payload: m.payload, track: dr.track, vMax: m.vMax, wMax: m.wMax });
    const rails = t.railsNeeded(registry, busV, devices.concat(driver ? [driver] : []));
    const wheels = wheelSpots(state, registry), casters = casterSpots(state);

    // bill of materials
    const qty = new Map(), role = new Map();
    const add = (id, n, what) => { if (!id || n <= 0) return; qty.set(id, (qty.get(id) || 0) + n); if (!role.has(id)) role.set(id, what); };
    add(state.compute, 1, 'compute'); add(dr.motor, nDrive, 'motor'); add(dr.driver, dr.driverCount, 'motor driver');
    const wheel = t.wheelFor(registry, dr.type, dr.wheelDiameter);
    if (wheel) add(wheel.id, Math.ceil(nDrive / (wheel.wheel?.per_set || 1)), 'wheel');
    sensors.forEach((s) => add(s.hw, 1, s.category));
    if (state.estop) add('generic_estop', 1, 'E-stop');
    add(state.power.battery, series * parallel, 'battery');
    rails.forEach((rl) => add(rl.hw, 1, `${rl.v} V rail`));
    const order = Object.keys(t.CATEGORY_TH);
    const lines = [...qty].map(([id, n]) => {
      const rec = ids[id], p = t.productsFor(catalog, id)[0] || null;
      return { hwId: id, category: rec ? rec.category : '?', name: rec ? rec.name : id, qty: n, role: role.get(id), product: p, unitPrice: p ? p.price : null, lineTotal: p && p.price != null ? p.price * n : null };
    }).sort((a, b) => ((order.indexOf(a.category) + 1 || 99) - (order.indexOf(b.category) + 1 || 99)) || a.hwId.localeCompare(b.hwId));
    const bom = { lines, total: lines.reduce((s, l) => s + (l.lineTotal || 0), 0), missing: lines.filter((l) => !l.product).map((l) => l.hwId), unpriced: lines.filter((l) => l.product && l.unitPrice == null).map((l) => l.hwId) };

    // warnings (plain Thai, each with the fix)
    const W = [], push = (lvl, txt) => W.push({ lvl, txt });
    if (!motor) push('err', 'ยังไม่ได้เลือกมอเตอร์');
    else if (!motorOk) push('err', `มอเตอร์ ${motor.name} แรงไม่พอ — ต้องการ ≥ ${fmt(dt.requiredMotorRatedTorque, 2)} N·m ที่ ${fmt(dt.motorRpm, 0)} rpm: เพิ่มอัตราทด ลดความเร็ว หรือเลือกมอเตอร์ใหญ่ขึ้น`);
    if (motor && !voltMatch(t.volt(motor), busV)) push('warn', `มอเตอร์เป็น ${t.volt(motor)} V แต่ระบบไฟ ${busV} V — ต้องมีไดรเวอร์ที่จ่าย ${t.volt(motor)} V ให้มอเตอร์`);
    if (driver && !voltMatch(t.volt(driver), busV)) push('warn', `ไดรเวอร์เป็น ${t.volt(driver)} V แต่ระบบไฟ ${busV} V — ใส่ DC-DC หรือเลือกไดรเวอร์ ${busV} V`);
    if (battery && packV && !voltMatch(packV, busV)) push('warn', `แบต ${nominal} V ×${series} = ${fmt(packV)} V ไม่ตรงระบบไฟ ${busV} V — ต้องมี DC-DC ระหว่างแบตกับ bus`);
    else if (battery && series > 1) push('ok', `แบต ${nominal} V ต่ออนุกรม ${series} ก้อน = ${fmt(packV)} V${parallel > 1 ? ` · ต่อขนาน ${parallel} ชุด` : ''} (BOM คิด ${series * parallel} ก้อน)`);
    if (battery && runtimeAch < m.runtimeH * 0.95) push('warn', `ใช้งานได้ประมาณ ${fmt(runtimeAch)} h จากเป้า ${m.runtimeH} h — เลือกแบตความจุสูงขึ้น`);
    if (!lidars.length) push('err', 'ยังไม่มี LiDAR — หุ่นทำแผนที่ (SLAM) และนำทางเองไม่ได้');
    else if (coverage < 0.75) push('warn', `LiDAR มองรอบตัวได้ ${Math.round(coverage * 100)}% — มีจุดบอด: เพิ่ม LiDAR ตัวที่ 2 (เฉียงแบบ KURO-X) หรือย้ายขึ้นหลังคา`);
    if ((m.payload > 50 || totalMass > 80) && !state.estop) push('err', 'หุ่นหนักเกิน 50 kg ต้องมีปุ่ม E-stop');
    const usb3 = sensors.filter((s) => (s.rec?.interfaces || []).includes('usb3')).length;
    if (compute?.compute && usb3 > compute.compute.usb3_ports) push('warn', `อุปกรณ์ USB 3 ${usb3} ตัว แต่ ${compute.name} มี ${compute.compute.usb3_ports} พอร์ต — ใช้ hub มีไฟเลี้ยง หรือเลือกคอมพ์ที่พอร์ตมากขึ้น`);
    if (!tip.ok) push('warn', 'เสี่ยงพลิกเมื่อเลี้ยวเร็ว — ลดความเร็ว ขยายระยะล้อ หรือวางของให้ต่ำลง');
    const halfW = c.shape === 'round' ? c.width / 2 : c.width / 2;
    if (dr.track / 2 + dr.wheelWidth / 2 > halfW + 0.005) push('warn', 'ล้อยื่นออกนอกตัวถัง — ลดระยะห่างล้อหรือขยายตัวถัง');
    if (m.minAisle && c.width + 0.1 > m.minAisle) push('err', `หุ่นกว้าง ${fmt(c.width + 0.1, 2)} m (รวมระยะปลอดภัย) แต่ช่องทางแคบสุด ${m.minAisle} m`);
    rails.filter((rl) => !rl.hw).forEach((rl) => push('err', `ต้องมีไฟ ${rl.v} V แต่ยังไม่มี DC-DC ${busV}→${rl.v} V ในคลัง`));
    sensors.forEach((s) => { if (Math.abs(s.pos[0]) > c.length / 2 + 0.06 || Math.abs(s.pos[1]) > c.width / 2 + 0.06) push('warn', `${s.id} ยื่นออกนอกตัวถังมาก — ระวังชน`); });
    if (!W.some((w) => w.lvl !== 'ok')) push('ok', 'พร้อมออกรบ — ไม่พบปัญหา ส่งต่อไปสร้าง ROS 2 workspace หรือเปิดใน Gazebo ได้เลย');

    const stats = {
      speed: clamp(m.vMax / 2), power: clamp(margin / 2), endurance: clamp(runtimeAch / Math.max(m.runtimeH * 1.5, 0.1)),
      vision: coverage, safety: clamp((state.estop ? 0.4 : 0) + (tip.ok ? 0.3 : 0) + 0.3 * coverage),
    };
    const avg = (stats.speed + stats.power + stats.endurance + stats.vision + stats.safety) / 5;
    const errs = W.filter((w) => w.lvl === 'err').length, warns = W.filter((w) => w.lvl === 'warn').length;
    const score = errs ? Math.min(0.39, avg) : Math.max(0, avg - 0.04 * warns);
    const rank = score >= 0.8 ? 'S' : score >= 0.68 ? 'A' : score >= 0.55 ? 'B' : score >= 0.4 ? 'C' : 'D';
    return { r, bottom, top, nDrive, sensors, motor, driver, battery, compute, nominal, series, parallel, packV, packWh, runtimeAch, robotMass, totalMass, dt, pw,
      suggestedBusV, margin, motorOk, nav, coverage, tip, rails, wheels, casters, casterR: casterRadius(state), bom, warnings: W, stats, score, rank, electronicsW };
  }

  // ------------------------------------------------------------------ Robot Definition v1
  function toYaml(state, registry, dv) {
    dv = dv || derive(state, registry);
    const ids = T().byId(registry), m = state.mission, c = state.chassis, dr = state.drive;
    const comp = ids[state.compute];
    const L = [
      '# Robot Definition v1 — built in TESR Robot Builder Garage 3D. Validate: tesr-rb validate ' + state.name + '.robot.yaml',
      'schema_version: 1',
      'meta:', `  name: ${state.name}`, `  package_prefix: ${state.prefix}`, `  description: ${JSON.stringify(state.description || state.name)}`,
      'target:', '  ros_distro: jazzy', '  os: ubuntu-24.04', `  compute: ${state.compute}`, `  arch: ${(comp && comp.compute && comp.compute.arch) || 'arm64'}`, '  deployment: docker',
      'requirements:', `  application: ${m.application}`,
      `  environment: {type: ${m.envType}, indoor: ${m.envType !== 'outdoor'}, floor: ${m.floor}, max_slope_deg: ${m.slopeDeg}${m.minAisle ? `, min_aisle_m: ${m.minAisle}` : ''}}`,
      `  payload: {max_kg: ${m.payload}, cog_offset_m: [0.0, 0.0, ${m.cogOffsetZ ?? 0.2}]}`,
      `  motion: {v_max: ${m.vMax}, a_max: ${m.aMax}, w_max: ${m.wMax}}`,
      `  runtime_h: ${m.runtimeH}`,
      'mechanical:', `  dims_m: {length: ${c.length}, width: ${c.width}, height: ${c.height}, ground_clearance: ${c.clearance}}`,
      '  mass_kg: {robot: auto, total: auto}',
      'drive:', `  type: ${dr.type}`,
      `  wheels: {diameter_m: ${dr.wheelDiameter}, width_m: ${dr.wheelWidth}, separation_m: ${dr.track}${dr.type === 'mecanum' ? `, wheelbase_m: ${dr.wheelbase}` : ''}}`,
    ];
    if (dv.casters.length) { L.push('  casters:'); dv.casters.forEach((k) => L.push(`    - {xyz: [${k.x}, ${k.y}, 0]}`)); }
    L.push(`  motor: {hw: ${dr.motor}, count: ${dv.nDrive}, gear_ratio: ${dr.gearRatio}, driver: ${dr.driver}}`, 'hardware:');
    dv.sensors.forEach((s) => L.push(`  - {id: ${s.id}, hw: ${s.hw}, frame: ${s.frame}, parent: base_link, xyz: [${s.pos.map(r4).join(', ')}], rpy: [0, 0, ${r4(s.yaw)}]}`));
    for (let k = 0; k < dr.driverCount; k++) L.push(`  - {id: ${dr.driverCount > 1 ? `motor_driver_${k + 1}` : 'motor_driver'}, hw: ${dr.driver}}`);
    if (state.estop) L.push('  - {id: estop, hw: generic_estop, io: DI1}');
    const pack = (dv.series > 1 ? `, series: ${dv.series}` : '') + (dv.parallel > 1 ? `, parallel: ${dv.parallel}` : '');
    L.push('power:', `  battery: {hw: ${state.power.battery}${pack}}`, `  bus_v: ${state.power.busV}`);
    if (dv.rails.length) { L.push('  rails:'); dv.rails.forEach((rl) => L.push(`    - {v: ${rl.v}${rl.hw ? `, hw: ${rl.hw}` : ''}}`)); }
    if (state.estop) L.push('io: {DI: {1: estop}}');
    L.push('comms: [dds, mqtt]', 'ros:', '  control: {stack: ros2_control, controller: auto}', '  localization: {slam: slam_toolbox, amcl: true, ekf: auto}',
      '  navigation: {profile: indoor_amr, planner: auto, controller: auto, costmap: auto, safety_margin_m: 0.05, features: [manual, slam, nav, waypoints]}',
      `  perception: {depth_to_costmap: ${dv.sensors.some((s) => /camera/.test(s.category))}}`,
      'sim: {engine: gz_harmonic, world: empty, renderer: ogre1}', 'integrations: {node_red: true, studio_pro: true}');
    return L.join('\n') + '\n';
  }

  // ------------------------------------------------------------------ URDF (+ Gazebo Harmonic)
  const n5 = (x) => { const v = Math.round(x * 1e5) / 1e5; return Object.is(v, -0) ? '0' : String(v); };
  const v3 = (a) => a.map(n5).join(' ');
  const sci = (x) => Math.max(x, 1e-6).toExponential(4);
  const xmlEsc = (s) => String(s).replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch]));
  const inertia = (ixx, iyy, izz) => `<inertia ixx="${sci(ixx)}" ixy="0" ixz="0" iyy="${sci(iyy)}" iyz="0" izz="${sci(izz)}"/>`;
  const inBox = (m, [x, y, z]) => inertia(m * (y * y + z * z) / 12, m * (x * x + z * z) / 12, m * (x * x + y * y) / 12);
  const inCyl = (m, rad, len, axis) => { const a = m * rad * rad / 2, b = m * (3 * rad * rad + len * len) / 12; return axis === 'y' ? inertia(b, a, b) : axis === 'x' ? inertia(a, b, b) : inertia(b, b, a); };
  const inSph = (m, rad) => { const i = 0.4 * m * rad * rad; return inertia(i, i, i); };
  const hexRgb = (hex) => { const n = parseInt(String(hex || '#8c8c92').replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  function geomXml(g) {
    if (g.type === 'box') return `<box size="${v3(g.size)}"/>`;
    if (g.type === 'cylinder') return `<cylinder radius="${n5(g.radius)}" length="${n5(g.length)}"/>`;
    if (g.type === 'sphere') return `<sphere radius="${n5(g.radius)}"/>`;
    return `<mesh filename="${xmlEsc(g.filename)}" scale="${v3(g.scale)}"/>`;
  }
  function linkXml(name, { visuals = [], collisions = [], mass = 0, com = [0, 0, 0], inert = '' }) {
    const o = [`  <link name="${name}">`];
    visuals.forEach((v) => o.push(`    <visual>`, `      <origin xyz="${v3(v.xyz || [0, 0, 0])}" rpy="${v3(v.rpy || [0, 0, 0])}"/>`, `      <geometry>${geomXml(v.geom)}</geometry>`, `      <material name="${v.mat}"/>`, `    </visual>`));
    collisions.forEach((v) => o.push(`    <collision>`, `      <origin xyz="${v3(v.xyz || [0, 0, 0])}" rpy="${v3(v.rpy || [0, 0, 0])}"/>`, `      <geometry>${geomXml(v.geom)}</geometry>`, `    </collision>`));
    if (mass > 0) o.push(`    <inertial>`, `      <origin xyz="${v3(com)}" rpy="0 0 0"/>`, `      <mass value="${n5(mass)}"/>`, `      ${inert}`, `    </inertial>`);
    o.push('  </link>');
    return o.join('\n');
  }
  const jointXml = (name, type, parent, child, xyz, rpy, axis) =>
    [`  <joint name="${name}" type="${type}">`, `    <parent link="${parent}"/>`, `    <child link="${child}"/>`, `    <origin xyz="${v3(xyz)}" rpy="${v3(rpy)}"/>`,
      ...(axis ? [`    <axis xyz="${axis}"/>`, '    <dynamics damping="0.05" friction="0.0"/>'] : []), '  </joint>'].join('\n');

  function sensorGeom(s) {
    const dm = (s.rec && s.rec.dims_m) || [0.05, 0.05, 0.05];
    if (s.category === 'lidar') return { type: 'cylinder', radius: Math.max(dm[0], dm[1]) / 2, length: dm[2], box: [dm[0], dm[1], dm[2]] };
    if (/camera/.test(s.category)) return { type: 'box', size: [dm[1], dm[0], dm[2]], box: [dm[1], dm[0], dm[2]] };
    return { type: 'box', size: dm, box: dm };
  }
  function partGeom(p, pkg) {
    const s = p.size || [0.1, 0.1, 0.1];
    if (p.kind === 'cylinder') return { type: 'cylinder', radius: s[0] / 2, length: s[2] };
    if (p.kind === 'sphere') return { type: 'sphere', radius: s[0] / 2 };
    if (p.kind === 'mesh') return { type: 'mesh', filename: `package://${pkg}/meshes/${p.file}`, scale: [p.scale, p.scale, p.scale] };
    return { type: 'box', size: s };
  }
  const meshOffset = (p) => (p.center ? p.center.map((v) => -v * p.scale) : [0, 0, 0]);

  function toUrdf(state, registry, dv, opts = {}) {
    dv = dv || derive(state, registry);
    const ids = T().byId(registry), c = state.chassis, dr = state.drive, m = state.mission, pkg = `${state.prefix}_description`;
    const { r, bottom, top } = dv, H = c.height, zc = (bottom + top) / 2, round = c.shape === 'round';
    const mats = { chassis: CHASSIS_COLORS[c.color] || CHASSIS_COLORS.gunmetal, tire: [0.05, 0.05, 0.06], rim: [0.79, 0.66, 0.3], caster: [0.3, 0.3, 0.33],
      lidar: [0.55, 0.08, 0.08], camera: [0.12, 0.2, 0.35], imu: [0.85, 0.45, 0.1], estop: [0.8, 0.05, 0.05] };
    (state.parts || []).forEach((p, i) => { mats[`part_${i + 1}`] = hexRgb(p.color); });
    const out = ['<?xml version="1.0"?>',
      `<!-- ${xmlEsc(state.name)} — generated by TESR Robot Builder Garage 3D for ROS 2 Jazzy / Gazebo Harmonic. Re-export from the Garage instead of hand-editing. -->`,
      `<robot name="${xmlEsc(state.name)}">`];
    Object.entries(mats).forEach(([k, v]) => out.push(`  <material name="${k}"><color rgba="${v.map(n5).join(' ')} 1"/></material>`));
    out.push('  <link name="base_footprint"/>');

    const wheelRec = T().wheelFor(registry, dr.type, dr.wheelDiameter);
    const wm = Math.max(0.2, (wheelRec && wheelRec.mass_kg) || r * 8);
    const sensorMass = dv.sensors.reduce((s, x) => s + ((x.rec && x.rec.mass_kg) || 0.05), 0);
    const partsMass = (state.parts || []).reduce((s, p) => s + (Number(p.mass) || 0), 0);
    const bodyMass = Math.max(1, dv.robotMass - wm * dv.wheels.length - sensorMass - partsMass);
    const chassisGeom = round ? { type: 'cylinder', radius: c.width / 2, length: H } : { type: 'box', size: [c.length, c.width, H] };
    const bodyVis = [];
    if (c.shell && c.shell.file) {
      const s = c.shell.scale, off = [-c.length / 2 - c.shell.min[0] * s, -c.width / 2 - c.shell.min[1] * s, bottom - c.shell.min[2] * s];
      bodyVis.push({ xyz: off, geom: { type: 'mesh', filename: `package://${pkg}/meshes/${c.shell.file}`, scale: [s, s, s] }, mat: 'chassis' });
    } else bodyVis.push({ xyz: [0, 0, zc], geom: chassisGeom, mat: 'chassis' });
    if (state.estop) bodyVis.push({ xyz: [r4(-c.length / 2 + 0.08), r4(c.width / 2 - 0.08), r4(top + 0.015)], geom: { type: 'cylinder', radius: 0.02, length: 0.03 }, mat: 'estop' });
    out.push(linkXml('base_link', { visuals: bodyVis, collisions: [{ xyz: [0, 0, zc], geom: chassisGeom }], mass: bodyMass, com: [0, 0, zc],
      inert: round ? inCyl(bodyMass, c.width / 2, H, 'z') : inBox(bodyMass, [c.length, c.width, H]) }));
    out.push(jointXml('base_footprint_joint', 'fixed', 'base_footprint', 'base_link', [0, 0, r], [0, 0, 0]));

    const wheelGeom = { type: 'cylinder', radius: r, length: dr.wheelWidth };
    dv.wheels.forEach((w) => {
      out.push(linkXml(w.link, { visuals: [{ rpy: [Math.PI / 2, 0, 0], geom: wheelGeom, mat: 'tire' }], collisions: [{ rpy: [Math.PI / 2, 0, 0], geom: wheelGeom }], mass: wm, inert: inCyl(wm, r, dr.wheelWidth, 'y') }));
      out.push(jointXml(w.joint, 'continuous', 'base_link', w.link, [w.x, w.y, 0], [0, 0, 0], '0 1 0'));
    });
    dv.casters.forEach((k, i) => {
      const cr = dv.casterR, name = `caster_${i + 1}_link`;
      out.push(linkXml(name, { visuals: [{ geom: { type: 'sphere', radius: cr }, mat: 'caster' }], collisions: [{ geom: { type: 'sphere', radius: cr } }], mass: 0.2, inert: inSph(0.2, cr) }));
      out.push(jointXml(`caster_${i + 1}_joint`, 'fixed', 'base_link', name, [k.x, k.y, -r + cr], [0, 0, 0]));
    });
    dv.sensors.forEach((s) => {
      const g = sensorGeom(s), mass = (s.rec && s.rec.mass_kg) || 0.05, mat = s.category === 'lidar' ? 'lidar' : /camera/.test(s.category) ? 'camera' : 'imu';
      const inert = g.type === 'cylinder' ? inCyl(mass, g.radius, g.length, 'z') : inBox(mass, g.box);
      out.push(linkXml(s.frame, { visuals: [{ geom: g, mat }], collisions: [{ geom: g }], mass, inert }));
      out.push(jointXml(`${s.id}_joint`, 'fixed', 'base_link', s.frame, s.pos, [0, 0, s.yaw]));
    });
    (state.parts || []).forEach((p, i) => {
      const name = `part_${i + 1}_link`, g = partGeom(p, pkg), box = p.size || [0.1, 0.1, 0.1], mass = Math.max(0.01, Number(p.mass) || 0.2);
      const colGeom = p.kind === 'mesh' ? { type: 'box', size: box } : g;
      out.push(linkXml(name, { visuals: [{ xyz: p.kind === 'mesh' ? meshOffset(p) : [0, 0, 0], geom: g, mat: `part_${i + 1}` }], collisions: [{ geom: colGeom }], mass, inert: inBox(mass, box) }));
      out.push(jointXml(`part_${i + 1}_joint`, 'fixed', 'base_link', name, p.pos, [0, 0, p.yaw || 0]));
    });

    if (opts.gazebo !== false) {
      dv.wheels.forEach((w) => out.push(`  <gazebo reference="${w.link}"><mu1>1.0</mu1><mu2>1.0</mu2></gazebo>`));
      dv.casters.forEach((k, i) => out.push(`  <gazebo reference="caster_${i + 1}_link"><mu1>0.0</mu1><mu2>0.0</mu2></gazebo>`));
      dv.sensors.forEach((s) => {
        const sen = (s.rec && s.rec.sensor) || {};
        if (s.category === 'lidar') {
          const half = s.fov >= 359.9 ? Math.PI : (s.fov * Math.PI / 180) / 2;
          out.push(`  <gazebo reference="${s.frame}">`, `    <sensor name="${s.id}" type="gpu_lidar">`, `      <gz_frame_id>${s.frame}</gz_frame_id>`,
            `      <topic>${s.topic}</topic>`, `      <update_rate>${sen.rate_hz || 10}</update_rate>`, '      <always_on>true</always_on>', '      <visualize>true</visualize>',
            '      <ray>', `        <scan><horizontal><samples>${Math.round(s.fov * 2)}</samples><resolution>1</resolution><min_angle>${n5(-half)}</min_angle><max_angle>${n5(half)}</max_angle></horizontal></scan>`,
            `        <range><min>${n5(Math.max(sen.min_range_m || 0.05, 0.02))}</min><max>${n5(sen.range_m || 12)}</max><resolution>0.01</resolution></range>`, '      </ray>', '    </sensor>', '  </gazebo>');
        } else if (/camera/.test(s.category)) {
          out.push(`  <gazebo reference="${s.frame}">`, `    <sensor name="${s.id}" type="rgbd_camera">`, `      <gz_frame_id>${s.frame}</gz_frame_id>`,
            `      <topic>${s.topic}</topic>`, '      <update_rate>15</update_rate>', '      <always_on>true</always_on>', '      <visualize>false</visualize>',
            `      <camera><horizontal_fov>${n5((sen.fov_deg || 87) * Math.PI / 180)}</horizontal_fov><image><width>640</width><height>480</height><format>R8G8B8</format></image>`,
            `        <clip><near>${n5(Math.max(sen.min_range_m || 0.2, 0.05))}</near><far>${n5(sen.range_m || 6)}</far></clip></camera>`, '    </sensor>', '  </gazebo>');
        } else if (s.category === 'imu') {
          out.push(`  <gazebo reference="${s.frame}">`, `    <sensor name="${s.id}" type="imu">`, `      <gz_frame_id>${s.frame}</gz_frame_id>`, `      <topic>${s.topic}</topic>`,
            `      <update_rate>${sen.rate_hz || 100}</update_rate>`, '      <always_on>true</always_on>', '    </sensor>', '  </gazebo>');
        }
      });
      const j = Object.fromEntries(dv.wheels.map((w) => [w.key, w.joint]));
      const common = ['      <topic>cmd_vel</topic>', '      <odom_topic>odom</odom_topic>', '      <tf_topic>tf</tf_topic>', '      <frame_id>odom</frame_id>',
        '      <child_frame_id>base_footprint</child_frame_id>', '      <odom_publish_frequency>30</odom_publish_frequency>'];
      out.push('  <gazebo>');
      if (dr.type === 'mecanum') {
        out.push('    <plugin filename="gz-sim-mecanum-drive-system" name="gz::sim::systems::MecanumDrive">',
          `      <front_left_joint>${j.front_left}</front_left_joint>`, `      <front_right_joint>${j.front_right}</front_right_joint>`,
          `      <back_left_joint>${j.rear_left}</back_left_joint>`, `      <back_right_joint>${j.rear_right}</back_right_joint>`,
          `      <wheel_separation>${n5(dr.track)}</wheel_separation>`, `      <wheelbase>${n5(dr.wheelbase)}</wheelbase>`, `      <wheel_radius>${n5(r)}</wheel_radius>`, ...common, '    </plugin>');
      } else {
        out.push('    <plugin filename="gz-sim-diff-drive-system" name="gz::sim::systems::DiffDrive">',
          `      <left_joint>${j.left}</left_joint>`, `      <right_joint>${j.right}</right_joint>`,
          `      <wheel_separation>${n5(dr.track)}</wheel_separation>`, `      <wheel_radius>${n5(r)}</wheel_radius>`,
          `      <max_linear_acceleration>${n5(m.aMax)}</max_linear_acceleration>`, ...common, '    </plugin>');
      }
      out.push('    <plugin filename="gz-sim-joint-state-publisher-system" name="gz::sim::systems::JointStatePublisher">', '      <topic>joint_states</topic>', '    </plugin>', '  </gazebo>');
    }
    out.push('</robot>');
    return out.join('\n') + '\n';
  }

  // ------------------------------------------------------------------ ROS 2 Jazzy package
  function bridgeArgs(dv) {
    const a = ['/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock', '/cmd_vel@geometry_msgs/msg/Twist]gz.msgs.Twist', '/odom@nav_msgs/msg/Odometry[gz.msgs.Odometry',
      '/tf@tf2_msgs/msg/TFMessage[gz.msgs.Pose_V', '/joint_states@sensor_msgs/msg/JointState[gz.msgs.Model'];
    dv.sensors.forEach((s) => {
      if (s.category === 'lidar') a.push(`/${s.topic}@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan`);
      else if (/camera/.test(s.category)) a.push(`/${s.topic}/image@sensor_msgs/msg/Image[gz.msgs.Image`, `/${s.topic}/depth_image@sensor_msgs/msg/Image[gz.msgs.Image`,
        `/${s.topic}/points@sensor_msgs/msg/PointCloud2[gz.msgs.PointCloudPacked`, `/${s.topic}/camera_info@sensor_msgs/msg/CameraInfo[gz.msgs.CameraInfo`);
      else if (s.category === 'imu') a.push(`/${s.topic}@sensor_msgs/msg/Imu[gz.msgs.IMU`);
    });
    return a;
  }
  function rvizConfig(fixed, dv, sim) {
    const d = ['    - Class: rviz_default_plugins/Grid', '      Name: Grid', '      Enabled: true', '      Cell Size: 0.5', '      Plane Cell Count: 20', '      Color: 80; 80; 90',
      '    - Class: rviz_default_plugins/RobotModel', '      Name: RobotModel', '      Enabled: true', '      Description Source: Topic', '      Description Topic:', '        Value: /robot_description',
      '    - Class: rviz_default_plugins/TF', '      Name: TF', '      Enabled: true', '      Marker Scale: 0.3'];
    if (sim) {
      const colors = ['255; 60; 60', '255; 180; 60', '60; 200; 255', '160; 255; 90'];
      dv.sensors.filter((s) => s.category === 'lidar').forEach((s, i) => d.push(`    - Class: rviz_default_plugins/LaserScan`, `      Name: ${s.topic}`, '      Enabled: true',
        '      Topic:', `        Value: /${s.topic}`, '        Reliability Policy: Best Effort', '      Color Transformer: FlatColor', `      Color: ${colors[i % colors.length]}`, '      Size (m): 0.03'));
      dv.sensors.filter((s) => /camera/.test(s.category)).forEach((s) => d.push('    - Class: rviz_default_plugins/PointCloud2', `      Name: ${s.topic} points`, '      Enabled: false',
        '      Topic:', `        Value: /${s.topic}/points`, '        Reliability Policy: Best Effort', '      Size (m): 0.01'));
    }
    return ['Panels:', '  - Class: rviz_common/Displays', '    Name: Displays', 'Visualization Manager:', '  Class: ""', '  Displays:', ...d,
      '  Global Options:', `    Fixed Frame: ${fixed}`, '    Background Color: 12; 12; 16', '    Frame Rate: 30', '  Tools:', '    - Class: rviz_default_plugins/MoveCamera',
      '    - Class: rviz_default_plugins/SetInitialPose', '    - Class: rviz_default_plugins/SetGoal', '  Views:', '    Current:', '      Class: rviz_default_plugins/Orbit',
      '      Distance: 3.5', `      Target Frame: base_link`, '      Pitch: 0.6', '      Yaw: 0.8', 'Window Geometry:', '  Width: 1280', '  Height: 800', ''].join('\n');
  }
  function worldSdf() {
    const wall = (name, x, y, sx, sy) => `    <model name="${name}"><static>true</static><pose>${x} ${y} 0.5 0 0 0</pose><link name="link">
      <collision name="c"><geometry><box><size>${sx} ${sy} 1</size></box></geometry></collision>
      <visual name="v"><geometry><box><size>${sx} ${sy} 1</size></box></geometry><material><ambient>0.35 0.33 0.3 1</ambient><diffuse>0.55 0.5 0.45 1</diffuse></material></visual></link></model>`;
    const crate = (name, x, y, s) => `    <model name="${name}"><static>true</static><pose>${x} ${y} ${s / 2} 0 0 0.4</pose><link name="link">
      <collision name="c"><geometry><box><size>${s} ${s} ${s}</size></box></geometry></collision>
      <visual name="v"><geometry><box><size>${s} ${s} ${s}</size></box></geometry><material><ambient>0.5 0.4 0.15 1</ambient><diffuse>0.79 0.66 0.3 1</diffuse></material></visual></link></model>`;
    return `<?xml version="1.0"?>
<!-- TESR Garage arena: 10 x 10 m room with crates, for testing LiDAR / camera / navigation. -->
<sdf version="1.9">
  <world name="garage">
    <physics name="1ms" type="ignored"><max_step_size>0.001</max_step_size><real_time_factor>1.0</real_time_factor></physics>
    <plugin filename="gz-sim-physics-system" name="gz::sim::systems::Physics"/>
    <plugin filename="gz-sim-user-commands-system" name="gz::sim::systems::UserCommands"/>
    <plugin filename="gz-sim-scene-broadcaster-system" name="gz::sim::systems::SceneBroadcaster"/>
    <plugin filename="gz-sim-sensors-system" name="gz::sim::systems::Sensors"><render_engine>ogre2</render_engine></plugin>
    <plugin filename="gz-sim-imu-system" name="gz::sim::systems::Imu"/>
    <light type="directional" name="sun"><cast_shadows>true</cast_shadows><pose>0 0 10 0 0 0</pose><diffuse>0.9 0.9 0.85 1</diffuse><specular>0.2 0.2 0.2 1</specular><direction>-0.4 0.2 -0.9</direction></light>
    <model name="ground_plane"><static>true</static><link name="link">
      <collision name="c"><geometry><plane><normal>0 0 1</normal><size>40 40</size></plane></geometry></collision>
      <visual name="v"><geometry><plane><normal>0 0 1</normal><size>40 40</size></plane></geometry><material><ambient>0.12 0.12 0.14 1</ambient><diffuse>0.2 0.2 0.23 1</diffuse></material></visual></link></model>
${wall('wall_n', 0, 5, 10, 0.1)}
${wall('wall_s', 0, -5, 10, 0.1)}
${wall('wall_e', 5, 0, 0.1, 10)}
${wall('wall_w', -5, 0, 0.1, 10)}
${crate('crate_1', 2.5, 1.5, 0.6)}
${crate('crate_2', -2, -2.2, 0.8)}
${crate('crate_3', 1.2, -3, 0.5)}
  </world>
</sdf>
`;
  }

  function rosPackage(state, registry, dv, meshFiles = []) {
    dv = dv || derive(state, registry);
    const name = state.name, pkg = `${state.prefix}_description`, base = `src/${pkg}`;
    const files = {};
    files[`${base}/package.xml`] = `<?xml version="1.0"?>
<?xml-model href="http://download.ros.org/schema/package_format3.xsd" schematypens="http://www.w3.org/2001/XMLSchema"?>
<package format="3">
  <name>${pkg}</name>
  <version>0.1.0</version>
  <description>${xmlEsc(name)} — robot description, RViz and Gazebo Harmonic launch files generated by TESR Robot Builder Garage 3D</description>
  <maintainer email="maintainer@example.com">TESR Robot Builder</maintainer>
  <license>Apache-2.0</license>
  <buildtool_depend>ament_cmake</buildtool_depend>
  <exec_depend>robot_state_publisher</exec_depend>
  <exec_depend>joint_state_publisher</exec_depend>
  <exec_depend>joint_state_publisher_gui</exec_depend>
  <exec_depend>rviz2</exec_depend>
  <exec_depend>ros_gz_sim</exec_depend>
  <exec_depend>ros_gz_bridge</exec_depend>
  <exec_depend>teleop_twist_keyboard</exec_depend>
  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
`;
    files[`${base}/CMakeLists.txt`] = `cmake_minimum_required(VERSION 3.8)
project(${pkg})
find_package(ament_cmake REQUIRED)
install(DIRECTORY launch meshes rviz urdf worlds DESTINATION share/\${PROJECT_NAME})
ament_package()
`;
    files[`${base}/urdf/${name}.urdf`] = toUrdf(state, registry, dv);
    files[`${base}/meshes/.gitkeep`] = '';
    files[`${base}/rviz/display.rviz`] = rvizConfig('base_footprint', dv, false);
    files[`${base}/rviz/sim.rviz`] = rvizConfig('odom', dv, true);
    files[`${base}/worlds/garage.sdf`] = worldSdf();
    files[`${base}/launch/display.launch.py`] = `"""RViz view of ${name} (no simulation). Generated by TESR Robot Builder Garage 3D."""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition, UnlessCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

PKG = "${pkg}"
URDF = "${name}.urdf"


def generate_launch_description():
    share = get_package_share_directory(PKG)
    with open(os.path.join(share, "urdf", URDF), encoding="utf-8") as f:
        robot_description = f.read()
    gui = LaunchConfiguration("gui")
    return LaunchDescription([
        DeclareLaunchArgument("gui", default_value="true", description="show joint_state_publisher_gui sliders"),
        Node(package="robot_state_publisher", executable="robot_state_publisher", parameters=[{"robot_description": robot_description}]),
        Node(package="joint_state_publisher_gui", executable="joint_state_publisher_gui", condition=IfCondition(gui)),
        Node(package="joint_state_publisher", executable="joint_state_publisher", condition=UnlessCondition(gui)),
        Node(package="rviz2", executable="rviz2", arguments=["-d", os.path.join(share, "rviz", "display.rviz")]),
    ])
`;
    files[`${base}/launch/gazebo.launch.py`] = `"""Gazebo Harmonic simulation of ${name} with ros_gz_bridge and RViz. Generated by TESR Robot Builder Garage 3D.

Drive it:  ros2 run teleop_twist_keyboard teleop_twist_keyboard
"""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import AppendEnvironmentVariable, DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

PKG = "${pkg}"
URDF = "${name}.urdf"
BRIDGE = ${JSON.stringify(bridgeArgs(dv), null, 4).replace(/\n\]$/, ',\n]')}


def generate_launch_description():
    share = get_package_share_directory(PKG)
    with open(os.path.join(share, "urdf", URDF), encoding="utf-8") as f:
        robot_description = f.read()
    world = LaunchConfiguration("world")
    gz_sim = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(get_package_share_directory("ros_gz_sim"), "launch", "gz_sim.launch.py")),
        launch_arguments={"gz_args": ["-r ", world]}.items(),
    )
    return LaunchDescription([
        DeclareLaunchArgument("world", default_value=os.path.join(share, "worlds", "garage.sdf")),
        DeclareLaunchArgument("rviz", default_value="true"),
        AppendEnvironmentVariable("GZ_SIM_RESOURCE_PATH", os.path.dirname(share)),
        gz_sim,
        Node(package="robot_state_publisher", executable="robot_state_publisher", output="screen",
             parameters=[{"robot_description": robot_description, "use_sim_time": True}]),
        Node(package="ros_gz_sim", executable="create", output="screen",
             arguments=["-topic", "robot_description", "-name", "${name}", "-z", "0.05"]),
        Node(package="ros_gz_bridge", executable="parameter_bridge", output="screen",
             arguments=BRIDGE, parameters=[{"use_sim_time": True}]),
        Node(package="rviz2", executable="rviz2", condition=IfCondition(LaunchConfiguration("rviz")),
             arguments=["-d", os.path.join(share, "rviz", "sim.rviz")], parameters=[{"use_sim_time": True}]),
    ])
`;
    const topics = dv.sensors.map((s) => `- \`/${s.topic}${/camera/.test(s.category) ? '/{image,depth_image,points,camera_info}' : ''}\` — ${s.id} (${s.hw})`).join('\n');
    const readme = `# ${name}_ws — ROS 2 Jazzy · Gazebo Harmonic

สร้างจาก **TESR Robot Builder Garage 3D** · package \`${pkg}\`

## รัน
\`\`\`bash
cd ${name}_ws
colcon build --symlink-install && source install/setup.bash

ros2 launch ${pkg} display.launch.py        # ดูใน RViz + slider หมุนล้อ
ros2 launch ${pkg} gazebo.launch.py         # จำลองใน Gazebo Harmonic + RViz
ros2 run teleop_twist_keyboard teleop_twist_keyboard   # ขับด้วยคีย์บอร์ด (อีก terminal)
\`\`\`
ต้องมี \`ros-jazzy-desktop ros-jazzy-ros-gz ros-jazzy-teleop-twist-keyboard\` (หรือ \`rosdep install --from-paths src -y --ignore-src\`)

## Topics ในการจำลอง
- \`/cmd_vel\` (Twist) → ขับหุ่น · \`/odom\` · \`/tf\` · \`/joint_states\` · \`/clock\`
${topics}

## ไฟล์
- \`urdf/${name}.urdf\` — โมเดล + inertial + Gazebo sensors/plugins (${state.drive.type === 'mecanum' ? 'MecanumDrive' : 'DiffDrive'})
- \`worlds/garage.sdf\` — ห้อง 10×10 m มีลังให้ LiDAR เห็น
- \`${name}.robot.yaml\` — Robot Definition สำหรับ \`tesr-rb generate\` (ros2_control, Nav2, …)

หมายเหตุ: ล้อ mecanum ในการจำลองใช้ปลั๊กอิน kinematic (ไม่จำลองลูกกลิ้งจริง)
`;
    files['README.md'] = readme;
    files[`${base}/README.md`] = readme;
    files[`${name}.robot.yaml`] = toYaml(state, registry, dv);
    meshFiles.forEach(() => {});
    return files;
  }

  const api = { BLUEPRINTS, CHASSIS_COLORS, applyBlueprint, autoResolve, derive, placeLayout, assignIds, chassisZ, rimPoint, wheelSpots, casterSpots, casterRadius,
    toYaml, toUrdf, rosPackage, bridgeArgs, voltMatch, uid, r4 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TESR_GARAGE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
