/* TESR Robot Builder — web app logic (docs/app.js)
 *
 * Pure functions (calc, recommend, yaml, bom) mirror src/tesr_robot_builder/calc/*.py and are
 * cross-checked by tests/test_web.js against numbers produced by the Python engine.
 * Data: ./data/registry.json (engineering specs, exported by `tesr-rb export-web`) and a product
 * catalog CSV (./data/products.csv or a Google Sheet shared "anyone with link" via ?catalog=<id|url>).
 * Every step produces something usable on its own: sizing numbers, part recommendations with TESR Shop
 * links, a robot.yaml for `tesr-rb generate`, and a BOM CSV.
 */
(function (root) {
  'use strict';

  const G = 9.81, SAFETY_FACTOR = 1.3, EFFICIENCY = 0.85;
  const ROLLING_RESISTANCE = { concrete: 0.015, epoxy: 0.012, tile: 0.012, carpet: 0.030, asphalt: 0.020, gravel: 0.050, mixed: 0.030 };
  const DUTY = 0.6, DOD = 0.8;

  // ------------------------------------------------------------------ calc (mirrors calc/*.py)
  const r4 = (x) => Math.round(x * 1e4) / 1e4;

  function sizeDrivetrain(o) {
    const cRr = ROLLING_RESISTANCE[o.floor] ?? 0.02;
    const theta = (o.slopeDeg || 0) * Math.PI / 180;
    const r = o.wheelDiameter / 2;
    const i = o.gearRatio || 1, eta = o.efficiency ?? EFFICIENCY, sf = o.safetyFactor ?? SAFETY_FACTOR;
    const fCont = o.totalMass * G * cRr;
    const fPeak = o.totalMass * G * (Math.sin(theta) + cRr * Math.cos(theta)) + o.totalMass * o.aMax;
    const twCont = fCont * r / o.nDrive, twPeak = fPeak * r / o.nDrive;
    const wheelRpm = o.vMax * 60 / (Math.PI * o.wheelDiameter);
    return {
      totalMass: o.totalMass, cRr, forceCont: fCont, forcePeak: fPeak,
      wheelTorqueCont: twCont, wheelTorquePeak: twPeak,
      motorTorqueCont: twCont / (i * eta), motorTorquePeak: twPeak / (i * eta),
      wheelRpm, motorRpm: wheelRpm * i,
      powerMechCont: fCont * o.vMax, powerMechPeak: fPeak * o.vMax, powerElecPeak: fPeak * o.vMax / eta,
      requiredMotorRatedTorque: twCont / (i * eta) * sf, requiredMotorPeakTorque: twPeak / (i * eta),
    };
  }

  function sizeBattery(o) {
    const eta = o.efficiency ?? EFFICIENCY, duty = o.duty ?? DUTY, dod = o.dod ?? DOD;
    const driveAvg = o.powerMechCont * duty / eta;
    const totalAvg = driveAvg + o.electronicsW;
    const wh = totalAvg * o.runtimeH / dod;
    return { electronicsW: o.electronicsW, driveAvgW: driveAvg, totalAvgW: totalAvg, energyWh: wh,
      capacityAh: wh / o.busV, peakCurrentA: (o.powerElecPeak + o.electronicsW) / o.busV };
  }

  function navSizing(o) {
    const hl = o.length / 2 + o.margin, hw = o.width / 2 + o.margin;
    const circ = Math.hypot(hl, hw);
    const raw = 2 * (o.vMax * o.vMax / (2 * o.aMax) + o.length);
    const local = r4(Math.ceil(Math.min(Math.max(raw, 3), 6) * 2) / 2);
    const obst = r4(Math.min((o.lidarRange || 8) * 0.9, local / 2));
    return {
      footprint: [[r4(hl), r4(hw)], [r4(-hl), r4(hw)], [r4(-hl), r4(-hw)], [r4(hl), r4(-hw)]],
      circumscribedRadius: r4(circ), inflationRadius: r4(circ + 0.10),
      localCostmap: local, obstacleRange: obst, raytraceRange: r4(obst + 0.5), resolution: 0.05,
    };
  }

  function estimateRobotMass(hardwareMass, L, W, H) {
    return r4(hardwareMass + 30 * L * W * Math.max(1, H / 0.4));
  }

  // System voltage suggestion from peak electrical power and total mass: small robots 12 V, general 24 V, heavy AMR 48 V
  function suggestBusV(powerElecPeakW, totalMassKg = 0) {
    if (powerElecPeakW < 120 && totalMassKg <= 40) return 12;
    if (powerElecPeakW < 400 && totalMassKg <= 150) return 24;
    return 48;
  }

  function tipping(o) {
    // quasi-static: a_tip = g·(track/2)/h_cog vs lateral accel v_max·w_max (rule R-MECH-004)
    const payloadH = o.height + (o.cogOffsetZ || 0), bodyH = o.groundClearance + o.height / 2;
    const hCog = (o.robotMass * bodyH + o.payload * payloadH) / Math.max(o.robotMass + o.payload, 1e-6);
    const aTip = G * (o.track / 2) / Math.max(hCog, 1e-3), aLat = o.vMax * o.wMax;
    return { hCog, aTip, aLat, ok: aLat <= 0.7 * aTip };
  }

  // ------------------------------------------------------------------ registry / catalog helpers
  function parseCsv(text) {
    const rows = [], row = [];
    let field = '', q = false;
    text = text.replace(/^\uFEFF/, '');
    for (let k = 0; k < text.length; k++) {
      const c = text[k];
      if (q) {
        if (c === '"') { if (text[k + 1] === '"') { field += '"'; k++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[k + 1] === '\n') k++;
        row.push(field); field = ''; rows.push(row.splice(0)); 
      } else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row.splice(0)); }
    if (!rows.length) return [];
    const header = rows[0].map((h) => h.trim());
    return rows.slice(1).filter((r) => r.some((v) => v.trim() !== '')).map((r) => {
      const o = {}; header.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); }); return o;
    });
  }

  function parseCatalog(text) {
    return parseCsv(text).map((r) => ({
      sku: r.sku || '', hardware_ref: r.hardware_ref || '', category: r.category || '',
      name: r.name_en || r.name_th || r.sku, name_th: r.name_th || '', brand: r.brand || '',
      price: r.price_thb ? Number(String(r.price_thb).replace(/,/g, '')) : null,
      stock: r.stock_status || '', shop_url: r.shop_url || '', image_url: r.image_url || '',
      datasheet_url: r.datasheet_url || '', spec: r.spec_summary || '', notes: r.notes || '',
    }));
  }

  function sheetCsvUrl(ref) {
    const m = ref.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
    const id = m ? m[1] : ref;
    const gid = ref.match(/[#&?]gid=(\d+)/);
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv` + (gid ? `&gid=${gid[1]}` : '');
  }

  function catalogUrl(ref) {
    if (!ref) return './data/products.csv';
    if (/docs\.google\.com\/spreadsheets/.test(ref)) return sheetCsvUrl(ref);
    if (/^https?:\/\//.test(ref)) return ref;
    if (/^[A-Za-z0-9_-]{20,}$/.test(ref)) return sheetCsvUrl(ref);
    return ref;
  }

  const STOCK_RANK = { in_stock: 0, preorder: 1, '': 2, out_of_stock: 3, discontinued: 4 };
  function productsFor(catalog, hwId) {
    return catalog.filter((p) => p.hardware_ref === hwId)
      .sort((a, b) => (STOCK_RANK[a.stock] ?? 2) - (STOCK_RANK[b.stock] ?? 2) || (a.price == null) - (b.price == null) || (a.price || 0) - (b.price || 0));
  }

  // LiDAR placements (pos name → x/y offsets from the chassis edges, yaw). Diagonal pairs (front-left + rear-right) are the
  // classic industrial AMR layout (KURO-X / Beary-X): two scanners cover 360° with no blind side.
  const LIDAR_LAYOUTS = {
    front1:  { label: '1 ตัว หน้า', spots: [['front', 1, 0, 0]] },
    diag2:   { label: '2 ตัว เฉียง (หน้าซ้าย + หลังขวา)', spots: [['front_left', 1, 1, 0.7854], ['rear_right', -1, -1, -2.3562]] },
    fr2:     { label: '2 ตัว หน้า + หลัง', spots: [['front', 1, 0, 0], ['rear', -1, 0, 3.14159]] },
    rear3:   { label: '3 ตัว หน้า + มุมหลัง 2', spots: [['front', 1, 0, 0], ['rear_left', -1, 1, 2.3562], ['rear_right', -1, -1, -2.3562]] },
    corner4: { label: '4 ตัว ทุกมุม', spots: [['front_left', 1, 1, 0.7854], ['front_right', 1, -1, -0.7854], ['rear_left', -1, 1, 2.3562], ['rear_right', -1, -1, -2.3562]] },
  };
  const CAMERA_LAYOUTS = { front1: [['front', 1, 0, 0]], fr2: [['front', 1, 0, 0], ['rear', -1, 0, 3.14159]] };
  // caster layouts for differential drive (x/y as fractions of the half-length / half-width, inset 0.1 m)
  const CASTER_LAYOUTS = { front_rear: [[1, 0], [-1, 0]], corners4: [[1, 1], [1, -1], [-1, 1], [-1, -1]], rear1: [[-1, 0]], front1: [[1, 0]] };
  function sensorSpots(spots, L, W, inset) {
    return spots.map(([pos, fx, fy, yaw]) => ({ pos, x: r4(fx * (L / 2 - inset)), y: r4(fy * (W / 2 - inset)), yaw }));
  }
  const CATEGORY_LABELS = [['wheel', 'ล้อ'], ['motor', 'มอเตอร์'], ['motor_driver', 'Low-level control (มอเตอร์ไดรเวอร์)'], ['encoder', 'เอ็นโค้ดเดอร์'],
    ['compute', 'คอมพิวเตอร์'], ['lidar', 'LiDAR'], ['depth_camera', 'กล้อง depth'], ['rgb_camera', 'กล้อง'], ['imu', 'IMU'],
    ['battery', 'แบตเตอรี่'], ['power_supply', 'แหล่งจ่ายไฟ / DC-DC'], ['estop', 'ความปลอดภัย (E-stop)'], ['accessory', 'อุปกรณ์เสริม']];
  const CATEGORY_ORDER = Object.fromEntries(CATEGORY_LABELS.map(([k], i) => [k, i]));
  const CATEGORY_TH = Object.fromEntries(CATEGORY_LABELS);
  const byId = (registry) => Object.fromEntries(registry.hardware.map((h) => [h.id, h]));
  const byCategory = (registry, cat) => registry.hardware.filter((h) => h.category === cat);
  const volt = (h) => (h.electrical ? h.electrical.voltage_v : null);
  const voltMatch = (v, busV) => v == null || Math.abs(v - busV) / busV <= 0.12;

  function motorFits(rec, res) {
    const m = rec.motor || {};
    return (m.rated_torque_nm ?? 0) >= res.requiredMotorRatedTorque && (m.peak_torque_nm ?? 0) >= res.requiredMotorPeakTorque && (m.rated_rpm ?? 0) >= res.motorRpm;
  }
  function batteryFits(rec, busV, pw) {
    const b = rec.battery || {};
    return voltMatch(b.nominal_v ?? volt(rec), busV) && (b.capacity_ah ?? 0) >= pw.capacityAh && (b.max_discharge_a ?? 0) >= pw.peakCurrentA;
  }

  function recommendMotors(registry, busV, res) {
    return byCategory(registry, 'motor').map((h) => ({ hw: h, voltOk: voltMatch(volt(h), busV), fits: motorFits(h, res) }))
      .sort((a, b) => (b.fits && b.voltOk) - (a.fits && a.voltOk) || (a.hw.motor?.rated_torque_nm ?? 0) - (b.hw.motor?.rated_torque_nm ?? 0));
  }
  function recommendBatteries(registry, busV, pw) {
    return byCategory(registry, 'battery').map((h) => ({ hw: h, fits: batteryFits(h, busV, pw) }))
      .sort((a, b) => b.fits - a.fits || (a.hw.battery?.capacity_ah ?? 0) - (b.hw.battery?.capacity_ah ?? 0));
  }
  function wheelFor(registry, driveType, diameter) {
    // registry wheel of the right type (mecanum / standard) closest to the requested diameter (±15 %) — mirrors catalog.wheel_for
    const want = driveType === 'mecanum' ? 'mecanum' : 'standard';
    let best = null, bestErr = null;
    byCategory(registry, 'wheel').forEach((h) => {
      const w = h.wheel || {}; if (w.type !== want || !w.diameter_m) return;
      const err = Math.abs(w.diameter_m - diameter) / diameter;
      if (err <= 0.15 && (bestErr == null || err < bestErr)) { best = h; bestErr = err; }
    });
    return best;
  }
  function railsNeeded(registry, busV, devices) {
    // devices: registry records; returns [{v, hw|null}] for each voltage other than the bus
    const need = [...new Set(devices.map(volt).filter((v) => v != null && !voltMatch(v, busV)))].sort((a, b) => a - b);
    return need.map((v) => {
      const dcdc = byCategory(registry, 'power_supply').find((h) => voltMatch(volt(h), busV) && Math.abs((h.power_supply?.output_v ?? -1) - v) < 0.5);
      return { v, hw: dcdc ? dcdc.id : null };
    });
  }

  // ------------------------------------------------------------------ Robot Definition v1 (YAML)
  const yq = (s) => /^[a-z][a-z0-9_]*$/.test(s) ? s : JSON.stringify(s);
  const yv = (x) => Array.isArray(x) ? `[${x.map((v) => (typeof v === 'number' ? v : yq(String(v)))).join(', ')}]` : x;

  function buildDefinition(d) {
    // d: normalised design object from the form (see collectDesign)
    const r = d.wheelDiameter / 2, gc = d.groundClearance, H = d.height, L = d.length;
    const hw = [];
    const zl = r4(gc + H + 0.05 - r), zc = r4(gc + H * 0.7 - r), W = d.width;
    const lidars = sensorSpots((LIDAR_LAYOUTS[d.lidarLayout] || LIDAR_LAYOUTS.front1).spots, L, W, 0.1);
    if (d.lidar) lidars.forEach((p) => hw.push({ id: `lidar_${p.pos}`, hw: d.lidar, frame: `laser_${p.pos}`, xyz: [p.x, p.y, zl], rpy: [0, 0, p.yaw] }));
    if (d.imu) hw.push({ id: 'imu', hw: d.imu, frame: 'imu_link', xyz: [0, 0, r4(gc + H / 2 - r)], rpy: [0, 0, 0] });
    const cams = sensorSpots(CAMERA_LAYOUTS[d.cameraLayout] || CAMERA_LAYOUTS.front1, L, W, 0.02);
    if (d.camera) cams.forEach((p) => hw.push({ id: `cam_${p.pos}`, hw: d.camera, frame: `camera_${p.pos}`, xyz: [p.x, 0, zc], rpy: [0, 0, p.yaw] }));
    for (let k = 0; k < d.driverCount; k++) hw.push({ id: d.driverCount > 1 ? `motor_driver_${k + 1}` : 'motor_driver', hw: d.driver });
    if (d.estop) hw.push({ id: 'estop', hw: 'generic_estop', io: 'DI1' });
    const inset = L > 0.4 ? 0.1 : 0.06;
    const casters = d.drive === 'differential' ? (CASTER_LAYOUTS[d.casterLayout] || CASTER_LAYOUTS.front_rear).map(([fx, fy]) => [r4(fx * (L / 2 - inset)), r4(fy * (d.width / 2 - inset)), 0]) : [];
    const lines = [
      `# Robot Definition v1 — drafted with TESR Robot Builder Web. Validate with: tesr-rb validate ${d.name}.robot.yaml`,
      'schema_version: 1',
      'meta:', `  name: ${d.name}`, `  package_prefix: ${d.prefix}`, `  description: ${JSON.stringify(d.description || d.name)}`,
      'target:', '  ros_distro: jazzy', '  os: ubuntu-24.04', `  compute: ${d.compute}`, `  arch: ${d.arch}`, '  deployment: docker',
      'requirements:', `  application: ${d.application}`,
      `  environment: {type: ${d.envType}, indoor: ${d.indoor}, floor: ${d.floor}, max_slope_deg: ${d.slopeDeg}${d.minAisle ? `, min_aisle_m: ${d.minAisle}` : ''}}`,
      `  payload: {max_kg: ${d.payload}, cog_offset_m: [0.0, 0.0, ${d.cogOffsetZ}]}`,
      `  motion: {v_max: ${d.vMax}, a_max: ${d.aMax}, w_max: ${d.wMax}}`,
      `  runtime_h: ${d.runtimeH}`,
      'mechanical:', `  dims_m: {length: ${L}, width: ${d.width}, height: ${H}, ground_clearance: ${gc}}`,
      `  mass_kg: {robot: ${d.robotMassManual ? d.robotMass : 'auto'}, total: auto}`,
      'drive:', `  type: ${d.drive}`,
      `  wheels: {diameter_m: ${d.wheelDiameter}, width_m: ${d.wheelWidth}, separation_m: ${d.track}${d.drive === 'mecanum' ? `, wheelbase_m: ${d.wheelbase}` : ''}}`,
    ];
    if (casters.length) { lines.push('  casters:'); casters.forEach((c) => lines.push(`    - {xyz: ${yv(c)}}`)); }
    lines.push(`  motor: {hw: ${d.motor}, count: ${d.drive === 'mecanum' ? 4 : 2}, gear_ratio: ${d.gearRatio}, driver: ${d.driver}}`);
    lines.push('hardware:');
    hw.forEach((h) => {
      const parts = [`id: ${h.id}`, `hw: ${h.hw}`];
      if (h.frame) parts.push(`frame: ${h.frame}`, 'parent: base_link', `xyz: ${yv(h.xyz)}`, `rpy: ${yv(h.rpy)}`);
      if (h.io) parts.push(`io: ${h.io}`);
      lines.push(`  - {${parts.join(', ')}}`);
    });
    const packOpts = (d.batterySeries > 1 ? `, series: ${d.batterySeries}` : '') + (d.batteryParallel > 1 ? `, parallel: ${d.batteryParallel}` : '');
    lines.push('power:', `  battery: {hw: ${d.battery}${packOpts}}`, `  bus_v: ${d.busV}`);
    if (d.rails.length) { lines.push('  rails:'); d.rails.forEach((rl) => lines.push(`    - {v: ${rl.v}${rl.hw ? `, hw: ${rl.hw}` : ''}}`)); }
    if (d.estop) lines.push('io: {DI: {1: estop}}');
    lines.push('comms: [dds, mqtt]', 'ros:', '  control: {stack: ros2_control, controller: auto}',
      '  localization: {slam: slam_toolbox, amcl: true, ekf: auto}',
      `  navigation: {profile: indoor_amr, planner: auto, controller: auto, costmap: auto, safety_margin_m: ${d.margin}, features: [manual, slam, nav, waypoints]}`,
      `  perception: {depth_to_costmap: ${d.camera ? 'true' : 'false'}}`,
      'sim: {engine: gz_harmonic, world: empty, renderer: ogre1}', 'integrations: {node_red: true, studio_pro: true}');
    return lines.join('\n') + '\n';
  }

  // ------------------------------------------------------------------ BOM
  function billOfMaterials(d, registry, catalog) {
    const ids = byId(registry), qty = new Map(), role = new Map();
    const add = (id, n, what) => { if (!id) return; qty.set(id, (qty.get(id) || 0) + n); if (!role.has(id)) role.set(id, what); };
    add(d.compute, 1, 'compute'); add(d.motor, d.drive === 'mecanum' ? 4 : 2, 'motor'); add(d.driver, d.driverCount, 'motor driver');
    const wheel = wheelFor(registry, d.drive, d.wheelDiameter);
    if (wheel) { const per = Number(wheel.wheel?.per_set || 1); add(wheel.id, Math.max(1, Math.ceil((d.drive === 'mecanum' ? 4 : 2) / per)), 'wheel'); }
    add(d.lidar, d.lidarCount || 1, 'LiDAR'); add(d.imu, 1, 'IMU'); add(d.camera, d.cameraCount || 1, 'camera'); if (d.estop) add('generic_estop', 1, 'E-stop');
    add(d.battery, (d.batterySeries || 1) * (d.batteryParallel || 1), 'battery'); d.rails.forEach((rl) => add(rl.hw, 1, `${rl.v} V rail`));
    const lines = [...qty].map(([id, n]) => {
      const rec = ids[id], p = productsFor(catalog, id)[0] || null;
      return { hwId: id, category: rec ? rec.category : '?', name: rec ? rec.name : id, qty: n, role: role.get(id), product: p,
        unitPrice: p ? p.price : null, lineTotal: p && p.price != null ? p.price * n : null };
    }).sort((a, b) => ((CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99)) || a.hwId.localeCompare(b.hwId));
    const total = lines.reduce((s, l) => s + (l.lineTotal || 0), 0);
    return { lines, total, missing: lines.filter((l) => !l.product).map((l) => l.hwId), unpriced: lines.filter((l) => l.product && l.unitPrice == null).map((l) => l.hwId) };
  }

  function bomCsv(bom) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['hw_id', 'category', 'name', 'qty', 'role', 'sku', 'unit_price_thb', 'line_total_thb', 'stock_status', 'shop_url']];
    bom.lines.forEach((l) => rows.push([l.hwId, l.category, l.name, l.qty, l.role, l.product?.sku || '', l.unitPrice ?? '', l.lineTotal ?? '', l.product ? (l.product.stock || 'listed') : 'not_in_catalog', l.product?.shop_url || '']));
    rows.push(['TOTAL', '', `${bom.missing.length} part(s) without catalog entry`, '', '', '', '', bom.total, '', '']);
    return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
  }

  const api = { sizeDrivetrain, sizeBattery, navSizing, estimateRobotMass, tipping, parseCsv, parseCatalog, catalogUrl, sheetCsvUrl,
    productsFor, motorFits, batteryFits, recommendMotors, recommendBatteries, railsNeeded, wheelFor, buildDefinition, billOfMaterials, bomCsv, byId, byCategory, volt, suggestBusV, ROLLING_RESISTANCE, CATEGORY_TH, LIDAR_LAYOUTS, CAMERA_LAYOUTS, CASTER_LAYOUTS, sensorSpots };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TESR = api;

  // ================================================================== UI (browser only)
  if (typeof document === 'undefined') return;

  const $ = (id) => document.getElementById(id);
  const num = (id) => Number($(id).value);
  const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? '—' : Number(x).toLocaleString('en-US', { maximumFractionDigits: d }));
  const thb = (x) => (x == null ? '<span class="muted">ยังไม่มีราคา</span>' : `${fmt(x, 0)} ฿`);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let registry = null, catalog = [];

  // Robot presets — pick one, then change only a few fields. Values are form ids.
  const PRESETS = {
    amr_300: { name: 'warehouse_amr_300', prefix: 'tesr_robot', description: '300 kg AMR สำหรับโลจิสติกส์ในโรงงาน', application: 'amr', envType: 'factory', floor: 'concrete', slopeDeg: 5, minAisle: 1.2,
      payload: 300, cogOffsetZ: 0.25, vMax: 1.0, aMax: 0.5, wMax: 1.0, runtimeH: 8, length: 1.0, width: 0.7, height: 0.45, groundClearance: 0.05, drive: 'differential',
      wheelDiameter: 0.16, wheelWidth: 0.05, track: 0.6, wheelbase: 0.4, gearRatio: 20, busV: 48, margin: 0.05, driverCount: 1, estop: true, lidarLayout: 'diag2', cameraLayout: 'front1', casterLayout: 'corners4' },
    service_60: { name: 'service_robot_60', prefix: 'tesr_service', description: 'หุ่นบริการ 60 kg ในโรงพยาบาล/สำนักงาน', application: 'service', envType: 'hospital', floor: 'tile', slopeDeg: 3, minAisle: 1.0,
      payload: 60, cogOffsetZ: 0.3, vMax: 0.8, aMax: 0.5, wMax: 1.2, runtimeH: 10, length: 0.6, width: 0.5, height: 0.9, groundClearance: 0.04, drive: 'differential',
      wheelDiameter: 0.15, wheelWidth: 0.04, track: 0.44, wheelbase: 0.4, gearRatio: 15, busV: 24, margin: 0.05, driverCount: 1, estop: true, lidarLayout: 'front1', cameraLayout: 'front1', casterLayout: 'front_rear' },
    edu_small: { name: 'edu_robot', prefix: 'edu_robot', description: 'หุ่นเรียนขนาดเล็กสำหรับ TESR Academy', application: 'research', envType: 'laboratory', floor: 'tile', slopeDeg: 3, minAisle: '',
      payload: 2, cogOffsetZ: 0.05, vMax: 0.5, aMax: 0.5, wMax: 1.5, runtimeH: 2, length: 0.26, width: 0.24, height: 0.10, groundClearance: 0.02, drive: 'differential',
      wheelDiameter: 0.10, wheelWidth: 0.03, track: 0.23, wheelbase: 0.2, gearRatio: 30, busV: 12, margin: 0.03, driverCount: 1, estop: false, lidarLayout: 'front1', cameraLayout: 'front1', casterLayout: 'rear1' },
    mecanum_demo: { name: 'mecanum_demo', prefix: 'mecanum_demo', description: 'หุ่น mecanum 4 ล้อ สำหรับงานวิจัย', application: 'research', envType: 'laboratory', floor: 'epoxy', slopeDeg: 2, minAisle: 1.0,
      payload: 30, cogOffsetZ: 0.15, vMax: 1.0, aMax: 0.8, wMax: 1.5, runtimeH: 4, length: 0.6, width: 0.5, height: 0.3, groundClearance: 0.05, drive: 'mecanum',
      wheelDiameter: 0.152, wheelWidth: 0.05, track: 0.44, wheelbase: 0.4, gearRatio: 15, busV: 24, margin: 0.05, driverCount: 2, estop: true, lidarLayout: 'front1', cameraLayout: 'front1', casterLayout: 'front_rear' },
  };
  function applyPreset(id) {
    const p = PRESETS[id]; if (!p) return;
    Object.entries(p).forEach(([k, v]) => { const el = $(k); if (!el) return; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; });
    ['motor', 'driver', 'battery', 'busV'].forEach((k) => { delete $(k).dataset.user; });
    $('robotMassManual').checked = false;
    populateSelects(); render();
  }

  const SHOP_SEARCH = 'https://tesrshop.com/?s=';
  function shopLink(hwId, label = 'TESR Shop') {
    const p = productsFor(catalog, hwId)[0];
    if (!p) return `<span class="tag warn" title="เพิ่มแถว hardware_ref=${esc(hwId)} ใน Google Sheet">ไม่มีในแคตตาล็อก</span>`;
    const price = p.price != null ? `${fmt(p.price, 0)} ฿` : 'ยังไม่มีราคา';
    const stock = p.stock ? `<span class="tag ${p.stock === 'in_stock' ? 'ok' : 'warn'}">${esc(p.stock)}</span>` : '';
    return p.shop_url ? `<a class="shop" href="${esc(p.shop_url)}" target="_blank" rel="noopener">🛒 ${label} · ${price}</a> ${stock}` : `<span class="tag">${price}</span> ${stock}`;
  }
  function shopUrlCell(hwId, name) {
    const p = productsFor(catalog, hwId)[0];
    if (p && p.shop_url) return `<a class="shop" href="${esc(p.shop_url)}" target="_blank" rel="noopener">🛒 สั่งซื้อ</a>`;
    return `<a class="shop ghost" href="${SHOP_SEARCH}${encodeURIComponent(name)}" target="_blank" rel="noopener" title="ยังไม่มีลิงก์ตรง — ค้นหาใน TESR Shop">🔍 ค้นหาใน Shop</a>`;
  }

  function fillSelect(id, records, opts = {}) {
    const el = $(id), prev = el.value;
    el.innerHTML = (opts.none ? `<option value="">— ${opts.none} —</option>` : '') +
      records.map((h) => `<option value="${h.id}">${esc(h.name)}${opts.suffix ? ' ' + esc(opts.suffix(h)) : ''}</option>`).join('');
    if (prev && [...el.options].some((o) => o.value === prev)) el.value = prev;
    else if (opts.defaultFirst && records.length) el.value = records[0].id;
  }

  function populateSelects() {
    const busV = num('busV');
    fillSelect('compute', byCategory(registry, 'compute'));
    fillSelect('lidar', byCategory(registry, 'lidar'), { none: 'ไม่มี', defaultFirst: true, suffix: (h) => `(${h.sensor?.range_m ?? '?'} m)` });
    fillSelect('camera', byCategory(registry, 'depth_camera'), { none: 'ไม่มี' });
    fillSelect('imu', byCategory(registry, 'imu'), { none: 'ไม่มี', defaultFirst: true });
    // Never lock a part to a voltage: list everything, matching voltage first, and say what the mismatch means.
    const byMatch = (vfn) => (a, b) => voltMatch(vfn(b), busV) - voltMatch(vfn(a), busV);
    const vnote = (v) => (v == null ? '' : voltMatch(v, busV) ? ' ✓' : ` — ${v} V, ไม่ตรง bus ${busV} V`);
    const bnote = (h) => { const v = h.battery?.nominal_v ?? volt(h); if (v == null || voltMatch(v, busV)) return ' ✓'; const n = Math.round(busV / v); return n >= 2 && voltMatch(v * n, busV) ? ` — ต่ออนุกรม ${n} ก้อน = ${(v * n).toFixed(0)} V` : ` — ${v} V ต้องมี DC-DC`; };
    fillSelect('motor', byCategory(registry, 'motor').sort(byMatch(volt)), { suffix: (h) => `(${volt(h) ?? '?'} V, ${h.motor?.rated_torque_nm ?? '?'} Nm)${vnote(volt(h))}` });
    fillSelect('driver', byCategory(registry, 'motor_driver').sort(byMatch(volt)), { suffix: (h) => `(${volt(h) ?? '?'} V)${vnote(volt(h))}` });
    fillSelect('battery', byCategory(registry, 'battery').sort(byMatch((h) => h.battery?.nominal_v ?? volt(h))), { suffix: (h) => `(${h.battery?.nominal_v ?? '?'} V ${h.battery?.capacity_ah ?? '?'} Ah)${bnote(h)}` });
    // pre-select parts that match the bus voltage
    const pick = (id, cat, vfn) => { if ($(id).dataset.user) return; const m = byCategory(registry, cat).find((h) => vfn(h) != null && voltMatch(vfn(h), busV)); if (m) $(id).value = m.id; };
    pick('motor', 'motor', volt); pick('driver', 'motor_driver', volt); pick('battery', 'battery', (h) => h.battery?.nominal_v ?? volt(h));
  }

  function collectDesign() {
    const ids = byId(registry);
    const drive = $('drive').value, busV = num('busV');
    const lidarLayout = $('lidarLayout')?.value || 'front1', cameraLayout = $('cameraLayout')?.value || 'front1', casterLayout = $('casterLayout')?.value || 'front_rear';
    const lidarCount = (LIDAR_LAYOUTS[lidarLayout] || LIDAR_LAYOUTS.front1).spots.length, cameraCount = $('camera').value ? (CAMERA_LAYOUTS[cameraLayout] || CAMERA_LAYOUTS.front1).length : 0;
    const devices = [ids[$('compute').value], ...Array(lidarCount).fill(ids[$('lidar').value]), ...Array(cameraCount).fill(ids[$('camera').value]), ids[$('imu').value]].filter(Boolean);
    const d = {
      name: ($('name').value || 'my_robot').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, 'r'),
      prefix: ($('prefix').value || 'tesr_robot').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      description: $('description').value,
      application: $('application').value, envType: $('envType').value, indoor: $('envType').value !== 'outdoor', floor: $('floor').value,
      slopeDeg: num('slopeDeg'), minAisle: num('minAisle') || null,
      payload: num('payload'), cogOffsetZ: num('cogOffsetZ'), vMax: num('vMax'), aMax: num('aMax'), wMax: num('wMax'), runtimeH: num('runtimeH'),
      length: num('length'), width: num('width'), height: num('height'), groundClearance: num('groundClearance'),
      drive, wheelDiameter: num('wheelDiameter'), wheelWidth: num('wheelWidth'), track: num('track'), wheelbase: num('wheelbase'),
      gearRatio: num('gearRatio'), busV, margin: num('margin'),
      compute: $('compute').value, arch: ids[$('compute').value]?.compute?.arch || 'arm64',
      lidar: $('lidar').value || null, camera: $('camera').value || null, imu: $('imu').value || null, estop: $('estop').checked,
      motor: $('motor').value, driver: $('driver').value, driverCount: Math.max(1, Math.round(num('driverCount') || (drive === 'mecanum' ? 2 : 1))),
      battery: $('battery').value, robotMassManual: $('robotMassManual').checked, lidarCount, cameraCount, lidarLayout, cameraLayout, casterLayout,
    };
    const nDrive = drive === 'mecanum' ? 4 : 2;
    const hwMass = devices.reduce((s, h) => s + (h.mass_kg || 0), 0) + (ids[d.motor]?.mass_kg || 0) * nDrive + (ids[d.battery]?.mass_kg || 0) * (ids[d.battery]?.battery?.nominal_v ? Math.max(1, Math.round(busV / ids[d.battery].battery.nominal_v)) : 1) + (ids[d.driver]?.mass_kg || 0) * d.driverCount;
    d.robotMass = d.robotMassManual ? num('robotMass') : estimateRobotMass(hwMass, d.length, d.width, d.height);
    d.totalMass = d.robotMass + d.payload;
    d.electronicsW = devices.reduce((s, h) => s + (h.electrical?.typical_w || 0), 0) || 30;
    d.rails = railsNeeded(registry, busV, devices.concat([ids[d.driver]].filter(Boolean)));
    d.devices = devices; d.nDrive = nDrive;
    const bat = ids[d.battery], nominal = bat?.battery?.nominal_v ?? (bat ? volt(bat) : null);
    d.batterySeries = nominal ? Math.max(1, Math.round(busV / nominal)) : 1;
    d.batteryPackV = nominal ? nominal * d.batterySeries : busV;
    d.batteryNominalV = nominal; d.batteryParallel = 1; // parallel set in render() once the required Ah is known
    d.lidarSpots = d.lidar ? sensorSpots((LIDAR_LAYOUTS[lidarLayout] || LIDAR_LAYOUTS.front1).spots, d.length, d.width, 0.1) : [];
    d.cameraSpots = d.camera ? sensorSpots(CAMERA_LAYOUTS[cameraLayout] || CAMERA_LAYOUTS.front1, d.length, d.width, 0.02) : [];
    d.casterSpots = drive === 'differential' ? (CASTER_LAYOUTS[casterLayout] || CASTER_LAYOUTS.front_rear).map(([fx, fy]) => ({ x: fx * (d.length / 2 - (d.length > 0.4 ? 0.1 : 0.06)), y: fy * (d.width / 2 - (d.length > 0.4 ? 0.1 : 0.06)) })) : [];
    return d;
  }

  function render() {
    if (!registry) return;
    const ids = byId(registry);
    const d = collectDesign();
    $('wheelbaseRow').style.display = d.drive === 'mecanum' ? '' : 'none';
    $('robotMass').disabled = !d.robotMassManual;
    if (!d.robotMassManual) $('robotMass').value = d.robotMass;

    // --- drivetrain
    const dt = sizeDrivetrain({ totalMass: d.totalMass, vMax: d.vMax, aMax: d.aMax, wheelDiameter: d.wheelDiameter, nDrive: d.nDrive, gearRatio: d.gearRatio, slopeDeg: d.slopeDeg, floor: d.floor });
    const sv = suggestBusV(dt.powerElecPeak, d.totalMass);
    if (!$('busV').dataset.user && d.busV !== sv) { $('busV').value = sv; populateSelects(); return render(); }
    document.querySelectorAll('#voltCards .vcard').forEach((c) => { c.classList.toggle('sel', Number(c.dataset.v) === d.busV); c.classList.toggle('rec', Number(c.dataset.v) === sv); });
    const tp = tipping({ height: d.height, cogOffsetZ: d.cogOffsetZ, groundClearance: d.groundClearance, robotMass: d.robotMass, payload: d.payload, track: d.track, vMax: d.vMax, wMax: d.wMax });
    $('drivetrainOut').innerHTML = `
      <table class="kv">
        <tr><td>มวลรวม (robot ${fmt(d.robotMass, 1)} + payload ${fmt(d.payload, 0)})</td><td><b>${fmt(d.totalMass, 1)} kg</b></td></tr>
        <tr><td>แรงขับต่อเนื่อง (พื้น ${esc(d.floor)}, C_rr ${dt.cRr})</td><td>${fmt(dt.forceCont, 1)} N</td></tr>
        <tr><td>แรงขับสูงสุด (ทางลาด ${d.slopeDeg}° + a ${d.aMax} m/s²)</td><td>${fmt(dt.forcePeak, 1)} N</td></tr>
        <tr><td>ทอร์กที่ล้อ ต่อเนื่อง / สูงสุด (ต่อล้อขับ ${d.nDrive} ล้อ)</td><td>${fmt(dt.wheelTorqueCont)} / ${fmt(dt.wheelTorquePeak)} N·m</td></tr>
        <tr><td>ทอร์กที่มอเตอร์ ต่อเนื่อง / สูงสุด (i = ${d.gearRatio}, η 0.85)</td><td>${fmt(dt.motorTorqueCont, 3)} / ${fmt(dt.motorTorquePeak, 3)} N·m</td></tr>
        <tr><td><b>มอเตอร์ที่ต้องการ</b> rated ≥ (SF 1.3) / peak ≥ / rpm ≥</td><td><b>${fmt(dt.requiredMotorRatedTorque, 3)} N·m / ${fmt(dt.requiredMotorPeakTorque, 3)} N·m / ${fmt(dt.motorRpm, 0)} rpm</b></td></tr>
        <tr><td>กำลังกล ต่อเนื่อง / สูงสุด (ทั้งหุ่น)</td><td>${fmt(dt.powerMechCont, 0)} / ${fmt(dt.powerMechPeak, 0)} W</td></tr>
        <tr><td>เสถียรภาพ: a_tip ${fmt(tp.aTip)} m/s² vs a_lat ${fmt(tp.aLat)} m/s² (CoG ${fmt(tp.hCog)} m)</td><td>${tp.ok ? '<span class="tag ok">ผ่าน</span>' : '<span class="tag err">เสี่ยงพลิก — ลด w_max/v_max หรือขยาย track</span>'}</td></tr>
      </table>`;
    const motors = recommendMotors(registry, d.busV, dt);
    $('motorRec').innerHTML = motors.length ? motors.map((m) => `
      <div class="rec ${m.fits && m.voltOk ? 'fit' : ''}">
        <div><b>${esc(m.hw.name)}</b> <span class="muted">${volt(m.hw) ?? '?'} V · rated ${m.hw.motor?.rated_torque_nm ?? '?'} N·m · peak ${m.hw.motor?.peak_torque_nm ?? '?'} N·m · ${m.hw.motor?.rated_rpm ?? '?'} rpm</span>
          ${m.fits && m.voltOk ? '<span class="tag ok">เหมาะ</span>' : m.fits ? '<span class="tag warn">แรงบิดพอ แต่แรงดันไม่ตรง bus</span>' : '<span class="tag">แรงบิด/รอบไม่พอ</span>'}</div>
        <div>${shopLink(m.hw.id)} <button class="mini" data-pick="motor" data-id="${m.hw.id}">เลือก</button></div></div>`).join('') : '<p class="muted">ไม่มีมอเตอร์ใน registry</p>';

    // --- power
    const pw = sizeBattery({ powerMechCont: dt.powerMechCont, powerElecPeak: dt.powerElecPeak, runtimeH: d.runtimeH, busV: d.busV, electronicsW: d.electronicsW });
    $('powerOut').innerHTML = `
      <table class="kv">
        <tr><td>อิเล็กทรอนิกส์ (compute + sensors จาก registry)</td><td>${fmt(pw.electronicsW, 0)} W</td></tr>
        <tr><td>ขับเคลื่อนเฉลี่ย (duty 0.6, η 0.85)</td><td>${fmt(pw.driveAvgW, 0)} W</td></tr>
        <tr><td>พลังงานที่ต้องการ ${d.runtimeH} h (DoD 0.8)</td><td><b>${fmt(pw.energyWh, 0)} Wh</b></td></tr>
        <tr><td><b>ความจุแบตเตอรี่ที่ ${d.busV} V</b></td><td><b>${fmt(pw.capacityAh, 1)} Ah</b></td></tr>
        <tr><td>กระแสสูงสุดที่แบตต้องจ่ายได้</td><td>${fmt(pw.peakCurrentA, 1)} A</td></tr>
      </table>`;
    const batCap = ids[d.battery]?.battery?.capacity_ah;
    d.batteryParallel = batCap ? Math.min(4, Math.max(1, Math.ceil(pw.capacityAh / batCap))) : 1;
    const bats = recommendBatteries(registry, d.busV, pw);
    $('batteryRec').innerHTML = bats.map((b) => `
      <div class="rec ${b.fits ? 'fit' : ''}">
        <div><b>${esc(b.hw.name)}</b> <span class="muted">${b.hw.battery?.nominal_v ?? '?'} V · ${b.hw.battery?.capacity_ah ?? '?'} Ah · ${b.hw.battery?.max_discharge_a ?? '?'} A · ${b.hw.mass_kg} kg</span>
          ${b.fits ? '<span class="tag ok">เหมาะ</span>' : (() => { const v = b.hw.battery?.nominal_v ?? volt(b.hw); const n = v ? Math.round(d.busV / v) : 1; return n >= 2 && voltMatch(v * n, d.busV) ? `<span class="tag warn">ต่ออนุกรม ${n} ก้อน</span>` : '<span class="tag">แรงดัน/ความจุ/กระแสไม่พอ</span>'; })()}</div>
        <div>${shopLink(b.hw.id)} <button class="mini" data-pick="battery" data-id="${b.hw.id}">เลือก</button></div></div>`).join('');

    // --- compatibility (subset of the Python rules)
    const compute = ids[d.compute], issues = [];
    const usb3 = d.devices.filter((h) => (h.interfaces || []).includes('usb3')).length;
    if (compute?.compute && usb3 > compute.compute.usb3_ports) issues.push(`⚠️ อุปกรณ์ USB 3 ${usb3} ตัว แต่ ${esc(compute.name)} มี ${compute.compute.usb3_ports} พอร์ต — ใช้ hub หรือย้ายไป Ethernet`);
    if (!voltMatch(volt(ids[d.driver]), d.busV)) issues.push(`⚠️ ไดรเวอร์ ${esc(ids[d.driver]?.name)} เป็น ${volt(ids[d.driver])} V บน bus ${d.busV} V — ใช้ได้ถ้ามี DC-DC ${d.busV}→${volt(ids[d.driver])} V หรือเลือกไดรเวอร์ที่ตรงแรงดัน`);
    if (!voltMatch(volt(ids[d.motor]), d.busV)) issues.push(`⚠️ มอเตอร์ ${esc(ids[d.motor]?.name)} เป็น ${volt(ids[d.motor])} V บน bus ${d.busV} V — ต้องมีไดรเวอร์ที่จ่าย ${volt(ids[d.motor])} V ให้มอเตอร์ (step-down) มิฉะนั้นมอเตอร์เสียหาย`);
    if (d.batteryNominalV && !voltMatch(d.batteryNominalV, d.busV)) {
      issues.push(voltMatch(d.batteryPackV, d.busV)
        ? `✅ แบต ${d.batteryNominalV} V ต่ออนุกรม ${d.batterySeries} ก้อน = ${d.batteryPackV.toFixed(0)} V ตรง bus (BOM คิดให้ ${d.batterySeries * d.batteryParallel} ก้อน)`
        : `⚠️ แบต ${d.batteryNominalV} V ×${d.batterySeries} = ${d.batteryPackV.toFixed(0)} V ไม่ตรง bus ${d.busV} V — ต้องมี DC-DC ระหว่างแบตกับ bus`);
    }
    if (d.batteryParallel > 1) issues.push(`ℹ️ ความจุแบต 1 ก้อนไม่พอ ${d.runtimeH} h — ต่อขนาน ${d.batteryParallel} ชุด (BOM คิดให้แล้ว)`);
    d.rails.forEach((rl) => issues.push(rl.hw ? `✅ ต้องมี rail ${rl.v} V → ใช้ ${esc(ids[rl.hw].name)}` : `🔴 ต้องมี rail ${rl.v} V แต่ไม่มี DC-DC ${d.busV}→${rl.v} V ใน registry`));
    if (!d.lidar) issues.push('🔴 SLAM/Nav ต้องมี 2D LiDAR');
    if (d.payload > 50 && !d.estop) issues.push('🔴 payload > 50 kg ต้องมี E-stop (R-SAFE-001)');
    if (d.minAisle && d.width + 2 * d.margin > d.minAisle) issues.push(`🔴 หุ่นกว้าง ${fmt(d.width + 2 * d.margin)} m แต่ช่องทางแคบสุด ${d.minAisle} m`);
    if (d.track / 2 + d.wheelWidth / 2 > d.width / 2 + 0.005) issues.push('⚠️ ล้อยื่นออกนอกตัวถัง (R-MECH-001)');
    $('compatOut').innerHTML = (issues.length ? issues : ['✅ ไม่พบปัญหาความเข้ากันได้ในชุดตรวจของหน้าเว็บ']).map((s) => `<div>${s}</div>`).join('') +
      '<p class="muted">ชุดตรวจเต็ม 16 rules อยู่ในขั้น 3 (สร้าง ROS 2 workspace)</p>';

    // --- nav sizing
    const nav = navSizing({ length: d.length, width: d.width, margin: d.margin, vMax: d.vMax, aMax: d.aMax, lidarRange: ids[d.lidar]?.sensor?.range_m });
    $('navOut').innerHTML = `<table class="kv">
        <tr><td>footprint (base_link, margin ${d.margin} m)</td><td><code>${JSON.stringify(nav.footprint)}</code></td></tr>
        <tr><td>inflation_radius (circumscribed ${nav.circumscribedRadius} + 0.10)</td><td>${nav.inflationRadius} m</td></tr>
        <tr><td>local costmap</td><td>${nav.localCostmap} m @ ${nav.resolution} m</td></tr>
        <tr><td>obstacle_range / raytrace_range (LiDAR ${ids[d.lidar]?.sensor?.range_m ?? '—'} m)</td><td>${nav.obstacleRange} / ${nav.raytraceRange} m</td></tr>
      </table>`;

    // --- definition + BOM
    const yaml = buildDefinition(d);
    $('yamlOut').value = yaml;
    $('cmdOut').textContent = `tesr-rb validate ${d.name}.robot.yaml\ntesr-rb generate ${d.name}.robot.yaml -o ${d.name}_ws\ntesr-rb bom ${d.name}.robot.yaml -o ${d.name}_bom.csv`;
    const bom = billOfMaterials(d, registry, catalog);
    let lastCat = null;
    $('bomOut').innerHTML = `<table class="bom"><thead><tr><th>จำนวน</th><th>รายการ</th><th>ราคา/หน่วย</th><th>รวม</th><th>สต๊อก</th><th>ลิงก์ TESR Shop</th></tr></thead><tbody>` +
      bom.lines.map((l) => {
        const head = l.category !== lastCat ? `<tr class="cat"><td colspan="6">${esc(CATEGORY_TH[l.category] || l.category)}</td></tr>` : '';
        lastCat = l.category;
        const stock = l.product && l.product.stock ? `<span class="tag ${l.product.stock === 'in_stock' ? 'ok' : 'warn'}">${esc(l.product.stock)}</span>` : '<span class="muted">—</span>';
        return head + `<tr><td>${l.qty}</td><td>${esc(l.name)}<br><span class="muted">${esc(l.role)} · ${esc(l.hwId)}</span></td><td>${thb(l.unitPrice)}</td><td>${thb(l.lineTotal)}</td><td>${stock}</td><td>${shopUrlCell(l.hwId, l.name)}</td></tr>`;
      }).join('') +
      `</tbody><tfoot><tr><td colspan="3">รวม (เฉพาะรายการที่มีราคา)</td><td colspan="3"><b>${fmt(bom.total, 0)} ฿</b></td></tr></tfoot></table>` +
      (bom.missing.length ? `<p class="muted">รายการที่ต้องเพิ่มใน Google Sheet (hardware_ref): <code>${bom.missing.join(', ')}</code></p>` : '') +
      (bom.unpriced.length ? `<p class="muted">มีในแคตตาล็อกแต่ยังไม่มีราคา: <code>${bom.unpriced.join(', ')}</code></p>` : '');
    if ($('kpi')) {
      $('kpi').innerHTML = `
        <div><b>${fmt(d.totalMass, 0)} kg</b><span>มวลรวม (หุ่น ${fmt(d.robotMass, 0)} + payload ${fmt(d.payload, 0)})</span></div>
        <div><b>${fmt(dt.requiredMotorRatedTorque, 2)} N·m</b><span>มอเตอร์ ×${d.nDrive} ที่ ≥ ${fmt(dt.motorRpm, 0)} rpm (i = ${d.gearRatio})</span></div>
        <div><b>${fmt(pw.capacityAh, 0)} Ah</b><span>ต้องการที่ ${d.busV} V / ${d.runtimeH} h${d.batterySeries > 1 || d.batteryParallel > 1 ? ` · แพ็ก ${d.batteryNominalV} V ×${d.batterySeries} อนุกรม${d.batteryParallel > 1 ? ` ×${d.batteryParallel} ขนาน` : ''}` : ''}</span></div>
        <div><b>${d.busV} V</b><span>ระบบไฟ${d.busV === sv ? ' (แนะนำ)' : ` · แนะนำ ${sv} V`} · สูงสุด ${fmt(dt.powerMechPeak, 0)} W / ${fmt(pw.peakCurrentA, 0)} A</span></div>
        <div><b>${d.lidarCount} LiDAR · ${d.cameraCount} กล้อง</b><span>costmap ${nav.localCostmap} m · inflation ${nav.inflationRadius} m</span></div>
        <div><b>${bom.total ? fmt(bom.total, 0) + ' ฿' : '—'}</b><span>ราคาอุปกรณ์${bom.total ? ` (มีราคา ${bom.lines.length - bom.missing.length - bom.unpriced.length}/${bom.lines.length})` : ' — รอทีมเติมราคา'}</span></div>`;
    }
    root.__tesr = { d, dt, pw, nav, yaml, bom };
  }

  function download(name, text, type = 'text/plain') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function loadCatalog(ref) {
    const url = catalogUrl(ref);
    const status = $('catalogStatus');
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      catalog = parseCatalog(await res.text());
      const priced = catalog.filter((p) => p.price != null).length;
      status.innerHTML = `✅ แคตตาล็อก ${catalog.length} รายการ (มีราคา ${priced}) จาก <code>${esc(url.length > 70 ? url.slice(0, 70) + '…' : url)}</code>`;
      if (ref) localStorage.setItem('tesr_rb_catalog', ref);
    } catch (e) {
      catalog = [];
      status.innerHTML = `⚠️ โหลดแคตตาล็อกไม่ได้ (${esc(e.message)}) — แสดงผลโดยไม่มีราคา/ลิงก์`;
    }
    render();
  }

  async function init() {
    const res = await fetch('./data/registry.json', { cache: 'no-store' });
    registry = await res.json();
    $('registryStatus').textContent = `registry ${registry.hardware.length} รายการ · hash ${registry.registry_hash} · engine ${registry.generator}`;
    populateSelects();
    const params = new URLSearchParams(location.search);
    const ref = params.get('catalog') || localStorage.getItem('tesr_rb_catalog') || '';
    $('catalogRef').value = ref;
    await loadCatalog(ref);
    document.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', (ev) => {
      if (['motor', 'driver', 'battery', 'busV'].includes(ev.target.id)) ev.target.dataset.user = '1';
      if (ev.target.id === 'busV') populateSelects();
      render();
    }));
    document.body.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-pick]');
      if (b) { $(b.dataset.pick).value = b.dataset.id; $(b.dataset.pick).dataset.user = '1'; render(); }
    });
    document.querySelectorAll('#voltCards .vcard').forEach((c) => c.addEventListener('click', () => { $('busV').value = c.dataset.v; $('busV').dataset.user = '1'; populateSelects(); render(); }));
    $('loadCatalog').onclick = () => loadCatalog($('catalogRef').value.trim());
    $('downloadYaml').onclick = () => download(`${root.__tesr.d.name}.robot.yaml`, root.__tesr.yaml, 'text/yaml');
    $('copyYaml').onclick = () => navigator.clipboard.writeText(root.__tesr.yaml).then(() => { $('copyYaml').textContent = 'คัดลอกแล้ว ✓'; setTimeout(() => ($('copyYaml').textContent = 'คัดลอก YAML'), 1500); });
    $('downloadBom').onclick = () => download(`${root.__tesr.d.name}_bom.csv`, bomCsv(root.__tesr.bom), 'text/csv');
    const handoff = (page) => (ev) => {
      if (ev) ev.preventDefault();
      const project = JSON.parse(localStorage.getItem('tesr_rb_project') || '{}');
      Object.assign(project, { design: root.__tesr.d, drivetrain: root.__tesr.dt, power: root.__tesr.pw, nav: root.__tesr.nav, yaml: root.__tesr.yaml, saved_at: new Date().toISOString() });
      localStorage.setItem('tesr_rb_project', JSON.stringify(project));
      location.href = page;
    };
    $('toModel').onclick = handoff('./model.html');
    if ($('toBuild')) $('toBuild').onclick = handoff('./build.html');
    if ($('preset')) $('preset').addEventListener('change', () => applyPreset($('preset').value));
    $('downloadDesign').onclick = () => download(`${root.__tesr.d.name}_design.json`, JSON.stringify({ design: root.__tesr.d, drivetrain: root.__tesr.dt, power: root.__tesr.pw, nav: root.__tesr.nav }, null, 2), 'application/json');
  }

  document.addEventListener('DOMContentLoaded', () => init().catch((e) => { $('registryStatus').textContent = `โหลด data/registry.json ไม่ได้: ${e.message} — เปิดผ่าน http server (python3 -m http.server -d docs)`; }));
})(typeof globalThis !== 'undefined' ? globalThis : this);
