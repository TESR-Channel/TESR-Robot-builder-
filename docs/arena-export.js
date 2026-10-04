/* TESR Robot Builder — arena engine (docs/arena-export.js)
 * Pure functions shared by the arena editor (arena.html), Mission Control (build.js) and the tests.
 *   arena  = { version, name, size:{w,h}, border, wallHeight, start:{x,y,yaw}, items:[…] }  (metres, radians; +x east, +y north)
 *   items  = wall {x1,y1,x2,y2,t,h} · box {x,y,w,d,h,yaw,color} · cyl {x,y,r,h,color}
 *            aruco {x,y,yaw,size,markerId,mount:'post'|'floor',z} · goal {x,y,label}
 * Export: one ROS 2 package with a self-contained Gazebo world (start pose = world origin, so the robot spawns at 0,0,0 and
 * AMCL's default initial pose is already right), a ground-truth occupancy map for Nav2, a view-only launch file and a README.
 * ArUco markers are modelled as black cells on a white plate — no textures, no resource paths, cheap to render.
 */
(function (root) {
  'use strict';
  // OpenCV DICT_4X4_50 — 16 inner bits per marker, MSB = top-left, row-major, 1 = white (extracted with cv2.aruco)
  const ARUCO_4X4_50 = [46386, 3994, 13101, 39238, 21662, 31181, 40494, 50418, 65242, 53078, 63889, 4519, 3767, 10767, 9393, 9790, 18021, 26112,
    27742, 30383, 34443, 45099, 52437, 56706, 65095, 38001, 44260, 42324, 8483, 13423, 17429, 22450, 40655, 61643, 2222, 2345, 6261, 1279,
    3574, 7258, 5912, 10792, 12940, 14514, 9448, 12011, 11583, 19300, 20526, 20499];
  const r4 = (v) => Math.round(v * 10000) / 10000;
  const f = (v) => String(r4(v));
  const deg = Math.PI / 180;

  // ---------- presets ("finished" fields) --------------------------------------------------------------------
  let uid = 0;
  const id = () => `i${Date.now().toString(36)}${(uid++).toString(36)}`;
  const W = (x1, y1, x2, y2, t = 0.15, h = 1.0) => ({ id: id(), type: 'wall', x1, y1, x2, y2, t, h });
  const B = (x, y, w, d, h, yaw = 0, color = 'red') => ({ id: id(), type: 'box', x, y, w, d, h, yaw, color });
  const C = (x, y, r, h = 1.0, color = 'gray') => ({ id: id(), type: 'cyl', x, y, r, h, color });
  const A = (x, y, yaw, markerId, mount = 'post', size = 0.15, z = 0.35) => ({ id: id(), type: 'aruco', x, y, yaw, size, markerId, mount, z });
  const G = (x, y, label) => ({ id: id(), type: 'goal', x, y, label });
  const PRESETS = {
    tesr_warehouse: { th: 'โกดัง TESR 12×8 m', en: 'TESR warehouse 12×8 m', icon: '🏭', make: () => ({ name: 'tesr_warehouse', size: { w: 12, h: 8 }, border: true, wallHeight: 1.2,
      start: { x: -4.5, y: 0, yaw: 0 },
      items: [W(-1.5, -0.4, -1.5, 2.8, 0.15, 1.2), B(2.5, 2.6, 3.0, 0.8, 1.8), B(2.5, -2.6, 3.0, 0.8, 1.8), B(-4.0, -2.6, 2.4, 0.8, 1.8),
        B(0.8, -0.9, 1.0, 0.8, 0.7, 0, 'wood'), B(4.2, 0.3, 1.0, 0.8, 0.7, 0.5, 'wood'), B(-3.8, 2.2, 1.0, 0.8, 0.7, 0.2, 'wood'),
        G(4.5, -1.2, 'A'), G(4.5, 1.5, 'B'), G(-0.2, 2.6, 'C')] }) },
    empty_room: { th: 'ห้องเปล่า 6×6 m', en: 'Empty room 6×6 m', icon: '⬜', make: () => ({ name: 'empty_room', size: { w: 6, h: 6 }, border: true, wallHeight: 1.0,
      start: { x: 0, y: 0, yaw: 0 }, items: [] }) },
    corridor: { th: 'ทางเดินแคบ + โค้ง', en: 'Narrow corridor + turns', icon: '🧭', make: () => ({ name: 'corridor', size: { w: 10, h: 5 }, border: true, wallHeight: 1.0,
      start: { x: -4.2, y: -1.8, yaw: 0 },
      items: [W(-5, -0.8, 2.0, -0.8), W(-3.0, 0.4, 5, 0.4), W(2.0, -0.8, 2.0, -2.5 + 1.2), W(-1.0, 0.4, -1.0, 2.5 - 1.1), B(3.6, -1.6, 0.6, 0.6, 0.6, 0.4, 'wood'),
        G(4.2, -1.8, 'A'), G(-4.2, 1.7, 'B')] }) },
    maze: { th: 'เขาวงกต 8×8 m', en: 'Maze 8×8 m', icon: '🌀', make: () => ({ name: 'maze', size: { w: 8, h: 8 }, border: true, wallHeight: 1.0,
      start: { x: -3.3, y: -3.3, yaw: 0 },
      items: [W(-2.4, -4, -2.4, 1.6), W(-0.8, -2.4, -0.8, 4), W(0.8, -4, 0.8, 0.8), W(0.8, 0.8, 2.4, 0.8), W(2.4, -2.4, 2.4, 2.4), W(-4, 2.4, -2.4, 2.4),
        W(-0.8, -2.4, 0.0, -2.4), G(3.3, -3.3, 'A'), G(3.3, 3.3, 'B')] }) },
    aruco_dock: { th: 'สถานี ArUco + จุดชาร์จ', en: 'ArUco stations + dock', icon: '🔳', make: () => ({ name: 'aruco_dock', size: { w: 8, h: 6 }, border: true, wallHeight: 1.0,
      start: { x: -3, y: 0, yaw: 0 },
      items: [A(3.85, 0, Math.PI, 0), A(0, 2.85, -Math.PI / 2, 1), A(0, -2.85, Math.PI / 2, 2), A(3.2, 0, 0, 7, 'floor', 0.2, 0), B(1.4, 1.0, 0.6, 0.6, 0.8, 0, 'wood'),
        C(-1.0, -1.2, 0.2, 1.0), G(3.3, 0, 'DOCK'), G(0, 2.2, 'A'), G(0, -2.2, 'B')] }) },
    obstacles: { th: 'สนามหลบสิ่งกีดขวาง', en: 'Obstacle course', icon: '🚧', make: () => ({ name: 'obstacles', size: { w: 10, h: 6 }, border: true, wallHeight: 1.0,
      start: { x: -4.3, y: 0, yaw: 0 },
      items: [C(-2.5, 0.8, 0.25), C(-2.0, -1.3, 0.3), C(-0.5, 0.2, 0.2), C(0.8, 1.7, 0.35), C(1.0, -1.0, 0.25), C(2.4, 0.5, 0.3), B(3.0, -1.8, 0.8, 0.5, 0.5, 0.7, 'wood'),
        B(-0.8, -2.2, 1.2, 0.4, 0.3, 0, 'blue'), G(4.3, 0, 'A')] }) },
  };

  function normalize(a) {
    a = JSON.parse(JSON.stringify(a || {}));
    a.version = 1; a.name = slug(a.name || 'my_arena');
    a.size = { w: Math.max(1, +(a.size && a.size.w) || 8), h: Math.max(1, +(a.size && a.size.h) || 6) };
    a.border = a.border !== false; a.wallHeight = +a.wallHeight || 1.0;
    a.start = Object.assign({ x: 0, y: 0, yaw: 0 }, a.start || {});
    a.items = (a.items || []).filter((it) => it && it.type).map((it) => Object.assign({ id: id() }, it));
    return a;
  }
  const slug = (s) => (String(s || 'my_arena').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^([^a-z])/, 'a_$1') || 'my_arena').slice(0, 40);

  // border walls are generated, not stored — resizing the field keeps them right
  function solids(a) {
    const out = a.items.filter((it) => it.type !== 'goal');
    if (a.border) {
      const hw = a.size.w / 2, hh = a.size.h / 2, t = 0.15, h = a.wallHeight;
      out.push({ id: 'border_n', type: 'wall', x1: -hw - t, y1: hh + t / 2, x2: hw + t, y2: hh + t / 2, t, h, border: true },
        { id: 'border_s', type: 'wall', x1: -hw - t, y1: -hh - t / 2, x2: hw + t, y2: -hh - t / 2, t, h, border: true },
        { id: 'border_e', type: 'wall', x1: hw + t / 2, y1: -hh, x2: hw + t / 2, y2: hh, t, h, border: true },
        { id: 'border_w', type: 'wall', x1: -hw - t / 2, y1: -hh, x2: -hw - t / 2, y2: hh, t, h, border: true });
    }
    return out;
  }
  const plateSize = (it) => it.size * 8 / 6; // marker (black square) + one white cell of quiet zone on each side

  // every solid as collision primitives: oriented boxes {cx,cy,hx,hy,yaw,h,z0} and circles {cx,cy,r,h,z0}
  function shapes(it) {
    if (it.type === 'wall') {
      const dx = it.x2 - it.x1, dy = it.y2 - it.y1, len = Math.hypot(dx, dy);
      return [{ k: 'obb', cx: (it.x1 + it.x2) / 2, cy: (it.y1 + it.y2) / 2, hx: len / 2, hy: (it.t || 0.15) / 2, yaw: Math.atan2(dy, dx), h: it.h || 1, z0: 0 }];
    }
    if (it.type === 'box') return [{ k: 'obb', cx: it.x, cy: it.y, hx: it.w / 2, hy: it.d / 2, yaw: it.yaw || 0, h: it.h || 0.5, z0: 0 }];
    if (it.type === 'cyl') return [{ k: 'circle', cx: it.x, cy: it.y, r: it.r, h: it.h || 1, z0: 0 }];
    if (it.type === 'aruco') {
      if (it.mount === 'floor') return [];
      const P = plateSize(it);
      return [{ k: 'circle', cx: it.x, cy: it.y, r: 0.015, h: it.z, z0: 0 },
        { k: 'obb', cx: it.x, cy: it.y, hx: 0.005, hy: P / 2, yaw: it.yaw || 0, h: P, z0: it.z - P / 2 }];
    }
    return [];
  }
  const inShape = (s, x, y) => {
    if (s.k === 'circle') return (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r;
    const c = Math.cos(-s.yaw), n = Math.sin(-s.yaw), lx = (x - s.cx) * c - (y - s.cy) * n, ly = (x - s.cx) * n + (y - s.cy) * c;
    return Math.abs(lx) <= s.hx && Math.abs(ly) <= s.hy;
  };

  // ---------- ArUco -------------------------------------------------------------------------------------------
  /** 6×6 cell matrix (true = black) for DICT_4X4_50 marker id, including the black border ring. */
  function markerCells(markerId) {
    const code = ARUCO_4X4_50[Math.max(0, Math.min(49, markerId | 0))];
    const m = [];
    for (let r = 0; r < 6; r++) {
      const row = [];
      for (let c = 0; c < 6; c++) {
        if (r === 0 || r === 5 || c === 0 || c === 5) { row.push(true); continue; }
        const bit = (code >> (15 - ((r - 1) * 4 + (c - 1)))) & 1;
        row.push(bit === 0); // 1 = white
      }
      m.push(row);
    }
    return m;
  }
  /** Printable marker at real size (mm) — print at 100 % scale. */
  function markerSvg(markerId, sizeMm = 150, label = true) {
    const m = markerCells(markerId), cell = sizeMm / 6, q = cell, total = sizeMm + 2 * q, H = total + (label ? 12 : 0);
    let rects = '';
    m.forEach((row, r) => row.forEach((b, c) => { if (b) rects += `<rect x="${f(q + c * cell)}" y="${f(q + r * cell)}" width="${f(cell + 0.02)}" height="${f(cell + 0.02)}"/>`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(total)}mm" height="${f(H)}mm" viewBox="0 0 ${f(total)} ${f(H)}">`
      + `<rect width="${f(total)}" height="${f(total)}" fill="#fff" stroke="#bbb" stroke-width="0.2"/><g fill="#000">${rects}</g>`
      + (label ? `<text x="${f(total / 2)}" y="${f(total + 8)}" font-family="sans-serif" font-size="5" text-anchor="middle">ArUco DICT_4X4_50 · id ${markerId} · ${sizeMm} mm</text>` : '')
      + '</svg>';
  }

  // ---------- frame: export with the start pose at the origin ---------------------------------------------------
  function toStartFrame(a) {
    const s = a.start, c = Math.cos(-s.yaw), n = Math.sin(-s.yaw);
    const P = (x, y) => [(x - s.x) * c - (y - s.y) * n, (x - s.x) * n + (y - s.y) * c];
    return (it) => {
      const o = Object.assign({}, it);
      if (it.type === 'wall') { [o.x1, o.y1] = P(it.x1, it.y1); [o.x2, o.y2] = P(it.x2, it.y2); }
      else { [o.x, o.y] = P(it.x, it.y); if ('yaw' in it) o.yaw = (it.yaw || 0) - s.yaw; }
      return o;
    };
  }

  // ---------- Gazebo SDF ------------------------------------------------------------------------------------------
  const COLORS = { red: [0.55, 0.0, 0.0], wood: [0.79, 0.66, 0.3], blue: [0.15, 0.35, 0.75], gray: [0.55, 0.55, 0.58], green: [0.2, 0.55, 0.3], yellow: [0.9, 0.75, 0.1], white: [0.92, 0.92, 0.92], black: [0.08, 0.08, 0.08] };
  const mat = (k) => { const c = COLORS[k] || COLORS.gray; return `<material><ambient>${c.map((v) => r4(v * 0.6)).join(' ')} 1</ambient><diffuse>${c.join(' ')} 1</diffuse></material>`; };
  const boxXml = (name, pose, size, color, collide = true) =>
    `${collide ? `<collision name="${name}_c"><pose>${pose}</pose><geometry><box><size>${size}</size></box></geometry></collision>` : ''}`
    + `<visual name="${name}_v"><pose>${pose}</pose><geometry><box><size>${size}</size></box></geometry>${mat(color)}</visual>`;

  function arucoModel(it, n) {
    const P = plateSize(it), cell = it.size / 6, cells = markerCells(it.markerId);
    let v = '';
    const floor = it.mount === 'floor';
    if (!floor) {
      v += `<collision name="post_c"><pose>0 0 ${f(it.z / 2)} 0 0 0</pose><geometry><cylinder><radius>0.015</radius><length>${f(it.z)}</length></cylinder></geometry></collision>`;
      v += `<visual name="post_v"><pose>0 0 ${f(it.z / 2)} 0 0 0</pose><geometry><cylinder><radius>0.015</radius><length>${f(it.z)}</length></cylinder></geometry>${mat('gray')}</visual>`;
      v += boxXml('plate', `0 0 ${f(it.z)} 0 0 0`, `0.01 ${f(P)} ${f(P)}`, 'white');
    } else {
      v += boxXml('plate', `0 0 0.001 0 0 0`, `${f(P)} ${f(P)} 0.002`, 'white', false);
    }
    // black cells, merged into horizontal strips per row (≤ 6 visuals per row, usually far fewer)
    cells.forEach((row, r) => {
      let c = 0;
      while (c < 6) {
        if (!row[c]) { c++; continue; }
        let e = c; while (e + 1 < 6 && row[e + 1]) e++;
        const mid = (c + e) / 2 - 2.5, len = (e - c + 1) * cell, k = `cell_${r}_${c}`;
        if (!floor) v += boxXml(k, `0.0055 ${f(mid * cell)} ${f(it.z + (2.5 - r) * cell)} 0 0 0`, `0.001 ${f(len)} ${f(cell)}`, 'black', false);
        else v += boxXml(k, `${f((2.5 - r) * cell)} ${f(-mid * cell)} 0.0025 0 0 0`, `${f(cell)} ${f(len)} 0.001`, 'black', false);
        c = e + 1;
      }
    });
    return `    <model name="aruco_${it.markerId}_${n}"><static>true</static><pose>${f(it.x)} ${f(it.y)} 0 0 0 ${f(it.yaw || 0)}</pose><link name="link">${v}</link></model>\n`;
  }

  function sdf(arena) {
    const a = normalize(arena), T = toStartFrame(a), name = a.name;
    let models = '', n = 0;
    for (const it0 of solids(a)) {
      const it = T(it0); n++;
      if (it.type === 'wall') {
        const s = shapes(it)[0];
        models += `    <model name="${it.border ? it.id : `wall_${n}`}"><static>true</static><pose>${f(s.cx)} ${f(s.cy)} ${f(s.h / 2)} 0 0 ${f(s.yaw)}</pose><link name="link">${boxXml('w', '0 0 0 0 0 0', `${f(s.hx * 2)} ${f(s.hy * 2)} ${f(s.h)}`, 'gray')}</link></model>\n`;
      } else if (it.type === 'box') {
        models += `    <model name="box_${n}"><static>true</static><pose>${f(it.x)} ${f(it.y)} ${f(it.h / 2)} 0 0 ${f(it.yaw || 0)}</pose><link name="link">${boxXml('b', '0 0 0 0 0 0', `${f(it.w)} ${f(it.d)} ${f(it.h)}`, it.color)}</link></model>\n`;
      } else if (it.type === 'cyl') {
        models += `    <model name="cylinder_${n}"><static>true</static><pose>${f(it.x)} ${f(it.y)} ${f(it.h / 2)} 0 0 0</pose><link name="link">`
          + `<collision name="c"><geometry><cylinder><radius>${f(it.r)}</radius><length>${f(it.h)}</length></cylinder></geometry></collision>`
          + `<visual name="v"><geometry><cylinder><radius>${f(it.r)}</radius><length>${f(it.h)}</length></cylinder></geometry>${mat(it.color)}</visual></link></model>\n`;
      } else if (it.type === 'aruco') models += arucoModel(it, n);
    }
    const span = Math.ceil(Math.hypot(a.size.w, a.size.h) * 2 + 10);
    return `<?xml version="1.0"?>
<!-- Generated by TESR Robot Builder — arena editor. Arena "${name}", ${a.size.w} x ${a.size.h} m.
     The robot's start pose is the world origin: spawn with x:=0 y:=0 yaw:=0.
     Light-weight on purpose: static primitives only, no textures, no shadows. -->
<sdf version="1.9">
  <world name="${name}">
    <physics name="1ms" type="ignored"><max_step_size>0.001</max_step_size><real_time_factor>1.0</real_time_factor></physics>
    <plugin filename="gz-sim-physics-system" name="gz::sim::systems::Physics"/>
    <plugin filename="gz-sim-user-commands-system" name="gz::sim::systems::UserCommands"/>
    <plugin filename="gz-sim-scene-broadcaster-system" name="gz::sim::systems::SceneBroadcaster"/>
    <plugin filename="gz-sim-sensors-system" name="gz::sim::systems::Sensors"><render_engine>ogre2</render_engine></plugin>
    <plugin filename="gz-sim-imu-system" name="gz::sim::systems::Imu"/>
    <scene><ambient>0.45 0.45 0.48 1</ambient><background>0.05 0.05 0.07 1</background><grid>false</grid><shadows>false</shadows></scene>
    <light type="directional" name="sun"><cast_shadows>false</cast_shadows><pose>0 0 10 0 0 0</pose><diffuse>0.9 0.88 0.82 1</diffuse><specular>0.1 0.1 0.1 1</specular><direction>-0.4 0.25 -0.9</direction></light>
    <model name="floor"><static>true</static><link name="link">
      <collision name="c"><geometry><plane><normal>0 0 1</normal><size>${span} ${span}</size></plane></geometry></collision>
      <visual name="v"><geometry><plane><normal>0 0 1</normal><size>${span} ${span}</size></plane></geometry><material><ambient>0.14 0.14 0.16 1</ambient><diffuse>0.24 0.24 0.27 1</diffuse></material></visual>
    </link></model>
${models}  </world>
</sdf>
`;
  }

  // ---------- ground-truth occupancy map (for AMCL without mapping first) --------------------------------------------
  function occupancy(arena, res = 0.05) {
    const a = normalize(arena), T = toStartFrame(a);
    const prims = solids(a).map(T).flatMap(shapes);
    // bounds of the field in the exported frame (+ border thickness + margin)
    const hw = a.size.w / 2 + 0.5, hh = a.size.h / 2 + 0.5, s = a.start, c = Math.cos(-s.yaw), n = Math.sin(-s.yaw);
    const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [(x - s.x) * c - (y - s.y) * n, (x - s.x) * n + (y - s.y) * c]);
    const minX = Math.min(...corners.map((p) => p[0])), maxX = Math.max(...corners.map((p) => p[0]));
    const minY = Math.min(...corners.map((p) => p[1])), maxY = Math.max(...corners.map((p) => p[1]));
    const w = Math.ceil((maxX - minX) / res), h = Math.ceil((maxY - minY) / res);
    const data = new Uint8Array(w * h).fill(254);
    for (let j = 0; j < h; j++) {
      const y = maxY - (j + 0.5) * res; // PGM row 0 = top = max y
      for (let i = 0; i < w; i++) {
        const x = minX + (i + 0.5) * res;
        for (const p of prims) if (inShape(p, x, y)) { data[j * w + i] = 0; break; }
      }
    }
    return { w, h, res, origin: [r4(minX), r4(minY), 0], data };
  }
  function pgm(grid) {
    const head = new TextEncoder().encode(`P5\n# TESR Robot Builder arena\n${grid.w} ${grid.h}\n255\n`);
    const out = new Uint8Array(head.length + grid.data.length); out.set(head); out.set(grid.data, head.length);
    return out;
  }
  const mapYaml = (name, grid) => `image: ${name}.pgm\nmode: trinary\nresolution: ${grid.res}\norigin: [${grid.origin.join(', ')}]\nnegate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.25\n`;

  // ---------- ROS 2 package --------------------------------------------------------------------------------------------
  function packageName(arena) { return `tesr_world_${normalize(arena).name}`.slice(0, 60); }

  function packageFiles(arena, robot = {}) {
    const a = normalize(arena), pkg = packageName(a), name = a.name, grid = occupancy(a);
    const P = robot.prefix ? `${robot.prefix}_bringup` : '<prefix>_bringup';
    const markers = a.items.filter((it) => it.type === 'aruco');
    const goals = a.items.filter((it) => it.type === 'goal').map(toStartFrame(a));
    const files = {};
    files[`${pkg}/package.xml`] = `<?xml version="1.0"?>
<package format="3">
  <name>${pkg}</name>
  <version>0.1.0</version>
  <description>Gazebo world "${name}" designed in the TESR Robot Builder arena editor (+ ground-truth map for Nav2).</description>
  <maintainer email="tesrshop@gmail.com">TESR Co.,Ltd.</maintainer>
  <license>Apache-2.0</license>
  <buildtool_depend>ament_cmake</buildtool_depend>
  <exec_depend>ros_gz_sim</exec_depend>
  <export><build_type>ament_cmake</build_type></export>
</package>
`;
    files[`${pkg}/CMakeLists.txt`] = `cmake_minimum_required(VERSION 3.8)
project(${pkg})
find_package(ament_cmake REQUIRED)
install(DIRECTORY worlds maps launch DESTINATION share/\${PROJECT_NAME})
ament_package()
`;
    files[`${pkg}/worlds/${name}.sdf`] = sdf(a);
    files[`${pkg}/maps/${name}.pgm`] = pgm(grid);
    files[`${pkg}/maps/${name}.yaml`] = mapYaml(name, grid);
    files[`${pkg}/arena.json`] = JSON.stringify(a, null, 1) + '\n';
    files[`${pkg}/launch/world.launch.py`] = `"""View the arena alone in Gazebo:  ros2 launch ${pkg} world.launch.py"""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource


def generate_launch_description():
    world = os.path.join(get_package_share_directory('${pkg}'), 'worlds', '${name}.sdf')
    gz = os.path.join(get_package_share_directory('ros_gz_sim'), 'launch', 'gz_sim.launch.py')
    return LaunchDescription([IncludeLaunchDescription(PythonLaunchDescriptionSource(gz), launch_arguments={'gz_args': ['-r ', world]}.items())])
`;
    markers.forEach((m) => { files[`${pkg}/aruco/aruco_4x4_50_id${m.markerId}_${Math.round(m.size * 1000)}mm.svg`] = markerSvg(m.markerId, Math.round(m.size * 1000)); });
    const share = `$(ros2 pkg prefix ${pkg})/share/${pkg}`;
    files[`${pkg}/README.md`] = `# ${pkg} — Gazebo world "${name}"

Designed in the **TESR Robot Builder arena editor** (${a.size.w} × ${a.size.h} m, ${a.items.length} objects${markers.length ? `, ${markers.length} ArUco marker(s)` : ''}).
Light-weight on purpose: static boxes/cylinders only, no textures, no shadows — it runs on a modest laptop.

## 1 · Put it in your ROS 2 workspace
Copy this folder into the \`src/\` folder of your robot workspace (the one from Robot Builder step 3):
\`\`\`
~/my_robot_ws/
└── src/
    ├── ${pkg}/        ← this folder
    ├── <prefix>_bringup/
    └── …
\`\`\`
## 2 · Build and source
\`\`\`bash
cd ~/my_robot_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash          # do this in every new terminal (or add it to ~/.bashrc)
\`\`\`
## 3 · Run your robot in this world (SLAM + Nav2 + RViz)
The start pose you set in the editor is the world origin, so spawn at 0,0,0:
\`\`\`bash
ros2 launch ${P} sim.launch.py world:=${share}/worlds/${name}.sdf x:=0 y:=0 yaw:=0
\`\`\`
## 4 · Navigate on the ready-made map (no mapping drive needed)
\`maps/${name}.yaml\` is drawn from the editor geometry. AMCL starts at the origin = your start pose:
\`\`\`bash
ros2 launch ${P} sim.launch.py world:=${share}/worlds/${name}.sdf x:=0 y:=0 yaw:=0 slam:=false map:=${share}/maps/${name}.yaml
\`\`\`
Then click **2D Goal Pose** in RViz.${goals.length ? `\n\nGoals from the editor (map frame, metres):\n\n| goal | x | y |\n|---|---|---|\n${goals.map((g) => `| ${g.label} | ${r4(g.x)} | ${r4(g.y)} |`).join('\n')}` : ''}

## Only look at the world
\`\`\`bash
ros2 launch ${pkg} world.launch.py
\`\`\`
${markers.length ? `## ArUco markers
Dictionary **DICT_4X4_50** (OpenCV). In Gazebo they are built from black cells, so any camera on the robot can detect them.
For the real field print \`aruco/*.svg\` at **100 % scale** (marker size = the black square).

| id | size | mount |
|---|---|---|
${markers.map((m) => `| ${m.markerId} | ${Math.round(m.size * 1000)} mm | ${m.mount === 'floor' ? 'floor' : `post, centre ${Math.round(m.z * 1000)} mm high`} |`).join('\n')}
` : ''}
## Change the world
Open the Robot Builder arena editor → **Import** \`arena.json\` → edit → export again.

---
TESR Co.,Ltd. · LINE www.tesrshop.com/line · tesrshop@gmail.com · 082-983-7768
`;
    return files;
  }

  const api = { ARUCO_4X4_50, PRESETS, COLORS, normalize, slug, solids, shapes, inShape, plateSize, markerCells, markerSvg, toStartFrame, sdf, occupancy, pgm, mapYaml, packageName, packageFiles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TESR_ARENA = api;
})(typeof window !== 'undefined' ? window : globalThis);
