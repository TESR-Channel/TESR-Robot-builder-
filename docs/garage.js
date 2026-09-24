/* TESR Robot Builder — Garage 3D (docs/garage.js)
 * A game-style robot garage that builds a *real* robot: every change updates the Robot Definition, the URDF and the BOM.
 * World = ROS convention (x forward, z up, metres). robotRoot sits at axle height, so child positions are base_link coordinates.
 * Logic/exports live in garage-core.js (window.TESR_GARAGE); sizing formulas in app.js (window.TESR, loaded after DOMContentLoaded
 * so its own page UI never starts here).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const G = window.TESR_GARAGE;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (x, d = 1) => (x == null || !isFinite(x) ? '—' : Number(x).toLocaleString('en-US', { maximumFractionDigits: d }));
const TAU = Math.PI * 2, SNAP = 0.005, SAVE_KEY = 'tesr_rb_garage', PROJECT_KEY = 'tesr_rb_project';
const snap = (v) => Math.round(v / SNAP) * SNAP;
const CHASSIS_HEX = { gunmetal: 0x2a2d36, crimson: 0x7a0c0c, gold: 0x9a7a30, white: 0xdcd9d2, carbon: 0x15161a };
const ICON = { lidar: '📡', depth_camera: '📷', rgb_camera: '📷', imu: '🧭', motor: '⚙️', motor_driver: '🎛️', battery: '🔋', compute: '🧠', wheel: '🛞', power_supply: '🔌', estop: '🛑' };

let registry = null, ids = {}, catalog = [], state = null, dv = null, T = null;
const meshStore = new Map();   // file name → ArrayBuffer (uploaded STL)
const geoCache = new Map();    // file name → BufferGeometry
let tab = 'mission', selectedUid = null, mount = null;
const flags = { scan: true, xray: false, payload: true, spin: false, drive: false };

const status = (m) => { $('gStatus').textContent = m; };
const banner = (m) => { const b = $('banner'); b.hidden = !m; b.innerHTML = m || ''; };

// ================================================================== scene
const viewport = $('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05050a);
scene.fog = new THREE.Fog(0x05050a, 9, 26);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 120);
camera.up.set(0, 0, 1);
camera.position.set(2.4, -2.2, 1.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 0.3;
controls.maxDistance = 12;
controls.autoRotateSpeed = 1.2;

scene.add(new THREE.HemisphereLight(0xbfc6d6, 0x16080a, 0.35));
const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
key.position.set(3, -4, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 });
scene.add(key);
const rimLight = new THREE.PointLight(0xb3171b, 18, 9); rimLight.position.set(-2.5, 2.5, 1.2); scene.add(rimLight);
const goldLight = new THREE.PointLight(0xc9a84c, 10, 8); goldLight.position.set(2.2, 2.6, 0.8); scene.add(goldLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.6, 0.45, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- showroom platform
const stageFx = new THREE.Group(); scene.add(stageFx);
(function buildStage() {
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 96), new THREE.MeshStandardMaterial({ color: 0x0b0b10, metalness: 0.7, roughness: 0.42 }));
  disc.receiveShadow = true; scene.add(disc);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x060609, roughness: 0.95 }));
  floor.position.z = -0.003; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(6.2, 31, 0x6a1414, 0x1b1b23); grid.rotation.x = Math.PI / 2; grid.position.z = 0.0015;
  grid.material.transparent = true; grid.material.opacity = 0.32; scene.add(grid);
  const ring = (r, w, col, op) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - w, r, 160), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, toneMapped: false })); m.position.z = 0.002; return m; };
  scene.add(ring(3.2, 0.018, 0xe9c86a, 0.95));
  stageFx.add(ring(2.2, 0.01, 0xc9a84c, 0.45), ring(1.35, 0.008, 0xb3171b, 0.6));
  const ticks = []; for (let k = 0; k < 120; k++) { const a = k / 120 * TAU, r1 = 3.12, r2 = k % 10 === 0 ? 2.9 : 3.03; ticks.push(Math.cos(a) * r1, Math.sin(a) * r1, 0.003, Math.cos(a) * r2, Math.sin(a) * r2, 0.003); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
  stageFx.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0xc9a84c, transparent: true, opacity: 0.55 })));
  const wedge = new THREE.Mesh(new THREE.RingGeometry(1.4, 3.1, 64, 1, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0xc9a84c, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false }));
  wedge.position.z = 0.002; stageFx.add(wedge);
  const n = 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.z = Math.abs(v.z) * 0.8 + 0.05; v.multiplyScalar(35 + Math.random() * 25); pos.set([v.x, v.y, v.z], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.75, fog: false })));
})();

// ---- robot containers
const driveRoot = new THREE.Group(); scene.add(driveRoot);      // test-drive pose
const robotRoot = new THREE.Group(); driveRoot.add(robotRoot);  // base_link (z = wheel radius)
let chassisPick = null, spinners = [], sweeps = [], scanFx = [], wheelsFx = [], selBox = null, ghost = null;

const tc = new TransformControls(camera, renderer.domElement);
tc.setTranslationSnap(SNAP);
tc.setSize(0.8);
scene.add(tc.getHelper ? tc.getHelper() : tc);
tc.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; if (!e.value) { refresh(); } });
tc.addEventListener('objectChange', () => {
  const obj = tc.object, it = obj && findItem(obj.userData.uid);
  if (!it) return;
  it.pos = [snap(obj.position.x), snap(obj.position.y), snap(obj.position.z)];
  renderInspector(true);
});

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
  camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport); resize();

// ================================================================== materials
const MAT = {
  tire: new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.88 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xc9a84c, metalness: 1, roughness: 0.22 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x17181d, metalness: 0.65, roughness: 0.35 }),
  alu: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x0f1014, metalness: 0.4, roughness: 0.6 }),
};
const glow = (hex, i = 3) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: hex, emissiveIntensity: i, toneMapped: false });
const fxMat = (hex, op) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
let chassisMat = null;

function disposeTree(o) {
  o.traverse((c) => { if (c.geometry && !c.userData.cachedGeo) c.geometry.dispose(); });
  while (o.children.length) o.remove(o.children[0]);
}

// ================================================================== robot build
function buildRobot() {
  disposeTree(robotRoot);
  spinners = []; sweeps = []; scanFx = []; wheelsFx = [];
  const s = state, c = s.chassis, dr = s.drive, r = dr.wheelDiameter / 2;
  const { bottom, top } = G.chassisZ(s), zc = (bottom + top) / 2, H = c.height;
  robotRoot.position.z = r;

  // chassis shell (always built: it is also the surface you click to mount sensors)
  chassisMat = new THREE.MeshPhysicalMaterial({ color: CHASSIS_HEX[c.color] || CHASSIS_HEX.gunmetal, metalness: 0.72, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  applyXray();
  const round = c.shape === 'round';
  const geo = round ? new THREE.CylinderGeometry(c.width / 2, c.width / 2, H, 72).rotateX(Math.PI / 2)
    : new RoundedBoxGeometry(c.length, c.width, H, 4, Math.min(0.03, H * 0.25, c.width * 0.08));
  const shell = new THREE.Mesh(geo, chassisMat);
  shell.position.z = zc; shell.castShadow = true; shell.receiveShadow = true;
  shell.userData.pick = 'chassis'; chassisPick = shell; robotRoot.add(shell);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(round ? new THREE.CylinderGeometry(c.width / 2, c.width / 2, H, 36).rotateX(Math.PI / 2) : new THREE.BoxGeometry(c.length, c.width, H), 25),
    new THREE.LineBasicMaterial({ color: 0xe9c86a, transparent: true, opacity: 0.55, toneMapped: false }));
  edges.position.z = zc; robotRoot.add(edges);
  // accent stripe + deck + headlights
  if (round) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(c.width / 2 + 0.003, 0.004, 8, 120), glow(0xff2a2a, 4)); t.position.z = zc + H * 0.15; robotRoot.add(t);
    const d = new THREE.Mesh(new THREE.CircleGeometry(c.width / 2 * 0.9, 64), MAT.deck); d.position.z = top + 0.002; robotRoot.add(d);
  } else {
    [1, -1].forEach((sy) => { const st = new THREE.Mesh(new THREE.BoxGeometry(c.length * 0.78, 0.004, Math.max(0.008, H * 0.05)), glow(0xff2a2a, 4)); st.position.set(0, sy * (c.width / 2 + 0.002), zc + H * 0.18); robotRoot.add(st); });
    const d = new THREE.Mesh(new THREE.BoxGeometry(c.length * 0.9, c.width * 0.86, 0.006), MAT.deck); d.position.z = top + 0.003; robotRoot.add(d);
    const chev = new THREE.Mesh(new THREE.ConeGeometry(Math.min(0.05, c.width * 0.1), Math.min(0.08, c.length * 0.12), 3).rotateZ(-Math.PI / 2), glow(0xe9c86a, 2.5));
    chev.position.set(c.length / 2 - Math.min(0.12, c.length * 0.2), 0, top + 0.008); chev.scale.z = 0.05; robotRoot.add(chev);
  }
  const hx = round ? c.width / 2 : c.length / 2;
  [1, -1].forEach((sy) => { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.006, Math.min(0.06, c.width * 0.12), Math.max(0.01, H * 0.06)), glow(0xcfe8ff, 6)); hl.position.set(hx + 0.002, sy * c.width * 0.3, zc + H * 0.2); robotRoot.add(hl); });

  // uploaded shell STL replaces the look (the box stays as the mounting surface / collision)
  if (c.shell && geoCache.has(c.shell.file)) {
    const m = new THREE.Mesh(geoCache.get(c.shell.file), new THREE.MeshPhysicalMaterial({ color: CHASSIS_HEX[c.color] || CHASSIS_HEX.gunmetal, metalness: 0.6, roughness: 0.35, clearcoat: 0.5 }));
    m.userData.cachedGeo = true;
    const k = c.shell.scale; m.scale.setScalar(k);
    m.position.set(-c.length / 2 - c.shell.min[0] * k, -c.width / 2 - c.shell.min[1] * k, bottom - c.shell.min[2] * k);
    m.castShadow = true; robotRoot.add(m);
    shell.material = new THREE.MeshBasicMaterial({ visible: false }); edges.material.opacity = 0.15;
  }

  // internals (visible with X-Ray)
  const inner = (hw, x, colHex, label) => {
    const rec = ids[hw]; if (!rec) return;
    const dm = (rec.dims_m || [0.1, 0.1, 0.05]).map((v, i) => Math.min(v, [c.length * 0.3, c.width * 0.8, H * 0.8][i]));
    const b = new THREE.Mesh(new THREE.BoxGeometry(...dm), new THREE.MeshStandardMaterial({ color: colHex, metalness: 0.3, roughness: 0.5, emissive: colHex, emissiveIntensity: 0.25 }));
    b.position.set(x, 0, bottom + 0.01 + dm[2] / 2); b.userData.inner = label; robotRoot.add(b);
  };
  inner(s.power.battery, -c.length * 0.25, 0x2e8b57, 'battery');
  inner(s.compute, 0, 0xc9a84c, 'compute');
  inner(dr.driver, c.length * 0.25, 0x8b5cf6, 'driver');

  // wheels
  const ww = dr.wheelWidth;
  dv.wheels.forEach((w) => {
    const g = new THREE.Group(); g.position.set(w.x, w.y, 0);
    const spin = new THREE.Group(); g.add(spin);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, ww, 48), MAT.tire); tire.castShadow = true; spin.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, ww * 1.04, 32), MAT.rim); spin.add(rim);
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, ww * 1.08, r * 0.08), MAT.dark); sp.rotation.y = k / 5 * Math.PI; spin.add(sp); }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, ww * 1.12, 16), glow(0xb3171b, 2)); spin.add(cap);
    if (dr.type === 'mecanum') {
      const sign = (w.key === 'front_left' || w.key === 'rear_right') ? 1 : -1;
      for (let k = 0; k < 10; k++) {
        const holder = new THREE.Group(); holder.rotation.y = k / 10 * TAU;
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.13, r * 0.13, ww * 1.05, 12), MAT.alu);
        roller.position.x = r * 0.9; roller.rotation.x = sign * Math.PI / 4; holder.add(roller); spin.add(holder);
      }
      tire.visible = false;
    }
    wheelsFx.push({ spin, w }); robotRoot.add(g);
  });
  dv.casters.forEach((k) => {
    const cr = dv.casterR, g = new THREE.Group(); g.position.set(k.x, k.y, 0);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(cr, 20, 14), MAT.alu); ball.position.z = -r + cr; ball.castShadow = true; g.add(ball);
    const post = Math.max(0.002, bottom - (-r + 2 * cr));
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(cr * 0.5, cr * 0.7, post + cr, 12).rotateX(Math.PI / 2), MAT.dark);
    fork.position.z = (bottom + (-r + cr)) / 2; g.add(fork); robotRoot.add(g);
  });
  if (s.estop) {
    const e = new THREE.Group(); e.position.set(-(round ? c.width / 2 : c.length / 2) + 0.08, c.width / 2 - 0.08, top);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8c21a, roughness: 0.4 }));
    base.position.z = 0.01; e.add(base);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 12, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), glow(0xff1a1a, 2.2)); cap.position.z = 0.02; e.add(cap);
    robotRoot.add(e);
  }
  if (flags.payload && s.mission.payload > 0) {
    const ph = Math.min(0.6, 0.12 + s.mission.payload / 800), pl = (round ? c.width : c.length) * 0.78, pwid = c.width * 0.78;
    const box = new THREE.Mesh(new THREE.BoxGeometry(pl, pwid, ph), fxMat(0xc9a84c, 0.05)); box.position.z = top + 0.01 + ph / 2; robotRoot.add(box);
    const bl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(pl, pwid, ph)), new THREE.LineDashedMaterial({ color: 0xe9c86a, dashSize: 0.03, gapSize: 0.02, transparent: true, opacity: 0.7 }));
    bl.computeLineDistances(); bl.position.copy(box.position); robotRoot.add(bl);
  }

  // sensors + custom parts
  dv.sensors.forEach((si) => { const g = sensorObject(si, false); robotRoot.add(g); });
  (s.parts || []).forEach((p) => robotRoot.add(partObject(p, false)));

  if (selectedUid) { const o = objectByUid(selectedUid); if (o && !flags.drive) tc.attach(o); else { tc.detach(); } }
  updateSelBox();
}

function sensorObject(si, isGhost) {
  const rec = si.rec || ids[si.hw] || {}, dm = rec.dims_m || [0.06, 0.06, 0.04], g = new THREE.Group();
  g.position.fromArray(si.pos); g.rotation.z = si.yaw || 0; g.userData.uid = si.uid;
  if (si.category === 'lidar') {
    const rad = Math.max(dm[0], dm[1]) / 2, h = dm[2];
    const base = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.05, h * 0.5, 36).rotateX(Math.PI / 2), MAT.dark); base.position.z = -h * 0.25; base.castShadow = true; g.add(base);
    const head = new THREE.Group(); head.position.z = h * 0.22; g.add(head);
    head.add(new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.86, rad * 0.9, h * 0.45, 36).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x101014, metalness: 0.2, roughness: 0.1, clearcoat: 1 })));
    head.add(new THREE.Mesh(new THREE.TorusGeometry(rad * 0.9, Math.max(0.002, rad * 0.06), 8, 48), glow(0xff2020, 4)));
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.004, rad * 0.7, h * 0.18), glow(0xff5040, 6)); win.position.x = rad * 0.88; head.add(win);
    if (!isGhost) spinners.push(head);
    if (!isGhost) {
      const fov = (si.fov || 360) * Math.PI / 180, R = Math.min((rec.sensor && rec.sensor.range_m) || 8, 2.6);
      const fan = new THREE.Mesh(new THREE.CircleGeometry(R, 96, -fov / 2, fov), fxMat(0xff2020, 0.05));
      const edge = new THREE.Mesh(new THREE.RingGeometry(R - 0.012, R, 120, 1, -fov / 2, fov), fxMat(0xff3030, 0.5));
      const sweep = new THREE.Mesh(new THREE.CircleGeometry(R, 24, -0.1, 0.2), fxMat(0xff4030, 0.28));
      [fan, edge, sweep].forEach((m) => { m.position.z = 0.001; g.add(m); scanFx.push(m); });
      sweeps.push({ mesh: sweep, fov, phase: Math.random() * 10 });
    }
  } else if (/camera/.test(si.category)) {
    const d = dm[1], w = dm[0], h = dm[2];
    const body = new THREE.Mesh(new RoundedBoxGeometry(d, w, h, 2, Math.min(d, h) * 0.3), MAT.alu); body.castShadow = true; g.add(body);
    [-0.3, 0.3].forEach((k) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.28, h * 0.28, 0.004, 20).rotateZ(Math.PI / 2), glow(0x3a9bff, 5)); l.position.set(d / 2 + 0.002, k * w, 0); g.add(l); });
    if (!isGhost) {
      const fov = ((rec.sensor && rec.sensor.fov_deg) || 87) * Math.PI / 180, L = Math.min((rec.sensor && rec.sensor.range_m) || 3, 1.4), rad = Math.tan(fov / 2) * L;
      const cone = new THREE.ConeGeometry(rad, L, 4, 1, true).rotateY(Math.PI / 4).rotateZ(Math.PI / 2); cone.translate(d / 2 + L / 2, 0, 0);
      const cm = new THREE.Mesh(cone, fxMat(0x3a9bff, 0.06)); g.add(cm); scanFx.push(cm);
      const ce = new THREE.LineSegments(new THREE.EdgesGeometry(cone), new THREE.LineBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.45, toneMapped: false })); g.add(ce); scanFx.push(ce);
    }
  } else {
    const b = new THREE.Mesh(new THREE.BoxGeometry(...dm), new THREE.MeshStandardMaterial({ color: 0xd8741a, emissive: 0xd8741a, emissiveIntensity: 0.6 })); g.add(b);
  }
  scanFx.forEach((m) => { m.visible = flags.scan; });
  if (isGhost) g.traverse((m) => { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.55; } });
  return g;
}

function partObject(p, isGhost) {
  const g = new THREE.Group(); g.position.fromArray(p.pos || [0, 0, 0]); g.rotation.z = p.yaw || 0; g.userData.uid = p.uid;
  const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(p.color || '#8c8c92'), metalness: 0.5, roughness: 0.35, clearcoat: 0.4, transparent: isGhost, opacity: isGhost ? 0.55 : 1 });
  const s = p.size || [0.1, 0.1, 0.1];
  let m;
  if (p.kind === 'mesh' && geoCache.has(p.file)) {
    m = new THREE.Mesh(geoCache.get(p.file), mat); m.userData.cachedGeo = true; m.scale.setScalar(p.scale);
    m.position.set(...p.center.map((v) => -v * p.scale));
  } else if (p.kind === 'cylinder') m = new THREE.Mesh(new THREE.CylinderGeometry(s[0] / 2, s[0] / 2, s[2], 40).rotateX(Math.PI / 2), mat);
  else if (p.kind === 'sphere') m = new THREE.Mesh(new THREE.SphereGeometry(s[0] / 2, 32, 20), mat);
  else m = new THREE.Mesh(new RoundedBoxGeometry(s[0], s[1], s[2], 2, Math.min(...s) * 0.12), mat);
  m.castShadow = true; g.add(m);
  return g;
}

function objectByUid(u) { let f = null; robotRoot.children.forEach((o) => { if (o.userData.uid === u) f = o; }); return f; }
function findItem(u) { return state.sensors.find((s) => s.uid === u) || (state.parts || []).find((p) => p.uid === u) || null; }
function updateSelBox() {
  if (selBox) { scene.remove(selBox); selBox.geometry.dispose(); selBox = null; }
  const o = selectedUid && objectByUid(selectedUid);
  if (o) { selBox = new THREE.BoxHelper(o, 0xe9c86a); selBox.material.toneMapped = false; scene.add(selBox); }
}
function applyXray() {
  if (!chassisMat) return;
  chassisMat.transparent = flags.xray; chassisMat.opacity = flags.xray ? 0.16 : 1; chassisMat.depthWrite = !flags.xray; chassisMat.needsUpdate = true;
}

// ================================================================== interaction: mount / select / drag
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pointerRay(e) {
  const rc = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function placement(hit) {
  const { bottom, top } = G.chassisZ(state);
  const p = robotRoot.worldToLocal(hit.point.clone());
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const up = n.z > 0.7;
  const yawSide = Math.round(Math.atan2(n.y, n.x) / (Math.PI / 4)) * (Math.PI / 4);
  const clampZ = (z, h) => Math.max(bottom + h / 2, Math.min(top - h / 2, z));
  if (mount.kind === 'sensor') {
    const dm = (ids[mount.hw] && ids[mount.hw].dims_m) || [0.05, 0.05, 0.04];
    if (mount.category === 'imu') return { pos: [snap(p.x), snap(p.y), snap(bottom + 0.02 + dm[2] / 2)], yaw: 0 };
    if (mount.category === 'lidar') {
      const rad = Math.max(dm[0], dm[1]) / 2;
      if (up) return { pos: [snap(p.x), snap(p.y), snap(top + dm[2] / 2)], yaw: 0 };
      return { pos: [snap(p.x + n.x * rad * 0.35), snap(p.y + n.y * rad * 0.35), snap(clampZ(p.z, dm[2]))], yaw: yawSide };
    }
    if (up) return { pos: [snap(p.x), snap(p.y), snap(top + dm[2] / 2)], yaw: 0 };
    return { pos: [snap(p.x + n.x * dm[1] / 2), snap(p.y + n.y * dm[1] / 2), snap(clampZ(p.z, dm[2]))], yaw: yawSide };
  }
  const sz = mount.part.size;
  if (up) return { pos: [snap(p.x), snap(p.y), snap(top + sz[2] / 2)], yaw: 0 };
  return { pos: [snap(p.x + n.x * sz[0] / 2), snap(p.y + n.y * sz[0] / 2), snap(clampZ(p.z, sz[2]))], yaw: yawSide };
}
function startMount(m) {
  cancelMount(); mount = m; select(null);
  if (m.kind === 'sensor') {
    const si = { uid: '_ghost', hw: m.hw, category: m.category, pos: [0, 0, 0], yaw: 0, rec: ids[m.hw], fov: 360 };
    ghost = sensorObject(si, true);
    banner(`🎯 คลิกบนตัวถังเพื่อติดตั้ง <b>${esc(ids[m.hw]?.name || m.hw)}</b> · หลังคา = มองรอบทิศ · ขอบ/มุม = หันออกด้านนอก · <kbd>Esc</kbd> ยกเลิก`);
  } else {
    ghost = partObject({ ...m.part, pos: [0, 0, 0] }, true);
    banner('🎯 คลิกบนตัวถังเพื่อวางชิ้นส่วน · <kbd>Esc</kbd> ยกเลิก');
  }
  ghost.visible = false; robotRoot.add(ghost);
}
function cancelMount() { if (ghost) { robotRoot.remove(ghost); ghost = null; } mount = null; banner(''); }

let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!mount || !ghost || !chassisPick) return;
  pointerRay(e);
  const hit = ray.intersectObject(chassisPick, false)[0];
  ghost.visible = !!hit;
  if (hit) { const pl = placement(hit); ghost.position.fromArray(pl.pos); ghost.rotation.z = pl.yaw; ghost.userData.pl = pl; }
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5 || tc.dragging) return;
  pointerRay(e);
  if (mount) {
    const hit = chassisPick && ray.intersectObject(chassisPick, false)[0];
    if (!hit) return;
    const pl = placement(hit), u = G.uid();
    if (mount.kind === 'sensor') state.sensors.push({ uid: u, hw: mount.hw, category: mount.category, pos: pl.pos, yaw: pl.yaw });
    else state.parts.push({ ...mount.part, uid: u, pos: pl.pos, yaw: pl.yaw });
    const keep = e.shiftKey ? mount : null;
    cancelMount(); selectedUid = u; changed(true);
    if (keep) startMount(keep);
    return;
  }
  if (flags.drive) return;
  const hits = ray.intersectObjects(robotRoot.children, true);
  for (const h of hits) { let o = h.object; while (o && o !== robotRoot && !o.userData.uid) o = o.parent; if (o && o.userData.uid) { select(o.userData.uid); return; } }
  select(null);
});
function select(u) {
  selectedUid = u;
  const o = u && objectByUid(u);
  if (o && !flags.drive) tc.attach(o); else tc.detach();
  updateSelBox(); renderInspector(); if (tab === 'sensors' || tab === 'parts') renderTab();
}
function rotateSel(d) { const it = selectedUid && findItem(selectedUid); if (!it) return; const y = (it.yaw || 0) + d; it.yaw = Math.round(Math.atan2(Math.sin(y), Math.cos(y)) * 1e4) / 1e4; changed(false); }
function deleteSel() {
  if (!selectedUid) return;
  state.sensors = state.sensors.filter((s) => s.uid !== selectedUid);
  state.parts = (state.parts || []).filter((p) => p.uid !== selectedUid);
  selectedUid = null; tc.detach(); changed(true);
}

// ================================================================== test drive
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  const k = e.key.toLowerCase();
  if (flags.drive && 'wasdqe'.includes(k)) { keys.add(k); e.preventDefault(); return; }
  if (k === 'escape') { if (mount) cancelMount(); else if (flags.drive) toggleTool('drive'); else select(null); }
  if ((k === 'delete' || k === 'backspace') && selectedUid) { deleteSel(); e.preventDefault(); }
  if (k === 'r' && selectedUid) rotateSel(e.shiftKey ? -Math.PI / 4 : Math.PI / 4);
  if (k === 'g' && selectedUid) tc.setMode('translate');
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
function stepDrive(dt) {
  const m = state.mission, dr = state.drive, r = dr.wheelDiameter / 2;
  const v = m.vMax * ((keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0));
  const w = m.wMax * ((keys.has('a') ? 1 : 0) - (keys.has('d') ? 1 : 0));
  const vy = dr.type === 'mecanum' ? m.vMax * 0.8 * ((keys.has('q') ? 1 : 0) - (keys.has('e') ? 1 : 0)) : 0;
  const yaw = driveRoot.rotation.z;
  driveRoot.position.x += (v * Math.cos(yaw) - vy * Math.sin(yaw)) * dt;
  driveRoot.position.y += (v * Math.sin(yaw) + vy * Math.cos(yaw)) * dt;
  driveRoot.rotation.z += w * dt;
  const d = Math.hypot(driveRoot.position.x, driveRoot.position.y);
  if (d > 2.6) driveRoot.position.multiplyScalar(2.6 / d);
  wheelsFx.forEach(({ spin, w: wh }) => {
    const side = wh.y > 0 ? 1 : -1;
    let om = (v - side * w * Math.abs(wh.y)) / r;
    if (dr.type === 'mecanum') om += (wh.key === 'front_left' || wh.key === 'rear_right' ? -1 : 1) * vy / r;
    spin.rotation.y += om * dt;
  });
  controls.target.lerp(new THREE.Vector3(driveRoot.position.x, driveRoot.position.y, 0.25), 0.08);
}

// ================================================================== loop
const clock = new THREE.Clock();
(function loop() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  spinners.forEach((s) => { s.rotation.z += dt * 7; });
  sweeps.forEach((s) => { s.mesh.rotation.z = s.fov >= TAU - 1e-3 ? (t * 2.4 + s.phase) % TAU : -s.fov / 2 + ((t * 2.4 + s.phase) % s.fov); });
  stageFx.rotation.z += dt * 0.06;
  if (flags.drive) stepDrive(dt);
  if (selBox) selBox.update();
  controls.update();
  composer.render();
  requestAnimationFrame(loop);
})();

function fitView() {
  const c = state.chassis, span = Math.max(c.length, c.width, c.height + 0.3);
  const d = Math.max(1.1, span * 2.6);
  controls.target.set(driveRoot.position.x, driveRoot.position.y, (state.chassis.clearance + c.height) * 0.6);
  camera.position.set(controls.target.x + d * 0.95, controls.target.y - d * 0.85, controls.target.z + d * 0.62);
}

// ================================================================== state changes
let rebuildQueued = false;
function changed(resolve) {
  if (resolve) G.autoResolve(state, registry);
  refresh();
  if (!rebuildQueued) { rebuildQueued = true; requestAnimationFrame(() => { rebuildQueued = false; buildRobot(); }); }
}
function refresh() {
  dv = G.derive(state, registry, catalog);
  renderHud(); renderInspector(true);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) { /* quota */ }
}
// keep sensors/parts anchored to the chassis when its size changes
function withReanchor(fn) {
  const oc = { ...state.chassis }, oz = G.chassisZ(state);
  fn();
  const nc = state.chassis, nz = G.chassisZ(state);
  const sx = nc.length / oc.length, sy = nc.width / oc.width;
  const move = (it) => {
    const z = it.pos[2];
    const nzv = z >= oz.top - 1e-3 ? nz.top + (z - oz.top) : Math.min(nz.top - 0.01, nz.bottom + (z - oz.bottom));
    it.pos = [snap(it.pos[0] * sx), snap(it.pos[1] * sy), snap(nzv)];
  };
  state.sensors.forEach(move); (state.parts || []).forEach(move);
}

// ================================================================== UI: tabs
const tabBody = $('tabBody');
$('tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (!b) return; tab = b.dataset.tab; document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); renderTab(); });

const volt = (h) => (h && h.electrical ? h.electrical.voltage_v : null);
const slider = (path, label, min, max, step, unit = '') => {
  const v = path.split('.').reduce((o, k) => o?.[k], state);
  return `<div class="sl"><div class="row"><span>${label}</span><span class="val" id="val-${path.replace('.', '-')}">${fmt(v, 3)} ${unit}</span></div><input type="range" data-bind="${path}" min="${min}" max="${max}" step="${step}" value="${v}" data-unit="${unit}"></div>`;
};
const seg = (act, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="${act}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
function specOf(h) {
  if (h.motor) return `${h.motor.rated_torque_nm} N·m · ${h.motor.rated_rpm} rpm · ${h.electrical?.peak_w ?? '?'} W`;
  if (h.battery) return `${h.battery.nominal_v} V · ${h.battery.capacity_ah} Ah · ${h.battery.max_discharge_a} A · ${h.mass_kg} kg`;
  if (h.sensor && h.sensor.type === 'lidar_2d') return `ระยะ ${h.sensor.range_m} m · ${h.sensor.fov_deg}° · ${h.sensor.rate_hz} Hz`;
  if (h.sensor && h.sensor.type === 'depth_camera') return `ระยะ ${h.sensor.range_m} m · FOV ${h.sensor.fov_deg}° · ${h.sensor.rate_hz} fps`;
  if (h.sensor && h.sensor.type === 'imu') return `${h.sensor.rate_hz} Hz · ${(h.interfaces || []).join('/')}`;
  if (h.compute) return `${h.compute.arch} · RAM ${h.compute.ram_gb} GB · USB3 ×${h.compute.usb3_ports}`;
  if (h.category === 'motor_driver') return `${volt(h)} V · ${(h.interfaces || []).join(' / ')}`;
  return h.manufacturer || '';
}
function shopChip(id, name) {
  const p = T.productsFor(catalog, id)[0];
  const price = p && p.price != null ? `<span class="price">${fmt(p.price, 0)} ฿</span>` : '';
  const link = p && p.shop_url ? `<a href="${esc(p.shop_url)}" target="_blank" rel="noopener">🛒 ซื้อ</a>` : `<a href="https://tesrshop.com/?s=${encodeURIComponent(name)}" target="_blank" rel="noopener">🔍 Shop</a>`;
  return price + link;
}
function card(h, { act, slot, on, chips = '', go = '' }) {
  return `<div class="pcard ${on ? 'on' : ''}" data-act="${act}" data-slot="${slot || ''}" data-id="${h.id}"><div class="ico">${ICON[h.category] || '🔩'}</div>
    <div><b>${esc(h.name)}</b><div class="spec">${esc(specOf(h))}</div><div class="chips">${chips}${shopChip(h.id, h.name)}</div></div>${go}</div>`;
}
const vChip = (v, busV) => (v == null ? '' : G.voltMatch(v, busV) ? `<span class="ok">${v} V ✓</span>` : `<span class="warn">${v} V</span>`);

function renderTab() {
  const s = state, busV = s.power.busV, byCat = (c) => T.byCategory(registry, c);
  let h = '';
  if (tab === 'mission') {
    h += '<h2>เลือกพิมพ์เขียว</h2><div class="bp">' + Object.entries(G.BLUEPRINTS).map(([k, b]) =>
      `<div class="pcard ${s.blueprint === k ? 'on' : ''}" data-act="bp" data-v="${k}"><div class="ico">${b.icon}</div><div><b>${esc(b.label)}</b><div class="spec">${esc(b.desc)}</div></div></div>`).join('') + '</div>';
    h += '<p class="note">เลือกแล้วแต่งต่อได้ทุกชิ้น — ระบบคำนวณมอเตอร์ แบต และแรงดันให้ตามภารกิจ</p>';
    h += '<h2>ภารกิจ</h2>' + slider('mission.payload', 'น้ำหนักของที่บรรทุก', 0, 1000, 5, 'kg') + slider('mission.vMax', 'ความเร็วสูงสุด', 0.2, 2, 0.1, 'm/s')
      + slider('mission.runtimeH', 'ใช้งานต่อการชาร์จ', 0.5, 16, 0.5, 'h') + slider('mission.slopeDeg', 'ทางลาดชันสุด', 0, 15, 0.5, '°')
      + '<div class="note">พื้น</div>' + seg('floor', [['concrete', 'คอนกรีต'], ['epoxy', 'อีพ็อกซี'], ['tile', 'กระเบื้อง'], ['carpet', 'พรม'], ['asphalt', 'ยางมะตอย'], ['gravel', 'กรวด']], s.mission.floor)
      + '<div class="note">สถานที่</div>' + seg('env', [['factory', 'โรงงาน'], ['warehouse', 'คลังสินค้า'], ['hospital', 'โรงพยาบาล'], ['office', 'สำนักงาน'], ['laboratory', 'แลป'], ['outdoor', 'กลางแจ้ง']], s.mission.envType);
  } else if (tab === 'chassis') {
    h += '<h2>รูปทรงตัวถัง</h2>' + seg('shape', [['box', '⬛ สี่เหลี่ยม'], ['round', '⚪ กลม']], s.chassis.shape);
    h += (s.chassis.shape === 'round' ? '' : slider('chassis.length', 'ยาว', 0.2, 2, 0.01, 'm')) + slider('chassis.width', s.chassis.shape === 'round' ? 'เส้นผ่านศูนย์กลาง' : 'กว้าง', 0.15, 1.5, 0.01, 'm')
      + slider('chassis.height', 'สูง (ตัวถัง)', 0.05, 1.2, 0.01, 'm') + slider('chassis.clearance', 'ระยะใต้ท้อง', 0.01, 0.2, 0.005, 'm');
    h += '<h2>สี</h2><div class="seg">' + Object.entries(CHASSIS_HEX).map(([k, v]) => `<button class="sw ${s.chassis.color === k ? 'on' : ''}" title="${k}" data-act="color" data-v="${k}" style="background:#${v.toString(16).padStart(6, '0')}"></button>`).join('') + '</div>';
    h += '<h2>โครงจากไฟล์ของคุณ</h2><p class="note">อัปโหลด STL ของโครง (mm หรือ m ตรวจให้อัตโนมัติ) — ระบบวัดขนาดแล้วปรับ ยาว×กว้าง×สูง ให้ตรง ใช้เป็นหน้าตาใน RViz/Gazebo</p>'
      + `<div class="seg"><button data-act="uploadShell">⬆️ อัปโหลดโครง STL</button>${s.chassis.shell ? `<button data-act="clearShell">✕ ใช้ทรงเรขาคณิต</button>` : ''}</div>`
      + (s.chassis.shell ? `<p class="note">ใช้ไฟล์ <code>${esc(s.chassis.shell.file)}</code>${geoCache.has(s.chassis.shell.file) ? '' : ' — <b>ยังไม่มีไฟล์ในเครื่องนี้ อัปโหลดอีกครั้ง</b>'}</p>` : '');
  } else if (tab === 'drive') {
    h += '<h2>ระบบขับ</h2>'
      + `<div class="pcard ${s.drive.type === 'differential' ? 'on' : ''}" data-act="drive" data-v="differential"><div class="ico">🛞</div><div><b>Differential 2 ล้อขับ</b><div class="spec">เลี้ยวด้วยความเร็วล้อต่างกัน + ล้อประคอง · ทนทาน ราคาประหยัด</div></div></div>`
      + `<div class="pcard ${s.drive.type === 'mecanum' ? 'on' : ''}" data-act="drive" data-v="mecanum"><div class="ico">🧭</div><div><b>Mecanum 4 ล้อ</b><div class="spec">สไลด์ข้าง/หมุนอยู่กับที่ · พื้นเรียบเท่านั้น</div></div></div>`
      + '<div class="pcard locked"><div class="ico">🚙</div><div><b>Skid-steer 4 ล้อขับ</b><div class="spec">พื้นขรุขระ/กลางแจ้ง</div></div></div>'
      + '<div class="pcard locked"><div class="ico">🏎️</div><div><b>Ackermann (เลี้ยวแบบรถยนต์)</b><div class="spec">ความเร็วสูง ทางยาว</div></div></div>';
    if (s.drive.type === 'differential') h += '<h2>ล้อประคอง</h2>' + seg('caster', [['front_rear', 'หน้า+หลัง'], ['corners4', '4 มุม'], ['rear1', 'หลัง 1'], ['front1', 'หน้า 1']], s.drive.casterLayout);
    h += '<h2>ล้อ & เกียร์</h2>' + slider('drive.wheelDiameter', 'เส้นผ่านศูนย์กลางล้อ', 0.06, 0.4, 0.005, 'm') + slider('drive.wheelWidth', 'หน้ากว้างล้อ', 0.02, 0.12, 0.005, 'm')
      + slider('drive.track', 'ระยะห่างล้อซ้าย-ขวา', 0.1, 1.5, 0.01, 'm') + (s.drive.type === 'mecanum' ? slider('drive.wheelbase', 'ระยะล้อหน้า-หลัง', 0.1, 1.5, 0.01, 'm') : '')
      + slider('drive.gearRatio', 'อัตราทดเกียร์', 1, 60, 1, ':1');
    h += `<h2>มอเตอร์ ${s.user.motor ? '<button class="mini ghost" data-act="auto" data-slot="motor">↺ ให้ระบบเลือก</button>' : '<span class="note">(ระบบเลือกให้)</span>'}</h2>`;
    h += T.recommendMotors(registry, busV, dv.dt).map((m) => card(m.hw, { act: 'pick', slot: 'motor', on: s.drive.motor === m.hw.id,
      chips: vChip(volt(m.hw), busV) + (m.fits ? '<span class="ok">แรงพอ</span>' : '<span class="err">แรงไม่พอ</span>') })).join('');
  } else if (tab === 'sensors') {
    h += '<h2>ติดตั้งด่วน (LiDAR)</h2>' + seg('lidarLayout', [['front1', 'หลังคา 1 ตัว'], ['diag2', 'เฉียง 2 ตัว (KURO-X)'], ['fr2', 'หน้า+หลัง'], ['rear3', '3 ตัว'], ['corner4', '4 มุม']], '');
    h += '<p class="note">หรือกด <b>ติดตั้ง</b> ที่การ์ดแล้วคลิกตำแหน่งบนตัวถัง (กด <kbd>Shift</kbd> ค้างเพื่อวางหลายตัว) · เลือกชิ้นแล้วลากลูกศรเพื่อย้าย <kbd>R</kbd> หมุน 45° <kbd>Del</kbd> ถอด</p>';
    h += '<h2>ติดตั้งอยู่</h2>' + (dv.sensors.length ? dv.sensors.map((x) => `<div class="installed ${selectedUid === x.uid ? 'sel' : ''}" data-act="sel" data-v="${x.uid}">${ICON[x.category] || '🔩'}<span class="nm">${x.id} · ${esc(x.rec?.name || x.hw)}${x.category === 'lidar' ? ` · ${x.fov}°` : ''}</span><button data-act="del" data-v="${x.uid}">ถอด</button></div>`).join('') : '<p class="note">ยังไม่มีเซนเซอร์</p>');
    [['lidar', 'LiDAR'], ['depth_camera', 'กล้อง depth'], ['imu', 'IMU']].forEach(([cat, label]) => {
      h += `<h2>${label}</h2>` + byCat(cat).map((r) => card(r, { act: 'mount', slot: cat, on: false, go: '<button class="mini go">ติดตั้ง</button>' })).join('');
    });
  } else if (tab === 'power') {
    h += `<h2>แรงดันระบบ ${s.user.busV ? '<button class="mini ghost" data-act="volt" data-v="auto">↺ ให้ระบบแนะนำ</button>' : '<span class="note">(ระบบแนะนำ)</span>'}</h2>`
      + seg('volt', [[12, '12 V หุ่นเล็ก'], [24, '24 V ทั่วไป'], [48, '48 V หนัก']], busV) + `<p class="note">แนะนำ ${dv.suggestedBusV} V จากกำลังสูงสุด ${fmt(dv.dt.powerElecPeak, 0)} W · มวล ${fmt(dv.totalMass, 0)} kg — ใช้แบตแรงดันอื่นได้ ระบบคิดการต่ออนุกรมให้</p>`;
    h += `<h2>แบตเตอรี่ ${s.user.battery ? '<button class="mini ghost" data-act="auto" data-slot="battery">↺ ให้ระบบเลือก</button>' : ''}</h2>` + T.byCategory(registry, 'battery').map((b) => {
      const nv = b.battery?.nominal_v ?? volt(b), n = Math.max(1, Math.round(busV / nv));
      const chip = G.voltMatch(nv, busV) ? `<span class="ok">${nv} V ✓</span>` : G.voltMatch(nv * n, busV) ? `<span class="warn">อนุกรม ${n} ก้อน</span>` : `<span class="err">${nv} V ต้องมี DC-DC</span>`;
      return card(b, { act: 'pick', slot: 'battery', on: s.power.battery === b.id, chips: chip });
    }).join('');
    h += `<h2>Low-level control (ไดรเวอร์) ${s.user.driver ? '<button class="mini ghost" data-act="auto" data-slot="driver">↺ ให้ระบบเลือก</button>' : ''}</h2>` + T.byCategory(registry, 'motor_driver').map((d) => card(d, { act: 'pick', slot: 'driver', on: s.drive.driver === d.id, chips: vChip(volt(d), busV) })).join('');
    h += '<h2>ความปลอดภัย</h2>' + `<div class="pcard ${s.estop ? 'on' : ''}" data-act="estop"><div class="ico">🛑</div><div><b>ปุ่ม E-stop</b><div class="spec">บังคับเมื่อหุ่นหนักเกิน 50 kg</div><div class="chips">${shopChip('generic_estop', 'Emergency stop')}</div></div></div>`;
  } else if (tab === 'brain') {
    h += '<h2>คอมพิวเตอร์</h2>' + T.byCategory(registry, 'compute').map((c) => {
      const usb3 = dv.sensors.filter((x) => (x.rec?.interfaces || []).includes('usb3')).length;
      const chip = c.compute && usb3 > c.compute.usb3_ports ? `<span class="warn">USB3 ไม่พอ (${usb3})</span>` : '<span class="ok">พอร์ตพอ</span>';
      return card(c, { act: 'pick', slot: 'compute', on: s.compute === c.id, chips: chip });
    }).join('') + '<p class="note">ROS 2 Jazzy · Ubuntu 24.04 · ซอฟต์แวร์ทั้งหมดสร้างในขั้น 3</p>';
  } else if (tab === 'parts') {
    h += '<h2>ชิ้นส่วนเรขาคณิต</h2><p class="note">กดแล้วคลิกบนตัวถังเพื่อวาง — เช่น เสา LiDAR, กันชน, ถาดบน, กล่องอุปกรณ์</p>'
      + seg('addPart', [['box', '⬛ กล่อง'], ['cylinder', '🥫 ทรงกระบอก'], ['sphere', '⚪ ทรงกลม']], '')
      + '<h2>ชิ้นส่วนจากไฟล์</h2>' + seg('uploadPart', [['stl', '⬆️ อัปโหลด STL']], '')
      + '<h2>ติดตั้งอยู่</h2>' + ((s.parts || []).length ? s.parts.map((p, i) => `<div class="installed ${selectedUid === p.uid ? 'sel' : ''}" data-act="sel" data-v="${p.uid}"><span class="sw" style="width:14px;height:14px;background:${esc(p.color)}"></span><span class="nm">part_${i + 1} · ${p.kind === 'mesh' ? esc(p.file) : p.kind} · ${fmt(p.mass, 2)} kg</span><button data-act="del" data-v="${p.uid}">ถอด</button></div>`).join('') : '<p class="note">ยังไม่มี</p>');
  } else {
    h += `<h2>วิธีเล่น</h2><p class="note">1) เลือก <b>พิมพ์เขียว</b> ในแท็บภารกิจ แล้วปรับน้ำหนัก ความเร็ว ชั่วโมงใช้งาน<br>2) แต่ง <b>โครง</b> และ <b>ล้อ</b> — หรืออัปโหลด STL ของคุณเอง<br>3) <b>เซนเซอร์</b>: กดติดตั้งแล้วคลิกบนตัวถัง · หลังคา = 360° · มุม/ขอบ = 270° หันออก<br>4) ดู <b>RANK</b> และแถบสเตตัสด้านขวา แก้ตามแจ้งเตือนจนได้ S/A<br>5) 🎮 ทดลองขับ: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> (mecanum <kbd>Q</kbd>/<kbd>E</kbd> สไลด์)<br>6) ส่งออก: 🚀 ขั้น 3 (ros2_control/Nav2) หรือ 📦 package เปิดใน <b>RViz</b>/<b>Gazebo Harmonic</b> ได้ทันที</p>
      <h2>ปุ่มลัด</h2><p class="note"><kbd>R</kbd> หมุน 45° · <kbd>Shift</kbd>+<kbd>R</kbd> หมุนกลับ · <kbd>Del</kbd> ถอด · <kbd>Esc</kbd> ยกเลิก · ลากซ้าย = หมุนมุมกล้อง · ลากขวา = เลื่อน · ล้อเมาส์ = ซูม</p>
      <h2>ข้อมูลอุปกรณ์</h2><p class="note">สเปกมาจาก <code>data/registry.json</code> · ราคา/ลิงก์ TESR Shop จากไฟล์ CSV หรือ Google Sheet ของทีม (ตั้งค่าในหน้า 1) — เพิ่มสินค้าในชีตแล้วขึ้นในโรงรถทันที</p>`;
  }
  tabBody.innerHTML = h;
}

tabBody.addEventListener('input', (e) => {
  const el = e.target, path = el.dataset.bind; if (!path) return;
  const v = Number(el.value);
  const setter = () => {
    const [a, b] = path.split('.'); state[a][b] = v;
    if (path === 'chassis.width' && state.chassis.shape === 'round') state.chassis.length = v;
  };
  if (path.startsWith('chassis.') || path === 'drive.wheelDiameter') withReanchor(setter); else setter();
  const lab = $(`val-${path.replace('.', '-')}`); if (lab) lab.textContent = `${fmt(v, 3)} ${el.dataset.unit || ''}`;
  changed(true);
});
tabBody.addEventListener('change', (e) => { if (e.target.dataset.bind) renderTab(); });
tabBody.addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act, v = a.dataset.v, id = a.dataset.id, slot = a.dataset.slot;
  const s = state;
  if (act === 'bp') { state = G.applyBlueprint(v, registry); selectedUid = null; tc.detach(); driveRoot.position.set(0, 0, 0); driveRoot.rotation.set(0, 0, 0); $('robotName').value = state.name; changed(false); fitView(); }
  else if (act === 'floor') { s.mission.floor = v; changed(true); }
  else if (act === 'env') { s.mission.envType = v; changed(true); }
  else if (act === 'shape') { withReanchor(() => { s.chassis.shape = v; if (v === 'round') s.chassis.length = s.chassis.width; }); changed(true); }
  else if (act === 'color') { s.chassis.color = v; changed(false); }
  else if (act === 'drive') { s.drive.type = v; s.drive.driverCount = v === 'mecanum' ? 2 : 1; if (v === 'mecanum' && !s.drive.wheelbase) s.drive.wheelbase = r2(s.chassis.length * 0.6); changed(true); }
  else if (act === 'caster') { s.drive.casterLayout = v; changed(false); }
  else if (act === 'pick') { if (slot === 'motor') s.drive.motor = id; else if (slot === 'driver') s.drive.driver = id; else if (slot === 'battery') s.power.battery = id; else if (slot === 'compute') s.compute = id; s.user[slot] = true; changed(true); }
  else if (act === 'auto') { s.user[slot] = false; changed(true); }
  else if (act === 'volt') { if (v === 'auto') s.user.busV = false; else { s.power.busV = Number(v); s.user.busV = true; } changed(true); }
  else if (act === 'estop') { s.estop = !s.estop; changed(true); }
  else if (act === 'mount') { startMount({ kind: 'sensor', hw: id, category: slot }); return; }
  else if (act === 'lidarLayout') {
    const hw = (s.sensors.find((x) => x.category === 'lidar') || {}).hw || T.byCategory(registry, 'lidar')[0].id;
    s.sensors = s.sensors.filter((x) => x.category !== 'lidar').concat(G.placeLayout('lidar', hw, v, s, registry)); selectedUid = null; changed(true);
  }
  else if (act === 'sel') { if (!e.target.closest('button')) select(v); return; }
  else if (act === 'del') { selectedUid = v; deleteSel(); }
  else if (act === 'addPart') { const size = v === 'box' ? [0.2, 0.15, 0.05] : v === 'cylinder' ? [0.06, 0.06, 0.25] : [0.1, 0.1, 0.1]; startMount({ kind: 'part', part: { kind: v, size, color: '#8c8c92', mass: 0.3 } }); return; }
  else if (act === 'uploadPart') { $('partInput').click(); return; }
  else if (act === 'uploadShell') { $('shellInput').click(); return; }
  else if (act === 'clearShell') { s.chassis.shell = null; changed(false); }
  renderTab();
});
const r2 = (x) => Math.round(x * 100) / 100;

// ================================================================== uploads
const safeName = (n) => n.toLowerCase().replace(/\.stl$/i, '').replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) + '.stl';
function loadStl(buf, file) {
  const geo = new STLLoader().parse(buf); geo.computeBoundingBox(); geo.computeVertexNormals();
  meshStore.set(file, buf); geoCache.set(file, geo);
  const bb = geo.boundingBox, size = bb.getSize(new THREE.Vector3()).toArray(), scale = Math.max(...size) > 10 ? 0.001 : 1;
  return { geo, min: bb.min.toArray(), center: bb.getCenter(new THREE.Vector3()).toArray(), size, scale };
}
$('shellInput').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const file = safeName(f.name), info = loadStl(await f.arrayBuffer(), file), k = info.scale;
  withReanchor(() => {
    state.chassis.shape = 'box';
    state.chassis.length = r2(Math.max(0.1, info.size[0] * k)); state.chassis.width = r2(Math.max(0.1, info.size[1] * k)); state.chassis.height = r2(Math.max(0.05, info.size[2] * k));
    state.chassis.shell = { file, scale: k, min: info.min };
  });
  status(`โครง ${file}: ${state.chassis.length} × ${state.chassis.width} × ${state.chassis.height} m (${k === 0.001 ? 'mm → m' : 'm'})`);
  changed(true); renderTab();
};
$('partInput').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const file = safeName(f.name), info = loadStl(await f.arrayBuffer(), file), k = info.scale;
  startMount({ kind: 'part', part: { kind: 'mesh', file, scale: k, center: info.center, size: info.size.map((v) => r2(Math.max(0.01, v * k))), color: '#c9a84c', mass: 0.5 } });
};

// ================================================================== HUD
function renderHud() {
  const s = dv.stats, m = state.mission;
  $('rank').dataset.rank = dv.rank; $('rank').innerHTML = `<small>RANK</small>${dv.rank}`;
  $('robotSub').textContent = `${state.drive.type === 'mecanum' ? 'Mecanum' : 'Differential'} · ${state.power.busV} V · ${dv.sensors.filter((x) => x.category === 'lidar').length} LiDAR · ${dv.sensors.filter((x) => /camera/.test(x.category)).length} กล้อง`;
  $('stats').innerHTML = [
    ['⚡ ความเร็ว', s.speed, `${m.vMax} m/s`], ['💪 แรงขับ', s.power, dv.motor ? `×${fmt(dv.margin, 1)}` : '—'],
    ['🔋 ความอึด', s.endurance, `${fmt(dv.runtimeAch, 1)} / ${m.runtimeH} h`], ['👁 การมองเห็น', s.vision, `${Math.round(dv.coverage * 100)}%`],
    ['🛡 ความปลอดภัย', s.safety, `${Math.round(s.safety * 100)}`],
  ].map(([k, v, t]) => `<div class="stat"><div class="row"><span>${k}</span><b>${t}</b></div><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div></div>`).join('');
  $('numbers').innerHTML = `
    <div><b>${fmt(dv.totalMass, 0)} kg</b><span>มวลรวม (หุ่น ${fmt(dv.robotMass, 0)})</span></div>
    <div><b>${state.power.busV} V</b><span>ระบบไฟ${dv.suggestedBusV !== state.power.busV ? ` · แนะนำ ${dv.suggestedBusV}` : ''}</span></div>
    <div><b>${fmt(dv.dt.requiredMotorRatedTorque, 2)} N·m</b><span>มอเตอร์ต้องการ @ ${fmt(dv.dt.motorRpm, 0)} rpm</span></div>
    <div><b>${dv.nominal ? `${dv.nominal} V ×${dv.series}${dv.parallel > 1 ? ` ×${dv.parallel}∥` : ''}` : '—'}</b><span>แพ็กแบต · ${fmt(dv.packWh, 0)} Wh</span></div>
    <div><b>${dv.nav.localCostmap} m</b><span>Nav2 costmap · infl ${dv.nav.inflationRadius}</span></div>
    <div><b>${dv.bom.total ? fmt(dv.bom.total, 0) + ' ฿' : 'รอราคา'}</b><span>ราคาอุปกรณ์</span></div>`;
  $('warnings').innerHTML = dv.warnings.map((w) => `<div class="wi ${w.lvl}">${w.lvl === 'err' ? '🔴' : w.lvl === 'warn' ? '⚠️' : '✅'} ${esc(w.txt)}</div>`).join('');
  $('bomMini').innerHTML = dv.bom.lines.map((l) => {
    const p = l.product, link = p && p.shop_url ? `<a href="${esc(p.shop_url)}" target="_blank" rel="noopener">🛒 ${p.price != null ? fmt(p.price * l.qty, 0) + ' ฿' : 'ซื้อ'}</a>` : `<a href="https://tesrshop.com/?s=${encodeURIComponent(l.name)}" target="_blank" rel="noopener">🔍 Shop</a>`;
    return `<div class="bl"><span class="q">${l.qty}×</span><span class="n">${ICON[l.category] || '🔩'} ${esc(l.name)}</span>${link}</div>`;
  }).join('');
  status(`${state.name} · RANK ${dv.rank} · ${dv.bom.lines.reduce((a, l) => a + l.qty, 0)} ชิ้น`);
}
function renderInspector(soft) {
  const box = $('inspector'), it = selectedUid && findItem(selectedUid);
  if (!it) { box.hidden = true; return; }
  if (soft && box.contains(document.activeElement)) return;
  const si = dv && dv.sensors.find((x) => x.uid === it.uid), isPart = !it.hw;
  const title = isPart ? `ชิ้นส่วน · ${it.kind === 'mesh' ? esc(it.file) : it.kind}` : `${si ? si.id : ''} · ${esc(ids[it.hw]?.name || it.hw)}`;
  const f = (k, label, v, step = 0.005) => `<label>${label}<input type="number" step="${step}" data-ins="${k}" value="${Math.round(v * 1000) / 1000}"></label>`;
  box.hidden = false;
  box.innerHTML = `<h2>ชิ้นที่เลือก</h2><p class="note">${title}${si && si.category === 'lidar' ? ` · มองได้ ${si.fov}°${si.embedded ? ' (ฝังในตัวถัง)' : ' (บนหลังคา)'}` : ''}</p>
    <div class="grid4">${f('x', 'x (m)', it.pos[0])}${f('y', 'y (m)', it.pos[1])}${f('z', 'z (m)', it.pos[2])}${f('yaw', 'yaw (°)', (it.yaw || 0) * 180 / Math.PI, 5)}</div>
    ${isPart ? `<div class="grid4">${f('sx', 'กว้าง x', it.size[0])}${f('sy', 'y', it.size[1])}${f('sz', 'สูง z', it.size[2])}${f('mass', 'kg', it.mass, 0.1)}</div><label>สี<input type="color" data-ins="color" value="${esc(it.color || '#8c8c92')}"></label>` : ''}
    <div class="seg"><button data-ins-act="rl">⟲ 45°</button><button data-ins-act="rr">⟳ 45°</button><button data-ins-act="del">🗑 ถอด</button><button data-ins-act="close">✕</button></div>`;
}
$('inspector').addEventListener('input', (e) => {
  const k = e.target.dataset.ins, it = selectedUid && findItem(selectedUid); if (!k || !it) return;
  const v = k === 'color' ? e.target.value : Number(e.target.value);
  if (k === 'x' || k === 'y' || k === 'z') it.pos['xyz'.indexOf(k)] = v;
  else if (k === 'yaw') it.yaw = v * Math.PI / 180;
  else if (k === 'sx' || k === 'sy' || k === 'sz') { it.size['xyz'.indexOf(k[1])] = Math.max(0.005, v); if (it.kind === 'sphere') it.size = [it.size[0], it.size[0], it.size[0]]; }
  else if (k === 'mass') it.mass = Math.max(0, v);
  else if (k === 'color') it.color = v;
  changed(k === 'mass');
});
$('inspector').addEventListener('click', (e) => {
  const a = e.target.dataset.insAct; if (!a) return;
  if (a === 'rl') rotateSel(Math.PI / 4); else if (a === 'rr') rotateSel(-Math.PI / 4); else if (a === 'del') deleteSel(); else select(null);
});

// ================================================================== tools & exports
function toggleTool(t) {
  if (t === 'fit') { fitView(); return; }
  if (t === 'shot') { download(`${state.name}.png`, dataUrlBlob(renderer.domElement.toDataURL('image/png'))); return; }
  flags[t] = !flags[t];
  document.querySelector(`#tools button[data-tool="${t}"]`).classList.toggle('on', flags[t]);
  if (t === 'scan') scanFx.forEach((m) => { m.visible = flags.scan; });
  if (t === 'xray') applyXray();
  if (t === 'spin') controls.autoRotate = flags.spin;
  if (t === 'payload') buildRobot();
  if (t === 'drive') {
    keys.clear(); cancelMount();
    if (flags.drive) { select(null); banner('🎮 ทดลองขับ: <kbd>W</kbd>/<kbd>S</kbd> เดินหน้า-ถอย · <kbd>A</kbd>/<kbd>D</kbd> เลี้ยว' + (state.drive.type === 'mecanum' ? ' · <kbd>Q</kbd>/<kbd>E</kbd> สไลด์' : '') + ` · สูงสุด ${state.mission.vMax} m/s · <kbd>Esc</kbd> ออก`); }
    else { banner(''); driveRoot.position.set(0, 0, 0); driveRoot.rotation.set(0, 0, 0); fitView(); }
  }
}
$('tools').addEventListener('click', (e) => { const b = e.target.closest('button[data-tool]'); if (b) toggleTool(b.dataset.tool); });
$('robotName').addEventListener('input', (e) => {
  const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, '');
  if (v.length >= 2) { state.name = v.slice(0, 60); state.prefix = state.prefix || 'tesr_robot'; refresh(); }
});
$('robotName').addEventListener('change', (e) => { e.target.value = state.name; });

function dataUrlBlob(u) { const [h, b] = u.split(','), bin = atob(b), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: h.split(':')[1].split(';')[0] }); }
function download(name, data, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const usedMeshes = () => new Set([state.chassis.shell?.file, ...(state.parts || []).filter((p) => p.kind === 'mesh').map((p) => p.file)].filter(Boolean));
function b64(buf) { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const bin = atob(str), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }

$('exYaml').onclick = () => download(`${state.name}.robot.yaml`, G.toYaml(state, registry, dv), 'text/yaml');
$('exUrdf').onclick = () => download(`${state.name}.urdf`, G.toUrdf(state, registry, dv), 'application/xml');
$('exBom').onclick = () => download(`${state.name}_bom.csv`, T.bomCsv(dv.bom), 'text/csv');
$('exPng').onclick = () => toggleTool('shot');
$('exBuild').onclick = () => {
  const project = JSON.parse(localStorage.getItem(PROJECT_KEY) || '{}');
  Object.assign(project, { yaml: G.toYaml(state, registry, dv), design: { name: state.name, prefix: state.prefix }, garage: state, saved_at: new Date().toISOString() });
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  location.href = './build.html';
};
$('exZip').onclick = async () => {
  if (!window.JSZip) { status('โหลด JSZip ไม่ได้ — ตรวจอินเทอร์เน็ต'); return; }
  const files = G.rosPackage(state, registry, dv), zip = new window.JSZip(), rootDir = zip.folder(`${state.name}_ws`), pkg = `${state.prefix}_description`;
  Object.entries(files).forEach(([p, c]) => rootDir.file(p, c));
  const missing = [];
  usedMeshes().forEach((f) => { if (meshStore.has(f)) rootDir.file(`src/${pkg}/meshes/${f}`, meshStore.get(f)); else missing.push(f); });
  download(`${state.name}_ws.zip`, await zip.generateAsync({ type: 'blob' }));
  status(missing.length ? `ดาวน์โหลดแล้ว — ขาดไฟล์ mesh: ${missing.join(', ')} (อัปโหลดใหม่ก่อน)` : `ดาวน์โหลด ${state.name}_ws.zip แล้ว · colcon build → ros2 launch ${pkg} gazebo.launch.py`);
};
$('exSave').onclick = () => {
  const meshes = {}; usedMeshes().forEach((f) => { if (meshStore.has(f)) meshes[f] = b64(meshStore.get(f)); });
  download(`${state.name}.garage.json`, JSON.stringify({ format: 'tesr-garage', version: 1, state, meshes }), 'application/json');
};
$('exLoad').onclick = () => $('saveInput').click();
$('saveInput').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.format !== 'tesr-garage' || !j.state || !j.state.chassis) throw new Error('ไม่ใช่ไฟล์เซฟโรงรถ');
    Object.entries(j.meshes || {}).forEach(([file, data]) => loadStl(unb64(data), file));
    state = j.state; state.parts = state.parts || []; state.user = state.user || {};
    selectedUid = null; $('robotName').value = state.name; changed(false); renderTab(); fitView();
    status(`โหลดเซฟ ${f.name} แล้ว`);
  } catch (err) { status(`โหลดไม่สำเร็จ: ${err.message}`); }
};

// ================================================================== boot
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(`load ${src}`)); document.head.appendChild(s); }); }
(async () => {
  try {
    // app.js registers its page UI on DOMContentLoaded; loading it after 'load' keeps that UI from starting here
    await new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
    await loadScript('./app.js');
    T = window.TESR;
    registry = await (await fetch('./data/registry.json', { cache: 'no-store' })).json();
    registry.hardware.forEach((h) => { ids[h.id] = h; });
    try {
      const ref = new URLSearchParams(location.search).get('catalog') || localStorage.getItem('tesr_rb_catalog') || '';
      const res = await fetch(T.catalogUrl(ref), { cache: 'no-store' });
      if (res.ok) catalog = T.parseCatalog(await res.text());
    } catch (_) { catalog = []; }
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) { saved = null; }
    state = saved && saved.version === 1 && saved.chassis && saved.drive ? saved : G.applyBlueprint('amr_300', registry);
    state.parts = state.parts || []; state.user = state.user || {};
    $('robotName').value = state.name;
    dv = G.derive(state, registry, catalog);
    renderTab(); refresh(); buildRobot(); fitView();
    $('loading').remove();
  } catch (err) {
    console.error(err);
    $('loading').textContent = `เปิดโรงรถไม่สำเร็จ: ${err.message}`;
  }
})();
