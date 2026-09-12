# ADR-0002 — Deterministic template generation, regenerate-safe workspace

**Status:** accepted · 2026-09-12

## Context
Generated ROS workspaces must be rebuilt whenever the definition, the registry or the templates change,
without destroying work the engineer did on top of them, and identical inputs must give identical output
so the result can be snapshot-tested and audited.

## Decision
* Generators are plugins (`generators/<id>.py` + Jinja2 templates under `generators/templates/<id>/`)
  that read only the resolved robot and return files. No timestamps, no randomness → byte-identical output.
* Every generated text file starts with a `GENERATED … do not edit` header naming the definition digest
  and registry hash. `.tesr/manifest.json` stores a SHA-256 per generated file.
* On regeneration, a generated file whose hash differs from the manifest was edited by hand: the run is
  refused (`--force` overrides). Files the pipeline no longer produces are removed; anything not in the
  manifest (`custom/`, user packages) is never touched.
* Lasting changes go in `overrides/<same relative path>` next to the definition; YAML overrides are
  deep-merged at generate time so the final file is always complete.
* CI proves the contract: unit + xacro expansion tests, and `colcon build` of every example in `ros:jazzy`.

## Consequences
* Templates are the product — they are reviewed and tested like code.
* Generated source is never the master copy; bug fixes go into templates and are re-rolled everywhere.
