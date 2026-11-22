/* TESR Robot Builder — step 3 Mission Control (docs/build.js)
 * Runs the real Python engine (src/tesr_robot_builder) inside the browser with Pyodide:
 *   1. load ./data/engine.json (bundle written by `tesr-rb export-web`), or fall back to
 *      ./data/engine-manifest.json + raw.githubusercontent.com for each file;
 *   2. write the files into Pyodide's FS, import tesr_robot_builder.web_entry;
 *   3. build_json(yaml) → {report, files, summary}; JSZip → <name>_ws.zip.
 * When a robot comes from the Garage the whole pipeline runs by itself. Nothing leaves the browser.
 */
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs';
const PROJECT_KEY = 'tesr_rb_project';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pyodide = null, engineFiles = null, lastResult = null, fromProject = false;
const extraFiles = new Map(); // name → File (STL/DAE dropped here)

const status = (m) => { $('status').textContent = m; };
const progress = (pct, text) => { $('engineBar').style.width = `${pct}%`; if (text) $('engineText').textContent = text; };
const stage = (s, cls) => { const el = document.querySelector(`.stage[data-s="${s}"]`); if (el) el.className = `stage ${cls || ''}`; };
const resetStages = () => ['schema', 'rules', 'gen', 'ready'].forEach((s) => stage(s, ''));
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2600); }

// ------------------------------------------------------------------ engine boot
async function loadEngineFiles() {
  try {
    const r = await fetch('./data/engine.json', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); return j.files; }
  } catch (_) { /* fall through */ }
  const man = await (await fetch('./data/engine-manifest.json', { cache: 'no-store' })).json();
  const files = {};
  let done = 0;
  await Promise.all(man.files.map(async (p) => {
    const r = await fetch(man.raw_url + p);
    if (!r.ok) throw new Error(`${r.status} ${p}`);
    files[p] = await r.text();
    done++; progress(10 + Math.round(15 * done / man.files.length), `โหลด engine ${done}/${man.files.length}`);
  }));
  return files;
}

async function bootEngine() {
  stage('engine', 'run');
  progress(3, 'ดาวน์โหลด Pyodide (Python ใน WebAssembly)…');
  const [{ loadPyodide }, files] = await Promise.all([import(PYODIDE_URL), loadEngineFiles()]);
  engineFiles = files;
  pyodide = await loadPyodide();
  progress(35, 'โหลด pydantic · pyyaml · jinja2…');
  await pyodide.loadPackage(['pydantic', 'pyyaml', 'jinja2']);
  progress(75, 'ติดตั้ง engine ลง filesystem ของเบราว์เซอร์…');
  const FS = pyodide.FS;
  for (const [path, text] of Object.entries(files)) {
    const full = `/engine/${path}`;
    FS.mkdirTree(full.slice(0, full.lastIndexOf('/')));
    FS.writeFile(full, text);
  }
  pyodide.runPython(`
import sys, os
sys.path.insert(0, '/engine/src')
os.environ['TESR_RB_REGISTRY'] = '/engine/registry'
from tesr_robot_builder import __version__
from tesr_robot_builder.web_entry import build_json
`);
  const ver = pyodide.runPython('__version__');
  progress(100, `engine ${ver} พร้อม — Python ${pyodide.runPython('sys.version.split()[0]')} ในเบราว์เซอร์ · ${Object.keys(files).length} ไฟล์`);
  stage('engine', 'ok');
  status(`engine ${ver} พร้อม`);
  $('validate').disabled = false; $('generate').disabled = false;
}

// ------------------------------------------------------------------ YAML sources
const robotName = (text) => (text.match(/^\s*name:\s*([a-z0-9_]+)/m) || [])[1] || 'robot';
function setHero() {
  const name = robotName($('yaml').value);
  $('heroName').textContent = name;
}
function loadExample(name) {
  const key = `examples/${name}.robot.yaml`;
  if (engineFiles && engineFiles[key]) { $('yaml').value = engineFiles[key]; fromProject = false; setHero(); status(`โหลดตัวอย่าง ${name}`); }
  else status('engine ยังโหลดไม่เสร็จ');
}
function loadFromProject() {
  const p = JSON.parse(localStorage.getItem(PROJECT_KEY) || '{}');
  if (p.yaml) { $('yaml').value = p.yaml; fromProject = true; setHero(); $('heroSub').textContent = `หุ่นจาก Garage (${p.design?.name || ''}) → เลือกสนาม → กดสร้าง → ดาวน์โหลด แล้วรัน 2 คำสั่ง หุ่นจะวิ่งใน Gazebo และ RViz ได้ทันที`; status(`robot.yaml จากโปรเจกต์ (${p.design?.name || ''})`); return true; }
  status('ยังไม่มีหุ่นในโปรเจกต์ — เริ่มที่ Garage 3D หรือใช้ตัวอย่าง');
  return false;
}

// ------------------------------------------------------------------ run engine
function run(extra) {
  const text = $('yaml').value;
  pyodide.globals.set('YAML_TEXT', text);
  pyodide.globals.set('DEF_NAME', `${robotName(text)}.robot.yaml`);
  pyodide.globals.set('EXTRA_JSON', extra ? JSON.stringify(extra) : null);
  return JSON.parse(pyodide.runPython("build_json(YAML_TEXT, DEF_NAME, '/engine/registry', EXTRA_JSON)"));
}

const CAT_TH = { hardware: 'ฮาร์ดแวร์', tf: 'TF / เฟรม', mechanical: 'กลไก', navigation: 'นำทาง', safety: 'ความปลอดภัย', power: 'ไฟฟ้า' };
function renderReport(res) {
  const icon = { PASS: '✅', WARN: '⚠️', ERROR: '🔴' };
  if (res.errors.length) {
    $('report').innerHTML = `<div class="finding ERROR"><b>${esc(res.stage)} error</b></div>` + res.errors.map((e) => `<div class="finding ERROR">${esc(e)}</div>`).join('');
    $('summary').innerHTML = ''; return;
  }
  const rep = res.report, nErr = rep.filter((r) => r.severity === 'ERROR').length, nWarn = rep.filter((r) => r.severity === 'WARN').length;
  const pass = rep.filter((r) => r.severity === 'PASS').length, pct = Math.round(100 * pass / Math.max(rep.length, 1));
  const cats = {};
  rep.forEach((r) => { const c = cats[r.category] || (cats[r.category] = { e: 0, w: 0, n: 0 }); c.n++; if (r.severity === 'ERROR') c.e++; if (r.severity === 'WARN') c.w++; });
  const order = { ERROR: 0, WARN: 1, PASS: 2 };
  const issues = [...rep].sort((a, b) => order[a.severity] - order[b.severity]);
  if ($('ruleCount')) $('ruleCount').textContent = `${rep.length} กฎวิศวกรรม`;
  const line = (r) => `<div class="finding ${r.severity}">${icon[r.severity]} <b>${r.rule}</b> ${esc(r.message)}${r.path ? ` <span class="muted">(${esc(r.path)})</span>` : ''}${r.suggestion && r.severity !== 'PASS' ? `<br><span class="muted">→ ${esc(r.suggestion)}</span>` : ''}</div>`;
  $('report').innerHTML = `<div class="score"><div class="ring" style="--p:${pct}"><b>${pct}%</b></div>
      <div><b style="font-family:'Chakra Petch';font-size:16px">${nErr ? `${nErr} ต้องแก้` : nWarn ? 'ผ่าน มีคำแนะนำ' : 'ผ่านทุกข้อ'}</b><div class="muted">${nErr} error · ${nWarn} warning · ${pass} ผ่าน</div></div></div>
    <div class="cats">${Object.entries(cats).map(([k, c]) => `<div class="cat ${c.e ? 'e' : c.w ? 'w' : ''}"><span>${CAT_TH[k] || k}</span><i>${c.e ? '🔴 ' + c.e : c.w ? '⚠️ ' + c.w : '✓'}</i></div>`).join('')}</div>
    ${issues.filter((r) => r.severity !== 'PASS').map(line).join('')}
    <details class="more"><summary>ดูผลทุกข้อ (${rep.length})</summary>${issues.map(line).join('')}</details>`;
  const s = res.summary;
  $('summary').innerHTML = s ? `
      <div><b>${esc(s.name)}</b><span>${esc(s.drive)} · ${esc(s.prefix)}_*</span></div>
      <div><b>${s.robot_mass} / ${s.total_mass} kg</b><span>หุ่น / รวมบรรทุก</span></div>
      <div><b>${esc(s.controller.split('/')[0])}</b><span>ros2_control</span></div>
      <div><b>${s.costmap.local_size_m} m · ${s.costmap.inflation_radius_m} m</b><span>local costmap · inflation</span></div>
      <div><b>${esc((s.nav_controller.split('/')[1] || s.nav_controller).replace('Controller', ''))} + ${esc((s.planner.split('/')[1] || s.planner).replace('Planner', ''))}</b><span>Nav2 controller + planner</span></div>` : '';
}

function pkgFacts(res) {
  const f = res.files, pre = res.summary.prefix, count = (pkg) => Object.keys(f).filter((p) => p.startsWith(`src/${pre}_${pkg}/`)).length;
  const gz = f[`src/${pre}_description/urdf/gazebo.xacro`] || '', nav = f[`src/${pre}_navigation/config/nav2_params.yaml`] || '';
  const lidars = (gz.match(/type="gpu_lidar"/g) || []).length, cams = (gz.match(/type="rgbd_camera"/g) || []).length, imus = (gz.match(/type="imu"/g) || []).length;
  const fp = (nav.match(/footprint: "([^"]+)"/) || [])[1] || '';
  const mm = (nav.match(/motion_model: "(\w+)"/) || [])[1] || '';
  return {
    description: [`${count('description')} ไฟล์`, `ros2_control · ${lidars} LiDAR · ${cams} กล้อง · ${imus} IMU`],
    control: [`${count('control')} ไฟล์`, `<code>${esc(res.summary.controller)}</code>`],
    gazebo: [`${count('gazebo')} ไฟล์`, `สนาม ${esc(fieldLabel())} · ${lidars + cams + imus} sensors จำลอง`],
    navigation: [`${count('navigation')} ไฟล์`, `MPPI ${esc(mm)} · footprint <code>${esc(fp)}</code>`],
    bringup: [`${count('bringup')} ไฟล์`, 'sim.launch.py = Gazebo + SLAM + Nav2 + RViz'],
  };
}

// Real-robot driver packages written next to the robot's own (e.g. tesr_zlac_hardware for ZLTECH hub motors)
function driverCards(res) {
  const box = $('pkgs');
  box.querySelectorAll('.pkg.drv').forEach((el) => el.remove());
  const own = `${res.summary.prefix}_`;
  const drv = [...new Set(Object.keys(res.files).filter((p) => p.startsWith('src/') && !p.startsWith(`src/${own}`)).map((p) => p.split('/')[1]))];
  for (const d of drv) {
    const n = Object.keys(res.files).filter((p) => p.startsWith(`src/${d}/`)).length;
    const what = d === 'tesr_zlac_hardware'
      ? '<span class="i18n-th">ไดรเวอร์มอเตอร์หุ่นจริง · ZLAC RS485 · ใช้เมื่อ hardware:=real</span><span class="i18n-en">real motor driver · ZLAC RS485 · used with hardware:=real</span>'
      : 'driver';
    box.insertAdjacentHTML('beforeend', `<div class="pkg drv" data-p="${esc(d)}"><div class="ico">⚙️</div><div><b>${esc(d)}</b><div>${what}</div></div><div class="n">${n} ไฟล์</div></div>`);
  }
}

async function renderPackages(res) {
  const facts = pkgFacts(res);
  driverCards(res);
  for (const el of document.querySelectorAll('.pkg')) {
    const k = el.dataset.p, fx = facts[k];
    if (fx) { el.querySelector('.n').textContent = fx[0]; el.querySelector(':scope > div:nth-child(2) > div').innerHTML = fx[1]; }
    el.classList.add('on'); await sleep(140);
  }
}

// ------------------------------------------------------------------ ① test field: 6 ready-made fields or the user's own (arena.html)
// The chosen field goes into the zip as its own package (Gazebo world + ready-made map), and run_sim.sh starts in it.
(function navLink() {
  const nav = document.querySelector('header.tesr nav');
  if (nav && !nav.querySelector('a[href="./arena.html"]')) (nav.querySelector('a[href="./guide.html"]') || nav.lastElementChild).insertAdjacentHTML('beforebegin', '<a href="./arena.html"><span class="i18n-th">🧱 ออกแบบสนาม</span><span class="i18n-en">🧱 Arena editor</span></a>');
})();
const A = window.TESR_ARENA, FIELD_KEY = 'tesr_rb_field';
let myArena = null;
try { const a = JSON.parse(localStorage.getItem('tesr_rb_arena') || 'null'); if (a && a.items) myArena = A.normalize(a); } catch (_) { myArena = null; }
let field = { key: 'tesr_warehouse', mode: 'map' };
try { field = { ...field, ...JSON.parse(localStorage.getItem(FIELD_KEY) || '{}') }; } catch (_) { /* first visit */ }
if (field.key === 'mine' ? !myArena : !A.PRESETS[field.key]) field.key = 'tesr_warehouse';
if (field.mode !== 'slam') field.mode = 'map';
const arenaOf = (key) => (key === 'mine' ? myArena : A.normalize(A.PRESETS[key].make()));
const currentArena = () => arenaOf(field.key);
const arenaPkg = () => A.packageName(currentArena());
const isEn = () => (window.TESR_I18N && window.TESR_I18N.lang === 'en');
const fieldLabel = () => (field.key === 'mine' ? `${myArena.name} (สนามของฉัน)` : A.PRESETS[field.key].th);
/** Goals drawn in the field (A, B, DOCK…), in the map frame of the exported world: the start pose is the origin. */
function fieldGoals(a) { return a.items.filter((it) => it.type === 'goal').map(A.toStartFrame(a)).map((g) => ({ label: g.label, x: Math.round(g.x * 100) / 100, y: Math.round(g.y * 100) / 100 })); }

/** How wide is the way to each goal? Widest-path search on the field's occupancy grid:
 *  clearance = the largest radius (m) a round robot can have and still drive from the start to that goal. 0 = walled off. */
const clearCache = new Map();
function fieldClearance(key) {
  if (clearCache.has(key)) return clearCache.get(key);
  const a = arenaOf(key), g = A.occupancy(a, 0.05), w = g.w, h = g.h, N = w * h, res = g.res;
  const d = new Float32Array(N).fill(1e6);
  for (let i = 0; i < N; i++) if (g.data[i] === 0) d[i] = 0;
  const relax = (i, j, c) => { if (d[j] + c < d[i]) d[i] = d[j] + c; }, S2 = Math.SQRT2 * res;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { const i = r * w + c; if (c) relax(i, i - 1, res); if (r) { relax(i, i - w, res); if (c) relax(i, i - w - 1, S2); if (c < w - 1) relax(i, i - w + 1, S2); } }
  for (let r = h - 1; r >= 0; r--) for (let c = w - 1; c >= 0; c--) { const i = r * w + c; if (c < w - 1) relax(i, i + 1, res); if (r < h - 1) { relax(i, i + w, res); if (c < w - 1) relax(i, i + w + 1, S2); if (c) relax(i, i + w - 1, S2); } }
  const idx = (x, y) => { const c = Math.floor((x - g.origin[0]) / res), r = h - 1 - Math.floor((y - g.origin[1]) / res); return c < 0 || r < 0 || c >= w || r >= h ? -1 : r * w + c; };
  const best = new Float32Array(N).fill(-1), heap = [], s0 = idx(0, 0);
  const push = (i) => { heap.push(i); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (best[heap[p]] >= best[heap[k]]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && best[heap[l]] > best[heap[m]]) m = l; if (r < heap.length && best[heap[r]] > best[heap[m]]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  if (s0 >= 0) { best[s0] = d[s0]; push(s0); }
  while (heap.length) {
    const i = pop(), r = Math.floor(i / w), c = i - r * w;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
      const j = rr * w + cc, v = Math.min(best[i], d[j]); if (v > best[j]) { best[j] = v; push(j); }
    }
  }
  const goals = fieldGoals(a).map((gl) => { const i = idx(gl.x, gl.y); return { label: gl.label, clearance: i < 0 ? 0 : Math.max(0, Math.round(best[i] * 100) / 100) }; });
  const out = { start: s0 >= 0 ? Math.round(d[s0] * 100) / 100 : 0, goals, min: goals.length ? Math.min(...goals.map((x) => x.clearance)) : (s0 >= 0 ? Math.round(d[s0] * 100) / 100 : 0) };
  clearCache.set(key, out); return out;
}
/** Size of the generated robot as Nav2 sees it (footprint from nav2_params.yaml). */
function robotSize() {
  if (!lastResult) return null;
  const nav = lastResult.files[`src/${lastResult.summary.prefix}_navigation/config/nav2_params.yaml`] || '', m = nav.match(/footprint: "([^"]+)"/);
  if (!m) return null;
  let pts; try { pts = JSON.parse(m[1]); } catch (_) { return null; }
  const hx = Math.max(...pts.map((p) => Math.abs(p[0]))), hy = Math.max(...pts.map((p) => Math.abs(p[1])));
  return { half: Math.min(hx, hy), circ: Math.hypot(hx, hy), length: 2 * hx, width: 2 * hy };
}
/** ok | tight | blocked for the generated robot in a field (null before a robot exists).
 *  blocked: less than 5 cm to spare on each side. tight: less than 25 cm on each side, or no room to turn on the spot —
 *  a rule of thumb from Nav2 runs in Gazebo (a 0.34 m robot got stuck in a 0.7 m doorway; a 0.8 m robot was fine in 1.4 m aisles). */
function fieldFit(key) {
  const rb = robotSize(); if (!rb) return null;
  const cl = fieldClearance(key), gaps = cl.goals.length ? cl.goals : [{ label: '', clearance: cl.start }];
  const blocked = gaps.filter((x) => x.clearance < rb.half + 0.05), tight = gaps.filter((x) => x.clearance >= rb.half + 0.05 && x.clearance < Math.max(rb.half + 0.25, rb.circ));
  return { level: blocked.length ? 'blocked' : tight.length ? 'tight' : 'ok', blocked, tight, min: cl.min, robot: rb };
}
function fitText(key) {
  const f = fieldFit(key), cl = fieldClearance(key), gap = `ทางแคบสุด ${(2 * cl.min).toFixed(2)} m`;
  if (!f) return ['', gap];
  if (f.level === 'blocked') return ['blocked', `❌ หุ่นกว้าง ${f.robot.width.toFixed(2)} m ผ่านไม่ได้ · ${gap}`];
  if (f.level === 'tight') return ['tight', `⚠️ คับสำหรับหุ่นตัวนี้ อาจติด · ${gap}`];
  return ['ok', `✓ ทางกว้างพอสำหรับหุ่นตัวนี้ · ${gap}`];
}

function drawField(cv, a) {
  const grid = A.occupancy(a, 0.1), ctx = cv.getContext('2d'), W = cv.width = 300, H = cv.height = 200;
  ctx.fillStyle = '#101014'; ctx.fillRect(0, 0, W, H);
  const k = Math.min((W - 16) / grid.w, (H - 16) / grid.h), ox = (W - grid.w * k) / 2, oy = (H - grid.h * k) / 2;
  ctx.fillStyle = '#23232b'; ctx.fillRect(ox, oy, grid.w * k, grid.h * k);
  ctx.fillStyle = '#C9A84C';
  for (let r = 0; r < grid.h; r++) for (let c = 0; c < grid.w; c++) if (grid.data[r * grid.w + c] === 0) ctx.fillRect(ox + c * k, oy + r * k, k + 0.6, k + 0.6);
  const px = (x, y) => [ox + (x - grid.origin[0]) / grid.res * k, oy + (grid.h - (y - grid.origin[1]) / grid.res) * k];
  ctx.font = '600 13px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fieldGoals(a).forEach((g) => { const [x, y] = px(g.x, g.y); ctx.fillStyle = '#2e8b57'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(String(g.label).slice(0, 1), x, y + 1); });
  const [sx, sy] = px(0, 0);   // the robot starts at the origin, facing +x
  ctx.fillStyle = '#ff453a'; ctx.beginPath(); ctx.moveTo(sx + 11, sy); ctx.lineTo(sx - 7, sy - 7); ctx.lineTo(sx - 7, sy + 7); ctx.closePath(); ctx.fill();
}
function renderFields() {
  const keys = [...Object.keys(A.PRESETS), ...(myArena ? ['mine'] : [])];
  $('fields').innerHTML = keys.map((k) => {
    const a = arenaOf(k), p = A.PRESETS[k];
    return `<button type="button" class="field${k === field.key ? ' sel' : ''}" data-field="${k}"><canvas></canvas>
      <b>${k === 'mine' ? `⭐ สนามของฉัน` : `${p.icon} <span class="i18n-th" style="font:inherit;color:inherit">${esc(p.th)}</span><span class="i18n-en" style="font:inherit;color:inherit">${esc(p.en)}</span>`}</b>
      <span>${k === 'mine' ? `${esc(a.name)} · ` : ''}${a.size.w} × ${a.size.h} m · ${a.items.filter((it) => it.type !== 'goal').length} สิ่งกีดขวาง</span>
      <span class="fit ${fitText(k)[0]}">${fitText(k)[1]}</span></button>`;
  }).join('');
  $('fields').querySelectorAll('.field').forEach((el) => drawField(el.querySelector('canvas'), arenaOf(el.dataset.field)));
  document.querySelectorAll('#fmode input').forEach((i) => { i.checked = i.value === field.mode; i.closest('label').classList.toggle('on', i.checked); });
}
function setField(patch) {
  field = { ...field, ...patch };
  try { localStorage.setItem(FIELD_KEY, JSON.stringify(field)); } catch (_) { /* quota */ }
  renderFields();
  if (lastResult) { renderLaunch(lastResult); renderFiles(lastResult); const fx = pkgFacts(lastResult).gazebo, el = document.querySelector('.pkg[data-p="gazebo"]'); if (el) el.querySelector(':scope > div:nth-child(2) > div').innerHTML = fx[1]; }
}
$('fields').addEventListener('click', (e) => { const b = e.target.closest('.field'); if (b) setField({ key: b.dataset.field }); });
$('fmode').addEventListener('change', (e) => { if (e.target.name === 'fmode') setField({ mode: e.target.value }); });
renderFields();

// ------------------------------------------------------------------ the two scripts a beginner runs: setup.sh once, then run_sim.sh
function setupScript(res) {
  const n = res.summary.name, repos = !!res.files['drivers.repos'];
  return `#!/usr/bin/env bash
# ${n}_ws — ติดตั้งและ build ครั้งแรก (ครั้งเดียว) · first-time install + build
# ใช้:  bash setup.sh
cd "$(dirname "$(readlink -f "$0")")" || exit 1
if [ ! -f /opt/ros/jazzy/setup.bash ]; then
  echo "❌ ไม่พบ ROS 2 Jazzy ในเครื่องนี้ (ต้องใช้ Ubuntu 24.04) — ติดตั้งตาม https://docs.ros.org/en/jazzy/Installation.html แล้วรัน bash setup.sh ใหม่"
  exit 1
fi
source /opt/ros/jazzy/setup.bash
SUDO=""; [ "$(id -u)" != "0" ] && command -v sudo >/dev/null && SUDO="sudo"
echo "① เครื่องมือ build (colcon, rosdep${repos ? ', vcstool' : ''})"
if ! command -v colcon >/dev/null || ! command -v rosdep >/dev/null${repos ? ' || ! command -v vcs >/dev/null' : ''}; then
  $SUDO apt-get update && $SUDO apt-get install -y python3-colcon-common-extensions python3-rosdep python3-vcstool || { echo "❌ ติดตั้งเครื่องมือ build ไม่สำเร็จ"; exit 1; }
fi
${repos ? `echo "② ดึง driver ที่ไม่มีใน apt (drivers.repos)"
vcs import --recursive --skip-existing src < drivers.repos || echo "⚠️ ดึง driver บางตัวไม่สำเร็จ — การจำลองยังรันได้ ส่วนหุ่นจริงต้องแก้ก่อน"
` : ''}echo "③ ติดตั้ง package ที่ workspace นี้ต้องใช้ (Gazebo, Nav2, slam_toolbox, RViz …) — ครั้งแรกใช้เวลาหลายนาที"
[ -d /etc/ros/rosdep/sources.list.d ] || $SUDO rosdep init
rosdep update --rosdistro jazzy || echo "⚠️ rosdep update ไม่สำเร็จ — ตรวจอินเทอร์เน็ต"
rosdep install --from-paths src -y --ignore-src --rosdistro jazzy || echo "⚠️ rosdep ติดตั้งไม่ครบ — ถ้า build ไม่ผ่าน ให้อ่านชื่อ package ที่ขาดจากข้อความด้านบน"
echo "④ build"
colcon build --symlink-install || { echo "❌ build ไม่ผ่าน — ส่งข้อความด้านบนมาที่ LINE www.tesrshop.com/line ได้เลย"; exit 1; }
echo
echo "✅ พร้อมแล้ว — เปิดการจำลองด้วย:  bash run_sim.sh"
`;
}
function runScript(res) {
  const n = res.summary.name, pre = res.summary.prefix, a = currentArena(), wp = arenaPkg();
  const goals = fieldGoals(a).map((g) => `${g.label} (x ${g.x}, y ${g.y})`).join(' · ');
  return `#!/usr/bin/env bash
# ${n}_ws — เปิดการจำลองทั้งระบบด้วยคำสั่งเดียว: Gazebo + RViz + Nav2 · one command for the whole simulation
# สนาม: ${a.name} (${a.size.w} x ${a.size.h} m) · โหมดเริ่มต้น: ${field.mode === 'map' ? 'แผนที่สำเร็จรูป (AMCL)' : 'ทำแผนที่เอง (SLAM)'}
#
#   bash run_sim.sh             เปิดตามที่เลือกไว้ตอนส่งออก
#   bash run_sim.sh map         ใช้แผนที่สำเร็จรูป — สั่งหุ่นไปจุดหมายได้ทันที
#   bash run_sim.sh slam        ให้หุ่นทำแผนที่เองระหว่างวิ่ง
#   bash run_sim.sh rtf:=0.5    เครื่องช้า / หุ่นวิ่งวน → ให้เวลาจำลองเดินช้าลงครึ่งหนึ่ง (0.25 สำหรับเครื่องช้ามาก)
#   bash run_sim.sh gui:=false  ไม่เปิดหน้าต่าง Gazebo (ดูหุ่นใน RViz อย่างเดียว เบาเครื่อง)
#   ต่อ argument ได้หลายตัว เช่น  bash run_sim.sh slam rtf:=0.5
cd "$(dirname "$(readlink -f "$0")")" || exit 1
MODE="${field.mode}"
case "\${1:-}" in map|slam) MODE="$1"; shift ;; esac
if [ ! -f /opt/ros/jazzy/setup.bash ]; then echo "❌ ไม่พบ ROS 2 Jazzy — รัน bash setup.sh เพื่อดูวิธีแก้"; exit 1; fi
source /opt/ros/jazzy/setup.bash
[ -f install/setup.bash ] || bash ./setup.sh || exit 1
source install/setup.bash
SHARE="$(ros2 pkg prefix ${wp})/share/${wp}" || { echo "❌ ไม่พบ package ${wp} — รัน bash setup.sh ใหม่"; exit 1; }
ARGS=(world:="$SHARE/worlds/${a.name}.sdf" x:=0 y:=0 yaw:=0)
if [ "$MODE" = "map" ]; then ARGS+=(slam:=false map:="$SHARE/maps/${a.name}.yaml"); fi
echo "▶ สนาม ${a.name} · โหมด $MODE · หยุดด้วย Ctrl+C"
echo "  ใน RViz กด [2D Goal Pose] แล้วคลิกค้าง-ลากบนแผนที่ → หุ่นวางเส้นทางและวิ่งไปเอง"${goals ? `
echo "  จุดหมายในสนามนี้: ${goals}"` : ''}
exec ros2 launch ${pre}_bringup sim.launch.py "\${ARGS[@]}" "$@"
`;
}

function renderLaunch(res) {
  const n = res.summary.name, pre = res.summary.prefix, a = currentArena(), ap = arenaPkg();
  const share = `$(ros2 pkg prefix ${ap})/share/${ap}`, world = `world:=${share}/worlds/${a.name}.sdf x:=0 y:=0 yaw:=0`;
  const goals = fieldGoals(a);
  const main = [
    ['1 · แตกไฟล์ + ติดตั้ง', 'ครั้งแรกครั้งเดียว · ใช้เวลาหลายนาที', `cd ~ && unzip -o ~/Downloads/${n}_ws.zip && cd ${n}_ws && bash setup.sh`, false],
    ['2 · เปิดการจำลองทั้งระบบ', `Gazebo + RViz + Nav2 · สนาม ${a.name}`, `cd ~/${n}_ws && bash run_sim.sh`, true],
  ];
  const more = [
    [field.mode === 'map' ? 'ให้หุ่นทำแผนที่เอง (SLAM)' : 'ใช้แผนที่สำเร็จรูป', 'สลับโหมดได้โดยไม่ต้องส่งออกใหม่', `bash run_sim.sh ${field.mode === 'map' ? 'slam' : 'map'}`],
    ['เครื่องช้า / หุ่นวิ่งวนเป็นวงกลม', 'ให้เวลาจำลองเดินช้าลง Nav2 จะคำนวณทัน', 'bash run_sim.sh rtf:=0.5'],
    ['ไม่เปิดหน้าต่าง Gazebo', 'ดูหุ่นใน RViz อย่างเดียว เบาเครื่อง', 'bash run_sim.sh gui:=false'],
    ['ขับด้วยคีย์บอร์ด', 'เปิด Terminal อีกหน้าต่าง', `source ~/${n}_ws/install/setup.bash\nros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true`],
    ['บันทึกแผนที่ที่หุ่นทำเอง', 'หลังขับสำรวจครบในโหมด slam', `ros2 run nav2_map_server map_saver_cli -f ~/${n}_map`],
    ['ดูผัง TF ของหุ่น', 'ได้ไฟล์ frames.pdf — ชื่อ frame ตรงกับหน้า ① ออกแบบ', 'ros2 run tf2_tools view_frames'],
    ['คำสั่ง ros2 launch เต็ม', 'สิ่งที่ run_sim.sh ทำให้', `ros2 launch ${pre}_bringup sim.launch.py ${world}${field.mode === 'map' ? ` slam:=false map:=${share}/maps/${a.name}.yaml` : ''}`],
    ['หุ่นจริง', 'ต่อมอเตอร์ไดรเวอร์ + เซนเซอร์แล้ว', `ros2 launch ${pre}_bringup robot.launch.py hardware:=real nav:=true`],
    ['ไม่มี ROS ในเครื่อง? (Docker บน Linux)', 'GUI ผ่าน X11', `xhost +local:docker\ndocker run -it --rm --net=host -e DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix -v "$PWD:/ws" -w /ws osrf/ros:jazzy-desktop-full bash -c "apt-get update -qq && bash setup.sh && bash run_sim.sh"`],
  ];
  const cmds = [...main, ...more];
  const card = ([t, sub, c, hl], i) => `<div class="cmd ${hl ? 'hl' : ''}"><div class="t"><span><b>${t}</b> <span class="muted">· ${sub}</span></span><button data-copy="${i}">คัดลอก</button></div><pre>${esc(c)}</pre></div>`;
  const fit = fitText(field.key);
  $('launch').innerHTML = (fit[0] === 'blocked' || fit[0] === 'tight' ? `<div class="tip warn">${fit[1]} — เลือกสนามอื่นในข้อ ① หรือทำหุ่นให้แคบลง</div>` : '') + main.map(card).join('')
    + `<div class="tip">เมื่อ RViz เปิดแล้ว กด <b>2D Goal Pose</b> ด้านบน แล้วคลิกค้าง-ลากบนแผนที่ → หุ่นวางเส้นทางและวิ่งไปเอง${goals.length ? `<br>จุดหมายในสนามนี้: ${goals.map((g) => `<b>${esc(g.label)}</b> (x ${g.x}, y ${g.y})`).join(' · ')}` : ''}</div>`
    + `<details class="morecmd"><summary>คำสั่งอื่น ๆ — สลับโหมด · เครื่องช้า · ขับเอง · หุ่นจริง · Docker</summary>${more.map((c, i) => card(c, i + main.length)).join('')}</details>`;
  $('launch').querySelectorAll('button[data-copy]').forEach((b) => b.addEventListener('click', () => {
    navigator.clipboard.writeText(cmds[Number(b.dataset.copy)][2]).then(() => { b.textContent = 'คัดลอกแล้ว ✓'; setTimeout(() => (b.textContent = 'คัดลอก'), 1500); });
  }));
  return cmds;
}

/** Everything that goes into the zip besides the engine files: the field package, the two scripts and the README. */
function bundleFiles(res) {
  const out = {};
  for (const [p, c] of Object.entries(A.packageFiles(currentArena(), { prefix: res.summary.prefix }))) out[`src/${p}`] = c;
  out['setup.sh'] = setupScript(res); out['run_sim.sh'] = runScript(res); out['README.md'] = workspaceReadme(res);
  return out;
}

let selectedFile = null;
function renderFiles(res) {
  const extra = bundleFiles(res), all = { ...res.files, ...extra };
  const paths = Object.keys(all).sort();
  $('explorerBox').style.display = paths.length ? '' : 'none';
  const groups = {};
  paths.forEach((p) => { const m = p.match(/^src\/([^/]+)\//); const g = m ? m[1] : '(workspace)'; (groups[g] = groups[g] || []).push(p); });
  $('files').innerHTML = Object.entries(groups).map(([g, list]) => `<div class="dir">📦 ${esc(g)}</div>` + list.map((p) => `<div class="f" data-path="${esc(p)}">${esc(p.replace(`src/${g}/`, ''))}</div>`).join('')).join('');
  $('files').querySelectorAll('div.f').forEach((el) => el.addEventListener('click', () => {
    selectedFile = el.dataset.path;
    $('files').querySelectorAll('div.f').forEach((x) => x.classList.toggle('sel', x === el));
    const body = all[selectedFile];
    $('preview').textContent = typeof body === 'string' ? body : `(ไฟล์ไบนารี ${body.length} bytes)`;
    $('preview').classList.remove('muted');
  }));
  $('zipNote').textContent = `${paths.length} ไฟล์ · ${new Set(Object.keys(res.files).filter((q) => q.startsWith('src/')).map((q) => q.split('/')[1])).size + 1} packages · สนาม ${currentArena().name} · มี setup.sh และ run_sim.sh`;
}

function extrasFromProject() {
  // meshes.xacro from Model Studio (project.model) — the STL files themselves are added from the drop zone
  const p = JSON.parse(localStorage.getItem(PROJECT_KEY) || '{}');
  const extra = {};
  if (p.model && p.model.meshes && p.model.meshes.length && window.TESR_MODEL) {
    const prefix = p.model.prefix || 'tesr_robot';
    extra[`src/${prefix}_description/urdf/meshes.xacro`] = window.TESR_MODEL.exportXacro(p.model);
  }
  return extra;
}

// ------------------------------------------------------------------ pipeline
async function pipeline(generate) {
  if (!pyodide) return;
  $('generate').disabled = true; resetStages(); lastResult = null; $('downloadZip').disabled = true;
  stage('schema', 'run'); await sleep(250);
  const res = run(generate ? extrasFromProject() : null);
  if (!res.ok && (res.stage === 'schema' || res.stage === 'yaml')) { stage('schema', 'bad'); renderReport(res); status('robot.yaml มีโครงสร้างผิด — ดูรายละเอียดในผลตรวจ'); $('generate').disabled = false; return; }
  stage('schema', 'ok'); stage('rules', 'run'); await sleep(350);
  renderReport(res);
  if (!res.ok) { stage('rules', 'bad'); status('มีข้อที่ต้องแก้ก่อนสร้าง — ดูผลตรวจ'); toast('🔴 ตรวจไม่ผ่าน — แก้ตามคำแนะนำ แล้วกดใหม่'); $('generate').disabled = false; return; }
  stage('rules', 'ok');
  if (!generate) { status('ตรวจผ่าน — กด 🚀 เพื่อสร้าง'); $('generate').disabled = false; return; }
  stage('gen', 'run'); await sleep(300);
  lastResult = res;
  await renderPackages(res);
  stage('gen', 'ok'); stage('ready', 'ok');
  renderFields(); renderLaunch(res); renderFiles(res);
  $('downloadZip').disabled = false; $('generate').disabled = false;
  status(`สร้างแล้ว ${Object.keys(res.files).length} ไฟล์ · ${res.summary.packages.length} packages`);
  toast(`🏁 ${res.summary.name} พร้อมแล้ว — ดาวน์โหลด แล้วทำตามข้อ ③`);
  burst();
}

$('generate').onclick = () => pipeline(true);
$('validate').onclick = () => pipeline(false);

$('downloadZip').onclick = async () => {
  if (!lastResult) return;
  const name = lastResult.summary.name, prefix = lastResult.summary.prefix;
  const zip = new JSZip(), root = zip.folder(`${name}_ws`);
  for (const [p, c] of Object.entries(lastResult.files)) root.file(p, c);
  for (const [fname, file] of extraFiles) root.file(`src/${prefix}_description/meshes/${fname}`, await file.arrayBuffer());
  for (const [p, c] of Object.entries(bundleFiles(lastResult))) root.file(p, c, p.endsWith('.sh') ? { unixPermissions: 0o755 } : {});
  const blob = await zip.generateAsync({ type: 'blob', platform: 'UNIX' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}_ws.zip`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`⬇ ${name}_ws.zip — ต่อไป: คำสั่ง 1 และ 2 ในข้อ ③`);
};

// Step-by-step README at the top of the zip — readable on GitHub, in VS Code or with `cat`. Thai first, written for a first-time ROS user.
function workspaceReadme(res) {
  const name = res.summary.name, prefix = res.summary.prefix, repos = !!res.files['drivers.repos'], a = currentArena(), ap = arenaPkg();
  const pkgs = [...new Set(Object.keys(res.files).filter((p) => p.startsWith('src/')).map((p) => p.split('/')[1])), ap].sort();
  const goals = fieldGoals(a), share = `$(ros2 pkg prefix ${ap})/share/${ap}`;
  const tfRows = (() => { try { const p = JSON.parse(localStorage.getItem(PROJECT_KEY) || '{}'); return (fromProject ? p.frames || [] : []).map((f) => `| \`${f.name}\` | ${f.parent ? `\`${f.parent}\`` : '—'} | ${f.xyz.join(', ')} | ${f.note || ''} |`).join('\n'); } catch (_) { return ''; } })();
  return `# ${name}_ws — หุ่นของคุณ พร้อมรันใน ROS 2 Jazzy

สร้างจาก **TESR Robot Builder** (engine ${res.summary.versions.generator}, registry ${res.summary.versions.registry}) · คู่มือมีภาพ: ${new URL('./guide.html', location.href).href}

## เริ่มเร็ว · Quick start
ต้องมี **Ubuntu 24.04 + ROS 2 Jazzy** (Windows ใช้ WSL2 + Ubuntu 24.04 ได้) เปิด Terminal แล้ววาง 2 บรรทัดนี้:

\`\`\`bash
cd ~ && unzip -o ~/Downloads/${name}_ws.zip && cd ${name}_ws && bash setup.sh    # ครั้งแรกครั้งเดียว: ติดตั้ง + build
bash run_sim.sh                                                                  # เปิด Gazebo + RViz + Nav2
\`\`\`

จะได้ 2 หน้าต่าง: **Gazebo** (โลกจำลอง สนาม \`${a.name}\` ${a.size.w} × ${a.size.h} m) และ **RViz** (สิ่งที่หุ่นเห็น: แผนที่ เลเซอร์ แกน TF เส้นทาง)
ใน RViz กดปุ่ม **2D Goal Pose** แล้วคลิกค้าง-ลากบนแผนที่ → หุ่นวางเส้นทางและวิ่งไปเอง หยุดทุกอย่างด้วย \`Ctrl+C\`
${goals.length ? `\nจุดหมายที่วางไว้ในสนามนี้ (เมตร, frame \`map\`, หุ่นเริ่มที่ 0, 0):\n\n| จุด | x | y |\n|---|---|---|\n${goals.map((g) => `| ${g.label} | ${g.x} | ${g.y} |`).join('\n')}\n` : ''}
## คำสั่งที่ใช้บ่อย
| อยากทำ | คำสั่ง |
|---|---|
| เปิดตามที่เลือกไว้ (${field.mode === 'map' ? 'แผนที่สำเร็จรูป' : 'ทำแผนที่เอง'}) | \`bash run_sim.sh\` |
| ใช้แผนที่สำเร็จรูป สั่งไปจุดหมายได้ทันที (AMCL) | \`bash run_sim.sh map\` |
| ให้หุ่นทำแผนที่เองระหว่างวิ่ง (SLAM) | \`bash run_sim.sh slam\` |
| เครื่องช้า หรือหุ่นวิ่งวนเป็นวงกลม | \`bash run_sim.sh rtf:=0.5\` (เครื่องช้ามากใช้ \`rtf:=0.25\`) |
| ไม่เปิดหน้าต่าง Gazebo ดูใน RViz อย่างเดียว | \`bash run_sim.sh gui:=false\` |
| ขับด้วยคีย์บอร์ด (Terminal ใหม่) | \`source ~/${name}_ws/install/setup.bash && ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true\` |
| บันทึกแผนที่ที่หุ่นทำเอง | \`ros2 run nav2_map_server map_saver_cli -f ~/${name}_map\` |
| ดูผัง TF ของหุ่น (ได้ frames.pdf) | \`ros2 run tf2_tools view_frames\` |
| หุ่นจริง (ต่อมอเตอร์ไดรเวอร์ + เซนเซอร์แล้ว) | \`ros2 launch ${prefix}_bringup robot.launch.py hardware:=real nav:=true\` |

Terminal ใหม่ทุกครั้งต้อง \`source ~/${name}_ws/install/setup.bash\` ก่อนใช้คำสั่ง \`ros2 …\` ของหุ่น (สคริปต์ \`run_sim.sh\` ทำให้เองแล้ว)

## ในโฟลเดอร์นี้มีอะไร
\`\`\`
${name}_ws/                 ← โฟลเดอร์นี้คือ ROS 2 workspace
├── README.md               ← ไฟล์นี้
├── setup.sh                ← ติดตั้ง + build ครั้งแรก
├── run_sim.sh              ← เปิดการจำลองทั้งระบบ
${repos ? '├── drivers.repos           ← driver ที่ต้อง build จาก source (setup.sh ดึงให้)\n' : ''}└── src/
${pkgs.map((p, i) => `    ${i === pkgs.length - 1 ? '└──' : '├──'} ${p}/${p === ap ? '        ← สนามทดสอบ: โลก Gazebo + แผนที่สำเร็จรูป' : ''}`).join('\n')}
\`\`\`
URDF ของหุ่นอยู่ที่ \`src/${prefix}_description/urdf/\` · ค่า Nav2 ที่คำนวณจากขนาดหุ่นอยู่ที่ \`src/${prefix}_navigation/config/nav2_params.yaml\`
${tfRows ? `\n## ผัง TF ของหุ่นตัวนี้\nชื่อเดียวกับที่เห็นในหน้า ① ออกแบบ (เลเยอร์ / TF) และใน RViz\n\n| frame | parent | x, y, z (m) | คืออะไร |\n|---|---|---|---|\n${tfRows}\n` : ''}
## ทำเองทีละขั้น (สิ่งที่ setup.sh และ run_sim.sh ทำให้)
\`\`\`bash
source /opt/ros/jazzy/setup.bash
${repos ? 'vcs import --recursive src < drivers.repos\n' : ''}rosdep install --from-paths src -y --ignore-src
colcon build --symlink-install
source install/setup.bash
ros2 launch ${prefix}_bringup sim.launch.py world:=${share}/worlds/${a.name}.sdf x:=0 y:=0 yaw:=0${field.mode === 'map' ? ` slam:=false map:=${share}/maps/${a.name}.yaml` : ''}
\`\`\`

## แก้ไขหุ่นหรือสนาม
กลับไปแก้ใน Robot Builder แล้วส่งออกใหม่ หรือแก้ไฟล์ YAML ใน \`src/*/config/\` (ใช้ \`--symlink-install\` แล้ว แก้ YAML แค่เปิดใหม่ ส่วน xacro ต้อง \`colcon build\` อีกครั้ง)
รายละเอียดแต่ละ package: \`src/${prefix}_bringup/README.md\` · สนาม: \`src/${ap}/README.md\`

## มีปัญหา?
| อาการ | วิธีแก้ |
|---|---|
| \`Package '${prefix}_bringup' not found\` | ยังไม่ได้ \`source install/setup.bash\` ใน Terminal นี้ หรือยังไม่ได้รัน \`bash setup.sh\` |
| หุ่นวิ่งวนเป็นวงกลม / ไปไม่ถึงจุดหมาย | เครื่องคำนวณไม่ทัน → \`bash run_sim.sh rtf:=0.5\` |
| Gazebo จอดำ หรือช้ามากใน VM / WSL | \`export LIBGL_ALWAYS_SOFTWARE=1\` แล้วรันใหม่ หรือ \`bash run_sim.sh gui:=false\` |
| หุ่นไม่ขยับ | \`ros2 control list_controllers\` — ทุกตัวต้องเป็น *active* |
| RViz ไม่มีแผนที่ในโหมด map | รอ 10–20 วินาทีให้ Nav2 ขึ้นครบ ถ้ายังไม่มีให้ปิดแล้วเปิดใหม่ |

---
Made by TESR · TESR Co.,Ltd. · LINE www.tesrshop.com/line · tesrshop@gmail.com · 082-983-7768
`;
}

// ------------------------------------------------------------------ celebration
function burst() {
  const cv = $('burst'), ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#C9A84C', '#ffe08a', '#b3171b', '#ffffff'], parts = [];
  const r = $('generate').getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
  for (let i = 0; i < 140; i++) { const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7; parts.push({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, s: 2 + Math.random() * 3, c: cols[i % 4], life: 60 + Math.random() * 40 }); }
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.99; p.life--; if (p.life > 0) { ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s * 2.2); } });
    if (++f < 110) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

// ------------------------------------------------------------------ inputs
document.querySelectorAll('button[data-example]').forEach((b) => b.addEventListener('click', () => loadExample(b.dataset.example)));
$('fromProject').onclick = loadFromProject;
$('yaml').addEventListener('input', setHero);
$('loadYaml').onclick = () => $('yamlInput').click();
$('yamlInput').onchange = async (e) => { const f = e.target.files[0]; if (f) { $('yaml').value = await f.text(); setHero(); status(`เปิด ${f.name}`); } e.target.value = ''; };
$('saveYaml').onclick = () => {
  const text = $('yaml').value;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/yaml' })); a.download = `${robotName(text)}.robot.yaml`; a.click();
};
const drop = $('drop');
drop.onclick = () => $('extraInput').click();
$('extraInput').onchange = (e) => { addExtra(e.target.files); e.target.value = ''; };
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => addExtra(e.dataTransfer.files));
function addExtra(files) {
  [...files].forEach((f) => extraFiles.set(f.name, f));
  $('extraNote').textContent = extraFiles.size ? `จะใส่ใน meshes/: ${[...extraFiles.keys()].join(', ')}` : '—';
}

// ------------------------------------------------------------------ start
(async () => {
  const has = loadFromProject();
  if (!has) { $('yaml').value = '# กำลังโหลดตัวอย่าง…'; $('adv').open = false; }
  try {
    await bootEngine();
    if ($('yaml').value.startsWith('# กำลังโหลด')) loadExample('warehouse_amr_300');
    if (fromProject) await pipeline(true); // robot from the Garage → run everything automatically
  } catch (e) {
    console.error(e);
    stage('engine', 'bad');
    progress(0, `โหลด engine ไม่สำเร็จ: ${e.message}`);
    status('engine ไม่พร้อม — ตรวจการเชื่อมต่ออินเทอร์เน็ต (Pyodide/jsdelivr) แล้วรีเฟรช');
  }
})();
