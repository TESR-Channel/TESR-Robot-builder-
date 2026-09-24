// Node helper for tests/test_garage.py: build every Garage blueprint and print the generated files as JSON.
const fs = require('fs'), path = require('path');
const G = require(path.join(__dirname, '..', 'docs', 'garage-core.js'));
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'data', 'registry.json'), 'utf8'));
const out = {};
for (const key of Object.keys(G.BLUEPRINTS)) {
  const s = G.applyBlueprint(key, reg);
  if (key === 'amr_300') s.parts.push({ uid: 'p1', kind: 'box', size: [0.3, 0.2, 0.05], color: '#C9A84C', mass: 1, pos: [0, 0, 0.3], yaw: 0 });
  const dv = G.derive(s, reg, []);
  out[key] = { files: G.rosPackage(s, reg, dv), rank: dv.rank, errors: dv.warnings.filter((w) => w.lvl === 'err').length, sensors: dv.sensors.map((x) => x.id), coverage: dv.coverage };
}
process.stdout.write(JSON.stringify(out));
