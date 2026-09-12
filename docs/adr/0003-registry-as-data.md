# ADR-0003 — Registry as data: hardware, drivers and profiles are YAML, separate from the catalog

**Status:** accepted · 2026-09-12 (open: repository split and licence)

## Context
The core must not know "Slamtec P3" — otherwise every new part is a code change and a release.
Commercial data (price, SKU, tesrshop URL) changes at a different pace than engineering data
and must not leak into ROS generation.

## Decision
Four data sets, linked by id, validated on load (`registry/loader.py`):

| Set | Path | Owner |
|---|---|---|
| Hardware capability | `registry/hardware/<category>/<id>.yaml` | engineering |
| ROS driver manifests | `registry/drivers/<hw_id>/<distro>/manifest.yaml` (+ templates in Phase 1) | engineering |
| Drive / nav profiles | `registry/profiles/{drive,nav}/*.yaml` | engineering |
| Product catalog | `catalog/products/*.yaml` → `hardware_ref` (Phase 5, synced from TESR Shop) | sales |

Records carry `verified: false` until checked against a datasheet. Drivers are keyed by ROS distro so
Humble robots (Beary-X, Kuro-X) can be added as a profile without touching Jazzy templates.

## Consequences
* Adding a part = adding files; CI validates the schema of every record.
* The registry is embedded in this repository for Phase 0 and becomes the public `tesr-robot-registry`
  repository once the generator is proven (Phase 1 gate). Licence of the registry and of the generated
  workspace is an open question listed in `docs/architecture-roadmap.md`.
