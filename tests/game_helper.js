// Node check of the Garage mission-mode geometry (no browser, no three.js): prints JSON for tests/test_game.py
global.window = {}; global.document = { getElementById: () => null }; global.localStorage = { getItem: () => null, setItem() {} };
global.location = { search: '' }; global.setTimeout = () => 0; window.addEventListener = () => {};
const { obbOverlap, rayBox, BOXES, MISSIONS, level } = require('../docs/garage-game.js');
const free = (x, y, hx, hy, yaw = 0) => !BOXES.some((b) => obbOverlap({ cx: x, cy: y, hx, hy, c: Math.cos(yaw), s: Math.sin(yaw) }, b));
const out = { missions: MISSIONS.length, spawnFree: {}, pointsFree: true, gap: {}, rays: [rayBox(-4.5, 0, 1, 0, BOXES[4], 20), rayBox(0.8, 0, 0, -1, BOXES[8], 20)], levels: [level(0), level(120), level(480)] };
for (const [n, hx, hy] of [['small', 0.2, 0.15], ['amr300', 0.52, 0.37], ['too_wide', 0.6, 0.58]]) {
  out.spawnFree[n] = free(-4.5, 0, hx, hy);
  let ok = true; for (let x = -2.8; x <= -0.2; x += 0.05) if (!free(x, 3.35, hx, hy)) ok = false; out.gap[n] = ok;
}
for (const m of MISSIONS) for (const p of m.points || []) if (!free(p[0], p[1], 0.3, 0.3)) out.pointsFree = false;
process.stdout.write(JSON.stringify(out));
