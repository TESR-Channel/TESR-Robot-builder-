/* TESR Robot Builder — TF / frame layers for the Garage (docs/garage-layers.js)
 * A layer panel like the Displays list in RViz, but for people who have never opened RViz:
 *   3D model · see-through · TF axes · frame names · TF links · sensor range · footprint + safety margin · collision shapes · floor
 * plus the TF tree as a clickable list (parent → child, position and rotation of every frame) and a one-click URDF export.
 * Frame names and poses come from garage-core.js frames(), the same data the exported URDF / ROS 2 workspace is written from,
 * so what you see here is what `ros2 run tf2_tools view_frames` and RViz will show.
 * The module only adds objects under driveRoot and reads window.__garage; the Garage logic stays in garage.js.
 */
const KEY = 'tesr_rb_layers';
const DEFAULTS = { model: true, xray: false, payload: true, tf: false, names: false, links: false, scan: true, footprint: false, collision: false, floor: true };
const PRESETS = {
  design: { model: true, xray: false, payload: true, tf: false, names: false, links: false, scan: true, footprint: false, collision: false, floor: true },
  rviz: { model: true, xray: true, payload: false, tf: true, names: true, links: true, scan: false, footprint: false, collision: false, floor: true },
  nav: { model: true, xray: true, payload: false, tf: false, names: false, links: false, scan: true, footprint: true, collision: true, floor: true },
};
const LAYERS = [
  ['model', '🤖', 'โมเดล 3D', 'ตัวหุ่นที่มองเห็น (visual)'],
  ['xray', '🩻', 'มองทะลุตัวถัง', 'เห็นแบต คอมพิวเตอร์ และแกนที่อยู่ข้างใน'],
  ['payload', '📦', 'ของที่บรรทุก', 'กล่องแสดงขนาดของที่หุ่นบรรทุก'],
  ['tf', '🧭', 'แกน TF', 'แกน X แดง · Y เขียว · Z น้ำเงิน ของทุก frame'],
  ['names', '🏷', 'ชื่อ frame', 'ชื่อเดียวกับใน URDF และ RViz'],
  ['links', '🔗', 'เส้นเชื่อม TF', 'เส้นจาก frame แม่ไป frame ลูก'],
  ['scan', '📡', 'ระยะสแกน', 'ระยะมองเห็นของ LiDAR และกล้อง'],
  ['footprint', '⬛', 'ขอบเขตหุ่น + ระยะกันชน', 'footprint และ inflation ที่ Nav2 ใช้วางแผน'],
  ['collision', '🧱', 'รูปทรงชน', 'รูปทรงที่ Gazebo ใช้คำนวณการชน (collision)'],
  ['floor', '▦', 'พื้นโรงรถ', 'พื้นและวงแหวนตกแต่ง'],
];
const KIND = { base: ['#e9c86a', 'ฐานหุ่น'], wheel: ['#9aa0a6', 'ล้อขับ'], caster: ['#7c7f86', 'ล้อประคอง'], lidar: ['#ff5a4f', 'LiDAR'], camera: ['#5aa9ff', 'กล้อง'], optical: ['#8fd0ff', 'แกนภาพ'], imu: ['#ffa64d', 'IMU'], part: ['#c9a84c', 'ชิ้นส่วนเสริม'] };
const TOOLS = ['xray', 'scan', 'payload'];   // layers that garage.js already owns as toolbar flags
const COL = { x: 0xff453a, y: 0x30d158, z: 0x3b82f6, link: 0xffd60a, foot: 0x2dd4ff, infl: 0xff9f0a, coll: 0x4ade80 };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n2 = (v) => (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3).replace(/\.?0+$/, '') || '0';
const degOf = (v) => Math.round(v * 180 / Math.PI);

let g = null, THREE = null, root = null, frames = [], world = new Map(), focus = null;
let layers = { ...DEFAULTS };
try { layers = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) { /* first visit */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(layers)); } catch (_) { /* quota */ } };

// ------------------------------------------------------------------ three.js helpers
const overlay = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false });
const lineMat = (color, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false });
function disposeAll(o) {
  o.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) [].concat(c.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
  });
  o.clear();
}
function axes(len, thick) {
  const grp = new THREE.Group();
  [['x', [0, 0, -Math.PI / 2]], ['y', [0, 0, 0]], ['z', [Math.PI / 2, 0, 0]]].forEach(([k, rot]) => {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(thick, thick, len, 10).translate(0, len / 2, 0), overlay(COL[k]));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(thick * 2.4, thick * 6, 12).translate(0, len + thick * 3, 0), overlay(COL[k]));
    const arm = new THREE.Group(); arm.add(shaft, tip); arm.rotation.set(...rot); grp.add(arm);
  });
  grp.traverse((o) => { o.renderOrder = 1000; });
  return grp;
}
function label(text, color, height) {
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d'), fs = 44, font = `600 ${fs}px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 28; cv.width = w; cv.height = fs + 22;
  ctx.font = font; ctx.fillStyle = 'rgba(8,8,12,.86)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, cv.height, 12); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, 14, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, toneMapped: false, transparent: true }));
  sp.scale.set(height * cv.width / cv.height, height, 1); sp.renderOrder = 1002;
  return sp;
}
function loop(points, color, opacity = 1) {
  const geo = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p[0], p[1], p[2] ?? 0.006)));
  const l = new THREE.LineLoop(geo, lineMat(color, opacity)); l.renderOrder = 998; return l;
}
const circle = (rad, color, opacity) => loop(Array.from({ length: 96 }, (_, i) => [rad * Math.cos(i / 96 * 2 * Math.PI), rad * Math.sin(i / 96 * 2 * Math.PI)]), color, opacity);
function wire(geo, color) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), lineMat(color, 0.9)); geo.dispose(); l.renderOrder = 997; return l;
}

// ------------------------------------------------------------------ scene
function poseMatrix(f) {
  return new THREE.Matrix4().compose(new THREE.Vector3(...f.xyz), new THREE.Quaternion().setFromEuler(new THREE.Euler(f.rpy[0], f.rpy[1], f.rpy[2], 'ZYX')), new THREE.Vector3(1, 1, 1));
}
function rebuild() {
  if (!g || !g.dv || !g.state) return;
  const G = window.TESR_GARAGE, st = g.state, dv = g.dv, c = st.chassis;
  frames = G.frames(st, g.registry, dv);
  world = new Map();
  frames.forEach((f) => { const m = poseMatrix(f); world.set(f.name, f.parent && world.has(f.parent) ? world.get(f.parent).clone().multiply(m) : m); });
  if (focus && !world.has(focus)) focus = null;
  if (!root) { root = new THREE.Group(); root.name = 'tesr_layers'; g.driveRoot.add(root); }
  disposeAll(root);

  const size = Math.max(c.length, c.width), L = Math.min(0.2, Math.max(0.07, size * 0.2)), T = L * 0.03;
  const seen = {};
  const gTf = new THREE.Group(), gNames = new THREE.Group(), gLinks = new THREE.Group();
  frames.forEach((f) => {
    const m = world.get(f.name), pos = new THREE.Vector3().setFromMatrixPosition(m), isFocus = focus === f.name;
    const k = f.kind === 'base' ? 1 : f.kind === 'optical' ? 0.55 : 0.72;
    const a = axes(L * k * (isFocus ? 1.7 : 1), T * (isFocus ? 1.8 : 1)); a.applyMatrix4(m); a.userData.frame = f.name;
    if (focus && !isFocus) a.traverse((o) => { if (o.material) o.material.opacity = 0.28; });
    gTf.add(a);
    const key = pos.toArray().map((v) => v.toFixed(2)).join(','), nth = seen[key] = (seen[key] || 0) + 1, lh = L * 0.24;
    const sp = label(f.name, isFocus ? '#ffffff' : KIND[f.kind][0], lh * (isFocus ? 1.3 : 1));
    sp.position.copy(pos).add(new THREE.Vector3(0, 0, L * k * 0.55 + lh * (0.9 + (nth - 1) * 1.15)));
    if (focus && !isFocus) sp.material.opacity = 0.35;
    gNames.add(sp);
    if (f.parent && world.has(f.parent)) {
      const p0 = new THREE.Vector3().setFromMatrixPosition(world.get(f.parent));
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p0, pos]), lineMat(COL.link, focus && !isFocus ? 0.3 : 0.95)); ln.renderOrder = 999; gLinks.add(ln);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(T * 2.2, 12, 8), overlay(COL.link)); dot.position.copy(pos); dot.renderOrder = 1001; gLinks.add(dot);
    }
  });
  gTf.visible = layers.tf || !!focus; gNames.visible = layers.names || !!focus; gLinks.visible = layers.links;
  if (focus && !layers.names) gNames.children.forEach((s, i) => { s.visible = frames[i].name === focus; });
  if (focus && !layers.tf) gTf.children.forEach((a) => { a.visible = a.userData.frame === focus; });

  // footprint (what Nav2 thinks the robot occupies) + inflation radius, drawn on the floor
  const gFoot = new THREE.Group(), nav = dv.nav;
  if (nav && nav.footprint) {
    gFoot.add(loop(nav.footprint, COL.foot));
    const fill = new THREE.Shape(nav.footprint.map((p) => new THREE.Vector2(p[0], p[1])));
    const fm = new THREE.Mesh(new THREE.ShapeGeometry(fill), overlay(COL.foot, 0.12)); fm.position.z = 0.005; fm.renderOrder = 996; gFoot.add(fm);
    gFoot.add(circle(nav.circumscribedRadius, COL.foot, 0.45), circle(nav.inflationRadius, COL.infl, 0.95));
  }
  gFoot.visible = layers.footprint;

  // collision shapes, the same primitives garage-core.js toUrdf() writes
  const gColl = new THREE.Group(), r = dv.r, zc = (dv.bottom + dv.top) / 2 + r;
  const body = wire(c.shape === 'round' ? new THREE.CylinderGeometry(c.width / 2, c.width / 2, c.height, 28).rotateX(Math.PI / 2) : new THREE.BoxGeometry(c.length, c.width, c.height), COL.coll);
  body.position.z = zc; gColl.add(body);
  dv.wheels.forEach((w) => { const m = wire(new THREE.CylinderGeometry(r, r, st.drive.wheelWidth, 20), COL.coll); m.position.set(w.x, w.y, r); gColl.add(m); });
  dv.casters.forEach((k) => { const m = wire(new THREE.SphereGeometry(dv.casterR, 10, 6), COL.coll); m.position.set(k.x, k.y, dv.casterR); gColl.add(m); });
  gColl.visible = layers.collision;

  root.add(gFoot, gColl, gLinks, gTf, gNames);
  g.robotRoot.visible = layers.model;
  if (!document.body.classList.contains('gm-playing')) { g.stageStatic.visible = layers.floor; g.stageFx.visible = layers.floor; }
  renderTree();
}

// ------------------------------------------------------------------ panel
function setLayer(k, on) {
  layers[k] = on;
  if (TOOLS.includes(k)) { if (g.flags[k] !== on) g.toggleTool(k); }
  save(); syncChecks(); rebuild();
}
function applyPreset(name) {
  const wasTf = layers.tf;
  layers = { ...PRESETS[name] }; focus = null;
  if (name === 'rviz' && !wasTf) { g.fitView(); g.camera.position.lerp(g.controls.target, 0.38); g.controls.update(); }   // come closer: axes are small
  TOOLS.forEach((k) => { if (g.flags[k] !== layers[k]) g.toggleTool(k); });
  save(); syncChecks(); rebuild();
  document.querySelectorAll('#layerPanel [data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === name));
}
function syncChecks() {
  document.querySelectorAll('#layerPanel input[data-layer]').forEach((i) => { i.checked = !!layers[i.dataset.layer]; });
  const on = layers.tf || layers.names || layers.links || layers.footprint || layers.collision;
  const b = $('layerBtn'); if (b) b.classList.toggle('on', on || $('layerPanel')?.classList.contains('open'));
}
function renderTree() {
  const box = $('tfTree'); if (!box) return;
  const depth = {}; frames.forEach((f) => { depth[f.name] = f.parent ? (depth[f.parent] ?? 0) + 1 : 0; });
  $('tfCount').textContent = String(frames.length);
  box.innerHTML = frames.map((f) => {
    const yaw = degOf(f.rpy[2]), rot = f.rpy.some((v) => Math.abs(v) > 1e-4);
    return `<button type="button" class="tf-row${focus === f.name ? ' sel' : ''}" data-frame="${esc(f.name)}" style="--d:${depth[f.name]}" title="${esc(f.note)}">
      <i style="background:${KIND[f.kind][0]}"></i><code>${esc(f.name)}</code><small>${f.parent ? `x ${n2(f.xyz[0])} · y ${n2(f.xyz[1])} · z ${n2(f.xyz[2])}${rot ? (f.kind === 'optical' ? ' · หมุนเป็นแกนภาพ' : ` · หัน ${yaw}°`) : ''}` : 'จุดเริ่มของหุ่น'}</small></button>`;
  }).join('');
  const f = frames.find((x) => x.name === focus), info = $('tfInfo');
  info.hidden = !f;
  if (f) info.innerHTML = `<b>${esc(f.name)}</b> · ${KIND[f.kind][1]}<br>${esc(f.note)}<br>${f.parent
    ? `ห่างจาก <code>${esc(f.parent)}</code> : x ${n2(f.xyz[0])} m (หน้า), y ${n2(f.xyz[1])} m (ซ้าย), z ${n2(f.xyz[2])} m (ขึ้น)<br>หมุน roll ${degOf(f.rpy[0])}° · pitch ${degOf(f.rpy[1])}° · yaw ${degOf(f.rpy[2])}°`
    : 'frame บนสุดของหุ่น — ระบบนำทางจะต่อ <code>odom</code> และ <code>map</code> เข้ามาที่นี่'}`;
}
function tfTable() {
  const rows = frames.map((f) => [f.name, f.parent || '-', ...f.xyz.map(n2), ...f.rpy.map((v) => n2(v))].join('\t'));
  return ['frame\tparent\tx\ty\tz\troll\tpitch\tyaw', ...rows].join('\n');
}
const NARROW = window.matchMedia('(max-width:1149px)');
/** Desktop: the panel floats over the 3D view. Tablet / phone: it sits under the 3D view so the robot stays visible. */
function dock() {
  const p = $('layerPanel'), host = NARROW.matches ? document.querySelector('main.garage') : document.querySelector('section.stage');
  if (p && host && p.parentNode !== host) host.appendChild(p);
}
function openPanel(open) {
  const p = $('layerPanel'); dock(); p.classList.toggle('open', open);
  if (open && !(layers.tf || layers.names || layers.links || layers.footprint || layers.collision)) applyPreset('rviz');
  syncChecks();
}
function buildPanel() {
  const stage = document.querySelector('section.stage'), tools = $('tools');
  if (!stage || !tools || $('layerPanel')) return;
  const btn = document.createElement('button');
  btn.id = 'layerBtn'; btn.type = 'button'; btn.title = 'เปิด/ปิดเลเยอร์: แกน TF ชื่อ frame ขอบเขตหุ่น รูปทรงชน'; btn.textContent = '🧭 เลเยอร์ / TF';
  tools.insertBefore(btn, tools.firstChild);
  const p = document.createElement('div'); p.id = 'layerPanel';
  p.innerHTML = `<div class="lp-head"><b>🧭 เลเยอร์ที่มองเห็น</b><button type="button" class="lp-x" title="ปิด">✕</button></div>
    <div class="lp-presets"><button type="button" data-preset="design">ออกแบบ</button><button type="button" data-preset="rviz">ดู TF</button><button type="button" data-preset="nav">นำทาง</button></div>
    <div class="lp-list">${LAYERS.map(([k, ic, name, tip]) => `<label title="${esc(tip)}"><input type="checkbox" data-layer="${k}"><span>${ic}</span><span>${name}</span></label>`).join('')}</div>
    <div class="lp-legend">แกน: <i class="ax x"></i>X หน้า <i class="ax y"></i>Y ซ้าย <i class="ax z"></i>Z ขึ้น</div>
    <details class="lp-tree" open><summary>ผัง TF ของหุ่น (<span id="tfCount">0</span> frame) — กดชื่อเพื่อชี้ตำแหน่ง</summary><div id="tfTree"></div><div class="lp-info" id="tfInfo" hidden></div></details>
    <div class="lp-actions"><button type="button" class="gold" id="lpUrdf">⬇ ดาวน์โหลด URDF</button><button type="button" id="lpCopy">คัดลอกตาราง TF</button></div>
    <p class="lp-note">ชื่อ frame และตำแหน่งตรงกับไฟล์ URDF และ ROS 2 workspace ที่ส่งออก เปิดใน RViz จะเห็นแบบเดียวกัน</p>`;
  stage.appendChild(p); dock();
  NARROW.addEventListener('change', dock);
  btn.addEventListener('click', () => openPanel(!p.classList.contains('open')));
  p.querySelector('.lp-x').addEventListener('click', () => openPanel(false));
  p.addEventListener('change', (e) => { const i = e.target.closest('input[data-layer]'); if (i) { setLayer(i.dataset.layer, i.checked); p.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('on')); } });
  p.addEventListener('click', (e) => {
    const pre = e.target.closest('[data-preset]'); if (pre) { applyPreset(pre.dataset.preset); return; }
    const row = e.target.closest('.tf-row'); if (row) { focus = focus === row.dataset.frame ? null : row.dataset.frame; rebuild(); }
  });
  $('lpUrdf').addEventListener('click', () => $('exUrdf')?.click());
  $('lpCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(tfTable()); $('lpCopy').textContent = 'คัดลอกแล้ว ✓'; } catch (_) { $('lpCopy').textContent = 'คัดลอกไม่ได้'; }
    setTimeout(() => { $('lpCopy').textContent = 'คัดลอกตาราง TF'; }, 1600);
  });
  // quick buttons in the right-hand panel (index.html)
  $('quickLayers')?.addEventListener('click', () => { openPanel(true); applyPreset('rviz'); });
  $('quickUrdf')?.addEventListener('click', () => $('exUrdf')?.click());
  // the old toolbar buttons keep working and stay in step with the panel
  tools.addEventListener('click', (e) => { const b = e.target.closest('button[data-tool]'); if (b && TOOLS.includes(b.dataset.tool)) { layers[b.dataset.tool] = g.flags[b.dataset.tool]; save(); syncChecks(); } });
  syncChecks();
}

// ------------------------------------------------------------------ start
function start() {
  g = window.__garage; if (!g) { setTimeout(start, 120); return; }
  THREE = g.THREE;
  TOOLS.forEach((k) => { layers[k] = g.flags[k]; });
  buildPanel();
  window.addEventListener('garage:built', rebuild);
  if (g.dv) rebuild();
  window.__garageLayers = { get layers() { return layers; }, get frames() { return frames; }, setLayer, applyPreset, openPanel, focus: (name) => { focus = name; rebuild(); }, tfTable };
}
start();
