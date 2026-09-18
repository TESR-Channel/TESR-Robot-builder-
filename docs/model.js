/* TESR Robot Builder — Model Studio (docs/model.js), ES module loaded via the import map in model.html.
 * World is Z-up in metres (ROS convention); the scene origin is base_link.
 * Pure state/export logic lives in model-core.js (TESR_MODEL) so it can be unit-tested with Node.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import URDFLoader from 'urdf-loader';

const M = window.TESR_MODEL;
const $ = (id) => document.getElementById(id);
const PROJECT_KEY = 'tesr_rb_project';

// ------------------------------------------------------------------ scene
const viewport = $('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x07070a, 1);
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
camera.up.set(0, 0, 1);
camera.position.set(1.6, -1.6, 1.1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xe8e6e1, 0x1a1012, 0.9));
const key = new THREE.DirectionalLight(0xfff2d0, 1.1); key.position.set(2, -3, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0x8b0000, 0.6); rim.position.set(-3, 2, 1); scene.add(rim);

const grid = new THREE.GridHelper(10, 50, 0xc9a84c, 0x24242a);
grid.rotation.x = Math.PI / 2; grid.material.transparent = true; grid.material.opacity = 0.45;
scene.add(grid);
scene.add(new THREE.AxesHelper(0.3));

// starfield
{
  const n = 1800, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 30); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.7 })));
}

const parts = new THREE.Group(); scene.add(parts);          // STL layers (state.meshes) + URDF robots
const ghost = new THREE.Group(); ghost.visible = false; scene.add(ghost); // reference primitives from step 1

const tc = new TransformControls(camera, renderer.domElement);
scene.add(tc.getHelper ? tc.getHelper() : tc);
tc.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; });
tc.addEventListener('objectChange', () => { syncFromObject(); renderProps(); });

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport); resize();
(function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();

// ------------------------------------------------------------------ state
let state = M.emptyState();
const objects = new Map(); // mesh id → THREE.Object3D
const fileMap = new Map(); // basename (lower) → File
let selected = null;       // THREE.Object3D
let loadedUrdf = null;     // { name, text, robot }
let groundZ = 0;

const status = (msg) => { $('status').textContent = msg; };
const loading = (on) => { $('loading').style.display = on ? 'flex' : 'none'; };

function materialFor(hex) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), metalness: 0.25, roughness: 0.55 });
}

function applyState(m) {
  const o = objects.get(m.id); if (!o) return;
  o.position.fromArray(m.position);
  o.rotation.set(m.rpy[0], m.rpy[1], m.rpy[2], 'ZYX');
  o.scale.fromArray(m.scale);
  o.visible = m.visible;
  if (o.material) o.material.color.set(m.color);
}

function syncFromObject() {
  if (!selected || !selected.userData.meshId) return;
  const m = state.meshes.find((x) => x.id === selected.userData.meshId); if (!m) return;
  const e = new THREE.Euler().setFromQuaternion(selected.quaternion, 'ZYX');
  m.position = selected.position.toArray().map(M.r4);
  m.rpy = [e.x, e.y, e.z].map(M.r4);
  m.scale = selected.scale.toArray().map((v) => Math.round(v * 1e6) / 1e6);
}

function addStlGeometry(geometry, file) {
  geometry.computeBoundingBox();
  const size = new THREE.Vector3(); geometry.boundingBox.getSize(size);
  const m = M.addMesh(state, { name: file.name.replace(/\.[^.]+$/, ''), file: file.name, bboxSizeRaw: size.toArray(), triangles: geometry.attributes.position.count / 3 });
  const mesh = new THREE.Mesh(geometry, materialFor(m.color));
  mesh.userData.meshId = m.id; mesh.castShadow = true;
  objects.set(m.id, mesh); parts.add(mesh); applyState(m);
  return m;
}

// ------------------------------------------------------------------ file loading
const readBuffer = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(file); });
const readText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });

async function handleFiles(files) {
  const list = [...files]; if (!list.length) return;
  loading(true);
  try {
    list.forEach((f) => fileMap.set(f.name.toLowerCase(), f));
    const urdf = list.find((f) => /\.urdf$/i.test(f.name));
    const stls = list.filter((f) => /\.stl$/i.test(f.name));
    if (urdf) await loadUrdf(urdf);
    else for (const f of stls) addStlGeometry(new STLLoader().parse(await readBuffer(f)), f);
    if (!urdf && !stls.length) status('ไม่พบ .stl หรือ .urdf ในไฟล์ที่เลือก (xacro ต้องแปลงก่อน: xacro robot.urdf.xacro > robot.urdf)');
    else status(`โหลดแล้ว ${list.length} ไฟล์`);
    $('fileNote').textContent = `${fileMap.size} ไฟล์ในเบราว์เซอร์ (ไม่ถูกอัปโหลดไปที่ไหน)`;
    renderLayers(); if (!urdf) fitView();
  } catch (e) { status(`โหลดไม่สำเร็จ: ${e.message}`); console.error(e); }
  loading(false);
}

async function loadUrdf(file) {
  const text = await readText(file);
  const loader = new URDFLoader();
  loader.packages = (pkg) => `pkg://${pkg}`;             // keep package:// paths resolvable → matched by basename below
  const missing = new Set();
  loader.loadMeshCb = (path, manager, material, done) => {
    const base = path.split('/').pop().toLowerCase();
    const f = fileMap.get(base);
    if (!f) { missing.add(base); done(null, new Error(`mesh not uploaded: ${base}`)); return; }
    if (/\.stl$/i.test(base)) {
      readBuffer(f).then((buf) => { const g = new STLLoader().parse(buf); done(new THREE.Mesh(g, material || materialFor('#8c8c92'))); }).catch((e) => done(null, e));
    } else if (/\.dae$/i.test(base)) {
      readText(f).then((t) => { const r = new ColladaLoader().parse(t, ''); done(r.scene); }).catch((e) => done(null, e));
    } else done(null, new Error(`unsupported mesh type: ${base}`));
  };
  if (loadedUrdf) { parts.remove(loadedUrdf.robot); }
  const robot = loader.parse(text);
  robot.userData.isRobot = true; robot.name = robot.robotName || file.name;
  parts.add(robot);
  loadedUrdf = { name: file.name, text, robot };
  $('robotName').value = (robot.robotName || 'my_robot').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  setTimeout(() => {
    renderJoints(robot); fitView();
    $('urdfNote').textContent = missing.size ? `mesh ที่ยังไม่ได้อัปโหลด: ${[...missing].join(', ')} — เลือกไฟล์เหล่านั้นเพิ่มแล้วโหลด URDF อีกครั้ง` : `URDF ${file.name}: ${Object.keys(robot.links).length} links, ${Object.keys(robot.joints).length} joints`;
  }, 300);
}

function renderJoints(robot) {
  const movable = Object.values(robot.joints).filter((j) => ['revolute', 'continuous', 'prismatic'].includes(j.jointType));
  $('jointsTitle').style.display = movable.length ? '' : 'none';
  $('joints').innerHTML = movable.map((j) => {
    const lo = j.jointType === 'continuous' ? -Math.PI : j.limit.lower, hi = j.jointType === 'continuous' ? Math.PI : j.limit.upper;
    return `<label>${j.name} <span class="muted">${j.jointType}</span><input type="range" min="${lo}" max="${hi}" step="0.01" value="0" data-joint="${j.name}"></label>`;
  }).join('');
  $('joints').querySelectorAll('input[data-joint]').forEach((el) => el.addEventListener('input', () => robot.setJointValue(el.dataset.joint, Number(el.value))));
}

// ------------------------------------------------------------------ UI: layers / props
function renderLayers() {
  const rows = state.meshes.map((m) => `<div class="layer ${selected?.userData.meshId === m.id ? 'sel' : ''}" data-id="${m.id}">
      <span class="sw" style="background:${m.color}"></span><span class="nm">${m.name}</span>
      <span class="muted">${m.bbox.size.map((v) => v.toFixed(2)).join('×')} m</span></div>`);
  if (loadedUrdf) rows.unshift(`<div class="layer ${selected?.userData.isRobot ? 'sel' : ''}" data-robot="1"><span class="sw" style="background:#C9A84C"></span><span class="nm">URDF · ${loadedUrdf.robot.robotName || loadedUrdf.name}</span></div>`);
  $('layers').innerHTML = rows.length ? rows.join('') : '<p class="muted">—</p>';
}

$('layers').addEventListener('click', (ev) => {
  const row = ev.target.closest('.layer'); if (!row) return;
  select(row.dataset.robot ? loadedUrdf.robot : objects.get(row.dataset.id));
});

function select(obj) {
  selected = obj || null;
  if (selected) tc.attach(selected); else tc.detach();
  renderLayers(); renderProps();
}

function renderProps() {
  const m = selected?.userData.meshId ? state.meshes.find((x) => x.id === selected.userData.meshId) : null;
  $('props').style.display = selected ? '' : 'none';
  if (!selected) { $('propTitle').textContent = 'ยังไม่ได้เลือก'; return; }
  if (m) {
    $('propTitle').textContent = m.file;
    $('pName').value = m.name;
    [['px', m.position[0]], ['py', m.position[1]], ['pz', m.position[2]], ['rr', M.deg(m.rpy[0])], ['rp', M.deg(m.rpy[1])], ['ry', M.deg(m.rpy[2])], ['sx', m.scale[0]], ['sy', m.scale[1]], ['sz', m.scale[2]]]
      .forEach(([id, v]) => { if (document.activeElement !== $(id)) $(id).value = v; });
    $('pColor').value = m.color; $('pVisible').checked = m.visible;
    $('pInfo').textContent = `${m.bbox.triangles} triangles · ไฟล์เดิมหน่วย ${m.bbox.raw_unit} · ขนาดหลังสเกล ${m.bbox.size.map((v) => v.toFixed(3)).join(' × ')} m`;
  } else {
    $('propTitle').textContent = `URDF · ${selected.robotName || selected.name}`;
    $('pName').value = selected.robotName || '';
    const e = new THREE.Euler().setFromQuaternion(selected.quaternion, 'ZYX');
    [['px', selected.position.x], ['py', selected.position.y], ['pz', selected.position.z], ['rr', M.deg(e.x)], ['rp', M.deg(e.y)], ['ry', M.deg(e.z)], ['sx', 1], ['sy', 1], ['sz', 1]]
      .forEach(([id, v]) => { if (document.activeElement !== $(id)) $(id).value = M.r4(v); });
    $('pInfo').textContent = 'ท่าของ root URDF ใช้ดูเท่านั้น — การส่งออก URDF จะให้ไฟล์ต้นฉบับ';
  }
}

function propsChanged() {
  if (!selected) return;
  const m = selected.userData.meshId ? state.meshes.find((x) => x.id === selected.userData.meshId) : null;
  const v = (id) => Number($(id).value) || 0;
  if (m) {
    m.name = $('pName').value || m.name;
    m.position = [v('px'), v('py'), v('pz')]; m.rpy = [M.rad(v('rr')), M.rad(v('rp')), M.rad(v('ry'))].map(M.r4);
    m.scale = [v('sx') || 1, v('sy') || 1, v('sz') || 1]; m.color = $('pColor').value; m.visible = $('pVisible').checked;
    applyState(m); renderLayers();
  } else {
    selected.position.set(v('px'), v('py'), v('pz'));
    selected.rotation.set(M.rad(v('rr')), M.rad(v('rp')), M.rad(v('ry')), 'ZYX');
  }
}
['pName', 'px', 'py', 'pz', 'rr', 'rp', 'ry', 'sx', 'sy', 'sz', 'pColor', 'pVisible'].forEach((id) => $(id).addEventListener('input', propsChanged));
document.querySelectorAll('button[data-scale]').forEach((b) => b.addEventListener('click', () => { const s = Number(b.dataset.scale); ['sx', 'sy', 'sz'].forEach((id) => ($(id).value = s)); propsChanged(); renderProps(); }));

$('centerXY').onclick = () => {
  if (!selected) return;
  const box = new THREE.Box3().setFromObject(selected), c = new THREE.Vector3(); box.getCenter(c);
  selected.position.x -= c.x; selected.position.y -= c.y; syncFromObject(); renderProps();
};
$('dropToGround').onclick = () => {
  if (!selected) return;
  const box = new THREE.Box3().setFromObject(selected);
  selected.position.z += groundZ - box.min.z; syncFromObject(); renderProps();
};
$('deleteMesh').onclick = () => {
  if (!selected) return;
  if (selected.userData.meshId) { parts.remove(selected); objects.delete(selected.userData.meshId); M.removeMesh(state, selected.userData.meshId); }
  else if (selected.userData.isRobot) { parts.remove(selected); loadedUrdf = null; $('joints').innerHTML = ''; $('jointsTitle').style.display = 'none'; }
  select(null);
};

// ------------------------------------------------------------------ picking
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4 || tc.dragging) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(parts.children, true)[0];
  if (!hit) { select(null); return; }
  let o = hit.object; while (o && !o.userData.meshId && !o.userData.isRobot) o = o.parent;
  select(o);
});

// ------------------------------------------------------------------ HUD
document.querySelectorAll('#hud button[data-mode]').forEach((b) => b.addEventListener('click', () => {
  tc.setMode(b.dataset.mode); document.querySelectorAll('#hud button[data-mode]').forEach((x) => x.classList.toggle('active', x === b));
}));
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const map = { w: 'translate', e: 'rotate', r: 'scale' };
  if (map[e.key]) document.querySelector(`#hud button[data-mode="${map[e.key]}"]`).click();
  if (e.key === 'Escape') select(null);
  if (e.key === 'Delete' && selected) $('deleteMesh').click();
});
$('toggleGrid').onclick = () => { grid.visible = !grid.visible; };
$('toggleGhost').onclick = () => { ghost.visible = !ghost.visible; };
$('fitView').onclick = () => fitView();

function fitView() {
  const box = new THREE.Box3();
  parts.traverse((o) => { if (o.isMesh && o.visible) box.expandByObject(o); });
  if (ghost.visible) box.expandByObject(ghost);
  if (box.isEmpty()) return;
  const c = new THREE.Vector3(), s = new THREE.Vector3(); box.getCenter(c); box.getSize(s);
  const d = Math.max(s.length(), 0.3) * 1.4;
  controls.target.copy(c);
  camera.position.copy(c).add(new THREE.Vector3(d, -d, d * 0.7));
  camera.near = d / 100; camera.far = Math.max(200, d * 10); camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ ghost from step 1
function buildGhost() {
  const project = JSON.parse(localStorage.getItem(PROJECT_KEY) || '{}');
  const design = project.design;
  ghost.clear();
  if (!design) { status('ยังไม่มีข้อมูลจากขั้น 1 — กด "ส่งไป Model Studio" ในหน้า Spec & Sizing ก่อน'); return; }
  const r = design.wheelDiameter / 2; groundZ = -r;
  grid.position.z = groundZ;
  M.designToPrimitives(design).forEach((p) => {
    let geom;
    if (p.kind === 'wheel') { geom = new THREE.CylinderGeometry(p.radius, p.radius, p.width, 32); geom.rotateX(Math.PI / 2); }
    else geom = new THREE.BoxGeometry(...p.size);
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color), transparent: true, opacity: 0.12 }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: new THREE.Color(p.color) }));
    const g = new THREE.Group(); g.add(mesh, edges);
    g.position.set(p.position[0], p.position[1], p.position[2] - r); // ground frame → base_link frame
    g.name = p.name; ghost.add(g);
  });
  ghost.visible = true;
  if (design.name) $('robotName').value = design.name;
  if (design.prefix) $('prefix').value = design.prefix;
  status(`เงาอ้างอิง: ${design.name} (${design.length}×${design.width}×${design.height} m, ${design.drive})`);
  fitView();
}
$('fromBuilder').onclick = buildGhost;

// ------------------------------------------------------------------ files UI
const drop = $('drop');
drop.onclick = () => $('fileInput').click();
$('fileInput').onchange = (e) => { handleFiles(e.target.files); e.target.value = ''; };
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
viewport.addEventListener('dragover', (e) => e.preventDefault());
viewport.addEventListener('drop', (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); });

$('clearAll').onclick = () => { parts.clear(); objects.clear(); state = M.emptyState($('robotName').value, $('prefix').value); loadedUrdf = null; $('joints').innerHTML = ''; select(null); status('ล้างแล้ว'); };
$('importJson').onclick = () => $('jsonInput').click();
$('jsonInput').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try {
    const s = M.importJson(await readText(f));
    state.meshes = []; parts.clear(); objects.clear();
    const missing = [];
    for (const m of s.meshes) {
      const file = fileMap.get(m.file.toLowerCase());
      if (!file) { missing.push(m.file); continue; }
      const geom = new STLLoader().parse(await readBuffer(file));
      const mesh = new THREE.Mesh(geom, materialFor(m.color)); mesh.userData.meshId = m.id;
      objects.set(m.id, mesh); parts.add(mesh); state.meshes.push(m); applyState(m);
    }
    state.name = s.name; state.prefix = s.prefix; $('robotName').value = s.name; $('prefix').value = s.prefix;
    renderLayers(); fitView();
    status(missing.length ? `นำเข้าแล้ว — ยังขาดไฟล์ STL: ${missing.join(', ')} (เลือกไฟล์ก่อนแล้วนำเข้าอีกครั้ง)` : `นำเข้า ${s.meshes.length} ชิ้นส่วน`);
  } catch (err) { status(`นำเข้าไม่สำเร็จ: ${err.message}`); }
};

// ------------------------------------------------------------------ export
function download(name, text, type = 'text/plain') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function currentState() {
  state.name = ($('robotName').value || 'my_robot').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  state.prefix = ($('prefix').value || 'tesr_robot').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return state;
}
$('exportUrdf').onclick = () => {
  const s = currentState();
  if (!s.meshes.length && loadedUrdf) return download(loadedUrdf.name, loadedUrdf.text, 'application/xml');
  download(`${s.name}.urdf`, M.exportUrdf(s), 'application/xml');
};
$('exportXacro').onclick = () => { const s = currentState(); download('meshes.xacro', M.exportXacro(s), 'application/xml'); };
$('exportJson').onclick = () => { const s = currentState(); download(`${s.name}.model.json`, M.exportJson(s), 'application/json'); };
$('exportPng').onclick = () => { const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png'); a.download = `${currentState().name}.png`; a.click(); };
$('saveProject').onclick = () => {
  const s = currentState();
  const project = JSON.parse(localStorage.getItem(PROJECT_KEY) || '{}');
  project.model = s; project.urdf = loadedUrdf ? { name: loadedUrdf.name, text: loadedUrdf.text } : null; project.saved_at = new Date().toISOString();
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  status(`บันทึกลงโปรเจกต์แล้ว (${s.meshes.length} ชิ้นส่วน${loadedUrdf ? ' + URDF' : ''}) — ขั้น 3 Definition/Generate อ่านจากที่นี่`);
};

// auto-load ghost if step 1 handed a design over
if (localStorage.getItem(PROJECT_KEY)) { try { buildGhost(); } catch (e) { console.warn(e); } }
