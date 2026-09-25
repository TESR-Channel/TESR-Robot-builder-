/* TESR Robot Builder — Garage made simple (docs/garage-ux.js)
 * One always-visible bar with the whole journey in 4 steps:
 *   ① เลือกหุ่น  ② แต่งหุ่น  ③ ทดสอบ (🎮 ขับ / 🏁 เล่นภารกิจ)  ④ ใช้งานจริง (📋 ใบเสนอราคา / 🚀 ROS 2)
 * plus a first-visit guide. It only clicks controls that already exist, so the Garage logic stays in garage.js.
 */
const $ = (id) => document.getElementById(id);
const SEEN = 'tesr_rb_guide_seen';
const click = (sel) => { const el = document.querySelector(sel); if (el) el.click(); return !!el; };
const tab = (name) => click(`#tabs button[data-tab="${name}"]`);

function hint(msg) {
  const h = $('uxHint'); if (!h) return;
  h.innerHTML = msg; h.classList.add('on');
  clearTimeout(hint.t); hint.t = setTimeout(() => h.classList.remove('on'), 5000);
}
function mark(step) { document.querySelectorAll('#uxBar .ux-step').forEach((b) => b.classList.toggle('now', b.dataset.step === String(step))); }

function drive() {
  const g = window.__garage; if (!g) return;
  if (!g.flags.drive) g.toggleTool('drive');
  mark(3);
  hint('🎮 กด <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> เพื่อขับ · มือถือใช้ภารกิจ 🏁 (มีจอยสัมผัส) · <kbd>Esc</kbd> หยุด');
  document.querySelector('.stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function play() {
  const g = window.__garage; if (g && g.flags.drive) g.toggleTool('drive');
  if (!click('#tools button[data-tool="mission"]')) { hint('กำลังเตรียมภารกิจ… ลองอีกครั้งในอีกสักครู่'); return; }
  mark(3);
  document.querySelector('.stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const ACTIONS = {
  pick: () => { tab('mission'); mark(1); hint('① แตะการ์ดหุ่นด้านซ้าย (เช่น AMR 300 kg) — หุ่นจะขึ้นกลางจอทันที'); },
  tune: () => { tab('chassis'); mark(2); hint('② ปรับขนาด ล้อ เซนเซอร์ แบต ได้ที่แท็บด้านซ้าย — ดู RANK ด้านขวาให้ได้ S หรือ A'); },
  drive, play,
  quote: () => { mark(4); click('#exSummary'); },
  ros: () => { mark(4); click('#exBuild'); },
  guide: () => openGuide(),
};

function injectUI() {
  const css = document.createElement('style');
  css.textContent = `
  #uxBar { display:flex; gap:8px; align-items:stretch; padding:8px 10px 0; flex-wrap:wrap; }
  #uxBar .ux-step { flex:1 1 0; min-width:150px; display:flex; gap:8px; align-items:center; padding:7px 10px; border-radius:12px; border:1px solid rgba(201,168,76,.25);
    background:linear-gradient(180deg,#15151b,#0c0c10); }
  #uxBar .ux-step.now { border-color:var(--gold); box-shadow:0 0 18px rgba(201,168,76,.25); }
  #uxBar .n { width:26px; height:26px; flex:none; border-radius:50%; display:grid; place-items:center; font-family:'Chakra Petch'; font-weight:700; color:#1a1300; background:linear-gradient(180deg,#ffe08a,#C9A84C); }
  #uxBar .t { font-size:11px; color:var(--muted); line-height:1.2; } #uxBar .t b { display:block; color:var(--text); font-size:12.5px; }
  #uxBar .btns { display:flex; gap:6px; margin-left:auto; flex-wrap:wrap; }
  #uxBar button { font-size:13px; padding:7px 12px; border-radius:9px; white-space:nowrap; }
  #uxBar button.hot { background:linear-gradient(180deg,#ff4a4a,#8B0000); color:#fff; font-weight:600; box-shadow:0 0 16px rgba(179,23,27,.55); animation:uxPulse 2.2s ease-in-out infinite; }
  #uxBar button.gold { background:linear-gradient(180deg,#ffe08a,#C9A84C); color:#1a1300; font-weight:600; }
  #uxBar .help { flex:0 0 auto; min-width:0; }
  @keyframes uxPulse { 50% { box-shadow:0 0 28px rgba(255,60,60,.85); } }
  main.garage { height:calc(100vh - 74px - 58px); }
  #uxHint { position:absolute; left:50%; top:112px; transform:translate(-50%,-8px); z-index:4; max-width:90%; background:rgba(8,8,12,.92); border:1px solid rgba(201,168,76,.6);
    color:#f3e6bf; padding:9px 16px; border-radius:12px; font-size:13.5px; opacity:0; pointer-events:none; transition:.3s; text-align:center; }
  #uxHint.on { opacity:1; transform:translate(-50%,0); }
  #uxGuide { position:fixed; inset:0; z-index:50; display:grid; place-items:center; background:rgba(3,3,6,.8); backdrop-filter:blur(5px); padding:16px; }
  #uxGuide .card { width:min(760px,100%); background:linear-gradient(180deg,#17171e,#0a0a0f); border:1px solid rgba(201,168,76,.5); border-radius:16px; padding:22px; }
  #uxGuide h2 { font-family:'Chakra Petch'; color:#ffe08a; margin:0 0 4px; letter-spacing:1px; } #uxGuide p { color:var(--muted); margin:0 0 14px; }
  #uxGuide .steps { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
  #uxGuide .s { border:1px solid #2a2a31; border-radius:12px; padding:12px; background:#0d0d12; text-align:center; }
  #uxGuide .s .i { font-size:34px; } #uxGuide .s b { display:block; font-family:'Chakra Petch'; margin:6px 0 4px; } #uxGuide .s span { font-size:12px; color:var(--muted); }
  #uxGuide .row { display:flex; gap:8px; justify-content:center; margin-top:16px; flex-wrap:wrap; } #uxGuide .row button { font-size:15px; padding:10px 18px; border-radius:10px; }
  @media (max-width:760px) { #uxGuide .steps { grid-template-columns:1fr 1fr; } #uxBar .ux-step { min-width:46%; } #uxBar .t { display:none; } }
  @media (max-width:1150px) { main.garage { height:auto; } main.garage .stage { order:-1; height:62vh; } }
  /* the mission menu/HUD are hidden with the [hidden] attribute, but their own display:grid/flex rules beat the browser default —
     without this the menu stayed on screen after pressing Play and covered the game */
  [hidden] { display:none !important; }
  /* missions: on-screen controls (no keyboard on phones/tablets) */
  .gm-btns { position:absolute; left:8px; top:8px; display:flex; gap:6px; pointer-events:auto; z-index:5; }
  .gm-btns button { background:rgba(8,8,12,.88); border:1px solid rgba(201,168,76,.55); color:#f3e6bf; font-size:13px; padding:8px 12px; border-radius:10px; }
  .gm-play { display:inline-block; margin-top:8px; padding:6px 16px; border-radius:16px; background:linear-gradient(180deg,#ff4a4a,#8B0000); color:#fff; font-size:13.5px; box-shadow:0 0 14px rgba(179,23,27,.55); }
  body.gm-playing #tools, body.gm-playing .stage-top, body.gm-playing #uxHint { display:none; }
  /* phones & tablets: the mission view takes the whole screen */
  @media (max-width:1149px) {
    body.garage-body.gm-full { overflow:hidden; }
    body.garage-body.gm-full main.garage .stage { position:fixed !important; inset:0 !important; height:100vh !important; height:100dvh !important; min-height:0 !important;
      z-index:1000; border-radius:0; border:none; }
    .gm-btns { top:auto; bottom:calc(58px + env(safe-area-inset-bottom)); left:50%; transform:translateX(-50%); }
  }`;
  document.head.appendChild(css);

  const bar = document.createElement('div'); bar.id = 'uxBar';
  bar.innerHTML = `
    <div class="ux-step now" data-step="1"><span class="n">1</span><span class="t"><b>เลือกหุ่น</b>พิมพ์เขียวสำเร็จรูป</span><span class="btns"><button data-ux="pick">🤖 เลือก</button></span></div>
    <div class="ux-step" data-step="2"><span class="n">2</span><span class="t"><b>แต่งหุ่น</b>ขนาด ล้อ เซนเซอร์ แบต</span><span class="btns"><button data-ux="tune">🔧 แต่ง</button></span></div>
    <div class="ux-step" data-step="3"><span class="n">3</span><span class="t"><b>ทดสอบ</b>ขับเอง หรือเล่นภารกิจ</span><span class="btns"><button data-ux="drive">🎮 ขับ</button><button class="hot" data-ux="play">🏁 เล่นภารกิจ</button></span></div>
    <div class="ux-step" data-step="4"><span class="n">4</span><span class="t"><b>ใช้งานจริง</b>ใบเสนอราคา / ROS 2</span><span class="btns"><button class="gold" data-ux="quote">📋 ใบเสนอราคา</button><button data-ux="ros">🚀 ROS 2</button></span></div>
    <div class="ux-step help"><span class="btns"><button class="ghost" data-ux="guide" title="วิธีใช้">❔</button></span></div>`;
  const main = document.querySelector('main.garage');
  main.parentNode.insertBefore(bar, main);
  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-ux]'); if (b) ACTIONS[b.dataset.ux](); });

  const h = document.createElement('div'); h.id = 'uxHint'; document.querySelector('.stage').appendChild(h);

  // follow the left tabs so the bar always shows where you are
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) mark(b.dataset.tab === 'mission' ? 1 : 2); });
  // after picking a blueprint, point at the next step
  $('tabBody').addEventListener('click', (e) => { if (e.target.closest('[data-act="bp"]')) { mark(2); hint('✅ ได้หุ่นแล้ว! ลองกด <b>🎮 ขับ</b> หรือ <b>🏁 เล่นภารกิจ</b> ที่แถบด้านบนได้เลย'); } });
}

function openGuide() {
  const d = document.createElement('div'); d.id = 'uxGuide';
  d.innerHTML = `<div class="card"><h2>🛠 ยินดีต้อนรับสู่ TESR Robot Builder</h2>
    <p>ออกแบบหุ่นยนต์จริง ลองขับในโกดังจำลอง แล้วได้ใบเสนอราคาและโปรแกรม ROS 2 — ทำตามแถบด้านบน 4 ขั้น</p>
    <div class="steps">
      <div class="s"><div class="i">🤖</div><b>1 · เลือกหุ่น</b><span>แตะการ์ดหุ่นด้านซ้าย หุ่นขึ้นกลางจอทันที</span></div>
      <div class="s"><div class="i">🔧</div><b>2 · แต่งหุ่น</b><span>ปรับขนาด ล้อ เซนเซอร์ แบต ดู RANK ด้านขวา</span></div>
      <div class="s"><div class="i">🏁</div><b>3 · ทดสอบ</b><span>ขับเองด้วย W A S D หรือเล่น 5 ภารกิจเก็บดาว</span></div>
      <div class="s"><div class="i">📋</div><b>4 · ใช้งานจริง</b><span>ใบเสนอราคาพร้อมพิมพ์ และโปรแกรม ROS 2</span></div>
    </div>
    <div class="row"><button class="ghost" data-g="start">เริ่มออกแบบ</button><button class="gold" data-g="play">🏁 เล่นภารกิจเลย</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b && e.target !== d) return;
    try { localStorage.setItem(SEEN, '1'); } catch (_) { /* ignore */ }
    d.remove();
    if (b && b.dataset.g === 'play') play(); else ACTIONS.pick();
  });
}

// ---- missions on touch screens: exit / restart / camera buttons, full-screen view, a clear ▶ Play on each open mission
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
  };
  new MutationObserver(sync).observe(hud, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ['hidden'], childList: true });
  sync();
}

(function boot() {
  if (!window.__garage || !window.__garage.dv || !$('tabs')) { setTimeout(boot, 200); return; }
  injectUI(); gameUi();
  let seen = false; try { seen = localStorage.getItem(SEEN) === '1'; } catch (_) { /* ignore */ }
  if (!seen) openGuide();
})();
