/* TESR Robot Builder — Definition & Generate (docs/build.js)
 * Runs the real Python engine (src/tesr_robot_builder) inside the browser with Pyodide:
 *   1. load ./data/engine.json (bundle written by `tesr-rb export-web`), or fall back to
 *      ./data/engine-manifest.json + raw.githubusercontent.com for each file;
 *   2. write the files into Pyodide's FS, import tesr_robot_builder.web_entry;
 *   3. build_json(yaml) → {report, files, summary}; JSZip → <name>_ws.zip.
 * Nothing leaves the browser.
 */
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs';
const PROJECT_KEY = 'tesr_rb_project';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let pyodide = null, engineFiles = null, lastResult = null;
const extraFiles = new Map(); // name → File (STL/DAE dropped here)

const status = (m) => { $('status').textContent = m; };
const progress = (pct, text) => { $('engineBar').style.width = `${pct}%`; if (text) $('engineText').textContent = text; };

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
  progress(100, `engine ${ver} พร้อม — Python ${pyodide.runPython('sys.version.split()[0]')} ในเบราว์เซอร์`);
  status(`engine ${ver} · ${Object.keys(files).length} files · registry ${Object.keys(files).filter((p) => p.startsWith('registry/')).length} records`);
  $('validate').disabled = false; $('generate').disabled = false;
}

// ------------------------------------------------------------------ YAML sources
function loadExample(name) {
  const key = `examples/${name}.robot.yaml`;
  if (engineFiles && engineFiles[key]) { $('yaml').value = engineFiles[key]; status(`โหลดตัวอย่าง ${name}`); }
  else status('engine ยังโหลดไม่เสร็จ');
}
function loadFromProject() {
  const p = JSON.parse(localStorage.getItem(PROJECT_KEY) || '{}');
  if (p.yaml) { $('yaml').value = p.yaml; status(`YAML จากขั้น 1 (${p.design?.name || ''})`); return true; }
  status('ยังไม่มี YAML จากขั้น 1 — กด "ส่งไป Model Studio" หรือ "ดาวน์โหลด .robot.yaml" ในหน้า Spec & Sizing ก่อน');
  return false;
}

// ------------------------------------------------------------------ run engine
function run(extra) {
  const text = $('yaml').value;
  const name = (text.match(/^\s*name:\s*([a-z0-9_]+)/m) || [])[1] || 'robot';
  pyodide.globals.set('YAML_TEXT', text);
  pyodide.globals.set('DEF_NAME', `${name}.robot.yaml`);
  pyodide.globals.set('EXTRA_JSON', extra ? JSON.stringify(extra) : null);
  const out = pyodide.runPython("build_json(YAML_TEXT, DEF_NAME, '/engine/registry', EXTRA_JSON)");
  return JSON.parse(out);
}

function renderReport(res) {
  const icon = { PASS: '✅', WARN: '⚠️', ERROR: '🔴' };
  if (res.errors.length) {
    $('report').innerHTML = `<div class="finding ERROR"><b>${esc(res.stage)} error</b></div>` + res.errors.map((e) => `<div class="finding ERROR">${esc(e)}</div>`).join('');
    $('summary').innerHTML = ''; return;
  }
  const nErr = res.report.filter((r) => r.severity === 'ERROR').length, nWarn = res.report.filter((r) => r.severity === 'WARN').length;
  const order = { ERROR: 0, WARN: 1, PASS: 2 };
  $('report').innerHTML = `<p><b>${nErr} error · ${nWarn} warning</b> <span class="muted">(${res.report.length} findings จาก 15 rules)</span></p>` +
    [...res.report].sort((a, b) => order[a.severity] - order[b.severity]).map((r) =>
      `<div class="finding ${r.severity}">${icon[r.severity]} <b>${r.rule}</b> ${esc(r.message)}${r.path ? ` <span class="muted">(${esc(r.path)})</span>` : ''}${r.suggestion && r.severity !== 'PASS' ? `<br><span class="muted">→ ${esc(r.suggestion)}</span>` : ''}</div>`).join('');
  const s = res.summary;
  $('summary').innerHTML = s ? `<div class="kpi">
      <div><b>${esc(s.name)}</b><span>${esc(s.drive)} · ${esc(s.prefix)}_*</span></div>
      <div><b>${s.robot_mass} / ${s.total_mass} kg</b><span>robot / total</span></div>
      <div><b>${esc(s.controller.split('/')[0])}</b><span>ros2_control</span></div>
      <div><b>${s.costmap.local_size_m} m</b><span>local costmap · infl ${s.costmap.inflation_radius_m} m</span></div>
      <div><b>${s.ekf ? 'EKF' : 'odom'}</b><span>${esc(s.planner.split('/')[1] || s.planner)} + ${esc(s.nav_controller.split('/')[1] || s.nav_controller)}</span></div>
    </div>` : '';
}

let selectedFile = null;
function renderFiles(res) {
  const paths = Object.keys(res.files).sort();
  $('workspace').style.display = paths.length ? '' : 'none';
  $('files').innerHTML = paths.map((p) => `<div data-path="${esc(p)}">${esc(p)}</div>`).join('');
  $('zipNote').textContent = `${paths.length} ไฟล์ · ${res.summary.packages.join(', ')}`;
  const name = res.summary.name;
  $('nextCmd').textContent = `unzip ${name}_ws.zip && cd ${name}_ws
docker run --rm -it -v "$PWD:/ws" -w /ws ros:jazzy bash -c \\
  "apt-get update -qq && rosdep update && rosdep install --from-paths src -y --ignore-src --skip-keys 'rviz2 joint_state_publisher_gui' && colcon build --symlink-install && source install/setup.bash && ros2 launch ${res.summary.prefix}_bringup robot.launch.py"`;
  $('files').querySelectorAll('div').forEach((el) => el.addEventListener('click', () => {
    selectedFile = el.dataset.path;
    $('files').querySelectorAll('div').forEach((x) => x.classList.toggle('sel', x === el));
    $('preview').textContent = res.files[selectedFile];
    $('preview').classList.remove('muted');
  }));
}

function extrasFromProject() {
  // meshes.xacro from Model Studio (project.model) — the STL files themselves are added from the drop zone
  const p = JSON.parse(localStorage.getItem(PROJECT_KEY) || '{}');
  const extra = {};
  if (p.model && p.model.meshes && p.model.meshes.length) {
    const prefix = p.model.prefix || 'tesr_robot';
    extra[`src/${prefix}_description/urdf/meshes.xacro`] = window.TESR_MODEL.exportXacro(p.model);
    extra[`src/${prefix}_description/urdf/MESHES_README.md`] = `# Meshes from Model Studio\n\nInclude in robot.urdf.xacro:\n\n    <xacro:include filename="meshes.xacro"/>\n    <xacro:tesr_meshes/>\n\nSTL files listed in meshes.xacro go in ../meshes/ (drop them on the Generate page to add them to the zip).\n`;
  }
  return extra;
}

$('validate').onclick = () => { const res = run(null); lastResult = null; renderReport(res); $('workspace').style.display = 'none'; status(res.ok ? 'ตรวจผ่าน — สร้าง workspace ได้' : `ตรวจไม่ผ่าน (${res.stage})`); };
$('generate').onclick = () => {
  const res = run(extrasFromProject()); renderReport(res);
  if (!res.ok) { $('workspace').style.display = 'none'; status(`สร้างไม่ได้ — แก้ ERROR ก่อน (${res.stage})`); return; }
  lastResult = res; renderFiles(res); status(`สร้างแล้ว ${Object.keys(res.files).length} ไฟล์ — ดาวน์โหลด zip ได้`);
};

$('downloadZip').onclick = async () => {
  if (!lastResult) return;
  const name = lastResult.summary.name, prefix = lastResult.summary.prefix;
  const zip = new JSZip(), root = zip.folder(`${name}_ws`);
  for (const [p, c] of Object.entries(lastResult.files)) root.file(p, c);
  for (const [fname, file] of extraFiles) root.file(`src/${prefix}_description/meshes/${fname}`, await file.arrayBuffer());
  root.file('README_WEB.md', `# ${name}_ws\n\nGenerated in the browser by TESR Robot Builder (engine ${lastResult.summary.versions.generator}, registry ${lastResult.summary.versions.registry}).\n\n${$('nextCmd').textContent}\n`);
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}_ws.zip`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

// ------------------------------------------------------------------ inputs
document.querySelectorAll('button[data-example]').forEach((b) => b.addEventListener('click', () => loadExample(b.dataset.example)));
$('fromProject').onclick = loadFromProject;
$('loadYaml').onclick = () => $('yamlInput').click();
$('yamlInput').onchange = async (e) => { const f = e.target.files[0]; if (f) { $('yaml').value = await f.text(); status(`เปิด ${f.name}`); } e.target.value = ''; };
$('saveYaml').onclick = () => {
  const text = $('yaml').value, name = (text.match(/^\s*name:\s*([a-z0-9_]+)/m) || [])[1] || 'robot';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/yaml' })); a.download = `${name}.robot.yaml`; a.click();
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
  if (!loadFromProject()) $('yaml').value = '# กำลังโหลดตัวอย่าง…';
  try {
    await bootEngine();
    if ($('yaml').value.startsWith('# กำลังโหลด')) loadExample('warehouse_amr_300');
  } catch (e) {
    console.error(e);
    progress(0, `โหลด engine ไม่สำเร็จ: ${e.message}`);
    status('engine ไม่พร้อม — ตรวจการเชื่อมต่ออินเทอร์เน็ต (Pyodide/jsdelivr) แล้วรีเฟรช');
  }
})();
