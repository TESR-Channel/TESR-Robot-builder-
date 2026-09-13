// Node helper used by tests/test_web.py to exercise docs/app.js outside the browser.
//   node tests/web_helper.js calc  '<json>'   → JSON of sizeDrivetrain/sizeBattery/navSizing results
//   node tests/web_helper.js yaml  '<json>'   → robot.yaml text from buildDefinition(design)
//   node tests/web_helper.js csv   '<csv>'    → parsed catalog rows as JSON
const path = require('path');
const T = require(path.join(__dirname, '..', 'docs', 'app.js'));
const [, , mode, arg] = process.argv;
if (mode === 'calc') {
  const a = JSON.parse(arg);
  const dt = T.sizeDrivetrain(a.drivetrain);
  const pw = T.sizeBattery({ ...a.power, powerMechCont: dt.powerMechCont, powerElecPeak: dt.powerElecPeak });
  const nav = T.navSizing(a.nav);
  process.stdout.write(JSON.stringify({ dt, pw, nav, mass: T.estimateRobotMass(...a.mass) }));
} else if (mode === 'yaml') {
  process.stdout.write(T.buildDefinition(JSON.parse(arg)));
} else if (mode === 'csv') {
  process.stdout.write(JSON.stringify(T.parseCatalog(arg)));
} else {
  process.exit(2);
}
