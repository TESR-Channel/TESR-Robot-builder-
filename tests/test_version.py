"""One version number for the whole project: engine, package metadata and the website (docs/version.js)."""
import re
from pathlib import Path

from tesr_robot_builder import __version__

ROOT = Path(__file__).resolve().parents[1]


def test_web_version_matches_engine():
    js = (ROOT / "docs" / "version.js").read_text(encoding="utf-8")
    assert re.search(r"version:\s*'([^']+)'", js).group(1) == __version__
    first = re.search(r"releases:\s*\[\s*\['([^']+)',\s*'([^']+)'", js)
    assert first.group(1) == __version__, "newest entry in releases must be the current version"
    assert first.group(2) == re.search(r"date:\s*'([^']+)'", js).group(1)


def test_pyproject_version_matches_engine():
    toml = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert re.search(r'^version\s*=\s*"([^"]+)"', toml, re.M).group(1) == __version__


def test_every_page_shows_the_version():
    for page in ["index.html", "play.html", "summary.html", "build.html", "arena.html", "guide.html", "form.html", "model.html"]:
        html = (ROOT / "docs" / page).read_text(encoding="utf-8")
        assert html.index("version.js") < html.index("nav.js"), page
