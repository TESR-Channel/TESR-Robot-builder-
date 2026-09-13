# TESR Robot Builder

**Robot Definition → Validation → deterministic ROS 2 workspace.**
A robot-engineering configurator by [TESR Co., Ltd.](https://tesrshop.com): describe a mobile robot once
(`*.robot.yaml`), validate it against engineering rules, and generate a ROS 2 Jazzy workspace
(URDF/Xacro, ros2_control, Nav2, simulation, Docker, Node-RED, TESR Studio Pro blocks) from tested templates.

The AI assistant (Phase 3) recommends and fills the definition — it never writes ROS files.
See [`docs/architecture-roadmap.md`](docs/architecture-roadmap.md) for the full architecture and the 5-phase roadmap.

```
Form / NL requirement ─▶ robot.yaml ─▶ resolve (auto → numbers) ─▶ rules (PASS/WARN/ERROR) ─▶ generators ─▶ ROS 2 ws
                              ▲                    │
                         registry (hardware · drivers · profiles)      robot.lock.yaml · .tesr/manifest.json
```

## Status — Phase 0 (Foundation)

| Done | Item |
|---|---|
| ✅ | Robot Definition v1 schema (Pydantic v2 + JSON Schema export) |
| ✅ | Registry as data: hardware records, driver manifests, drive/nav profiles |
| ✅ | Resolver: every `auto` → concrete value, recorded in `robot.lock.yaml` |
| ✅ | Validation engine with 15 built-in rules (hardware, TF, mechanical, navigation, safety, power) |
| ✅ | Generators: `<prefix>_description` (URDF/Xacro, display launch, RViz) and `<prefix>_bringup` (robot.launch.py, capabilities.json) |
| ✅ | Regenerate-safe writes: generated-file headers, hash manifest, `overrides/` deep-merge |
| ✅ | CLI `tesr-rb` · tests (schema, calc, rules, xacro expansion, determinism) · CI with `colcon build` in `ros:jazzy` |
| ✅ | **Web app** (`docs/index.html`, GitHub Pages) — requirement → drivetrain/power/Nav2 sizing → part recommendations with TESR Shop links → `robot.yaml` + BOM, no install needed |
| ✅ | **Product catalog** (`catalog/products.csv` or a shared Google Sheet) joined to the registry by `hardware_ref`; `tesr-rb bom` prices any definition |
| ⏳ Phase 1 | ros2_control, sensor drivers, EKF, SLAM Toolbox, AMCL, Nav2 auto-sizing, Gazebo Harmonic, Docker; validate/generate in the browser (Pyodide) |

## Web app (no install)

Open the GitHub Pages site (Settings → Pages → branch `main`, folder `/docs`) or run it locally:

```bash
python3 -m http.server -d docs 8080     # then http://localhost:8080
```

Four steps, each with output you can use immediately: sizing numbers → recommended motors/batteries with
🛒 TESR Shop links → compatibility + Nav2 sizing → `robot.yaml` (for `tesr-rb generate`) and a BOM CSV.
Paste the team's Google Sheet link in the catalog box (or `index.html?catalog=<sheet id>`) to get live prices;
see [`catalog/README.md`](catalog/README.md).

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

tesr-rb validate examples/warehouse_amr_300.robot.yaml
tesr-rb generate examples/ironx_gen2.robot.yaml -o out/ironx_ws
tesr-rb resolve  examples/mecanum_demo.robot.yaml        # every resolved value
tesr-rb schema   -o robot-definition.schema.json          # JSON Schema for editors / web UI
tesr-rb registry                                          # loaded hardware + drivers
tesr-rb bom      examples/warehouse_amr_300.robot.yaml -o bom.csv   # BOM with TESR Shop prices/links
tesr-rb export-web                                        # refresh docs/data for the web app
```

On a machine with ROS 2 Jazzy (or in the `ros:jazzy` container):

```bash
cd out/ironx_ws
rosdep install --from-paths src -y --ignore-src
colcon build --symlink-install
source install/setup.bash
ros2 launch ironx_description display.launch.py         # model + TF in RViz2
ros2 launch ironx_bringup robot.launch.py                # robot_state_publisher + joint states
```

## Repository layout

```
src/tesr_robot_builder/
  schema/      Robot Definition v1 (Pydantic models, JSON Schema, loader)
  registry/    loader for hardware / driver / profile YAML
  calc/        deterministic calculators (geometry now; drivetrain, power, stability in Phase 1)
  resolve.py   auto → resolved values (+ lock file content)
  rules/       validation engine + built-in rules (add a rule = add a function)
  generators/  template plugins (Jinja2) — description, bringup; pipeline with overrides + manifest
  catalog.py   product catalog (CSV / Google Sheet) + bill of materials
  web_export.py  registry.json / products.csv for the web app
  cli.py       tesr-rb
registry/      hardware records, driver manifests, drive/nav profiles (data — becomes its own repo later)
catalog/       products.csv — SKU, price, tesrshop link per hardware_ref (team-edited; see catalog/README.md)
docs/          index.html + app.js (web app, GitHub Pages) · data/ · architecture-roadmap.md · adr/
examples/      ironx_gen2 · mecanum_demo · warehouse_amr_300
tests/         unit + xacro expansion + determinism
.github/       CI: pytest + colcon build of every example in ros:jazzy
```

## Conventions

* Units: metres, kilograms, seconds, **radians** (a `rpy` value above 2π is rejected as "looks like degrees").
* `base_footprint` is on the ground under the robot centre; `base_link` sits at axle height. Hardware poses are relative to their `parent` frame (default `base_link`).
* Generated files carry a `GENERATED …` header and are tracked in `.tesr/manifest.json`; hand edits are detected and refused (`--force` to override). Put lasting changes in `overrides/<same relative path>` next to the definition — they are deep-merged at generate time.
* Registry records with `verified: false` still need datasheet confirmation. Never add a part by hand-editing generated files.

## Adding things

| Want to… | Do |
|---|---|
| add a hardware part | `registry/hardware/<category>/<id>.yaml` (+ `registry/drivers/<id>/jazzy/manifest.yaml` for sensors/drivers), then `tesr-rb export-web` |
| add a product / price / shop link | one row in the catalog sheet (`hardware_ref` = registry id) |
| add a validation rule | a function in `src/tesr_robot_builder/rules/builtin.py` decorated with `@register(id, category, description)` |
| add a generator | a class in `src/tesr_robot_builder/generators/` with `render(ctx)` + templates under `generators/templates/<id>/`, registered in `pipeline.py` |
| change defaults for a drive type / nav profile | `registry/profiles/drive/*.yaml`, `registry/profiles/nav/*.yaml` |

## Development

```bash
pytest -q                                    # unit + generation tests (xacro expansion included)
tesr-rb generate examples/*.robot.yaml ...   # regenerate; CI builds all three in ros:jazzy
```

License: to be decided (see ADR-0003 and the open questions in `docs/architecture-roadmap.md`).
