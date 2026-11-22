// Node helper for tests/test_garage.py: build every Garage blueprint and print the generated files as JSON.
const fs = require('fs'), path = require('path');
const G = require(path.join(__dirname, '..', 'docs', 'garage-core.js'));
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'data', 'registry.json'), 'utf8'));
const out = {};
for (const key of Object.keys(G.BLUEPRINTS)) {
  const s = G.applyBlueprint(key, reg);
  if (key === 'amr_300') s.parts.push({ uid: 'p1', kind: 'box', size: [0.3, 0.2, 0.05], color: '#C9A84C', mass: 1, pos: [0, 0, 0.3], yaw: 0 });
  const dv = G.derive(s, reg, []);
  out[key] = { files: G.rosPackage(s, reg, dv), rank: dv.rank, errors: dv.warnings.filter((w) => w.lvl === 'err').length, sensors: dv.sensors.map((x) => x.id), coverage: dv.coverage,
    frames: G.frames(s, reg, dv).filter((f) => f.kind !== 'part') };
}
// component checklist: a customer-supplied IMU + battery, and a robot whose IMU was removed
{
  const s = G.applyBlueprint('service_60', reg);
  s.own = { imu: true, battery: true }; s.ownNote = { imu: 'Xsens MTi-3' };
  const dv = G.derive(s, reg, []);
  out.checklist_own = { yaml: G.toYaml(s, reg, dv), complete: dv.complete, own: dv.bom.own, status: Object.fromEntries(dv.checklist.map((c) => [c.id, c.status])) };
  const s2 = G.applyBlueprint('service_60', reg); s2.sensors = s2.sensors.filter((x) => x.category !== 'imu');
  const dv2 = G.derive(s2, reg, []);
  out.checklist_missing = { yaml: G.toYaml(s2, reg, dv2), complete: dv2.complete, missing: dv2.missingComps.map((c) => c.id) };
  G.addComponent(s2, reg, 'imu');
  out.checklist_fixed = { complete: G.derive(s2, reg, []).complete };
}
process.stdout.write(JSON.stringify(out));
