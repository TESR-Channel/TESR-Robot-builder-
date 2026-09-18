/* TESR Robot Builder — Model Studio core (docs/model-core.js)
 * Pure functions shared by model.js (browser) and tests/test_model.js (node). No three.js here.
 * State = { name, prefix, meshes: [{ id, name, file, position:[x,y,z] m, rpy:[r,p,y] rad, scale:[sx,sy,sz], color:'#rrggbb', visible, bbox:{size:[..], count} }] }
 */
(function (root) {
  'use strict';

  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const deg = (rad) => r4(rad * 180 / Math.PI);
  const rad = (d) => d * Math.PI / 180;

  function emptyState(name = 'my_robot', prefix = 'tesr_robot') {
    return { version: 1, name, prefix, meshes: [] };
  }

  /** STL files are usually millimetres: if the raw model is bigger than 10 units, treat it as mm. */
  function autoScale(bboxSizeRaw) {
    const m = Math.max(...bboxSizeRaw);
    if (m > 10) return 0.001;   // mm → m
    if (m > 0 && m < 0.01) return 1000; // someone exported in km? unlikely; treat as error-free fallback
    return 1;
  }

  const PALETTE = ['#8B0000', '#C9A84C', '#8c8c92', '#3a6ea5', '#2e8b57', '#b3171b', '#e0d9c7'];

  function addMesh(state, { name, file, bboxSizeRaw, triangles }) {
    const s = autoScale(bboxSizeRaw);
    const id = `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    const mesh = {
      id, name: name || file.replace(/\.[^.]+$/, ''), file, position: [0, 0, 0], rpy: [0, 0, 0], scale: [s, s, s],
      color: PALETTE[state.meshes.length % PALETTE.length], visible: true,
      bbox: { size: bboxSizeRaw.map((v) => r4(v * s)), triangles: triangles || 0, raw_unit: s === 0.001 ? 'mm' : 'm' },
    };
    state.meshes.push(mesh);
    return mesh;
  }

  function removeMesh(state, id) { state.meshes = state.meshes.filter((m) => m.id !== id); }

  const num3 = (v) => v.map((x) => r4(x)).join(' ');
  const hexToRgba = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return `${((n >> 16) & 255) / 255} ${((n >> 8) & 255) / 255} ${(n & 255) / 255} 1.0`.replace(/(\.\d{3})\d+/g, '$1');
  };
  const xmlEsc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, 'm');

  /** One base_link with a <visual>+<collision> per mesh — the shape the description generator will consume. */
  function exportUrdf(state) {
    const pkg = `${state.prefix}_description`;
    const lines = ['<?xml version="1.0"?>', `<!-- TESR Robot Builder — Model Studio export for ${state.name}. Copy the STL files to ${pkg}/meshes/ -->`,
      `<robot name="${xmlEsc(state.name)}">`, '  <link name="base_link">'];
    state.meshes.filter((m) => m.visible).forEach((m) => {
      const geom = `<geometry><mesh filename="package://${pkg}/meshes/${xmlEsc(m.file)}" scale="${num3(m.scale)}"/></geometry>`;
      const origin = `<origin xyz="${num3(m.position)}" rpy="${num3(m.rpy)}"/>`;
      lines.push(`    <visual name="${slug(m.name)}">`, `      ${origin}`, `      ${geom}`,
        `      <material name="${slug(m.name)}_mat"><color rgba="${hexToRgba(m.color)}"/></material>`, '    </visual>',
        '    <collision>', `      ${origin}`, `      ${geom}`, '    </collision>');
    });
    if (!state.meshes.some((m) => m.visible)) lines.push('    <!-- no meshes: upload STL files in Model Studio -->');
    lines.push('  </link>', '</robot>');
    return lines.join('\n') + '\n';
  }

  /** Xacro macro version — drop into <prefix>_description/urdf/meshes.xacro and include it from robot.urdf.xacro. */
  function exportXacro(state) {
    const pkg = `${state.prefix}_description`;
    const lines = ['<?xml version="1.0"?>', `<!-- TESR Robot Builder — Model Studio export for ${state.name} -->`,
      '<robot xmlns:xacro="http://www.ros.org/wiki/xacro">', '  <xacro:macro name="tesr_meshes" params="parent:=base_link">'];
    state.meshes.filter((m) => m.visible).forEach((m) => {
      lines.push(`    <link name="${slug(m.name)}_mesh">`,
        `      <visual><geometry><mesh filename="$(find ${pkg})/meshes/${xmlEsc(m.file)}" scale="${num3(m.scale)}"/></geometry>`,
        `        <material name="${slug(m.name)}_mat"><color rgba="${hexToRgba(m.color)}"/></material></visual>`,
        `      <collision><geometry><mesh filename="$(find ${pkg})/meshes/${xmlEsc(m.file)}" scale="${num3(m.scale)}"/></geometry></collision>`,
        '    </link>',
        `    <joint name="${slug(m.name)}_mesh_joint" type="fixed"><parent link="\${parent}"/><child link="${slug(m.name)}_mesh"/><origin xyz="${num3(m.position)}" rpy="${num3(m.rpy)}"/></joint>`);
    });
    lines.push('  </xacro:macro>', '</robot>');
    return lines.join('\n') + '\n';
  }

  function exportJson(state) { return JSON.stringify(state, null, 2) + '\n'; }

  function importJson(text) {
    const s = JSON.parse(text);
    if (!s || s.version !== 1 || !Array.isArray(s.meshes)) throw new Error('not a Model Studio file (version 1 with meshes[])');
    s.meshes.forEach((m) => { m.position = m.position || [0, 0, 0]; m.rpy = m.rpy || [0, 0, 0]; m.scale = m.scale || [1, 1, 1]; m.visible = m.visible !== false; });
    return s;
  }

  /** Ghost primitives from a Spec & Sizing design (localStorage tesr_rb_project.design) so STL can be aligned to the resolved geometry. */
  function designToPrimitives(design) {
    if (!design) return [];
    const r = design.wheelDiameter / 2, gc = design.groundClearance, H = design.height, L = design.length, W = design.width;
    const prims = [{ kind: 'box', name: 'chassis', size: [L, W, H], position: [0, 0, gc + H / 2], color: '#C9A84C' }];
    const hs = design.track / 2;
    const wheels = design.drive === 'mecanum'
      ? [[design.wheelbase / 2, hs], [design.wheelbase / 2, -hs], [-design.wheelbase / 2, hs], [-design.wheelbase / 2, -hs]]
      : [[0, hs], [0, -hs]];
    wheels.forEach(([x, y], i) => prims.push({ kind: 'wheel', name: `wheel_${i}`, radius: r, width: design.wheelWidth, position: [x, y, r], color: '#8c8c92' }));
    if (design.lidar) prims.push({ kind: 'sensor', name: 'lidar', size: [0.07, 0.07, 0.04], position: [L / 2 - 0.1, 0, gc + H + 0.05], color: '#b3171b' });
    if (design.camera) prims.push({ kind: 'sensor', name: 'camera', size: [0.03, 0.12, 0.03], position: [L / 2 - 0.02, 0, gc + H * 0.7], color: '#b3171b' });
    return prims; // positions are ground-frame (base_footprint); base_link is r above the ground
  }

  const api = { emptyState, autoScale, addMesh, removeMesh, exportUrdf, exportXacro, exportJson, importJson, designToPrimitives, deg, rad, r4, PALETTE, slug };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TESR_MODEL = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
