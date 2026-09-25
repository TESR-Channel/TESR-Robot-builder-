/* TESR Robot Builder — Garage 3D mission mode (docs/garage-game.js)
 * Your robot, driven with its real numbers, in the same 12 × 8 m warehouse the Gazebo package uses:
 *  - top speed / acceleration / turn rate from the mission spec, slower if the motor is too weak
 *  - battery drains from the real pack: a robot that meets its runtime requirement lasts the full mission
 *  - every LiDAR you mounted ray-casts the warehouse and paints a SLAM-style map (same idea as slam_toolbox)
 *  - collisions use the real footprint, so a robot that is too wide cannot fit through the narrow aisle
 * Five missions, stars, XP, pilot level and achievements (stored in this browser only).
 */
const W8 = () => window.__garage;
const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const SAVE = 'tesr_rb_game';

// ------------------------------------------------------------------ world (matches <prefix>_gazebo/worlds/tesr_arena.sdf)
const ARENA_W = 12, ARENA_H = 8;
const BOXES = [ // cx, cy, sx, sy, height, kind, yaw
  [0, 4, 12, 0.15, 1.2, 'wall', 0], [0, -4, 12, 0.15, 1.2, 'wall', 0], [6, 0, 0.15, 8, 1.2, 'wall', 0], [-6, 0, 0.15, 8, 1.2, 'wall', 0],
  [-1.5, 1.2, 0.15, 3.2, 1.2, 'wall', 0],
  [2.5, 2.6, 3.0, 0.8, 1.8, 'rack', 0], [2.5, -2.6, 3.0, 0.8, 1.8, 'rack', 0], [-4.0, -2.6, 2.4, 0.8, 1.8, 'rack', 0],
  [0.8, -0.9, 1.0, 0.8, 0.7, 'pallet', 0], [4.2, 0.3, 1.0, 0.8, 0.7, 'pallet', 0.5], [-3.8, 2.2, 1.0, 0.8, 0.7, 'pallet', 0.2],
].map(([cx, cy, sx, sy, h, kind, yaw]) => ({ cx, cy, hx: sx / 2, hy: sy / 2, h, kind, yaw, c: Math.cos(yaw), s: Math.sin(yaw) }));
const SPAWN = [-4.5, 0, 0];
const A = [-5.2, 3.2], B = [5.0, -3.1], C = [0.2, 3.2];

const MISSIONS = [
  { id: 'm1', icon: '🎓', name: 'ขับครั้งแรก', brief: 'ขับไปแตะวงแหวนทองให้ครบ 3 จุดตามลำดับ', tip: 'W/S เดินหน้า-ถอย · A/D เลี้ยว · C สลับกล้อง', type: 'route',
    points: [[-2.6, -1.3], [-2.4, 1.3], [-5.0, -1.2]], stop: false, stars: [30, 50, 100] },
  { id: 'm2', icon: '🗺️', name: 'นักทำแผนที่', brief: 'ขับสำรวจให้ LiDAR เห็นพื้นที่โกดัง 92%', tip: 'นี่คือสิ่งที่ slam_toolbox ทำในขั้น 3 — LiDAR หลายตัว/มุมกว้างทำแผนที่เร็วกว่า', type: 'map',
    target: 0.92, stars: [45, 75, 130] },
  { id: 'm3', icon: '📦', name: 'ส่งของด่วน', brief: 'รับของที่ A แล้วไปส่งที่ B', tip: 'จอดนิ่งในวงแหวน 1 วินาทีเพื่อยก/วางของ', type: 'route',
    points: [[...A, 'A', 'pick'], [...B, 'B', 'drop']], stop: true, stars: [60, 95, 160] },
  { id: 'm4', icon: '🧭', name: 'ช่องแคบ', brief: 'ลอดช่องระหว่างผนังกั้นกับกำแพงเหนือ (กว้าง 1.1 m)', tip: 'หุ่นที่กว้างเกินช่องต้องอ้อมไกล — ความกว้างที่ออกแบบใน Garage มีผลจริง', type: 'route',
    points: [[-2.6, 3.35], [-0.5, 3.35], [0.4, 1.6]], stop: false, stars: [35, 60, 110] },
  { id: 'm5', icon: '🔋', name: 'มาราธอนแบต', brief: 'ส่งของ 2 รอบ: A→B แล้ว A→C ก่อนแบตหมด', tip: 'หุ่นที่แบตได้ตามชั่วโมงใช้งานที่ตั้งไว้จะเหลือแบตพอ — ถ้าไม่พอ กลับไปเพิ่มแบต/ต่อขนาน', type: 'route',
    points: [[...A, 'A', 'pick'], [...B, 'B', 'drop'], [...A, 'A', 'pick'], [...C, 'C', 'drop']], stop: true, stars: [150, 210, 320], battery: true },
];
const ACH = {
  first_drive: ['🚗', 'ออกตัว', 'จบภารกิจแรก'], no_crash: ['🛡️', 'ไร้รอยขีดข่วน', 'จบภารกิจโดยไม่ชนเลย'], three_star: ['⭐', 'สามดาว', 'ได้ 3 ดาวในภารกิจใดก็ได้'],
  cartographer: ['🗺️', 'นักทำแผนที่', 'ทำแผนที่ได้ 95% ขึ้นไป'], heavy: ['🏋️', 'สายแบก', 'ส่งของสำเร็จด้วยหุ่นบรรทุก ≥ 300 kg'],
  speedster: ['⚡', 'สายซิ่ง', 'จบภารกิจด้วยหุ่นความเร็ว ≥ 1.5 m/s'], omni: ['🧭', 'สไลด์ข้าง', 'จบภารกิจด้วยหุ่น mecanum'],
  marathon: ['🔋', 'แบตอึด', 'จบมาราธอนโดยแบตเหลือ ≥ 30%'], all_clear: ['🏆', 'ผู้พิชิตโกดัง', 'ผ่านครบ 5 ภารกิจ'],
};

let save = { xp: 0, best: {}, ach: [] };
try { save = Object.assign(save, JSON.parse(localStorage.getItem(SAVE) || '{}')); } catch (_) { /* fresh */ }
const store = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (_) { /* ignore */ } };
const level = (xp) => Math.floor(Math.sqrt(xp / 120)) + 1;
const lvlXp = (l) => 120 * (l - 1) * (l - 1);

// ------------------------------------------------------------------ sound (tiny WebAudio synth, no files)
let actx = null;
function beep(f = 660, d = 0.09, type = 'square', v = 0.04, slide = 0) {
  try {
    actx = actx || new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
  } catch (_) { /* audio blocked */ }
}
const sfx = {
  tick: () => beep(880, 0.06), go: () => beep(1320, 0.25, 'square', 0.05, 200), point: () => { beep(988, 0.08); setTimeout(() => beep(1319, 0.12), 80); },
  crash: () => beep(140, 0.25, 'sawtooth', 0.07, -80), load: () => beep(523, 0.1, 'triangle', 0.06),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.06), i * 120)), fail: () => beep(300, 0.5, 'sawtooth', 0.05, -200),
};

// ------------------------------------------------------------------ geometry helpers (2D, metres, world frame)
function obbOverlap(a, b) { // SAT for two oriented rectangles {cx,cy,hx,hy,c,s}
  const axes = [[a.c, a.s], [-a.s, a.c], [b.c, b.s], [-b.s, b.c]];
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  for (const [ax, ay] of axes) {
    const ra = a.hx * Math.abs(a.c * ax + a.s * ay) + a.hy * Math.abs(-a.s * ax + a.c * ay);
    const rb = b.hx * Math.abs(b.c * ax + b.s * ay) + b.hy * Math.abs(-b.s * ax + b.c * ay);
    if (Math.abs(dx * ax + dy * ay) > ra + rb) return false;
  }
  return true;
}
function rayBox(ox, oy, dx, dy, b, maxT) { // slab test in the box frame
  const px = ox - b.cx, py = oy - b.cy;
  const lx = b.c * px + b.s * py, ly = -b.s * px + b.c * py, ldx = b.c * dx + b.s * dy, ldy = -b.s * dx + b.c * dy;
  let t0 = 0, t1 = maxT;
  for (const [o, d, h] of [[lx, ldx, b.hx], [ly, ldy, b.hy]]) {
    if (Math.abs(d) < 1e-9) { if (o < -h || o > h) return Infinity; continue; }
    let ta = (-h - o) / d, tb = (h - o) / d; if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return Infinity;
  }
  return t0;
}
const inBox = (x, y, b, pad = 0) => { const px = x - b.cx, py = y - b.cy; return Math.abs(b.c * px + b.s * py) <= b.hx + pad && Math.abs(-b.s * px + b.c * py) <= b.hy + pad; };

// ------------------------------------------------------------------ occupancy grid (0.1 m cells) — the "SLAM" map
const RES = 0.1, GW = ARENA_W / RES, GH = ARENA_H / RES;
let grid = new Uint8Array(GW * GH), reachable = 0, knownFree = 0;
(function countReachable() {
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = -ARENA_W / 2 + (i + 0.5) * RES, y = -ARENA_H / 2 + (j + 0.5) * RES;
    if (!BOXES.some((b) => inBox(x, y, b))) reachable++;
  }
})();
const cell = (x, y) => { const i = Math.floor((x + ARENA_W / 2) / RES), j = Math.floor((y + ARENA_H / 2) / RES); return i >= 0 && j >= 0 && i < GW && j < GH ? j * GW + i : -1; };
function markFree(k) { if (k >= 0 && grid[k] === 0) { grid[k] = 1; knownFree++; } }

// ------------------------------------------------------------------ state
let active = false, arena = null, mission = null, run = null, camMode = 'chase', joy = { x: 0, y: 0 };
let rayGeo = null, rayLines = null, markers = [], cargo = null, rayTimer = 0, miniTimer = 0;
const keys = new Set();

function robotSpec() {
  const g = W8(), s = g.state, dv = g.dv, m = s.mission, c = s.chassis;
  const weak = dv.motor && !dv.motorOk;
  const L = c.shape === 'round' ? c.width : c.length;
  const Wd = Math.max(c.width, s.drive.track + s.drive.wheelWidth);
  const life = clamp(300 * (dv.runtimeAch || 0) / Math.max(m.runtimeH, 0.1), 20, 900); // seconds of mission time for a full pack
  return {
    vmax: m.vMax * (weak ? 0.7 : 1), wmax: m.wMax * (weak ? 0.7 : 1), amax: m.aMax * (weak ? 0.5 : 1) * 1.6, // ×1.6 keeps short missions snappy
    holo: s.drive.type === 'mecanum', hx: L / 2 + 0.02, hy: Wd / 2 + 0.02, life, weak,
    lidars: dv.sensors.filter((x) => x.category === 'lidar').map((x) => ({ x: x.pos[0], y: x.pos[1], yaw: x.yaw || 0, fov: (x.fov || 360) * Math.PI / 180, range: Math.min(x.rec?.sensor?.range_m || 8, 8) })),
    payload: m.payload, vRated: m.vMax,
  };
}

// ------------------------------------------------------------------ 3D arena
function buildArena() {
  const g = W8(), T = g.THREE, grp = new T.Group();
  const floor = new T.Mesh(new T.PlaneGeometry(ARENA_W, ARENA_H), new T.MeshStandardMaterial({ color: 0x1a1a20, metalness: 0.3, roughness: 0.75 }));
  floor.position.z = 0.0008; floor.receiveShadow = true; grp.add(floor);
  const lines = new T.GridHelper(12, 12, 0x5a1414, 0x2a2a33); lines.rotation.x = Math.PI / 2; lines.scale.set(1, 1, 8 / 12); lines.position.z = 0.002;
  lines.material.transparent = true; lines.material.opacity = 0.5; grp.add(lines);
  // safety lane markings
  const lane = new T.MeshBasicMaterial({ color: 0xe8c21a, transparent: true, opacity: 0.55 });
  [[0, 0.05, 10.5, 0.05], [-3.5, 0.05, 0.05, 6.8]].forEach(([x, y, sx, sy]) => { const m = new T.Mesh(new T.PlaneGeometry(sx, sy), lane); m.position.set(x, y, 0.003); grp.add(m); });
  const mats = {
    wall: new T.MeshStandardMaterial({ color: 0x3b3d46, metalness: 0.2, roughness: 0.8 }),
    rack: new T.MeshStandardMaterial({ color: 0x6d0a0a, metalness: 0.5, roughness: 0.45 }),
    pallet: new T.MeshStandardMaterial({ color: 0xa4843c, metalness: 0.1, roughness: 0.7 }),
    shelf: new T.MeshStandardMaterial({ color: 0xc9a84c, metalness: 0.8, roughness: 0.3 }),
    crate: new T.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.9 }),
  };
  BOXES.forEach((b) => {
    const m = new T.Mesh(new T.BoxGeometry(b.hx * 2, b.hy * 2, b.h), b.kind === 'rack' ? mats.rack : b.kind === 'pallet' ? mats.pallet : mats.wall);
    m.position.set(b.cx, b.cy, b.h / 2); m.rotation.z = b.yaw; m.castShadow = true; m.receiveShadow = true;
    if (b.kind === 'rack') { m.scale.z = 0.08; m.position.z = 0.07; } // rack = base + posts + shelves
    grp.add(m);
    if (b.kind === 'rack') {
      [0.6, 1.2, 1.78].forEach((z) => { const sh = new T.Mesh(new T.BoxGeometry(b.hx * 2, b.hy * 2, 0.04), mats.shelf); sh.position.set(b.cx, b.cy, z); grp.add(sh); });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const p = new T.Mesh(new T.BoxGeometry(0.06, 0.06, b.h), mats.rack); p.position.set(b.cx + sx * (b.hx - 0.03), b.cy + sy * (b.hy - 0.03), b.h / 2); grp.add(p); });
      for (let k = 0; k < 5; k++) { const cr = new T.Mesh(new T.BoxGeometry(0.42, 0.5, 0.36), mats.crate); cr.position.set(b.cx - b.hx + 0.35 + k * (b.hx * 2 - 0.7) / 4, b.cy, 0.62 + 0.2 + (k % 2) * 0.6); grp.add(cr); }
    }
  });
  const edge = new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2a2a, emissiveIntensity: 2.5, toneMapped: false });
  BOXES.filter((b) => b.kind === 'wall').forEach((b) => { const e = new T.Mesh(new T.BoxGeometry(b.hx * 2 + 0.01, b.hy * 2 + 0.01, 0.025), edge); e.position.set(b.cx, b.cy, b.h); grp.add(e); });
  rayGeo = new T.BufferGeometry(); rayGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(4 * 90 * 6), 3));
  rayLines = new T.LineSegments(rayGeo, new T.LineBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.35, toneMapped: false }));
  rayLines.frustumCulled = false; grp.add(rayLines);
  g.scene.add(grp);
  return grp;
}
function labelSprite(T, text) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = 'rgba(8,8,12,.85)'; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill(); x.lineWidth = 6; x.strokeStyle = '#e9c86a'; x.stroke();
  x.fillStyle = '#ffe08a'; x.font = 'bold 64px "Chakra Petch", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 70);
  const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false })); sp.scale.set(0.45, 0.45, 1); return sp;
}
function buildMarkers() {
  const g = W8(), T = g.THREE;
  markers.forEach((m) => arena.remove(m.grp)); markers = [];
  (mission.points || []).forEach((p, i) => {
    const grp = new T.Group(); grp.position.set(p[0], p[1], 0);
    const ring = new T.Mesh(new T.RingGeometry(0.48, 0.56, 64), new T.MeshBasicMaterial({ color: 0xe9c86a, transparent: true, opacity: 0.9, toneMapped: false, side: T.DoubleSide }));
    ring.position.z = 0.01; grp.add(ring);
    const prog = new T.Mesh(new T.RingGeometry(0.36, 0.46, 64, 1, Math.PI / 2, 0.001), new T.MeshBasicMaterial({ color: 0x7fd39b, toneMapped: false, side: T.DoubleSide }));
    prog.position.z = 0.012; grp.add(prog);
    const beam = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 2.2, 40, 1, true).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: 0xc9a84c, transparent: true, opacity: 0.08, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    beam.position.z = 1.1; grp.add(beam);
    const lab = labelSprite(T, p[2] || String(i + 1)); lab.position.z = 1.5; grp.add(lab);
    arena.add(grp); markers.push({ grp, ring, prog, beam, p });
  });
}

// ------------------------------------------------------------------ UI
function injectUI() {
  if ($('gmStyle')) return;
  const css = document.createElement('style'); css.id = 'gmStyle';
  css.textContent = `
  .gm-hud { position:absolute; inset:0; pointer-events:none; z-index:3; font-family:'IBM Plex Sans Thai', sans-serif; }
  .gm-top { position:absolute; left:50%; top:12px; transform:translateX(-50%); display:flex; gap:10px; align-items:center; background:rgba(8,8,12,.82); border:1px solid rgba(201,168,76,.45); padding:8px 16px; clip-path:polygon(12px 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0 50%); }
  .gm-top b { font-family:'Chakra Petch'; color:#ffe08a; letter-spacing:1px; } .gm-top .t { font-family:'Chakra Petch'; font-size:22px; color:#fff; min-width:70px; text-align:center; }
  .gm-top .o { font-size:12.5px; color:#cfcac0; max-width:340px; } .gm-top .cr { color:#ff8a80; font-family:'Chakra Petch'; }
  .gm-mini { position:absolute; right:12px; top:12px; background:rgba(8,8,12,.85); border:1px solid rgba(201,168,76,.45); padding:6px; border-radius:8px; }
  .gm-mini canvas { display:block; width:240px; height:160px; image-rendering:pixelated; } .gm-mini div { font-family:'Chakra Petch'; font-size:11px; color:#e9c86a; display:flex; justify-content:space-between; margin-top:3px; }
  .gm-gauges { position:absolute; left:12px; bottom:14px; width:230px; background:rgba(8,8,12,.82); border:1px solid rgba(201,168,76,.35); border-radius:10px; padding:8px 10px; }
  .gm-gauges .row { display:flex; justify-content:space-between; font-size:11.5px; color:#cfcac0; } .gm-gauges .row b { font-family:'Chakra Petch'; color:#ffe08a; }
  .gm-bar { height:8px; background:#1b1b22; border-radius:4px; overflow:hidden; margin:3px 0 7px; } .gm-bar i { display:block; height:100%; background:linear-gradient(90deg,#b3171b,#C9A84C); transition:width .15s; }
  .gm-bar.bat i { background:linear-gradient(90deg,#2e8b57,#7fd39b); } .gm-bar.bat.low i { background:linear-gradient(90deg,#8B0000,#ff5a4a); }
  .gm-warn { color:#ffb35a; font-size:11.5px; }
  .gm-center { position:absolute; left:50%; top:42%; transform:translate(-50%,-50%); font-family:'Chakra Petch'; font-size:96px; color:#ffe08a; text-shadow:0 0 40px rgba(201,168,76,.8); pointer-events:none; }
  .gm-flash { position:absolute; inset:0; background:radial-gradient(ellipse at center, transparent 40%, rgba(179,23,27,.55)); opacity:0; transition:opacity .25s; pointer-events:none; }
  .gm-modal { position:absolute; inset:0; z-index:6; display:grid; place-items:center; background:rgba(4,4,8,.72); backdrop-filter:blur(4px); pointer-events:auto; overflow:auto; }
  .gm-card { width:min(820px, 94%); background:linear-gradient(180deg,#15151c,#0a0a0f); border:1px solid rgba(201,168,76,.45); padding:20px 22px; clip-path:polygon(0 16px,16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%); }
  .gm-card h2 { font-family:'Chakra Petch'; letter-spacing:2px; color:#ffe08a; margin:0 0 4px; font-size:22px; }
  .gm-pilot { display:flex; gap:14px; align-items:center; margin:8px 0 14px; } .gm-pilot .lv { font-family:'Chakra Petch'; font-size:28px; color:#ffe08a; }
  .gm-xp { flex:1; } .gm-xp .gm-bar { height:10px; }
  .gm-ms { display:grid; grid-template-columns:repeat(auto-fill,minmax(145px,1fr)); gap:10px; }
  .gm-m { border:1px solid #2a2a31; background:#0d0d12; border-radius:10px; padding:10px; cursor:pointer; text-align:center; transition:.15s; position:relative; }
  .gm-m:hover { border-color:#e9c86a; transform:translateY(-3px); box-shadow:0 10px 30px rgba(201,168,76,.15); }
  .gm-m .ic { font-size:34px; } .gm-m b { display:block; font-family:'Chakra Petch'; margin:4px 0 2px; } .gm-m small { color:#9a978f; font-size:11.5px; display:block; min-height:30px; }
  .gm-m .st { color:#ffe08a; letter-spacing:2px; font-size:15px; } .gm-m.lock { opacity:.4; cursor:not-allowed; } .gm-m.lock::after { content:'🔒'; position:absolute; top:6px; right:8px; }
  .gm-ach { display:flex; flex-wrap:wrap; gap:6px; margin-top:14px; } .gm-ach span { font-size:12px; border:1px solid #2a2a31; border-radius:14px; padding:2px 9px; color:#6d6a63; }
  .gm-ach span.on { color:#ffe08a; border-color:rgba(201,168,76,.6); background:rgba(201,168,76,.08); }
  .gm-row { display:flex; gap:8px; justify-content:flex-end; margin-top:14px; flex-wrap:wrap; }
  .gm-res { text-align:center; } .gm-res .big { font-size:52px; letter-spacing:8px; color:#ffe08a; text-shadow:0 0 30px rgba(201,168,76,.6); }
  .gm-res .kv { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:12px 0; } .gm-res .kv div { background:#0d0d12; border:1px solid #2a2a31; border-radius:8px; padding:8px; }
  .gm-res .kv b { display:block; font-family:'Chakra Petch'; color:#ffe08a; font-size:18px; } .gm-res .kv span { color:#9a978f; font-size:11.5px; }
  .gm-toast { position:absolute; left:50%; top:78px; transform:translateX(-50%); background:linear-gradient(90deg,#8B0000,#b3171b); color:#fff; padding:7px 16px; border-radius:20px; font-size:13px; box-shadow:0 0 30px rgba(179,23,27,.5); animation:gmT 2.8s forwards; }
  @keyframes gmT { 0%{opacity:0;transform:translate(-50%,-10px)} 10%,85%{opacity:1;transform:translate(-50%,0)} 100%{opacity:0} }
  .gm-joy { position:absolute; left:18px; bottom:130px; width:120px; height:120px; border-radius:50%; border:2px solid rgba(201,168,76,.5); background:rgba(8,8,12,.45); pointer-events:auto; touch-action:none; display:none; }
  .gm-joy i { position:absolute; left:40px; top:40px; width:40px; height:40px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#ffe08a,#C9A84C); }
  @media (pointer:coarse) { .gm-joy { display:block; } }
  @media (max-width:760px) { .gm-mini canvas { width:150px; height:100px; } .gm-top .o { display:none; } }
  #tools button[data-tool="mission"] { background:linear-gradient(180deg,#ff3b3b,#8B0000); color:#fff; font-weight:600; box-shadow:0 0 16px rgba(179,23,27,.6); }
  .pilot-chip { margin-left:6px; font-family:'Chakra Petch'; font-size:11px; color:#ffe08a; border:1px solid rgba(201,168,76,.5); border-radius:10px; padding:0 7px; }`;
  document.head.appendChild(css);
  const stage = document.querySelector('.stage');
  const hud = document.createElement('div'); hud.className = 'gm-hud'; hud.id = 'gmHud'; hud.hidden = true;
  hud.innerHTML = `<div class="gm-flash" id="gmFlash"></div>
    <div class="gm-top"><span id="gmIcon">🎯</span><div><b id="gmName"></b><div class="o" id="gmObj"></div></div><div class="t" id="gmTime">0.0</div><div class="cr" id="gmCrash">💥 0</div></div>
    <div class="gm-mini"><canvas id="gmMap" width="240" height="160"></canvas><div><span>SLAM MAP</span><span id="gmMapped">0%</span></div></div>
    <div class="gm-gauges"><div class="row"><span>ความเร็ว</span><b id="gmSpd">0.00 m/s</b></div><div class="gm-bar"><i id="gmSpdBar"></i></div>
      <div class="row"><span>แบตเตอรี่</span><b id="gmBatT">100%</b></div><div class="gm-bar bat" id="gmBatBox"><i id="gmBat"></i></div>
      <div class="gm-warn" id="gmWarn"></div><div class="row"><span>Esc ออก · C กล้อง · R เริ่มใหม่</span></div></div>
    <div class="gm-joy" id="gmJoy"><i></i></div><div class="gm-center" id="gmCenter"></div>`;
  stage.appendChild(hud);
  const modal = document.createElement('div'); modal.className = 'gm-modal'; modal.id = 'gmModal'; modal.hidden = true; stage.appendChild(modal);
  const btn = document.createElement('button'); btn.dataset.tool = 'mission'; btn.title = 'เล่นภารกิจกับหุ่นตัวนี้'; btn.textContent = '🏁 ภารกิจ';
  const tools = $('tools'); tools.insertBefore(btn, tools.firstChild);
  btn.addEventListener('click', (e) => { e.stopPropagation(); openMenu(); }, true);
  const chip = document.createElement('span'); chip.className = 'pilot-chip'; chip.id = 'pilotChip';
  const sub = $('robotSub'); if (sub && sub.parentNode) sub.parentNode.appendChild(chip);
  updateChip();
  // touch joystick
  const joyEl = $('gmJoy'), knob = joyEl.querySelector('i');
  const move = (e) => { const r = joyEl.getBoundingClientRect(); let x = (e.clientX - r.left - 60) / 50, y = (e.clientY - r.top - 60) / 50; const n = Math.hypot(x, y); if (n > 1) { x /= n; y /= n; } joy = { x, y: -y }; knob.style.transform = `translate(${x * 40}px, ${y * 40}px)`; };
  joyEl.addEventListener('pointerdown', (e) => { joyEl.setPointerCapture(e.pointerId); move(e); });
  joyEl.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') move(e); });
  ['pointerup', 'pointercancel'].forEach((t) => joyEl.addEventListener(t, () => { joy = { x: 0, y: 0 }; knob.style.transform = ''; }));
}
function updateChip() { const c = $('pilotChip'); if (c) c.textContent = `PILOT LV ${level(save.xp)} · ${save.xp} XP`; }
function toast(msg) { const t = document.createElement('div'); t.className = 'gm-toast'; t.textContent = msg; ($('gmHud').hidden ? document.querySelector('.stage') : $('gmHud')).appendChild(t); setTimeout(() => t.remove(), 2900); }
const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const unlocked = (i) => i === 0 || (save.best[MISSIONS[i - 1].id]?.stars || 0) > 0;

function openMenu() {
  if (!W8() || !W8().dv) return;
  if (active) stopMission();
  const l = level(save.xp), next = lvlXp(l + 1), cur = lvlXp(l), sp = robotSpec(), s = W8().state, dv = W8().dv;
  const m = $('gmModal'); m.hidden = false;
  m.innerHTML = `<div class="gm-card"><h2>🏁 ภารกิจในโกดัง TESR</h2>
    <div class="muted" style="font-size:12.5px">ขับ <b>${s.name}</b> ด้วยสเปกจริง: ${sp.vmax.toFixed(2)} m/s · ${s.drive.type === 'mecanum' ? 'mecanum (Q/E สไลด์)' : 'differential'} · LiDAR ${sp.lidars.length} ตัว · แบต ${Math.round(sp.life)} วินาทีภารกิจ · RANK ${dv.rank}${sp.weak ? ' · <span class="gm-warn">มอเตอร์แรงไม่พอ — เร่งช้า</span>' : ''}<br>โกดังเดียวกับ Gazebo ใน package <code>_gazebo</code> — เล่นที่นี่ แล้วไปรันจริงในขั้น 3</div>
    <div class="gm-pilot"><div class="lv">LV ${l}</div><div class="gm-xp"><div style="font-size:12px;color:#9a978f">${save.xp} / ${next} XP ถึง LV ${l + 1}</div><div class="gm-bar"><i style="width:${Math.round(100 * (save.xp - cur) / Math.max(next - cur, 1))}%"></i></div></div></div>
    <div class="gm-ms">${MISSIONS.map((ms, i) => `<div class="gm-m ${unlocked(i) ? '' : 'lock'}" data-m="${i}"><div class="ic">${ms.icon}</div><b>${i + 1}. ${ms.name}</b><small>${ms.brief}</small><div class="st">${starStr(save.best[ms.id]?.stars || 0)}</div>${save.best[ms.id] ? `<small>ดีที่สุด ${save.best[ms.id].time.toFixed(1)} s</small>` : ''}</div>`).join('')}</div>
    <div class="gm-ach">${Object.entries(ACH).map(([k, [ic, n, d]]) => `<span class="${save.ach.includes(k) ? 'on' : ''}" title="${d}">${ic} ${n}</span>`).join('')}</div>
    <div class="gm-row"><button class="ghost" id="gmClose">กลับไปแต่งหุ่น</button></div></div>`;
  m.querySelectorAll('.gm-m').forEach((el) => el.addEventListener('click', () => { const i = Number(el.dataset.m); if (unlocked(i)) startMission(i); else toast('🔒 ผ่านภารกิจก่อนหน้าให้ได้อย่างน้อย 1 ดาวก่อน'); }));
  $('gmClose').onclick = () => { m.hidden = true; };
}

// ------------------------------------------------------------------ mission lifecycle
function startMission(i) {
  const g = W8(); mission = MISSIONS[i];
  $('gmModal').hidden = true;
  if (!active) {
    active = true; window.__gameActive = true;
    run = { savedScan: g.flags.scan, savedDrive: g.flags.drive };
    if (g.flags.drive) g.toggleTool('drive');
    g.select(null); g.tc.detach(); g.controls.enabled = false;
    g.stageStatic.visible = false; g.stageFx.visible = false;
    g.flags.scan = false; g.buildRobot();
    arena = buildArena();
  }
  const sp = robotSpec();
  Object.assign(run, { i, sp, t: 0, started: false, countdown: 3.2, crashes: 0, crashCool: 0, v: 0, w: 0, vy: 0, bat: 1, idx: 0, hold: 0, carrying: false, done: false, maxSpeedSeen: 0 });
  grid = new Uint8Array(GW * GH); knownFree = 0;
  g.driveRoot.position.set(SPAWN[0], SPAWN[1], 0); g.driveRoot.rotation.set(0, 0, SPAWN[2]);
  setCargo(false); buildMarkers();
  $('gmHud').hidden = false; $('gmIcon').textContent = mission.icon; $('gmName').textContent = mission.name;
  $('gmWarn').textContent = sp.weak ? '⚠ มอเตอร์แรงไม่พอ — ความเร่งลดลง' : (mission.id === 'm4' && sp.hy * 2 > 1.05 ? `⚠ หุ่นกว้าง ${(sp.hy * 2).toFixed(2)} m เกินช่อง 1.1 m — ต้องอ้อม` : '');
  if (!sp.lidars.length) $('gmWarn').textContent += ' ⚠ ไม่มี LiDAR — แผนที่จะว่าง';
  updateObjective(); camMode = 'chase';
  g.banner('');
  toast(`${mission.icon} ${mission.brief} — ${mission.tip}`);
}
function stopMission() {
  const g = W8(); if (!active) return;
  active = false; window.__gameActive = false;
  $('gmHud').hidden = true; setCargo(false);
  if (arena) { g.scene.remove(arena); arena.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); arena = null; markers = []; }
  g.stageStatic.visible = true; g.stageFx.visible = true; g.controls.enabled = true;
  g.flags.scan = run ? run.savedScan : true; g.buildRobot();
  g.driveRoot.position.set(0, 0, 0); g.driveRoot.rotation.set(0, 0, 0); g.fitView();
}
function setCargo(on) {
  const g = W8(), T = g.THREE;
  if (cargo) { g.driveRoot.remove(cargo); cargo = null; }
  if (!on) return;
  const s = g.state, c = s.chassis, top = c.clearance + c.height + 0.01, L = (c.shape === 'round' ? c.width : c.length) * 0.7, Wd = c.width * 0.7, h = Math.min(0.5, 0.12 + s.mission.payload / 900);
  cargo = new T.Group();
  const box = new T.Mesh(new T.BoxGeometry(L, Wd, h), new T.MeshStandardMaterial({ color: 0x9a7a3a, roughness: 0.8 })); box.position.z = top + h / 2; box.castShadow = true; cargo.add(box);
  const tape = new T.Mesh(new T.BoxGeometry(L * 1.01, 0.05, h * 1.01), new T.MeshStandardMaterial({ color: 0x8B0000 })); tape.position.z = top + h / 2; cargo.add(tape);
  g.driveRoot.add(cargo);
}
function updateObjective() {
  if (!mission) return;
  if (mission.type === 'map') { $('gmObj').textContent = `สำรวจให้ได้ ${Math.round(mission.target * 100)}% ของโกดัง`; return; }
  const p = mission.points[run.idx];
  if (!p) return;
  const tag = p[3] === 'pick' ? `ไปรับของที่ ${p[2]}` : p[3] === 'drop' ? `ไปส่งของที่ ${p[2]}` : `ไปจุดที่ ${run.idx + 1}/${mission.points.length}`;
  $('gmObj').textContent = `${tag}${mission.stop ? ' · จอดนิ่ง 1 วินาที' : ''}`;
  markers.forEach((m, k) => { const on = k === run.idx; m.grp.visible = mission.type !== 'map' && k >= run.idx && (on || k === run.idx + 1); m.ring.material.opacity = on ? 0.95 : 0.3; m.beam.material.opacity = on ? 0.12 : 0.03; });
}

function finish(ok, why) {
  if (run.done) return; run.done = true;
  const ms = mission, sp = run.sp, t = run.t;
  let stars = 0;
  if (ok) { stars = t <= ms.stars[0] ? 3 : t <= ms.stars[1] ? 2 : 1; if (run.crashes > 2) stars = Math.max(1, stars - 1); }
  const gained = ok ? 40 + stars * 40 + (run.crashes === 0 ? 40 : 0) + (ms.id === 'm5' ? Math.round(run.bat * 60) : 0) : 10;
  const before = level(save.xp);
  save.xp += gained;
  const prev = save.best[ms.id];
  if (ok && (!prev || stars > prev.stars || (stars === prev.stars && t < prev.time))) save.best[ms.id] = { stars, time: t };
  const newAch = [];
  const give = (k) => { if (!save.ach.includes(k)) { save.ach.push(k); newAch.push(k); } };
  if (ok) {
    give('first_drive'); if (run.crashes === 0) give('no_crash'); if (stars === 3) give('three_star');
    if (ms.type === 'map' && knownFree / reachable >= 0.95) give('cartographer');
    if (ms.id === 'm3' || ms.id === 'm5') { if (sp.payload >= 300) give('heavy'); }
    if (sp.vRated >= 1.5) give('speedster'); if (sp.holo) give('omni'); if (ms.id === 'm5' && run.bat >= 0.3) give('marathon');
    if (MISSIONS.every((x) => (save.best[x.id]?.stars || 0) > 0)) give('all_clear');
  }
  store(); updateChip();
  ok ? sfx.win() : sfx.fail();
  const lvUp = level(save.xp) > before;
  const i = run.i, hasNext = i + 1 < MISSIONS.length && unlocked(i + 1);
  const m = $('gmModal'); m.hidden = false;
  m.innerHTML = `<div class="gm-card gm-res"><h2>${ok ? 'ภารกิจสำเร็จ!' : 'ภารกิจล้มเหลว'}</h2><div class="muted">${ms.icon} ${ms.name}${why ? ` — ${why}` : ''}</div>
    <div class="big">${starStr(stars)}</div>
    <div class="kv"><div><b>${t.toFixed(1)} s</b><span>เวลา (3★ ≤ ${ms.stars[0]} s)</span></div><div><b>${run.crashes}</b><span>ครั้งที่ชน</span></div>
      <div><b>${Math.round(run.bat * 100)}%</b><span>แบตเหลือ</span></div><div><b>+${gained} XP</b><span>${lvUp ? `🎉 เลื่อนเป็น LV ${level(save.xp)}` : `LV ${level(save.xp)}`}</span></div></div>
    ${newAch.length ? `<div class="gm-ach" style="justify-content:center">${newAch.map((k) => `<span class="on">🏅 ${ACH[k][0]} ${ACH[k][1]} — ${ACH[k][2]}</span>`).join('')}</div>` : ''}
    <div class="muted" style="font-size:12.5px;margin-top:10px">${adviceFor(ok, why)}</div>
    <div class="gm-row" style="justify-content:center"><button class="ghost" id="gmMenu">เมนูภารกิจ</button><button class="ghost" id="gmGarage">กลับไปแต่งหุ่น</button><button id="gmRetry">↻ เล่นอีกครั้ง</button>${ok && hasNext ? '<button class="gold" id="gmNext">ภารกิจถัดไป →</button>' : ''}</div></div>`;
  $('gmMenu').onclick = openMenu; $('gmGarage').onclick = () => { m.hidden = true; stopMission(); };
  $('gmRetry').onclick = () => startMission(i); if ($('gmNext')) $('gmNext').onclick = () => startMission(i + 1);
}
function adviceFor(ok, why) {
  const sp = run.sp;
  if (!ok && /แบต/.test(why || '')) return '💡 แบตหมดก่อนจบ: ในแท็บพลังงานเลือกแบตก้อนใหญ่ขึ้น หรือเพิ่มการต่อขนาน — ชั่วโมงใช้งานจริงจะขึ้นตาม';
  if (sp.weak) return '💡 มอเตอร์แรงไม่พอสำหรับน้ำหนักนี้ — เพิ่มอัตราทดเกียร์หรือเลือกมอเตอร์ใหญ่ขึ้นในแท็บขับเคลื่อน';
  if (mission.type === 'map' && sp.lidars.length < 2) return '💡 ลองติด LiDAR แบบเฉียง 2 ตัว (KURO-X) — มองได้ 360° ทำแผนที่เร็วขึ้นมาก';
  if (run.crashes > 2) return '💡 ชนบ่อย: ลดความเร็วสูงสุดหรือเพิ่ม safety margin — ใน Nav2 ค่า inflation จะกันไม่ให้หุ่นเฉียดแบบนี้';
  return ok ? '💡 หุ่นแบบนี้พร้อมไปขั้น 3 — ได้ workspace ที่รันโกดังเดียวกันนี้ใน Gazebo + Nav2' : '💡 ลองอีกครั้ง หรือกลับไปปรับหุ่นใน Garage';
}

// ------------------------------------------------------------------ per-frame
function collides(x, y, yaw) {
  const sp = run.sp, me = { cx: x, cy: y, hx: sp.hx, hy: sp.hy, c: Math.cos(yaw), s: Math.sin(yaw) };
  return BOXES.some((b) => obbOverlap(me, b));
}
function lidarScan(g) {
  const sp = run.sp, pos = rayGeo.attributes.position.array, dr = g.driveRoot, x0 = dr.position.x, y0 = dr.position.y, yaw = dr.rotation.z, c = Math.cos(yaw), s = Math.sin(yaw);
  let n = 0;
  sp.lidars.slice(0, 4).forEach((L) => {
    const ox = x0 + c * L.x - s * L.y, oy = y0 + s * L.x + c * L.y, rays = 90;
    for (let k = 0; k < rays; k++) {
      const a = yaw + L.yaw - L.fov / 2 + (L.fov * (k + 0.5)) / rays, dx = Math.cos(a), dy = Math.sin(a);
      let hit = L.range;
      for (const b of BOXES) { const tt = rayBox(ox, oy, dx, dy, b, hit); if (tt < hit) hit = tt; }
      for (let d = 0; d < hit - RES * 0.5; d += RES * 0.7) markFree(cell(ox + dx * d, oy + dy * d));
      if (hit < L.range) { const kk = cell(ox + dx * (hit + 0.02), oy + dy * (hit + 0.02)); if (kk >= 0) grid[kk] = 2; }
      pos.set([ox, oy, 0.25, ox + dx * hit, oy + dy * hit, 0.25], n * 6); n++;
    }
  });
  for (let k = n * 6; k < pos.length; k++) pos[k] = 0;
  rayGeo.attributes.position.needsUpdate = true;
}
function drawMini(g) {
  const cv = $('gmMap'), ctx = cv.getContext('2d'), img = ctx.createImageData(GW, GH), d = img.data;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const v = grid[j * GW + i], o = ((GH - 1 - j) * GW + i) * 4;
    const col = v === 2 ? [233, 200, 106] : v === 1 ? [70, 72, 84] : [12, 12, 16];
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  const off = drawMini.off || (drawMini.off = document.createElement('canvas')); off.width = GW; off.height = GH; off.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, cv.width, cv.height);
  const sx = cv.width / ARENA_W, sy = cv.height / ARENA_H, px = (x) => (x + ARENA_W / 2) * sx, py = (y) => (ARENA_H / 2 - y) * sy;
  if (mission.type !== 'map') mission.points.forEach((p, k) => { if (k < run.idx) return; ctx.strokeStyle = k === run.idx ? '#ffe08a' : 'rgba(233,200,106,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(p[0]), py(p[1]), 5, 0, Math.PI * 2); ctx.stroke(); });
  const dr = g.driveRoot, x = px(dr.position.x), y = py(dr.position.y), a = -dr.rotation.z;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, 5); ctx.lineTo(-5, -5); ctx.closePath(); ctx.fill(); ctx.restore();
  $('gmMapped').textContent = `${Math.round(100 * knownFree / reachable)}%`;
}

window.__gameTick = function (dt) {
  if (!active || !run) return false;
  const g = W8(), sp = run.sp, dr = g.driveRoot, cam = g.camera;
  // camera: chase or top-down
  const yaw = dr.rotation.z, p = dr.position, span = Math.max(sp.hx, sp.hy);
  if (camMode === 'chase') {
    const back = Math.max(2.0, span * 5), up = Math.max(1.3, span * 3);
    const want = new g.THREE.Vector3(p.x - Math.cos(yaw) * back, p.y - Math.sin(yaw) * back, up);
    cam.position.lerp(want, Math.min(1, dt * 4)); cam.up.set(0, 0, 1); cam.lookAt(p.x + Math.cos(yaw) * 1.2, p.y + Math.sin(yaw) * 1.2, 0.3);
  } else {
    cam.position.lerp(new g.THREE.Vector3(p.x, p.y - 0.01, 9), Math.min(1, dt * 3)); cam.up.set(0, 1, 0); cam.lookAt(p.x, p.y, 0);
  }
  if (run.shake > 0) { run.shake -= dt; cam.position.x += (Math.random() - 0.5) * 0.06; cam.position.y += (Math.random() - 0.5) * 0.06; }
  markers.forEach((m, k) => { m.ring.rotation.z += dt * (k === run.idx ? 1.5 : 0.4); m.grp.children[3].position.z = 1.5 + Math.sin(performance.now() / 300 + k) * 0.06; });
  if (run.done) return true;
  // countdown
  if (!run.started) {
    const before = Math.ceil(run.countdown); run.countdown -= dt; const now = Math.ceil(run.countdown);
    $('gmCenter').textContent = run.countdown > 0.2 ? String(Math.max(1, now - 0)) : 'GO!';
    if (now !== before && now > 0) sfx.tick();
    if (run.countdown <= 0) { run.started = true; sfx.go(); setTimeout(() => { if ($('gmCenter').textContent === 'GO!') $('gmCenter').textContent = ''; }, 600); }
    lidarScan(g); drawMini(g);
    return true;
  }
  run.t += dt;
  // drive with the robot's real limits
  const k = (c) => (keys.has(c) ? 1 : 0);
  const fwd = clamp(k('w') - k('s') + joy.y, -1, 1), turn = clamp(k('a') - k('d') - joy.x, -1, 1), strafe = sp.holo ? k('q') - k('e') : 0;
  const approach = (cur, tgt, rate) => cur + clamp(tgt - cur, -rate * dt, rate * dt);
  run.v = approach(run.v, fwd * sp.vmax, sp.amax * (fwd === 0 ? 1.6 : 1));
  run.w = approach(run.w, turn * sp.wmax, sp.wmax * 4);
  run.vy = approach(run.vy, strafe * sp.vmax * 0.8, sp.amax);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const nx = p.x + (run.v * c - run.vy * s) * dt, ny = p.y + (run.v * s + run.vy * c) * dt, nyaw = yaw + run.w * dt;
  run.crashCool -= dt;
  if (collides(nx, ny, nyaw)) {
    if (!collides(nx, p.y, yaw)) { p.x = nx; run.v *= 0.5; } else if (!collides(p.x, ny, yaw)) { p.y = ny; run.v *= 0.5; } // slide along walls
    else { run.v = -run.v * 0.2; run.vy = 0; }
    run.w = 0;
    if (run.crashCool <= 0 && Math.abs(run.v) + Math.abs(run.vy) > 0.02) { run.crashes++; run.crashCool = 0.6; run.shake = 0.25; sfx.crash(); $('gmFlash').style.opacity = 1; setTimeout(() => ($('gmFlash').style.opacity = 0), 180); }
  } else { p.x = nx; p.y = ny; dr.rotation.z = nyaw; }
  g.spinWheels(run.v, run.w, run.vy, dt);
  // battery: full pack lasts sp.life seconds at average use (40 % idle draw + 60 % scaled by speed)
  const sf = (Math.abs(run.v) + Math.abs(run.vy)) / Math.max(sp.vmax, 0.01);
  run.bat = Math.max(0, run.bat - dt * (0.4 + 0.6 * sf) / (0.76 * sp.life) * (run.carrying ? 1.15 : 1));
  // lidar + map at ~15 Hz
  rayTimer -= dt; if (rayTimer <= 0) { rayTimer = 1 / 15; lidarScan(g); }
  miniTimer -= dt; if (miniTimer <= 0) { miniTimer = 1 / 10; drawMini(g); }
  // objectives
  if (mission.type === 'map') {
    if (knownFree / reachable >= mission.target) finish(true);
  } else {
    const pt = mission.points[run.idx], mk = markers[run.idx], dist = Math.hypot(p.x - pt[0], p.y - pt[1]);
    if (dist < 0.55) {
      const still = Math.abs(run.v) + Math.abs(run.vy) < 0.08;
      if (!mission.stop) run.hold = 1; else if (still) run.hold += dt; else run.hold = Math.max(0, run.hold - dt);
      mk.prog.geometry.dispose(); mk.prog.geometry = new g.THREE.RingGeometry(0.36, 0.46, 64, 1, Math.PI / 2, Math.max(0.001, Math.PI * 2 * Math.min(run.hold, 1)));
      if (run.hold >= 1) {
        if (pt[3] === 'pick') { run.carrying = true; setCargo(true); sfx.load(); toast(`📦 รับของที่ ${pt[2]} แล้ว`); }
        else if (pt[3] === 'drop') { run.carrying = false; setCargo(false); sfx.load(); toast(`✅ ส่งของที่ ${pt[2]} แล้ว`); }
        else sfx.point();
        run.idx++; run.hold = 0;
        if (run.idx >= mission.points.length) finish(true); else updateObjective();
      }
    } else if (run.hold > 0) { run.hold = 0; mk.prog.geometry.dispose(); mk.prog.geometry = new g.THREE.RingGeometry(0.36, 0.46, 64, 1, Math.PI / 2, 0.001); }
  }
  if (!run.done && run.bat <= 0) finish(false, 'แบตหมดกลางทาง');
  // HUD
  const spd = Math.hypot(run.v, run.vy);
  run.maxSpeedSeen = Math.max(run.maxSpeedSeen, spd);
  $('gmTime').textContent = run.t.toFixed(1); $('gmCrash').textContent = `💥 ${run.crashes}`;
  $('gmSpd').textContent = `${spd.toFixed(2)} m/s`; $('gmSpdBar').style.width = `${Math.round(100 * spd / Math.max(sp.vmax, 0.01))}%`;
  $('gmBat').style.width = `${Math.round(run.bat * 100)}%`; $('gmBatT').textContent = `${Math.round(run.bat * 100)}%`; $('gmBatBox').classList.toggle('low', run.bat < 0.25);
  return true;
};

// ------------------------------------------------------------------ input
window.addEventListener('keydown', (e) => {
  if (!active || e.target.matches('input, textarea, select')) return;
  const k = e.key.toLowerCase();
  if ('wasdqe'.includes(k) && k.length === 1) { keys.add(k); e.preventDefault(); }
  if (k === 'arrowup') keys.add('w'); if (k === 'arrowdown') keys.add('s'); if (k === 'arrowleft') keys.add('a'); if (k === 'arrowright') keys.add('d');
  if (k.startsWith('arrow')) e.preventDefault();
  if (k === 'c') camMode = camMode === 'chase' ? 'top' : 'chase';
  if (k === 'r' && run) startMission(run.i);
  if (k === 'escape') { if (!$('gmModal').hidden && run && run.done) { $('gmModal').hidden = true; stopMission(); } else if (run && !run.done) finish(false, 'ออกจากภารกิจ'); }
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase(); keys.delete(k);
  ({ arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' })[k] && keys.delete(({ arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' })[k]);
});
window.addEventListener('blur', () => keys.clear());

// ------------------------------------------------------------------ boot: wait for the garage
(function waitGarage() {
  if (W8() && W8().dv && $('tools')) { injectUI(); if (new URLSearchParams(location.search).has('play')) openMenu(); return; }
  setTimeout(waitGarage, 200);
})();

// test hook (Node): pure helpers
if (typeof module !== 'undefined') module.exports = { obbOverlap, rayBox, BOXES, MISSIONS, level };
