# CI workflow — move to .github/workflows/ci.yml

The token used to push this repository lacks the `workflow` scope, so GitHub refused to write
`.github/workflows/ci.yml` directly. Install it with:

```bash
mkdir -p .github/workflows
git mv docs/ci/ci.yml .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions (pytest + colcon build in ros:jazzy)"
git push
```

Jobs:

| Job | Runs | Proves |
|---|---|---|
| `python` | `pip install -e .[dev]` · `pytest -q` (incl. Node cross-check of `docs/app.js`) · `tesr-rb validate` on every example · `tesr-rb export-web` must leave `docs/data` unchanged | schema, calculators, rules, generators, xacro expansion, determinism, web ↔ engine parity |
| `colcon` (container `ros:jazzy`) | generate a workspace from every example → `rosdep install` → `colcon build` → `xacro` + `check_urdf` | **Phase 0 exit gate**: generated packages build on real ROS 2 Jazzy |
