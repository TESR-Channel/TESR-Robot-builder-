/* TESR Robot Builder — step 2: spec summary & quotation (docs/summary.js)
 * Reads the one shared project (the Garage state in localStorage 'tesr_rb_garage' + its screenshot) and renders a
 * printable document: robot picture, rank/stats, full spec, sensor mounting table, engineering numbers, and a
 * quotation priced from the TESR Shop catalog (CSV or Google Sheet). Nothing leaves the browser.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 1) => (x == null || !isFinite(x) ? '—' : Number(x).toLocaleString('en-US', { maximumFractionDigits: d }));
  const baht = (x) => (x == null ? '—' : Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const G = window.TESR_GARAGE;
  const QUOTE_KEY = 'tesr_rb_quote';
  const COMPANY = {
    th: 'บริษัท ทีอีเอสอาร์ จำกัด', en: 'TESR Co.,Ltd.',
    address: '112/296 หมู่บ้าน เพอร์เฟค มาสเตอร์พีซ หมู่ที่ 2 ตำบลไทรม้า อำเภอเมืองนนทบุรี จังหวัดนนทบุรี 11000',
    addressEn: '112/296 Perfect Masterpiece village moo.2, Sai Ma sub district, Mueang Nonthaburi district, Nonthaburi 11000',
    taxId: '0105560083185', web: 'tesrshop.com',
    line: 'www.tesrshop.com/line', lineUrl: 'https://www.tesrshop.com/line', email: 'tesrshop@gmail.com', phone: '082-983-7768', tel: '0829837768',
  };
  const isEn = () => (window.TESR_I18N && window.TESR_I18N.lang === 'en');
  // "26 กันยายน 2569" (Thai, Buddhist year) or "26 September 2026" — dates are stored as YYYY-MM-DD
  const longDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`); if (isNaN(d)) return iso || '—';
    return d.toLocaleDateString(isEn() ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // local date, not UTC
  const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + (Number(n) || 0)); return ymd(d); };
  const today = () => ymd(new Date());
  const FLOOR = { concrete: 'คอนกรีต', epoxy: 'อีพ็อกซี', tile: 'กระเบื้อง', carpet: 'พรม', asphalt: 'ยางมะตอย', gravel: 'กรวด', mixed: 'ผสม' };
  const ENV = { factory: 'โรงงาน', warehouse: 'คลังสินค้า', hospital: 'โรงพยาบาล', office: 'สำนักงาน', laboratory: 'ห้องแลป', outdoor: 'กลางแจ้ง', custom: 'อื่น ๆ' };
  const CASTER = { front_rear: 'หน้า + หลัง', corners4: '4 มุม', rear1: 'หลัง 1 ล้อ', front1: 'หน้า 1 ล้อ' };
  let T = null, registry = null, ids = {}, catalog = [], state = null, dv = null, quote = {};

  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(`load ${src}`)); document.head.appendChild(s); });
  const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };

  function docNo() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `TESR-RB-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }
  function loadQuote() {
    try { quote = JSON.parse(localStorage.getItem(QUOTE_KEY) || '{}'); } catch (_) { quote = {}; }
    if (quote.robot !== state.name || !quote.no) Object.assign(quote, { robot: state.name, no: docNo(), date: today() });
    quote.validDays = quote.validDays ?? 30; quote.vat = quote.vat ?? true; quote.discount = quote.discount ?? 0;
    saveQuote();
  }
  const saveQuote = () => { try { localStorage.setItem(QUOTE_KEY, JSON.stringify(quote)); } catch (_) { /* ignore */ } };

  const L = (th, en) => (isEn() ? en : th);
  const mm = (m) => Math.round(m * 1000);
  // The chassis frame is not sold: the customer builds it. This turns the Garage design into a practical starting point —
  // extrusion size, cut list, plates, wheel / caster / sensor mounting — to be checked by the customer's engineer.
  function frameGuide() {
    const s = state, c = s.chassis, dr = s.drive, m = s.mission;
    const load = dv.totalMass;
    const prof = load <= 40 ? { id: '2020', a: 0.02 } : load <= 150 ? { id: '3030', a: 0.03 } : { id: '4040', a: 0.04 };
    const plateT = load <= 30 ? 3 : load <= 100 ? 5 : 6;
    const wheelR = dr.wheelDiameter / 2, H = c.height, round = c.shape === 'round';
    const rows = [];
    if (round) {
      rows.push([L('แผ่นฐาน (กลม)', 'Base plate (round)'), `Ø${mm(c.width)} mm · ${L('อะลูมิเนียม', 'aluminium')} ${plateT} mm`, 1]);
      rows.push([L('แผ่นบน (กลม)', 'Top plate (round)'), `Ø${mm(c.width)} mm · ${L('อะลูมิเนียม', 'aluminium')} ${Math.max(3, plateT - 1)} mm`, 1]);
      rows.push([L('เสาค้ำ (standoff)', 'Standoffs'), `${mm(H - 2 * plateT / 1000)} mm · M6`, load > 40 ? 6 : 4]);
    } else {
      const cross = mm(c.width - 2 * prof.a), post = mm(H - 2 * prof.a), nCross = c.length > 0.8 ? 6 : 4;
      rows.push([L(`โปรไฟล์ ${prof.id} แนวยาว`, `${prof.id} extrusion, long rails`), `${mm(c.length)} mm`, 4]);
      rows.push([L(`โปรไฟล์ ${prof.id} แนวขวาง`, `${prof.id} extrusion, cross rails`), `${cross} mm`, nCross]);
      rows.push([L(`โปรไฟล์ ${prof.id} เสาตั้ง`, `${prof.id} extrusion, posts`), `${post} mm`, 4]);
      rows.push([L('ฉากยึดมุม + น็อต T-nut', 'Corner brackets + T-nuts'), `${prof.id}`, (nCross + 4) * 2]);
      rows.push([L('แผ่นบน (รับของ)', 'Top plate (payload deck)'), `${mm(c.length)} × ${mm(c.width)} mm · ${L('อะลูมิเนียม', 'aluminium')} ${plateT} mm`, 1]);
      rows.push([L('แผ่นฐาน (วางแบต/บอร์ด)', 'Base plate (battery / electronics)'), `${mm(c.length - 2 * prof.a)} × ${cross} mm · ${L('อะลูมิเนียม', 'aluminium')} 3 mm`, 1]);
      const total = (4 * c.length + nCross * (c.width - 2 * prof.a) + 4 * (H - 2 * prof.a));
      rows.push([L('รวมความยาวโปรไฟล์', 'Total extrusion length'), `≈ ${fmt(total, 2)} m`, '—']);
    }
    const nDrive = dr.type === 'mecanum' ? 4 : 2;
    const wheelPos = dr.type === 'mecanum'
      ? `x = ±${mm(dr.wheelbase / 2)} mm, y = ±${mm(dr.track / 2)} mm`
      : `x = 0, y = ±${mm(dr.track / 2)} mm`;
    const mounts = [
      [L('ล้อขับ', 'Drive wheels'), `${nDrive} × Ø${mm(dr.wheelDiameter)} mm · ${wheelPos} · ${L('แกนล้อสูงจากพื้น', 'axle height')} ${mm(wheelR)} mm`],
      [L('ล้อประคอง', 'Casters'), dr.type === 'mecanum' ? L('ไม่ต้องใช้ (mecanum)', 'not needed (mecanum)') : `${CASTER[dr.casterLayout] || dr.casterLayout} · ${L('ต้องสูงเท่าแกนล้อขับ ปรับด้วยแหวนรอง/สปริง', 'must match the drive axle height — shim or spring-load')}`],
      [L('ระยะใต้ท้อง', 'Ground clearance'), `${mm(c.clearance)} mm`],
      [L('ความสูงตัวถัง / ทั้งคัน', 'Body height / overall'), `${mm(H)} mm / ${mm(c.clearance + H)} mm`],
      [L('น้ำหนักที่โครงต้องรับ', 'Load the frame must carry'), `${fmt(load, 0)} kg (${L('หุ่น', 'robot')} ${fmt(dv.robotMass, 0)} + ${L('ของ', 'payload')} ${fmt(m.payload, 0)})`],
      [L('จุดศูนย์ถ่วงที่คำนวณไว้', 'Centre of gravity (as designed)'), `${mm(dv.tip.hCog)} mm ${L('จากพื้น — วางแบตไว้ต่ำและกลางตัว เพื่อไม่ให้สูงกว่านี้', 'above ground — keep the battery low and centred so it stays at or below this')}`],
    ];
    const lidarZ = dv.sensors.filter((x) => x.category === 'lidar').map((x) => `${esc(x.id)} z=${mm(x.pos[2])} mm`).join(', ');
    const tips = [
      L('ระนาบสแกนของ LiDAR ต้องโล่ง 360° ในมุมที่ออกแบบไว้ — ห้ามมีเสาหรือขอบแผ่นบังระดับความสูงนี้', 'Keep the LiDAR scan plane clear over its designed field of view — no posts or plate edges at that height') + (lidarZ ? ` (${lidarZ})` : ''),
      L('ยึดเซนเซอร์ตามตาราง "ตำแหน่งติดตั้งเซนเซอร์" (อ้างจาก base_link = กึ่งกลางแกนล้อขับ บนพื้น)', 'Mount the sensors per the "Sensor mounting positions" table (base_link = centre between the drive wheels, at ground level)'),
      L('ติดปุ่ม E-stop ในตำแหน่งที่เอื้อมถึงได้จากทุกด้าน ตัดไฟมอเตอร์โดยตรง', 'Place the E-stop where it can be reached from any side; it must cut motor power directly'),
      L('ใช้ไฟล์ URDF / mesh ใน package description (ขั้น 3) เป็นแบบอ้างอิงขนาด หรือส่งเข้าโปรแกรม CAD', 'Use the URDF / meshes in the description package (step 3) as the dimensional reference or import them into CAD'),
      L('แนวทางนี้เป็นจุดเริ่มต้น — ให้วิศวกรตรวจความแข็งแรงก่อนผลิตจริง', 'This is a starting point — have an engineer check strength before building'),
    ];
    return `<h2>${L('แนวทางสร้างโครงรถ', 'Chassis frame build guide')} <span class="muted" style="text-transform:none;letter-spacing:0">(${L('ลูกค้าจัดทำเอง — ไม่รวมในใบเสนอราคา', 'built by the customer — not included in this quotation')})</span></h2>
      <div class="grid2">
        <div><h3>${L('รายการวัสดุ / ตัดชิ้นงาน', 'Material & cut list')}</h3>
          <table class="t"><thead><tr><th>${L('ชิ้นงาน', 'Part')}</th><th>${L('ขนาด', 'Size')}</th><th class="num">${L('จำนวน', 'Qty')}</th></tr></thead>
          <tbody>${rows.map(([a, b, q]) => `<tr><td>${a}</td><td>${b}</td><td class="num">${q}</td></tr>`).join('')}</tbody></table></div>
        <div><h3>${L('ตำแหน่งติดตั้งหลัก', 'Key mounting positions')}</h3>${kvT(mounts)}</div>
      </div>
      <ul class="note" style="margin:8px 0 0 18px;padding:0">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>`;
  }
  const kvT = (rows) => `<table class="kv">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;

  function totals() {
    const sub = dv.bom.lines.reduce((s, l) => s + (l.lineTotal || 0), 0);
    const disc = sub * (Number(quote.discount) || 0) / 100, net = sub - disc, vat = quote.vat ? net * 0.07 : 0;
    return { sub, disc, net, vat, grand: net + vat, unpriced: dv.bom.lines.filter((l) => l.unitPrice == null).length };
  }

  function render() {
    const s = state, m = s.mission, c = s.chassis, dr = s.drive, st = dv.stats;
    const shot = localStorage.getItem('tesr_rb_garage_shot');
    const comp = dv.compute, motor = dv.motor, driver = dv.driver, bat = dv.battery;
    const kv = (rows) => `<table class="kv">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
    const bars = [['ความเร็ว', st.speed, `${m.vMax} m/s`], ['แรงขับ', st.power, motor ? `×${fmt(dv.margin, 1)}` : '—'], ['ความอึด', st.endurance, `${fmt(dv.runtimeAch, 1)} / ${m.runtimeH} h`],
      ['การมองเห็น', st.vision, `${Math.round(dv.coverage * 100)}%`], ['ความปลอดภัย', st.safety, `${Math.round(st.safety * 100)}`]]
      .map(([k, v, t]) => `<div class="stat"><div class="row"><span>${k}</span><b>${t}</b></div><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div></div>`).join('');
    const sensorsRows = dv.sensors.map((x) => `<tr><td><b>${esc(x.id)}</b></td><td>${esc(x.rec?.name || x.hw)}</td><td class="num">${x.pos.map((v) => fmt(v, 3)).join(', ')}</td>
      <td class="num">${fmt(x.yaw * 180 / Math.PI, 0)}°</td><td>${x.category === 'lidar' ? `${x.fov}° ${x.embedded ? '(ฝังมุม/ขอบ)' : '(บนหลังคา)'} · ${x.rec?.sensor?.range_m ?? '?'} m` : /camera/.test(x.category) ? `FOV ${x.rec?.sensor?.fov_deg ?? '?'}° · ${x.rec?.sensor?.range_m ?? '?'} m` : `${x.rec?.sensor?.rate_hz ?? '?'} Hz`}</td>
      <td><code>/${esc(x.topic)}</code></td></tr>`).join('');
    let lastCat = null;
    const bomRows = dv.bom.lines.map((l, i) => {
      const head = l.category !== lastCat ? `<tr class="cat"><td colspan="6">${esc(T.CATEGORY_TH[l.category] || l.category)}</td></tr>` : '';
      lastCat = l.category;
      const p = l.product, link = p && p.shop_url ? `<a href="${esc(p.shop_url)}" target="_blank" rel="noopener">${esc(p.sku || 'TESR Shop')}</a>` : (p && p.sku ? esc(p.sku) : '<span class="muted">—</span>');
      return head + `<tr><td class="num">${i + 1}</td><td>${esc(l.name)}<div class="muted">${esc(l.hwId)}</div></td><td>${link}</td><td class="num">${l.qty}</td>
        <td class="num">${l.unitPrice != null ? baht(l.unitPrice) : '<span class="muted">สอบถาม</span>'}</td><td class="num">${l.lineTotal != null ? baht(l.lineTotal) : '—'}</td></tr>`;
    }).join('');
    const warn = dv.warnings.filter((w) => w.lvl !== 'ok');

    $('doc').innerHTML = `<div class="sheet">
      <div class="doc-head">
        <div class="brand" style="align-items:flex-start"><i style="width:88px;height:100px"></i><div style="max-width:420px">
          <b style="font-size:17px">${COMPANY.th}</b><span style="display:block;font-size:12px;color:#8B0000;font-family:'Chakra Petch'">${COMPANY.en}</span>
          <span style="display:block;font-size:11.5px;line-height:1.45;margin-top:3px">${COMPANY.address}</span>
          <span style="display:block;font-size:11px;line-height:1.4;color:#8a857a">${COMPANY.addressEn}</span>
          <span style="display:block;font-size:11.5px;margin-top:2px">${isEn() ? 'Tax ID' : 'เลขประจำตัวผู้เสียภาษี / Tax ID'}: <b>${COMPANY.taxId}</b> · ${COMPANY.web}</span>
          <span style="display:block;font-size:11.5px;margin-top:2px">LINE ${COMPANY.line} · ${COMPANY.email} · ${L('โทร', 'Tel')} ${COMPANY.phone}</span></div></div>
        <div class="doc-meta"><h1>ใบสรุปสเปก &amp; ใบเสนอราคา</h1><div style="font-family:'Chakra Petch';font-size:12px;letter-spacing:1px;color:#8B0000;margin-bottom:6px">QUOTATION</div>
          <div>เลขที่ <b>${esc(quote.no)}</b></div>
          <div>วันที่ <b id="qDate">${longDate(quote.date)}</b></div>
          <div>ยืนราคาถึง <b id="qUntil">${longDate(addDays(quote.date, quote.validDays))}</b> (<span id="vDays">${quote.validDays}</span> วัน)</div>
          <label class="no-print" style="display:inline-flex;flex-direction:row;gap:6px;align-items:center;margin-top:6px;font-size:11.5px;color:#6d6a63">แก้วันที่
            <input type="date" data-q="date" value="${esc(quote.date)}" style="background:#fff;color:#1b1b1f;border:1px solid #d8d4ca;padding:2px 6px;font-size:12px"></label></div>
      </div>
      <div class="cust">
        <label>ลูกค้า / บริษัท<input data-q="customer" value="${esc(quote.customer || '')}" placeholder="ชื่อบริษัท"></label>
        <label>ผู้ติดต่อ<input data-q="contact" value="${esc(quote.contact || '')}" placeholder="ชื่อ-นามสกุล"></label>
        <label>โทร / อีเมล<input data-q="phone" value="${esc(quote.phone || '')}"></label>
        <label class="wide">หมายเหตุ / ขอบเขตงาน<textarea data-q="notes" rows="2" placeholder="เช่น รวมประกอบ + ติดตั้งซอฟต์แวร์ ROS 2 Jazzy + อบรม 1 วัน">${esc(quote.notes || '')}</textarea></label>
      </div>

      <div class="hero">
        <div class="pic">${shot ? `<img src="${shot}" alt="${esc(s.name)}">` : 'ไม่มีภาพ — กด “📋 สรุปสเปก” จากหน้า Garage เพื่อถ่ายภาพหุ่น'}</div>
        <div>
          <div class="name">${esc(s.name)}</div><div class="desc">${esc(s.description || '')}</div>
          <div class="rankbox"><div class="rank">${dv.rank}</div><div class="muted">คะแนนความพร้อมจาก Garage 3D<br>${dv.warnings.filter((w) => w.lvl === 'err').length} ปัญหาร้ายแรง · ${dv.warnings.filter((w) => w.lvl === 'warn').length} คำเตือน</div></div>
          ${bars}
        </div>
      </div>

      <h2>สเปกหุ่นยนต์</h2>
      <div class="grid2">
        <div><h3>ภารกิจ</h3>${kv([['งาน', `${esc(m.application)} · ${ENV[m.envType] || m.envType}`], ['น้ำหนักบรรทุก', `${fmt(m.payload, 0)} kg`], ['ความเร็วสูงสุด', `${m.vMax} m/s · เลี้ยว ${m.wMax} rad/s`],
          ['ใช้งานต่อการชาร์จ', `${m.runtimeH} h (คำนวณได้ ~${fmt(dv.runtimeAch, 1)} h)`], ['พื้น / ทางลาด', `${FLOOR[m.floor] || m.floor} · ${m.slopeDeg}°`], ['ช่องทางแคบสุด', m.minAisle ? `${m.minAisle} m` : '—']])}</div>
        <div><h3>ตัวถัง</h3>${kv([['รูปทรง', c.shape === 'round' ? `กลม Ø${c.width} m` : `${c.length} × ${c.width} m`], ['สูง / ใต้ท้อง', `${c.height} m / ${c.clearance} m`],
          ['มวลหุ่น / รวมบรรทุก', `${fmt(dv.robotMass, 0)} kg / ${fmt(dv.totalMass, 0)} kg`], ['โครงจากไฟล์', c.shell ? esc(c.shell.file) : 'ทรงเรขาคณิต'], ['ชิ้นส่วนเพิ่ม', `${(s.parts || []).length} ชิ้น`], ['E-stop', s.estop ? 'มี' : 'ไม่มี']])}</div>
        <div><h3>ระบบขับเคลื่อน</h3>${kv([['ชนิด', dr.type === 'mecanum' ? 'Mecanum 4 ล้อ (holonomic)' : `Differential 2 ล้อขับ + ล้อประคอง ${CASTER[dr.casterLayout] || ''}`],
          ['ล้อ', `Ø${fmt(dr.wheelDiameter * 1000, 0)} mm × ${fmt(dr.wheelWidth * 1000, 0)} mm · ระยะล้อ ${dr.track} m${dr.type === 'mecanum' ? ` · wheelbase ${dr.wheelbase} m` : ''}`],
          ['มอเตอร์', motor ? `${esc(motor.name)} × ${dv.nDrive}` : '—'], ['อัตราทด', `${dr.gearRatio}:1`], ['Low-level control', driver ? `${esc(driver.name)} × ${dr.driverCount}` : '—']])}</div>
        <div><h3>พลังงาน</h3>${kv([['ระบบไฟ', `${s.power.busV} V${dv.suggestedBusV !== s.power.busV ? ` (แนะนำ ${dv.suggestedBusV} V)` : ''}`], ['แบตเตอรี่', bat ? esc(bat.name) : '—'],
          ['การต่อแพ็ก', dv.nominal ? `${dv.nominal} V × ${dv.series} อนุกรม${dv.parallel > 1 ? ` × ${dv.parallel} ขนาน` : ''} = ${fmt(dv.packV, 1)} V · ${fmt(dv.packWh, 0)} Wh` : '—'],
          ['กำลังเฉลี่ย / สูงสุด', `${fmt(dv.pw.totalAvgW, 0)} W / ${fmt(dv.dt.powerElecPeak, 0)} W`], ['กระแสสูงสุด', `${fmt(dv.pw.peakCurrentA, 1)} A`],
          ['ไฟเลี้ยงย่อย', dv.rails.length ? dv.rails.map((r) => `${r.v} V${r.hw ? ` (${esc(ids[r.hw]?.name || r.hw)})` : ' — ยังไม่มี DC-DC'}`).join(', ') : '—']])}</div>
        <div><h3>คอมพิวเตอร์ &amp; ซอฟต์แวร์</h3>${kv([['คอมพิวเตอร์', comp ? esc(comp.name) : '—'], ['ระบบ', 'Ubuntu 24.04 · ROS 2 Jazzy · Docker'],
          ['ควบคุม', `ros2_control · ${dr.type === 'mecanum' ? 'mecanum_drive_controller' : 'diff_drive_controller'}`], ['ทำแผนที่ / นำทาง', 'slam_toolbox · AMCL · Nav2 (MPPI)'], ['จำลอง', 'Gazebo Harmonic · RViz2']])}</div>
        <div><h3>Nav2 (คำนวณจากขนาดและ LiDAR)</h3>${kv([['footprint', `<code>${JSON.stringify(dv.nav.footprint)}</code>`], ['inflation radius', `${dv.nav.inflationRadius} m`],
          ['local costmap', `${dv.nav.localCostmap} m @ ${dv.nav.resolution} m`], ['obstacle / raytrace', `${dv.nav.obstacleRange} / ${dv.nav.raytraceRange} m`], ['มองรอบตัว (LiDAR)', `${Math.round(dv.coverage * 100)}%`]])}</div>
      </div>

      <h2>ตำแหน่งติดตั้งเซนเซอร์ <span class="muted" style="text-transform:none;letter-spacing:0">(base_link: x หน้า · y ซ้าย · z ขึ้น, หน่วย m)</span></h2>
      <table class="t"><thead><tr><th>frame</th><th>อุปกรณ์</th><th class="num">x, y, z</th><th class="num">หัน</th><th>มุมมอง</th><th>topic</th></tr></thead><tbody>${sensorsRows || '<tr><td colspan="6">ไม่มีเซนเซอร์</td></tr>'}</tbody></table>

      <h2>การคำนวณทางวิศวกรรม</h2>
      <div class="grid2">
        ${kv([['แรงขับต่อเนื่อง / สูงสุด', `${fmt(dv.dt.forceCont, 1)} N / ${fmt(dv.dt.forcePeak, 1)} N`], ['แรงบิดที่ล้อ (ต่อล้อ)', `${fmt(dv.dt.wheelTorqueCont, 2)} / ${fmt(dv.dt.wheelTorquePeak, 2)} N·m`],
          ['มอเตอร์ต้องการ (rated, SF 1.3)', `≥ ${fmt(dv.dt.requiredMotorRatedTorque, 3)} N·m @ ${fmt(dv.dt.motorRpm, 0)} rpm`], ['มอเตอร์ที่เลือก', motor ? `${motor.motor?.rated_torque_nm} N·m @ ${motor.motor?.rated_rpm} rpm → ${dv.motorOk ? 'ผ่าน' : 'ไม่ผ่าน'}` : '—']])}
        ${kv([['พลังงานที่ต้องการ', `${fmt(dv.pw.energyWh, 0)} Wh (${fmt(dv.pw.capacityAh, 1)} Ah @ ${s.power.busV} V)`], ['เสถียรภาพ (a_tip vs a_lat)', `${fmt(dv.tip.aTip, 2)} vs ${fmt(dv.tip.aLat, 2)} m/s² → ${dv.tip.ok ? 'ผ่าน' : 'เสี่ยงพลิก'}`],
          ['จุดศูนย์ถ่วง (สูงจากพื้น)', `${fmt(dv.tip.hCog, 2)} m`], ['ค่าที่ใช้', `C_rr ${dv.dt.cRr} · η 0.85 · duty 0.6 · DoD 0.8`]])}
      </div>
      ${frameGuide()}
      ${warn.length ? `<h2>ข้อควรทราบ</h2>${warn.map((w) => `<div class="wi ${w.lvl}">${esc(w.txt)}</div>`).join('')}` : ''}

      <h2>ใบเสนอราคาอุปกรณ์</h2>
      <div class="opts no-print">
        <label>ส่วนลด (%) <input type="number" data-q="discount" min="0" max="100" step="1" value="${quote.discount}"></label>
        <label><input type="checkbox" data-q="vat" ${quote.vat ? 'checked' : ''}> VAT 7%</label>
        <label>ยืนราคา (วัน) <input type="number" data-q="validDays" min="1" step="1" value="${quote.validDays}"></label>
      </div>
      <table class="t"><thead><tr><th class="num">#</th><th>รายการ</th><th>SKU / ลิงก์</th><th class="num">จำนวน</th><th class="num">ราคา/หน่วย (฿)</th><th class="num">รวม (฿)</th></tr></thead>
        <tbody>${bomRows}</tbody><tfoot id="tfoot"></tfoot></table>
      <p class="note" id="priceNote"></p>
      <p class="note">${L('โครงรถ / ตัวถัง: ลูกค้าจัดทำเอง ไม่รวมในใบเสนอราคานี้ — ดู "แนวทางสร้างโครงรถ" ด้านบน', 'Chassis frame: built by the customer, not included in this quotation — see the "Chassis frame build guide" above')}</p>
      <p class="note">ราคาอุปกรณ์จาก TESR Shop ณ วันที่ออกเอกสาร · ยังไม่รวมค่าประกอบ ติดตั้ง ซอฟต์แวร์ และอบรม เว้นแต่ระบุในหมายเหตุ · สเปกคำนวณโดย TESR Robot Builder (ตรวจด้วยกฎวิศวกรรม 16 ข้อก่อนสร้าง ROS 2 workspace)</p>
      <div style="margin-top:14px;padding:12px 14px;border:1.5px solid #C9A84C;border-radius:8px;background:#fffaf0;break-inside:avoid">
        <b style="font-family:'Chakra Petch';color:#8B0000">${L('สนใจสั่งซื้อ · สอบถาม · นัดติดตั้งและอบรม ติดต่อ TESR', 'To order, ask questions or book installation & training — contact TESR')}</b>
        <div style="display:flex;flex-wrap:wrap;gap:6px 22px;margin-top:6px;font-size:13px">
          <span>LINE: <a href="${COMPANY.lineUrl}" target="_blank" rel="noopener">${COMPANY.line}</a></span>
          <span>Email: <a href="mailto:${COMPANY.email}">${COMPANY.email}</a></span>
          <span>${L('โทร', 'Tel')}: <a href="tel:${COMPANY.tel}">${COMPANY.phone}</a></span></div>
        <div class="note" style="margin-top:6px">${L('วิธีนำไฟล์ ROS 2 ไปใช้งานทีละขั้น', 'Step-by-step guide for the ROS 2 files')}: <a href="${esc(new URL('./guide.html', location.href).href)}" target="_blank" rel="noopener">${esc(new URL('./guide.html', location.href).href)}</a></div>
      </div>
      <div class="sign"><div>${isEn() ? 'Quoted by' : 'ผู้เสนอราคา'} · ${COMPANY.en}</div><div>ผู้อนุมัติ / ลูกค้า</div></div>
    </div>`;
    renderTotals();
  }

  function renderTotals() {
    const t = totals();
    $('tfoot').innerHTML = `<tr><td colspan="5" class="num">รวมเป็นเงิน</td><td class="num">${baht(t.sub)}</td></tr>
      ${t.disc ? `<tr><td colspan="5" class="num">ส่วนลด ${quote.discount}%</td><td class="num">−${baht(t.disc)}</td></tr>` : ''}
      ${quote.vat ? `<tr><td colspan="5" class="num">VAT 7%</td><td class="num">${baht(t.vat)}</td></tr>` : ''}
      <tr class="grand"><td colspan="5" class="num">รวมทั้งสิ้น</td><td class="num">${baht(t.grand)}</td></tr>`;
    $('priceNote').textContent = t.unpriced ? `มี ${t.unpriced} รายการที่ยังไม่มีราคาในแคตตาล็อก (“สอบถาม”) — ยอดรวมยังไม่รวมรายการเหล่านี้` : '';
    $('vDays').textContent = quote.validDays;
    $('qDate').textContent = longDate(quote.date); $('qUntil').textContent = longDate(addDays(quote.date, quote.validDays));
    $('sStatus').textContent = `${state.name} · ${dv.bom.lines.length} รายการ · ${t.grand ? baht(t.grand) + ' ฿' : 'รอราคา'}`;
  }

  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.q; if (!k || !state) return;
    quote[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    saveQuote(); if (['discount', 'vat', 'validDays', 'date'].includes(k)) renderTotals();
  });
  // dates follow the TH / EN switch (Thai: Buddhist year)
  document.addEventListener('click', (e) => { if (e.target.closest('.lang-switch button') && state && dv) setTimeout(render, 0); });
  $('aBack').onclick = () => { location.href = './index.html'; };
  $('aPrint').onclick = () => window.print();
  $('aBom').onclick = () => state && download(`${state.name}_bom.csv`, T.bomCsv(dv.bom), 'text/csv');
  $('aYaml').onclick = () => state && download(`${state.name}.robot.yaml`, G.toYaml(state, registry, dv), 'text/yaml');
  $('aBuild').onclick = () => {
    if (state) {
      const project = JSON.parse(localStorage.getItem('tesr_rb_project') || '{}');
      Object.assign(project, { yaml: G.toYaml(state, registry, dv), design: { name: state.name, prefix: state.prefix }, garage: state, saved_at: new Date().toISOString() });
      localStorage.setItem('tesr_rb_project', JSON.stringify(project));
    }
    location.href = './build.html';
  };

  // app.js registers its own page UI on DOMContentLoaded; loading it after 'load' keeps that UI from starting here
  window.addEventListener('load', async () => {
    const nav = document.querySelector('header.tesr nav');
    if (nav && !nav.querySelector('a[href="./guide.html"]')) nav.insertAdjacentHTML('beforeend', '<a href="./guide.html"><span class="i18n-th">📘 คู่มือใช้ไฟล์</span><span class="i18n-en">📘 File guide</span></a>');
    try {
      await loadScript('./app.js');
      T = window.TESR;
      registry = await (await fetch('./data/registry.json', { cache: 'no-store' })).json();
      registry.hardware.forEach((h) => { ids[h.id] = h; });
      try {
        const ref = new URLSearchParams(location.search).get('catalog') || localStorage.getItem('tesr_rb_catalog') || '';
        const res = await fetch(T.catalogUrl(ref), { cache: 'no-store' });
        if (res.ok) catalog = T.parseCatalog(await res.text());
      } catch (_) { catalog = []; }
      try { state = JSON.parse(localStorage.getItem('tesr_rb_garage') || 'null'); } catch (_) { state = null; }
      if (!state || !state.chassis || !state.drive) {
        $('doc').innerHTML = '<div class="empty"><h2>ยังไม่มีหุ่นในโปรเจกต์</h2><p class="muted">เริ่มที่ <a href="./index.html">🛠 Garage 3D</a> หรือ <a href="./form.html">โหมดฟอร์ม</a> แล้วกด “📋 สรุปสเปก &amp; ใบเสนอราคา”</p></div>';
        $('sStatus').textContent = 'ยังไม่มีโปรเจกต์';
        return;
      }
      state.parts = state.parts || []; state.user = state.user || {};
      dv = G.derive(state, registry, catalog);
      loadQuote(); render();
      document.title = `${state.name} — สรุปสเปก & ใบเสนอราคา ${quote.no}`;
    } catch (err) {
      console.error(err);
      $('doc').innerHTML = `<div class="empty"><p>สร้างเอกสารไม่สำเร็จ: ${esc(err.message)}</p></div>`;
    }
  });
})();
