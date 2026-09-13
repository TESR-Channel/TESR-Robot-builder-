"""Export registry + catalog as the static data files the web app (docs/index.html) loads.

    tesr-rb export-web -o docs/data

Writes ``registry.json`` (every hardware record incl. category-specific extras, driver summary,
drive/nav profiles) and copies the catalog to ``products.csv``. The web app is served by GitHub
Pages from ``docs/`` so everything it needs must live under ``docs/``.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import __version__
from .catalog import Catalog
from .registry.loader import Registry


def export_web_data(reg: Registry, catalog: Catalog | None, out_dir: Path) -> list[Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    data = {
        "generator": __version__,
        "registry_hash": reg.content_hash(),
        "hardware": [rec.model_dump(mode="json") for rec in sorted(reg.hardware.values(), key=lambda r: (r.category, r.id))],
        "drivers": [
            {"hw": m.hw, "distro": m.distro, "package": m.package, "apt": m.apt, "ros2_control_plugin": m.ros2_control_plugin}
            for (_, _), m in sorted(reg.drivers.items())
        ],
        "drive_profiles": {k: v.model_dump(mode="json") for k, v in reg.drive_profiles.items()},
        "nav_profiles": {k: v.model_dump(mode="json") for k, v in reg.nav_profiles.items()},
    }
    written = []
    p = out_dir / "registry.json"
    p.write_text(json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    written.append(p)
    if catalog is not None and Path(catalog.source).is_file():
        target = out_dir / "products.csv"
        target.write_text(Path(catalog.source).read_text(encoding="utf-8-sig"), encoding="utf-8")
        written.append(target)
    return written
