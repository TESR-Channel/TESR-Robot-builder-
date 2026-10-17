/* TESR Robot Builder — Garage helpers for both Garage pages (docs/garage-ux.js)
 *   index.html (body.mode-design): first-visit guide that explains the 4 site steps.
 *   play.html  (body.mode-play):   the mode picker (free drive / missions / arena) and touch controls for missions.
 * It only drives controls that already exist, so the Garage logic stays in garage.js and garage-game.js.
 */
const $ = (id) => document.getElementById(id);
const SEEN = 'tesr_rb_guide_seen';
const PLAY = document.body.classList.contains('mode-play');

// ---------------------------------------------------------------- first visit (design page)
function openGuide() {
  const d = document.createElement('div'); d.id = 'uxGuide';
  d.innerHTML = `<div class="card"><h2>ยินดีต้อนรับสู่ TESR Robot Builder</h2>
    <p>ออกแบบหุ่นยนต์จริงทีละขั้น แล้วได้ใบเสนอราคาและโปรแกรม ROS 2 — ทำตามเมนูด้านบนจาก ① ไป ④</p>
    <div class="steps">
      <div class="s"><div class="n">1</div><b>ออกแบบ</b><span>เลือกแบบ แล้วกด “ถัดไป” ทีละขั้น</span></div>
      <div class="s"><div class="n">2</div><b>ทดสอบ &amp; เกม</b><span>ลองขับหรือเล่นภารกิจ (ไม่บังคับ)</span></div>
      <div class="s"><div class="n">3</div><b>สรุป &amp; ราคา</b><span>สเปกและใบเสนอราคาพร้อมพิมพ์</span></div>
      <div class="s"><div class="n">4</div><b>ส่งออก ROS 2</b><span>ไฟล์ workspace พร้อม colcon build</span></div>
    </div>
    <div class="row"><button class="primary" data-g="start">เริ่มออกแบบ →</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click', (e) => {
    if (!e.target.closest('[data-g]') && e.target !== d) return;
    try { localStorage.setItem(SEEN, '1'); } catch (_) { /* ignore */ }
    d.remove();
  });
}

// ---------------------------------------------------------------- test & play page
function setMode(mode) {
  const g = window.__garage; if (!g) return;
  document.querySelectorAll('.mode-card[data-mode]').forEach((c) => c.classList.toggle('on', c.dataset.mode === mode));
  document.querySelectorAll('.mode-help').forEach((h) => h.classList.toggle('on', h.id === `help-${mode}`));
  if (mode === 'drive') { if (!g.flags.drive) g.toggleTool('drive'); }
  else if (g.flags.drive) g.toggleTool('drive');
  if (mode === 'mission') {
    const b = document.querySelector('#tools button[data-tool="mission"]');
    if (b) b.click(); else setTimeout(() => setMode('mission'), 300);
  }
  if (innerWidth < 1150) document.querySelector('.stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function robotChip() {
  const g = window.__garage; if (!g || !g.dv) return;
  $('pcName').textContent = g.state.name;
  $('pcSub').textContent = `RANK ${g.dv.rank} · ${g.state.mission.vMax} m/s · ${g.dv.sensors.filter((x) => x.category === 'lidar').length} LiDAR`;
}
// missions on touch screens: exit / restart / camera buttons, full-screen view, a clear ▶ Play on each open mission
function key(k) { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); } // garage-game.js listens on window
function decorateMenu() {
  document.querySelectorAll('#gmModal .gm-m:not(.lock):not([data-ux-play])').forEach((el) => {
    el.dataset.uxPlay = '1';
    const s = document.createElement('span'); s.className = 'gm-play'; s.innerHTML = '▶ <b>เล่น</b>'; el.appendChild(s);
  });
}
function gameUi() {
  const hud = $('gmHud'), modal = $('gmModal');
  if (!hud || !modal) { setTimeout(gameUi, 300); return; }
  const b = document.createElement('div'); b.className = 'gm-btns';
  b.innerHTML = '<button data-k="Escape">✕ <span>ออก</span></button><button data-k="r">↻ <span>เริ่มใหม่</span></button><button data-k="c">🎥 <span>กล้อง</span></button>';
  hud.appendChild(b);
  b.addEventListener('click', (e) => { const x = e.target.closest('[data-k]'); if (x) key(x.dataset.k); });
  const sync = () => {
    const playing = !hud.hidden, open = !modal.hidden;
    document.body.classList.toggle('gm-full', playing || open);
    document.body.classList.toggle('gm-playing', playing);
    if (open) decorateMenu();
    if (!playing && !open) document.querySelector('.mode-card[data-mode="mission"]')?.classList.remove('on');
  };
  new MutationObserver(sync).observe(hud, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ['hidden'], childList: true });
  sync();
}

(function boot() {
  if (!window.__garage || !window.__garage.dv) { setTimeout(boot, 200); return; }
  if (PLAY) {
    robotChip(); gameUi();
    document.querySelector('#bay').addEventListener('click', (e) => { const c = e.target.closest('.mode-card[data-mode]'); if (c) setMode(c.dataset.mode); });
    const q = new URLSearchParams(location.search);
    if (q.has('drive')) setMode('drive');
    return;
  }
  let seen = false; try { seen = localStorage.getItem(SEEN) === '1'; } catch (_) { /* ignore */ }
  if (!seen) openGuide();
})();
