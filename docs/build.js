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
  if (p.yaml) { $('yaml').value = p.yaml; fromProject = true; setHero(); $('heroSub').textContent = `หุ่นจาก Garage (${p.design?.name || ''}) → ตรวจ 16 กฎ → 5 packages พร้อมจำลอง ทำแผนที่ และนำทางเองใน Gazebo`; status(`robot.yaml จากโปรเจกต์ (${p.design?.name || ''})`); return true; }
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
    gazebo: [`${count('gazebo')} ไฟล์`, `TESR arena 12×8 m · ${lidars + cams + imus} sensors จำลอง`],
    navigation: [`${count('navigation')} ไฟล์`, `MPPI ${esc(mm)} · footprint <code>${esc(fp)}</code>`],
    bringup: [`${count('bringup')} ไฟล์`, 'sim.launch.py = Gazebo + SLAM + Nav2 + RViz'],
  };
}

async function renderPackages(res) {
  const facts = pkgFacts(res);
  for (const el of document.querySelectorAll('.pkg')) {
    const k = el.dataset.p, fx = facts[k];
    if (fx) { el.querySelector('.n').textContent = fx[0]; el.querySelector(':scope > div:nth-child(2) > div').innerHTML = fx[1]; }
    el.classList.add('on'); await sleep(140);
  }
}

function renderLaunch(res) {
  const n = res.summary.name, pre = res.summary.prefix;
  const cmds = [
    ['1 · Build', 'ครั้งแรกเท่านั้น', `unzip ${n}_ws.zip && cd ${n}_ws\nrosdep install --from-paths src -y --ignore-src\ncolcon build --symlink-install && source install/setup.bash`, false],
    ['2 · จำลอง + ทำแผนที่ + นำทาง', 'คำสั่งเดียว — คลิก 2D Goal Pose ใน RViz', `ros2 launch ${pre}_bringup sim.launch.py`, true],
    ['3 · ขับด้วยคีย์บอร์ด', 'อีก terminal', 'ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true', false],
    ['4 · บันทึกแผนที่ → ใช้ AMCL', 'หลังขับสำรวจครบ', `ros2 run nav2_map_server map_saver_cli -f ~/${n}_map\nros2 launch ${pre}_bringup sim.launch.py slam:=false map:=$HOME/${n}_map.yaml`, false],
    ['5 · หุ่นจริง', 'ต่อมอเตอร์ไดรเวอร์ + เซนเซอร์แล้ว', `ros2 launch ${pre}_bringup robot.launch.py hardware:=real nav:=true`, false],
    ['ไม่มี ROS ในเครื่อง? (Docker, Linux)', 'GUI ผ่าน X11', `xhost +local:docker\ndocker run -it --rm --net=host -e DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix -v "$PWD:/ws" -w /ws osrf/ros:jazzy-desktop-full bash -c "apt-get update -qq && rosdep update && rosdep install --from-paths src -y --ignore-src && colcon build --symlink-install && source install/setup.bash && ros2 launch ${pre}_bringup sim.launch.py"`, false],
  ];
  $('launch').innerHTML = cmds.map(([t, sub, c, hl], i) => `<div class="cmd ${hl ? 'hl' : ''}"><div class="t"><span><b>${t}</b> <span class="muted">· ${sub}</span></span><button data-copy="${i}">คัดลอก</button></div><pre>${esc(c)}</pre></div>`).join('');
  $('launch').querySelectorAll('button[data-copy]').forEach((b) => b.addEventListener('click', () => {
    navigator.clipboard.writeText(cmds[Number(b.dataset.copy)][2]).then(() => { b.textContent = 'คัดลอกแล้ว ✓'; setTimeout(() => (b.textContent = 'คัดลอก'), 1500); });
  }));
  return cmds;
}

let selectedFile = null;
function renderFiles(res) {
  const paths = Object.keys(res.files).sort();
  $('explorerBox').style.display = paths.length ? '' : 'none';
  const groups = {};
  paths.forEach((p) => { const m = p.match(/^src\/([^/]+)\//); const g = m ? m[1] : '(workspace)'; (groups[g] = groups[g] || []).push(p); });
  $('files').innerHTML = Object.entries(groups).map(([g, list]) => `<div class="dir">📦 ${esc(g)}</div>` + list.map((p) => `<div class="f" data-path="${esc(p)}">${esc(p.replace(`src/${g}/`, ''))}</div>`).join('')).join('');
  $('files').querySelectorAll('div.f').forEach((el) => el.addEventListener('click', () => {
    selectedFile = el.dataset.path;
    $('files').querySelectorAll('div.f').forEach((x) => x.classList.toggle('sel', x === el));
    $('preview').textContent = res.files[selectedFile];
    $('preview').classList.remove('muted');
  }));
  $('zipNote').textContent = `${paths.length} ไฟล์ · ${res.summary.packages.length} packages`;
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
  renderLaunch(res); renderFiles(res);
  $('downloadZip').disabled = false; $('generate').disabled = false;
  status(`สร้างแล้ว ${Object.keys(res.files).length} ไฟล์ · ${res.summary.packages.length} packages`);
  toast(`🏁 ${res.summary.name} พร้อมแล้ว — ดาวน์โหลด แล้วรัน sim.launch.py`);
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
  const cmds = [...document.querySelectorAll('#launch .cmd')].map((el) => `## ${el.querySelector('b').textContent}\n\n\`\`\`bash\n${el.querySelector('pre').textContent}\n\`\`\``).join('\n\n');
  root.file('README.md', `# ${name}_ws — ROS 2 Jazzy\n\nGenerated in the browser by TESR Robot Builder (engine ${lastResult.summary.versions.generator}, registry ${lastResult.summary.versions.registry}).\nDetails: src/${prefix}_bringup/README.md\n\n${cmds}\n`);
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}_ws.zip`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`⬇ ${name}_ws.zip — ต่อไป: คำสั่ง 1 และ 2 ใน Launch pad`);
};

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
