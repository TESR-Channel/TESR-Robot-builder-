# ADR-0001 — Robot Definition is the single source of truth

**Status:** accepted · 2026-09-12

## Context
TESR Robot Builder must produce URDF, ros2_control, Nav2, simulation, Docker, Node-RED and
Studio Pro artefacts for the same robot. If each artefact were edited or generated independently,
a change to the robot width would have to be repeated in six places and would drift.
An LLM generating ROS files directly cannot be version-controlled or safety-audited.

## Decision
* One structured document, `*.robot.yaml` (schema v1, `src/tesr_robot_builder/schema/definition.py`),
  holds every design fact. The UI and the AI assistant may only modify this document.
* `auto` values are resolved by code (`resolve.py`, calculators, registry profiles); the resolved
  numbers plus the versions used are written to `robot.lock.yaml` so a build is reproducible.
* The schema is strict (`extra="forbid"`), units are SI and radians, and the JSON Schema is exported
  for editors and the web UI.
* AI proposals arrive as JSON Patch against this document (Phase 3); they pass schema validation and
  rules before a human confirms them.

## Consequences
* Adding an output format never touches the definition — it adds a generator.
* Every generated file references the definition (`name@digest`) in its header.
* Breaking schema changes bump `schema_version`; migrations live in `schema/migrations/` (Phase 1+).
