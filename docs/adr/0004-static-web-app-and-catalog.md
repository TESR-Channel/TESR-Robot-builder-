# ADR-0004 — Web app runs as static HTML (GitHub Pages); catalog is a team-edited sheet

**Status:** accepted · 2026-09-13 (supersedes the FastAPI + React "local-first app" of Phase 2 in `architecture-roadmap.md`)

## Context
Anon asked for three things: the builder must run in a plain web page, every module must produce
something usable on its own as soon as it exists, and the tool must sell TESR Shop parts through its
recommendations. TESR's other tools (Forge, Whisper, PDF editor, Pincer Studio) are single-page apps on
GitHub Pages — no server to operate, which matters for a team of ≤10.

## Decision
* `docs/index.html` + `docs/app.js` is the web app, served by GitHub Pages from `docs/`. No backend.
  Data it needs is exported into `docs/data/` by `tesr-rb export-web` (registry.json, products.csv).
* Calculators (drivetrain, power, Nav2 sizing, mass estimate) exist twice — Python (`calc/*.py`, used by
  the engine) and JS (`docs/app.js`) — and `tests/test_web.py` runs the JS through Node and asserts the
  numbers match the Python results. The YAML the page drafts is validated by the full Python rule set in
  the same test, for differential and mecanum. Drift between the two is therefore a failing test.
* Step outputs are deliverables in their own right: sizing tables, recommended parts with shop links,
  `robot.yaml`, BOM CSV, design JSON. `tesr-rb generate` (and later deploy/sim) stay on a machine with
  ROS; running the Python engine in the browser via Pyodide is the planned Phase 2 follow-up so that
  validate/generate also work without an install.
* The product catalog is a Google Sheet (or `catalog/products.csv`) with fixed columns, joined to the
  registry by `hardware_ref`. It is read-only for the engine and never enters generated workspaces
  (prices change → would break deterministic generation); BOM is a separate CLI command / web panel.

## Consequences
* Adding a product = one row in the sheet; adding engineering data = one YAML in the registry. Both are
  visible to the web app after `tesr-rb export-web` (registry) or immediately via the sheet URL (catalog).
* The web checks are a subset of the rules (documented on the page); `tesr-rb validate` remains the gate.
* GitHub Pages must be enabled on the repository: Settings → Pages → Deploy from branch `main`, folder `/docs`.
