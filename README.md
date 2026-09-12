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
| ⏳ Phase 1 | ros2_control, sensor drivers, EKF, SLAM Toolbox, AMCL, Nav2 auto-sizing, Gazebo Harmonic, Docker |

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

tesr-rb validate examples/warehouse_amr_300.robot.yaml
tesr-rb generate examples/ironx_gen2.robot.yaml -o out/ironx_ws
tesr-rb resolve  examples/mecanum_demo.robot.yaml        # every resolved value
tesr-rb schema   -o robot-definition.schema.json          # JSON Schema for editors / web UI
tesr-rb registry                                          # loaded hardware + drivers
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
  cli.py       tesr-rb
registry/      hardware records, driver manifests, drive/nav profiles (data — becomes its own repo later)
examples/      ironx_gen2 · mecanum_demo · warehouse_amr_300
tests/         unit + xacro expansion + determinism
docs/          architecture-roadmap.md, adr/
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
| add a hardware part | `registry/hardware/<category>/<id>.yaml` (+ `registry/drivers/<id>/jazzy/manifest.yaml` for sensors/drivers) |
| add a validation rule | a function in `src/tesr_robot_builder/rules/builtin.py` decorated with `@register(id, category, description)` |
| add a generator | a class in `src/tesr_robot_builder/generators/` with `render(ctx)` + templates under `generators/templates/<id>/`, registered in `pipeline.py` |
| change defaults for a drive type / nav profile | `registry/profiles/drive/*.yaml`, `registry/profiles/nav/*.yaml` |

## Development

```bash
pytest -q                                    # unit + generation tests (xacro expansion included)
tesr-rb generate examples/*.robot.yaml ...   # regenerate; CI builds all three in ros:jazzy
```

License: to be decided (see ADR-0003 and the open questions in `docs/architecture-roadmap.md`).
