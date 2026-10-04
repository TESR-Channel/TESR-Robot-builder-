/* TESR Robot Builder — arena editor (docs/arena.js)
 * Design a Gazebo field in 2D (fast on any laptop or phone), test-drive the robot from the Garage with its real LiDAR and
 * camera numbers, then export a ROS 2 world package (see arena-export.js). Everything stays in the browser.
 */
(function () {
  'use strict';
  const A = window.TESR_ARENA, $ = (id) => document.getElementById(id);
  const KEY = 'tesr_rb_arena';
  const isEn = () => (window.TESR_I18N && window.TESR_I18N.lang === 'en');
  const L = (th, en) => (isEn() ? en : th);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cv = $('cv'), ctx = cv.getContext('2d');
  let arena, sel = null, tool = 'select', mode = 'edit', registry = null, garage = null;
  const view = { cx: 0, cy: 0, s: 50 };
  const hist = [], redo = [];

  // ---------- state --------------------------------------------------------------------------------------------
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.items) return A.normalize(s); } catch (_) { /* fall through */ }
    return A.normalize(A.PRESETS.tesr_warehouse.make());
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(arena)); } catch (_) { /* ignore */ } status(); };
  function commit() { hist.push(JSON.stringify(arena)); if (hist.length > 60) hist.shift(); redo.length = 0; }
  function undo() { if (!hist.length) return; redo.push(JSON.stringify(arena)); arena = JSON.parse(hist.pop()); sel = null; afterChange(); }
  function redoIt() { if (!redo.length) return; hist.push(JSON.stringify(arena)); arena = JSON.parse(redo.pop()); sel = null; afterChange(); }
  function afterChange() { save(); fillSettings(); renderProps(); draw(); }
  const snap = (v) => { const g = +$('aSnap').value; return g ? Math.round(v / g) * g : Math.round(v * 1000) / 1000; };
  const item = (id) => arena.items.find((i) => i.id === id);
  const nextId = (type) => { const used = new Set(arena.items.filter((i) => i.type === type).map((i) => (type === 'aruco' ? i.markerId : i.label))); if (type === 'aruco') { for (let k = 0; k < 50; k++) if (!used.has(k)) return k; return 0; } for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(c)) return c; return 'Z'; };

  // ---------- view ---------------------------------------------------------------------------------------------
  function resize() { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0); draw(); }
  function fit() { const r = cv.getBoundingClientRect(); view.cx = 0; view.cy = 0; view.s = Math.min((r.width - 40) / (arena.size.w + 1), (r.height - 120) / (arena.size.h + 1)); draw(); }
  const toS = (x, y) => { const r = cv.getBoundingClientRect(); return [r.width / 2 + (x - view.cx) * view.s, r.height / 2 - (y - view.cy) * view.s]; };
  const toW = (px, py) => { const r = cv.getBoundingClientRect(); return [(px - r.width / 2) / view.s + view.cx, -(py - r.height / 2) / view.s + view.cy]; };

  // ---------- drawing ------------------------------------------------------------------------------------------
  const FILL = { red: '#8B0000', wood: '#c9a84c', blue: '#2b5bbf', gray: '#8c8c94', green: '#2e8b57', yellow: '#e6bf1a', white: '#e6e6e6', black: '#222' };
  function poly(pts, fill, stroke, lw = 1) { ctx.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = toS(x, y); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } }
  const obbPts = (s) => { const c = Math.cos(s.yaw), n = Math.sin(s.yaw); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [s.cx + u * s.hx * c - v * s.hy * n, s.cy + u * s.hx * n + v * s.hy * c]); };
  function drawShape(s, fill, stroke) {
    if (s.k === 'circle') { const [x, y] = toS(s.cx, s.cy); ctx.beginPath(); ctx.arc(x, y, s.r * view.s, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } }
    else poly(obbPts(s), fill, stroke, 2);
  }
  function drawMarker(it, selected) {
    const P = A.plateSize(it), cells = A.markerCells(it.markerId), cell = it.size / 6;
    if (it.mount === 'floor') {
      const c = Math.cos(it.yaw || 0), n = Math.sin(it.yaw || 0), at = (u, v) => [it.x + u * c - v * n, it.y + u * n + v * c];
      poly([at(-P / 2, -P / 2), at(P / 2, -P / 2), at(P / 2, P / 2), at(-P / 2, P / 2)], '#fff', selected ? '#ffe08a' : '#999', selected ? 3 : 1);
      cells.forEach((row, r) => row.forEach((b, k) => { if (!b) return; const u0 = (2.5 - r) * cell, v0 = -(k - 2.5) * cell; poly([at(u0 - cell / 2, v0 - cell / 2), at(u0 + cell / 2, v0 - cell / 2), at(u0 + cell / 2, v0 + cell / 2), at(u0 - cell / 2, v0 + cell / 2)], '#000'); }));
    } else {
      A.shapes(it).forEach((s) => drawShape(s, '#f0f0f0', selected ? '#ffe08a' : '#777'));
      const c = Math.cos(it.yaw || 0), n = Math.sin(it.yaw || 0), [x0, y0] = toS(it.x, it.y), [x1, y1] = toS(it.x + c * 0.35, it.y + n * 0.35);
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    const [x, y] = toS(it.x, it.y); ctx.fillStyle = '#ffe08a'; ctx.font = '600 11px Chakra Petch, sans-serif'; ctx.fillText(`#${it.markerId}`, x + 8, y - 8);
  }
  function drawStart(p, ghost) {
    const fp = robotFootprint(), c = Math.cos(p.yaw), n = Math.sin(p.yaw), at = (u, v) => [p.x + u * c - v * n, p.y + u * n + v * c];
    if (fp.round) { const [x, y] = toS(p.x, p.y); ctx.beginPath(); ctx.arc(x, y, fp.r * view.s, 0, Math.PI * 2); ctx.fillStyle = ghost ? 'rgba(201,168,76,.18)' : 'rgba(201,168,76,.85)'; ctx.fill(); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.stroke(); }
    else poly([at(-fp.l / 2, -fp.w / 2), at(fp.l / 2, -fp.w / 2), at(fp.l / 2, fp.w / 2), at(-fp.l / 2, fp.w / 2)], ghost ? 'rgba(201,168,76,.18)' : 'rgba(201,168,76,.85)', '#ffe08a', 2);
    const [x0, y0] = toS(p.x, p.y), [x1, y1] = toS(...at(Math.max(fp.l || fp.r * 2, 0.3) * 0.6, 0));
    ctx.strokeStyle = ghost ? '#ffe08a' : '#1a1300'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (ghost) { ctx.fillStyle = '#ffe08a'; ctx.font = '600 11px Chakra Petch, sans-serif'; ctx.fillText('START', x0 + 10, y0 + 18); }
  }
  function draw() {
    const r = cv.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height);
    // grid
    const [wx0, wy1] = toW(0, 0), [wx1, wy0] = toW(r.width, r.height);
    ctx.lineWidth = 1;
    for (let x = Math.floor(wx0); x <= wx1; x++) { const [a] = toS(x, 0); ctx.strokeStyle = x === 0 ? 'rgba(201,168,76,.35)' : 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(a, r.height); ctx.stroke(); }
    for (let y = Math.floor(wy0); y <= wy1; y++) { const [, b] = toS(0, y); ctx.strokeStyle = y === 0 ? 'rgba(201,168,76,.35)' : 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(0, b); ctx.lineTo(r.width, b); ctx.stroke(); }
    const hide = mode === 'test' && $('oHide').checked;
    // floor
    poly([[-arena.size.w / 2, -arena.size.h / 2], [arena.size.w / 2, -arena.size.h / 2], [arena.size.w / 2, arena.size.h / 2], [-arena.size.w / 2, arena.size.h / 2]], hide ? '#0a0a0e' : '#15151b', 'rgba(201,168,76,.25)');
    if (mode === 'test' && $('oSlam').checked) drawSlam();
    if (!hide) {
      for (const it of A.solids(arena)) {
        if (it.type === 'aruco') { drawMarker(it, sel === it.id); continue; }
        const fill = it.type === 'wall' ? '#6d6d75' : FILL[it.color] || '#888';
        A.shapes(it).forEach((s) => drawShape(s, fill, sel === it.id ? '#ffe08a' : 'rgba(0,0,0,.4)'));
        if (it.type === 'wall' && sel === it.id) [[it.x1, it.y1], [it.x2, it.y2]].forEach(([x, y]) => { const [a, b] = toS(x, y); ctx.fillStyle = '#ffe08a'; ctx.fillRect(a - 5, b - 5, 10, 10); });
      }
    }
    for (const g of arena.items.filter((i) => i.type === 'goal')) {
      const [x, y] = toS(g.x, g.y), done = sim && sim.goals[g.id];
      ctx.beginPath(); ctx.arc(x, y, 0.3 * view.s, 0, Math.PI * 2); ctx.strokeStyle = done ? '#2e8b57' : (sel === g.id ? '#fff' : '#C9A84C'); ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = done ? '#7fd39b' : '#ffe08a'; ctx.font = '700 13px Chakra Petch, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(g.label + (done ? ' ✓' : ''), x, y + 5); ctx.textAlign = 'left';
    }
    if (mode === 'edit') drawStart(arena.start, true);
    if (draft) drawDraft();
    if (mode === 'test' && sim) drawSim();
  }

  // ---------- tools ---------------------------------------------------------------------------------------------
  const TOOLS = [
    ['select', '🖐', 'เลือก/ย้าย', 'Select/move'], ['wall', '🧱', 'กำแพง', 'Wall'], ['box', '⬛', 'กล่อง', 'Box'], ['cyl', '⚪', 'ทรงกระบอก', 'Cylinder'],
    ['aruco', '🔳', 'ArUco', 'ArUco'], ['goal', '📍', 'จุดหมาย', 'Goal'], ['start', '🚩', 'จุดเริ่ม', 'Start'], ['erase', '🗑', 'ลบ', 'Erase'],
  ];
  const HINT = {
    select: ['แตะชิ้นงานเพื่อเลือก ลากเพื่อย้าย · ลากพื้นที่ว่างเพื่อเลื่อนมุมมอง · R หมุน 15° · Delete ลบ', 'Tap to select, drag to move · drag empty space to pan · R rotates 15° · Delete removes'],
    wall: ['ลากจากจุดหนึ่งไปอีกจุดเพื่อวางกำแพง', 'Drag from one point to another to place a wall'],
    box: ['ลากเป็นสี่เหลี่ยมเพื่อวางกล่อง/ชั้นวาง/พาเลท', 'Drag a rectangle to place a box / rack / pallet'],
    cyl: ['แตะจุดกลางแล้วลากออกเพื่อกำหนดรัศมี', 'Press the centre and drag out the radius'],
    aruco: ['แตะเพื่อวางป้าย ArUco บนเสา (หันเข้าหาจุดเริ่ม) — เปลี่ยนเป็นติดพื้นได้ในคุณสมบัติ', 'Tap to place an ArUco sign on a post (facing the start) — switch to a floor tag in the properties'],
    goal: ['แตะเพื่อวางจุดหมาย A, B, C… ไว้ทดสอบการนำทาง', 'Tap to place goals A, B, C… for navigation tests'],
    start: ['แตะเพื่อย้ายจุดเริ่มของหุ่น · R หมุนทิศ', 'Tap to move the robot start · R rotates the heading'],
    erase: ['แตะชิ้นงานที่ต้องการลบ', 'Tap an object to delete it'],
  };
  function renderTools() {
    $('tools').innerHTML = TOOLS.map(([k, ic, th, en]) => `<button data-t="${k}" class="${tool === k ? 'on' : ''}">${ic} ${L(th, en)}</button>`).join('')
      + `<span class="sp"></span><button data-a="undo" title="Ctrl+Z">↶</button><button data-a="redo" title="Ctrl+Y">↷</button>`;
    $('hint').textContent = mode === 'test' ? L('ขับ: W A S D / ลูกศร (mecanum: Q E สไลด์) · มือถือใช้จอยซ้ายล่าง', 'Drive: W A S D / arrows (mecanum: Q E strafe) · on phones use the joystick') : L(...HINT[tool]);
    $('tools').hidden = mode === 'test';
  }
  $('tools').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t) { tool = b.dataset.t; renderTools(); }
    if (b.dataset.a === 'undo') undo(); if (b.dataset.a === 'redo') redoIt();
  });

  // ---------- pointer input ------------------------------------------------------------------------------------
  let drag = null, draft = null; const pointers = new Map();
  function hit(x, y) {
    const tol = 8 / view.s;
    const goals = arena.items.filter((i) => i.type === 'goal').reverse();
    for (const g of goals) if (Math.hypot(g.x - x, g.y - y) < 0.35) return g;
    for (const it of arena.items.slice().reverse()) {
      if (it.type === 'goal') continue;
      if (it.type === 'aruco' && Math.hypot(it.x - x, it.y - y) < Math.max(0.2, A.plateSize(it) / 2 + tol)) return it;
      for (const s of A.shapes(it)) { const g = s.k === 'circle' ? Object.assign({}, s, { r: s.r + tol }) : Object.assign({}, s, { hx: s.hx + tol, hy: s.hy + tol }); if (A.inShape(g, x, y)) return it; }
    }
    return null;
  }
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; drag = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), s0: view.s }; draft = null; return; }
    if (mode === 'test') { drag = { pan: [e.offsetX, e.offsetY], c: [view.cx, view.cy] }; return; }
    const [x, y] = toW(e.offsetX, e.offsetY), sx = snap(x), sy = snap(y);
    if (tool === 'select') {
      const it = selItem();
      if (it && it.type === 'wall') for (const k of [1, 2]) if (Math.hypot(it[`x${k}`] - x, it[`y${k}`] - y) < 10 / view.s) { commit(); drag = { end: k, it }; return; }
      const h = hit(x, y);
      if (h) { sel = h.id; commit(); drag = { move: h, x0: x, y0: y, orig: JSON.parse(JSON.stringify(h)) }; renderProps(); draw(); return; }
      if (Math.hypot(arena.start.x - x, arena.start.y - y) < 0.35) { sel = 'start'; commit(); drag = { start: true }; renderProps(); draw(); return; }
      sel = null; renderProps(); drag = { pan: [e.offsetX, e.offsetY], c: [view.cx, view.cy] }; draw(); return;
    }
    if (tool === 'erase') { const h = hit(x, y); if (h) { commit(); arena.items = arena.items.filter((i) => i !== h); sel = null; afterChange(); } return; }
    if (tool === 'aruco') {
      commit(); const yaw = Math.atan2(arena.start.y - sy, arena.start.x - sx);
      const it = { id: `i${Date.now().toString(36)}`, type: 'aruco', x: sx, y: sy, yaw: Math.round(yaw / (Math.PI / 12)) * (Math.PI / 12), size: 0.15, markerId: nextId('aruco'), mount: 'post', z: 0.35 };
      arena.items.push(it); sel = it.id; afterChange(); return;
    }
    if (tool === 'goal') { commit(); const it = { id: `i${Date.now().toString(36)}`, type: 'goal', x: sx, y: sy, label: nextId('goal') }; arena.items.push(it); sel = it.id; afterChange(); return; }
    if (tool === 'start') { commit(); Object.assign(arena.start, { x: sx, y: sy }); sel = 'start'; afterChange(); return; }
    draft = { tool, x0: sx, y0: sy, x1: sx, y1: sy };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (drag && drag.pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; view.s = Math.max(8, Math.min(400, drag.s0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / drag.pinch)); draw(); return; }
    const [x, y] = toW(e.offsetX, e.offsetY);
    if (draft) { draft.x1 = snap(x); draft.y1 = snap(y); draw(); return; }
    if (!drag) return;
    if (drag.pan) { view.cx = drag.c[0] - (e.offsetX - drag.pan[0]) / view.s; view.cy = drag.c[1] + (e.offsetY - drag.pan[1]) / view.s; draw(); return; }
    if (drag.end) { drag.it[`x${drag.end}`] = snap(x); drag.it[`y${drag.end}`] = snap(y); draw(); return; }
    if (drag.start) { arena.start.x = snap(x); arena.start.y = snap(y); draw(); return; }
    if (drag.move) {
      const it = drag.move, o = drag.orig, dx = x - drag.x0, dy = y - drag.y0;
      if (it.type === 'wall') { it.x1 = snap(o.x1 + dx); it.y1 = snap(o.y1 + dy); it.x2 = it.x1 + (o.x2 - o.x1); it.y2 = it.y1 + (o.y2 - o.y1); }
      else { it.x = snap(o.x + dx); it.y = snap(o.y + dy); }
      draw();
    }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (draft) {
      const d = draft; draft = null; const w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0), len = Math.hypot(w, h);
      const nid = `i${Date.now().toString(36)}`;
      if (d.tool === 'wall' && len >= 0.1) { commit(); arena.items.push({ id: nid, type: 'wall', x1: d.x0, y1: d.y0, x2: d.x1, y2: d.y1, t: 0.15, h: arena.wallHeight }); sel = nid; }
      if (d.tool === 'box' && w >= 0.05 && h >= 0.05) { commit(); arena.items.push({ id: nid, type: 'box', x: (d.x0 + d.x1) / 2, y: (d.y0 + d.y1) / 2, w, d: h, h: 0.6, yaw: 0, color: 'wood' }); sel = nid; }
      if (d.tool === 'cyl' && len >= 0.05) { commit(); arena.items.push({ id: nid, type: 'cyl', x: d.x0, y: d.y0, r: Math.round(len * 100) / 100, h: 1.0, color: 'gray' }); sel = nid; }
      afterChange(); return;
    }
    if (drag && (drag.move || drag.end || drag.start)) afterChange();
    if (pointers.size === 0) drag = null;
  }
  cv.addEventListener('pointerup', endPointer); cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = toW(e.offsetX, e.offsetY); view.s = Math.max(8, Math.min(400, view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); const [x2, y2] = toW(e.offsetX, e.offsetY); view.cx += x - x2; view.cy += y - y2; draw(); }, { passive: false });
  function drawDraft() {
    const d = draft;
    if (d.tool === 'wall') { const s = A.shapes({ type: 'wall', x1: d.x0, y1: d.y0, x2: d.x1, y2: d.y1, t: 0.15 })[0]; drawShape(s, 'rgba(201,168,76,.5)', '#ffe08a'); }
    if (d.tool === 'box') poly([[d.x0, d.y0], [d.x1, d.y0], [d.x1, d.y1], [d.x0, d.y1]], 'rgba(201,168,76,.4)', '#ffe08a', 2);
    if (d.tool === 'cyl') drawShape({ k: 'circle', cx: d.x0, cy: d.y0, r: Math.hypot(d.x1 - d.x0, d.y1 - d.y0) }, 'rgba(201,168,76,.4)', '#ffe08a');
    const [a, b] = toS(d.x1, d.y1); ctx.fillStyle = '#ffe08a'; ctx.font = '12px Chakra Petch, sans-serif';
    ctx.fillText(d.tool === 'cyl' ? `r ${Math.hypot(d.x1 - d.x0, d.y1 - d.y0).toFixed(2)} m` : d.tool === 'wall' ? `${Math.hypot(d.x1 - d.x0, d.y1 - d.y0).toFixed(2)} m` : `${Math.abs(d.x1 - d.x0).toFixed(2)} × ${Math.abs(d.y1 - d.y0).toFixed(2)} m`, a + 10, b - 10);
  }
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (mode === 'test') { keys.add(k); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redoIt() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redoIt(); return; }
    if ((k === 'delete' || k === 'backspace') && sel && sel !== 'start') { commit(); arena.items = arena.items.filter((i) => i.id !== sel); sel = null; afterChange(); }
    if (k === 'r') rotateSel(e.shiftKey ? -1 : 1);
    if (k === 'escape') { sel = null; draft = null; renderProps(); draw(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  function rotateSel(dir) {
    const st = Math.PI / 12 * dir;
    if (sel === 'start') { commit(); arena.start.yaw = norm(arena.start.yaw + st); afterChange(); return; }
    const it = selItem(); if (!it) return; commit();
    if (it.type === 'wall') { const cx = (it.x1 + it.x2) / 2, cy = (it.y1 + it.y2) / 2, c = Math.cos(st), n = Math.sin(st); [[1], [2]].forEach(([k]) => { const dx = it[`x${k}`] - cx, dy = it[`y${k}`] - cy; it[`x${k}`] = cx + dx * c - dy * n; it[`y${k}`] = cy + dx * n + dy * c; }); }
    else if ('yaw' in it) it.yaw = norm((it.yaw || 0) + st);
    afterChange();
  }
  const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const selItem = () => (sel && sel !== 'start' ? item(sel) : null);

  // ---------- properties panel -----------------------------------------------------------------------------------
  const num = (k, v, step = 0.05, lab = k) => `<label>${lab}<input type="number" step="${step}" data-k="${k}" value="${Math.round(v * 1000) / 1000}"></label>`;
  function renderProps() {
    const box = $('props');
    if (sel === 'start') {
      const s = arena.start;
      box.innerHTML = `<div class="muted2">🚩 ${L('จุดเริ่มของหุ่น — ส่งออกเป็นจุดกำเนิดของโลก (หุ่น spawn ที่ 0,0,0)', 'Robot start — exported as the world origin (spawn at 0,0,0)')}</div>
        <div class="row">${num('x', s.x)}${num('y', s.y)}<label>${L('ทิศ (°)', 'Heading (°)')}<input type="number" step="15" data-k="yawdeg" value="${Math.round(s.yaw * 180 / Math.PI)}"></label></div>`;
      return;
    }
    const it = selItem();
    if (!it) { box.innerHTML = `<p class="muted2">${L('ยังไม่ได้เลือกชิ้นงาน — ใช้เครื่องมือ 🖐 แตะที่ชิ้นงาน', 'Nothing selected — use 🖐 and tap an object')}</p><p class="muted2">${arena.items.length} ${L('ชิ้นในสนาม', 'objects in the field')}</p>`; return; }
    const colors = Object.keys(A.COLORS).map((c) => `<option ${it.color === c ? 'selected' : ''}>${c}</option>`).join('');
    const yaw = 'yaw' in it ? `<label>${L('หมุน (°)', 'Rotate (°)')}<input type="number" step="15" data-k="yawdeg" value="${Math.round((it.yaw || 0) * 180 / Math.PI)}"></label>` : '';
    let h = '';
    if (it.type === 'wall') h = `<div class="row">${num('x1', it.x1)}${num('y1', it.y1)}</div><div class="row">${num('x2', it.x2)}${num('y2', it.y2)}</div><div class="row">${num('t', it.t, 0.01, L('หนา (m)', 'Thickness (m)'))}${num('h', it.h, 0.1, L('สูง (m)', 'Height (m)'))}</div>`;
    if (it.type === 'box') h = `<div class="row">${num('x', it.x)}${num('y', it.y)}${yaw}</div><div class="row">${num('w', it.w, 0.05, L('กว้าง X', 'Size X'))}${num('d', it.d, 0.05, L('ลึก Y', 'Size Y'))}${num('h', it.h, 0.05, L('สูง', 'Height'))}</div><div class="row"><label>${L('สี', 'Colour')}<select data-k="color">${colors}</select></label></div>`;
    if (it.type === 'cyl') h = `<div class="row">${num('x', it.x)}${num('y', it.y)}</div><div class="row">${num('r', it.r, 0.01, L('รัศมี', 'Radius'))}${num('h', it.h, 0.05, L('สูง', 'Height'))}</div><div class="row"><label>${L('สี', 'Colour')}<select data-k="color">${colors}</select></label></div>`;
    if (it.type === 'aruco') h = `<div class="row">${num('x', it.x)}${num('y', it.y)}${yaw}</div>
      <div class="row"><label>Marker id (0–49)<input type="number" min="0" max="49" step="1" data-k="markerId" value="${it.markerId}"></label>${num('size', it.size, 0.01, L('ขนาดสี่เหลี่ยมดำ (m)', 'Black square (m)'))}</div>
      <div class="row"><label>${L('ติดตั้ง', 'Mount')}<select data-k="mount"><option value="post" ${it.mount !== 'floor' ? 'selected' : ''}>${L('ป้ายบนเสา', 'Sign on a post')}</option><option value="floor" ${it.mount === 'floor' ? 'selected' : ''}>${L('แปะพื้น', 'Floor tag')}</option></select></label>${it.mount !== 'floor' ? num('z', it.z, 0.05, L('สูงกลางป้าย (m)', 'Centre height (m)')) : ''}</div>
      <p class="muted2">DICT_4X4_50 · ${L('ป้ายหันไปทางเส้นสีทอง — ปรับ "หมุน" ให้หันหาหุ่น · ตั้งความสูงให้อยู่ในมุมกล้องของหุ่น', 'the sign faces the gold line — rotate it toward the robot · put it within the camera’s view height')}</p>`;
    if (it.type === 'goal') h = `<div class="row">${num('x', it.x)}${num('y', it.y)}<label>${L('ชื่อ', 'Label')}<input data-k="label" value="${esc(it.label)}" maxlength="8"></label></div>`;
    const icon = { wall: '🧱', box: '⬛', cyl: '⚪', aruco: '🔳', goal: '📍' }[it.type];
    box.innerHTML = `<div class="muted2">${icon} ${it.type}</div>${h}<div class="row"><button class="ghost" data-act="dup">⧉ ${L('ทำซ้ำ', 'Duplicate')}</button><button class="ghost" data-act="del">🗑 ${L('ลบ', 'Delete')}</button></div>`;
  }
  $('props').addEventListener('change', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    commit();
    const tgt = sel === 'start' ? arena.start : selItem(); if (!tgt) return;
    let v = e.target.type === 'number' ? +e.target.value : e.target.value;
    if (k === 'yawdeg') { tgt.yaw = norm(v * Math.PI / 180); }
    else if (k === 'markerId') tgt.markerId = Math.max(0, Math.min(49, Math.round(v)));
    else if (['w', 'd', 'h', 'r', 't', 'size', 'z'].includes(k)) tgt[k] = Math.max(0.01, v);
    else tgt[k] = v;
    if (k === 'mount') { tgt.z = v === 'floor' ? 0 : 0.35; }
    afterChange();
  });
  $('props').addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]'); if (!a) return; const it = selItem(); if (!it) return; commit();
    if (a.dataset.act === 'del') { arena.items = arena.items.filter((i) => i !== it); sel = null; }
    if (a.dataset.act === 'dup') {
      const c = JSON.parse(JSON.stringify(it)); c.id = `i${Date.now().toString(36)}`;
      if (c.type === 'wall') { c.x1 += 0.5; c.x2 += 0.5; } else { c.x += 0.5; }
      if (c.type === 'aruco') c.markerId = nextId('aruco'); if (c.type === 'goal') c.label = nextId('goal');
      arena.items.push(c); sel = c.id;
    }
    afterChange();
  });

  // ---------- field settings + presets ----------------------------------------------------------------------------
  function fillSettings() { $('aName').value = arena.name; $('aW').value = arena.size.w; $('aH').value = arena.size.h; $('aWH').value = arena.wallHeight; $('aBorder').checked = arena.border; }
  [['aName', (v) => { arena.name = A.slug(v); }], ['aW', (v) => { arena.size.w = Math.max(1, +v); }], ['aH', (v) => { arena.size.h = Math.max(1, +v); }],
    ['aWH', (v) => { arena.wallHeight = Math.max(0.2, +v); }], ['aBorder', (v, el) => { arena.border = el.checked; }]].forEach(([idn, fn]) => {
    $(idn).addEventListener('change', (e) => { commit(); fn(e.target.value, e.target); afterChange(); });
  });
  function renderPresets() {
    $('presets').innerHTML = Object.entries(A.PRESETS).map(([k, p]) => `<button data-p="${k}"><b>${p.icon}</b>${L(p.th, p.en)}</button>`).join('');
    $('howto').innerHTML = L(`1) เลือกสนามสำเร็จรูป หรือวาดเองด้วยแถบเครื่องมือ<br>2) กด <b>▶ ทดสอบขับ</b> — ใช้หุ่นจาก Garage (LiDAR/กล้องตามสเปกจริง)<br>3) กด <b>📦 Gazebo world package</b> แล้วทำตาม README ในไฟล์<br><br>สนามนี้จะถูกใส่ใน workspace ของขั้น 3 ให้อัตโนมัติด้วย`,
      `1) Pick a ready-made field or draw your own with the toolbar<br>2) Press <b>▶ Test drive</b> — uses the robot from the Garage (real LiDAR/camera specs)<br>3) Press <b>📦 Gazebo world package</b> and follow its README<br><br>This field is also added to the step-3 workspace automatically`);
  }
  $('presets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    if (arena.items.length && !confirm(L('แทนที่สนามปัจจุบันด้วยสนามสำเร็จรูป? (ย้อนกลับได้ด้วย ↶)', 'Replace the current field with this preset? (undo with ↶)'))) return;
    commit(); arena = A.normalize(A.PRESETS[b.dataset.p].make()); sel = null; afterChange(); fit();
  });

  // ---------- robot from the Garage ------------------------------------------------------------------------------
  function robotFootprint() {
    const c = garage && garage.chassis;
    if (!c) return { l: 0.5, w: 0.4 };
    return c.shape === 'round' ? { round: true, r: c.width / 2 } : { l: c.length, w: c.width };
  }
  function robotSpec() {
    const g = garage, hw = (id) => registry && registry.hardware.find((h) => h.id === id);
    const fp = robotFootprint();
    const lidars = [], cams = [];
    for (const s of (g && g.sensors) || [{ hw: 'slamtec_c1', category: 'lidar', pos: [0, 0, 0.3], yaw: 0 }]) {
      const r = hw(s.hw), sp = (r && r.sensor) || {};
      if (s.category === 'lidar') {
        const rate = sp.rate_hz || 10, fov = sp.fov_deg || 360, real = sp.sample_rate_hz ? Math.round(sp.sample_rate_hz / rate * fov / 360) : Math.round(fov * 2);
        lidars.push({ name: (r && r.name) || s.hw, x: s.pos[0], y: s.pos[1], z: s.pos[2], yaw: s.yaw || 0, range: sp.range_m || 12, min: sp.min_range_m || 0.05, fov: fov * Math.PI / 180, rays: Math.min(real, 360), real });
      }
      if (s.category === 'depth_camera' || s.category === 'rgb_camera') cams.push({ name: (r && r.name) || s.hw, x: s.pos[0], y: s.pos[1], yaw: s.yaw || 0, fov: (sp.fov_deg || 69) * Math.PI / 180, range: Math.min(sp.range_m || 4, 6) });
    }
    const m = (g && g.mission) || {};
    return { fp, lidars, cams, holo: g && g.drive && g.drive.type === 'mecanum', vMax: m.vMax || 0.8, wMax: m.wMax || 1.2, name: (g && g.name) || 'robot' };
  }

  // ---------- test drive (2D, light) ------------------------------------------------------------------------------
  const keys = new Set(); const joy = { x: 0, y: 0 };
  let sim = null, raf = 0, last = 0;
  function prims() { return A.solids(arena).flatMap(A.shapes); }
  function startSim() {
    const spec = robotSpec(), res = 0.05;
    const gw = Math.ceil((arena.size.w + 2) / res), gh = Math.ceil((arena.size.h + 2) / res);
    sim = { spec, p: Object.assign({}, arena.start), v: 0, vy: 0, w: 0, t: 0, hits: 0, inHit: false, goals: {}, seen: {}, grid: new Uint8Array(gw * gh), gw, gh, res,
      ox: -arena.size.w / 2 - 1, oy: -arena.size.h / 2 - 1, scans: [], lastScan: 0, cams: [], prims: prims() };
    // free cells inside the field (what a full map would show) — the coverage figure is measured against these
    const ps = sim.prims; sim.inside = [];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const x = sim.ox + (i + 0.5) * res, y = sim.oy + (j + 0.5) * res;
      if (Math.abs(x) < arena.size.w / 2 && Math.abs(y) < arena.size.h / 2 && !ps.some((q) => A.inShape(q, x, y))) sim.inside.push(j * gw + i);
    }
    sim.img = document.createElement('canvas'); sim.img.width = gw; sim.img.height = gh; sim.imgCtx = sim.img.getContext('2d'); sim.imgData = sim.imgCtx.createImageData(gw, gh);
    scan(); renderHud();
  }
  function robotShapes(p) {
    const fp = sim.spec.fp;
    return fp.round ? [{ k: 'circle', cx: p.x, cy: p.y, r: fp.r }] : [{ k: 'obb', cx: p.x, cy: p.y, hx: fp.l / 2, hy: fp.w / 2, yaw: p.yaw }];
  }
  function overlap(a, b) {
    if (a.k === 'circle' && b.k === 'circle') return Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r;
    if (a.k === 'circle') return overlap(b, a);
    if (b.k === 'circle') { // obb vs circle: clamp centre into the box
      const c = Math.cos(-a.yaw), n = Math.sin(-a.yaw), lx = (b.cx - a.cx) * c - (b.cy - a.cy) * n, ly = (b.cx - a.cx) * n + (b.cy - a.cy) * c;
      const qx = Math.max(-a.hx, Math.min(a.hx, lx)), qy = Math.max(-a.hy, Math.min(a.hy, ly));
      return (lx - qx) ** 2 + (ly - qy) ** 2 < b.r * b.r;
    }
    const axes = [a.yaw, a.yaw + Math.PI / 2, b.yaw, b.yaw + Math.PI / 2];
    for (const ang of axes) {
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const proj = (o) => { const c = Math.cos(o.yaw), n = Math.sin(o.yaw); return Math.abs(o.hx * (c * ux + n * uy)) + Math.abs(o.hy * (-n * ux + c * uy)); };
      if (Math.abs((b.cx - a.cx) * ux + (b.cy - a.cy) * uy) > proj(a) + proj(b)) return false;
    }
    return true;
  }
  const collides = (p) => robotShapes(p).some((r) => sim.prims.some((o) => overlap(r, o)));
  function rayHit(ox, oy, dx, dy, z, maxR) {
    let best = maxR;
    for (const s of sim.prims) {
      if (z != null && (z < s.z0 || z > s.z0 + s.h)) continue; // below or above this object
      if (s.k === 'circle') {
        const fx = ox - s.cx, fy = oy - s.cy, b = fx * dx + fy * dy, c = fx * fx + fy * fy - s.r * s.r, disc = b * b - c;
        if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < best) best = t; }
      } else {
        const c = Math.cos(-s.yaw), n = Math.sin(-s.yaw), lx = (ox - s.cx) * c - (oy - s.cy) * n, ly = (ox - s.cx) * n + (oy - s.cy) * c, ldx = dx * c - dy * n, ldy = dx * n + dy * c;
        let t0 = -Infinity, t1 = Infinity;
        for (const [o, d, h] of [[lx, ldx, s.hx], [ly, ldy, s.hy]]) {
          if (Math.abs(d) < 1e-9) { if (Math.abs(o) > h) { t0 = Infinity; break; } continue; }
          let a = (-h - o) / d, b = (h - o) / d; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        }
        if (t0 <= t1 && t0 > 0 && t0 < best) best = t0;
      }
    }
    return best;
  }
  function gridSet(x, y, v) { const i = Math.floor((x - sim.ox) / sim.res), j = Math.floor((y - sim.oy) / sim.res); if (i < 0 || j < 0 || i >= sim.gw || j >= sim.gh) return; const k = j * sim.gw + i; if (v === 2 || sim.grid[k] !== 2) sim.grid[k] = v; }
  function scan() {
    const p = sim.p, c = Math.cos(p.yaw), n = Math.sin(p.yaw);
    sim.scans = sim.spec.lidars.map((l) => {
      const lx = p.x + l.x * c - l.y * n, ly = p.y + l.x * n + l.y * c, base = p.yaw + l.yaw, pts = [];
      const span = l.fov >= 6.27 ? Math.PI * 2 : l.fov, step = span / l.rays;
      for (let k = 0; k < l.rays; k++) {
        const a = base - span / 2 + (k + 0.5) * step, dx = Math.cos(a), dy = Math.sin(a), d = rayHit(lx, ly, dx, dy, l.z, l.range);
        for (let s = 0.05; s < d; s += sim.res) gridSet(lx + dx * s, ly + dy * s, 1);
        if (d < l.range) { gridSet(lx + dx * d, ly + dy * d, 2); pts.push([lx + dx * d, ly + dy * d]); }
      }
      return { lx, ly, pts };
    });
    // ArUco seen by a camera: in range, in the field of view, facing it and not hidden behind something
    sim.cams = sim.spec.cams.map((cam) => ({ x: p.x + cam.x * c - cam.y * n, y: p.y + cam.x * n + cam.y * c, yaw: p.yaw + cam.yaw, fov: cam.fov, range: cam.range }));
    const now = [];
    for (const m of arena.items.filter((i) => i.type === 'aruco')) {
      for (const cam of sim.cams) {
        const dx = m.x - cam.x, dy = m.y - cam.y, d = Math.hypot(dx, dy), ang = norm(Math.atan2(dy, dx) - cam.yaw);
        const maxD = Math.min(cam.range, m.mount === 'floor' ? 1.2 : m.size * 25);
        if (d > maxD || d < 0.15 || Math.abs(ang) > cam.fov / 2) continue; // too close: the marker no longer fits in the image
        if (m.mount !== 'floor' && Math.cos(m.yaw) * (-dx / d) + Math.sin(m.yaw) * (-dy / d) < Math.cos(70 * Math.PI / 180)) continue;
        if (m.mount !== 'floor' && rayHit(cam.x, cam.y, dx / d, dy / d, null, d - 0.05) < d - 0.06) continue;
        now.push({ id: m.markerId, d, ang, item: m.id }); sim.seen[m.markerId] = true; break;
      }
    }
    sim.detect = now;
  }
  function stepSim(dt) {
    const s = sim.spec, f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) + joy.y;
    const turn = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (s.holo ? 0 : joy.x);
    const side = s.holo ? ((keys.has('q') ? 1 : 0) - (keys.has('e') ? 1 : 0) - joy.x) : 0;
    const ramp = (cur, tgt, a) => cur + Math.max(-a * dt, Math.min(a * dt, tgt - cur));
    sim.v = ramp(sim.v, Math.max(-1, Math.min(1, f)) * s.vMax, 1.2); sim.vy = ramp(sim.vy, Math.max(-1, Math.min(1, side)) * s.vMax, 1.2); sim.w = ramp(sim.w, Math.max(-1, Math.min(1, turn)) * s.wMax, 4);
    const p = sim.p, c = Math.cos(p.yaw), n = Math.sin(p.yaw);
    const np = { x: p.x + (sim.v * c - sim.vy * n) * dt, y: p.y + (sim.v * n + sim.vy * c) * dt, yaw: norm(p.yaw + sim.w * dt) };
    let hitNow = false;
    if (!collides(np)) Object.assign(p, np);
    else {
      hitNow = true;
      const tries = [{ x: np.x, y: p.y, yaw: np.yaw }, { x: p.x, y: np.y, yaw: np.yaw }, { x: p.x, y: p.y, yaw: np.yaw }];
      const ok = tries.find((q) => !collides(q)); if (ok) Object.assign(p, ok);
      sim.v *= 0.3; sim.vy *= 0.3;
    }
    if (hitNow && !sim.inHit) sim.hits++;
    sim.inHit = hitNow; sim.t += dt;
    for (const g of arena.items.filter((i) => i.type === 'goal')) if (!sim.goals[g.id] && Math.hypot(g.x - p.x, g.y - p.y) < 0.35) sim.goals[g.id] = sim.t;
    sim.lastScan += dt; if (sim.lastScan >= 0.1) { sim.lastScan = 0; scan(); renderHud(); }
  }
  function drawSlam() {
    const d = sim.imgData.data, g = sim.grid;
    for (let j = 0; j < sim.gh; j++) for (let i = 0; i < sim.gw; i++) {
      const v = g[j * sim.gw + i], k = ((sim.gh - 1 - j) * sim.gw + i) * 4;
      if (v === 2) { d[k] = 255; d[k + 1] = 224; d[k + 2] = 138; d[k + 3] = 255; } else if (v === 1) { d[k] = 60; d[k + 1] = 80; d[k + 2] = 110; d[k + 3] = 110; } else d[k + 3] = 0;
    }
    sim.imgCtx.putImageData(sim.imgData, 0, 0);
    const [x0, y0] = toS(sim.ox, sim.oy + sim.gh * sim.res); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sim.img, x0, y0, sim.gw * sim.res * view.s, sim.gh * sim.res * view.s);
  }
  function drawSim() {
    if ($('oCam').checked) for (const cam of sim.cams) {
      const [x, y] = toS(cam.x, cam.y); ctx.beginPath(); ctx.moveTo(x, y);
      ctx.arc(x, y, cam.range * view.s, -(cam.yaw + cam.fov / 2), -(cam.yaw - cam.fov / 2)); ctx.closePath(); ctx.fillStyle = 'rgba(80,140,255,.12)'; ctx.fill();
    }
    if ($('oRays').checked) for (const s of sim.scans) {
      const [x, y] = toS(s.lx, s.ly); ctx.strokeStyle = 'rgba(255,60,60,.18)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const [px, py] of s.pts) { const [a, b] = toS(px, py); ctx.moveTo(x, y); ctx.lineTo(a, b); } ctx.stroke();
      ctx.fillStyle = '#ff5050'; for (const [px, py] of s.pts) { const [a, b] = toS(px, py); ctx.fillRect(a - 1.5, b - 1.5, 3, 3); }
    }
    for (const d of sim.detect || []) { const m = item(d.item); if (!m) continue; const [a, b] = toS(m.x, m.y); ctx.strokeStyle = '#4da3ff'; ctx.lineWidth = 3; ctx.strokeRect(a - 14, b - 14, 28, 28); }
    drawStart(sim.p, false);
  }
  function renderHud() {
    if (!sim) return;
    const s = sim.spec; let known = 0;
    for (const k of sim.inside) if (sim.grid[k]) known++;
    const area = Math.max(1, sim.inside.length);
    $('hud').innerHTML = `<div><b>${sim.t.toFixed(1)} s</b><span>${L('เวลา', 'Time')}</span></div><div><b>${Math.abs(sim.v).toFixed(2)} m/s</b><span>${L('ความเร็ว', 'Speed')} (max ${s.vMax})</span></div>
      <div><b>${sim.hits}</b><span>${L('ครั้งที่ชน', 'Collisions')}</span></div><div><b>${Math.min(100, Math.round(known / area * 100))}%</b><span>${L('แผนที่ที่เห็นแล้ว', 'Map seen')}</span></div>
      <div style="grid-column:1/-1"><span>${esc(s.name)} · ${s.lidars.map((l) => `${esc(l.name)} ${l.range} m · ${l.rays}${l.real > l.rays ? `/${l.real}` : ''} rays`).join(' · ') || L('ไม่มี LiDAR', 'no LiDAR')} · ${s.cams.length} ${L('กล้อง', 'camera(s)')}</span></div>`;
    const goals = arena.items.filter((i) => i.type === 'goal');
    $('goals').innerHTML = goals.length ? goals.map((g) => `<div class="${sim.goals[g.id] != null ? 'ok' : ''}">📍 ${esc(g.label)} ${sim.goals[g.id] != null ? `✓ ${sim.goals[g.id].toFixed(1)} s` : '—'}</div>`).join('') : `<div>${L('ยังไม่มีจุดหมาย — วางด้วยเครื่องมือ 📍', 'No goals yet — place them with 📍')}</div>`;
    const marks = arena.items.filter((i) => i.type === 'aruco');
    $('arucoList').innerHTML = !s.cams.length ? `<div>${L('หุ่นยังไม่มีกล้อง — เพิ่มกล้องใน Garage เพื่อทดสอบ ArUco', 'The robot has no camera — add one in the Garage to test ArUco')}</div>`
      : marks.length ? marks.map((m) => { const d = (sim.detect || []).find((x) => x.item === m.id); return `<div class="${d ? 'hit' : sim.seen[m.markerId] ? 'ok' : ''}">🔳 #${m.markerId} ${d ? `· ${d.d.toFixed(2)} m · ${Math.round(d.ang * 180 / Math.PI)}°` : sim.seen[m.markerId] ? L('· เคยเห็นแล้ว', '· seen') : ''}</div>`; }).join('') : `<div>${L('ไม่มี ArUco ในสนาม', 'No ArUco markers in the field')}</div>`;
  }
  function loop(ts) {
    if (mode !== 'test') return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    stepSim(dt); draw(); raf = requestAnimationFrame(loop);
  }
  function setMode(m) {
    mode = m; document.body.classList.toggle('testing', m === 'test');
    $('mEdit').classList.toggle('on', m === 'edit'); $('mTest').classList.toggle('on', m === 'test');
    $('propsBox').hidden = m === 'test'; $('testBox').hidden = m !== 'test';
    cancelAnimationFrame(raf);
    if (m === 'test') { sel = null; startSim(); last = 0; raf = requestAnimationFrame(loop); } else { sim = null; draw(); }
    renderTools();
  }
  $('mEdit').onclick = () => setMode('edit'); $('mTest').onclick = () => setMode('test');
  $('tReset').onclick = () => { startSim(); };
  ['oRays', 'oSlam', 'oCam', 'oHide'].forEach((k) => $(k).addEventListener('change', draw));
  // touch joystick
  if (matchMedia('(pointer:coarse)').matches) $('joy').classList.add('touch');
  (function joystick() {
    const el = $('joy'), knob = el.querySelector('i'); let idj = null;
    const set = (e) => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left - 60) / 50, y = (e.clientY - r.top - 60) / 50, m = Math.min(1, Math.hypot(x, y)) / (Math.hypot(x, y) || 1); joy.x = x * m; joy.y = -y * m; knob.style.transform = `translate(${joy.x * 40}px, ${-joy.y * 40}px)`; };
    el.addEventListener('pointerdown', (e) => { idj = e.pointerId; el.setPointerCapture(idj); set(e); });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === idj) set(e); });
    const end = () => { idj = null; joy.x = joy.y = 0; knob.style.transform = ''; }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  })();

  // ---------- export --------------------------------------------------------------------------------------------------
  const download = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  $('xPkg').onclick = async () => {
    if (!window.JSZip) { $('xNote').textContent = L('โหลด JSZip ไม่ได้ — ตรวจอินเทอร์เน็ต', 'Could not load JSZip — check the internet'); return; }
    const files = A.packageFiles(arena, { prefix: garage && garage.prefix }), zip = new window.JSZip();
    for (const [p, c] of Object.entries(files)) zip.file(p, c);
    download(`${A.packageName(arena)}.zip`, await zip.generateAsync({ type: 'blob' }));
    $('xNote').innerHTML = L(`ดาวน์โหลด <b>${A.packageName(arena)}.zip</b> แล้ว → แตกไฟล์ไว้ใน <code>~/&lt;robot&gt;_ws/src/</code> → <code>colcon build</code> → <code>source install/setup.bash</code> → คำสั่งรันอยู่ใน README.md`,
      `Downloaded <b>${A.packageName(arena)}.zip</b> → unzip into <code>~/&lt;robot&gt;_ws/src/</code> → <code>colcon build</code> → <code>source install/setup.bash</code> → run commands are in README.md`);
  };
  $('xJson').onclick = () => download(`${arena.name}.arena.json`, new Blob([JSON.stringify(arena, null, 1)], { type: 'application/json' }));
  $('xImport').onclick = () => $('fImport').click();
  $('fImport').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const a = JSON.parse(await f.text()); if (!a.items) throw new Error('items'); commit(); arena = A.normalize(a); sel = null; afterChange(); fit(); }
    catch (err) { $('xNote').textContent = L('ไฟล์นี้ไม่ใช่ arena.json', 'This is not an arena.json file'); }
    e.target.value = '';
  };
  $('xAruco').onclick = () => {
    const ms = arena.items.filter((i) => i.type === 'aruco');
    if (!ms.length) { $('xNote').textContent = L('ยังไม่มี ArUco ในสนาม — วางด้วยเครื่องมือ 🔳', 'No ArUco in the field yet — place one with 🔳'); return; }
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>ArUco — ${esc(arena.name)}</title><style>body{font-family:sans-serif;margin:10mm}div{display:inline-block;margin:6mm;text-align:center;page-break-inside:avoid}@media print{p{display:none}}</style>
      <p>${L('พิมพ์ที่สเกล 100% (ปิด “ปรับให้พอดีหน้า”) — วัดขนาดสี่เหลี่ยมดำหลังพิมพ์ให้ตรงตามที่ระบุ', 'Print at 100 % scale (turn off “fit to page”) — measure the black square after printing')}</p>
      ${ms.map((m) => `<div>${A.markerSvg(m.markerId, Math.round(m.size * 1000))}</div>`).join('')}<script>setTimeout(()=>print(),300)<\/script>`);
    w.document.close();
  };

  function status() {
    const n = (t) => arena.items.filter((i) => i.type === t).length;
    $('st').textContent = `${arena.name} · ${arena.size.w}×${arena.size.h} m · 🧱${n('wall') + (arena.border ? 4 : 0)} ⬛${n('box')} ⚪${n('cyl')} 🔳${n('aruco')} 📍${n('goal')}`;
  }
  function relabel() { renderTools(); renderProps(); renderPresets(); if (sim) renderHud(); }
  document.addEventListener('click', (e) => { if (e.target.closest('.lang-switch button')) setTimeout(relabel, 0); });

  $('zIn').onclick = () => { view.s = Math.min(400, view.s * 1.25); draw(); };
  $('zOut').onclick = () => { view.s = Math.max(8, view.s / 1.25); draw(); };
  $('zFit').onclick = fit;

  // ---------- boot -------------------------------------------------------------------------------------------------------
  arena = load();
  try { garage = JSON.parse(localStorage.getItem('tesr_rb_garage') || 'null'); } catch (_) { garage = null; }
  fillSettings(); renderPresets(); renderTools(); renderProps(); status();
  new ResizeObserver(resize).observe($('stage'));
  setTimeout(fit, 0);
  fetch('./data/registry.json', { cache: 'no-store' }).then((r) => r.json()).then((j) => { registry = j; }).catch(() => { registry = null; });
  window.__arena = { get arena() { return arena; }, get sim() { return sim; }, setMode, stepSim: (dt) => stepSim(dt), keys, startSim };
})();
