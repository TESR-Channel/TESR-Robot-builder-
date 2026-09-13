from pathlib import Path

import pytest

from tesr_robot_builder.calc.drivetrain import motor_fits, size_drivetrain
from tesr_robot_builder.calc.power import battery_fits, size_battery
from tesr_robot_builder.catalog import COLUMNS, Catalog, CatalogError, bill_of_materials, bom_csv, sheet_csv_url
from tesr_robot_builder.resolve import resolve
from tesr_robot_builder.web_export import export_web_data
from tests.conftest import ROOT

HEADER = ",".join(COLUMNS)


def test_repo_catalog_covers_every_registry_part(registry):
    cat = Catalog.load(ROOT / "catalog" / "products.csv")
    assert not cat.problems
    assert set(cat.by_ref) == set(registry.hardware)  # one row per registry part, ready for prices/links


def test_catalog_parse_prices_and_ranking():
    text = HEADER + "\n" + \
        "A,slamtec_p3,lidar,,P3 out,Slamtec,\"11,000\",piece,out_of_stock,,,,,,,,,\n" + \
        "B,slamtec_p3,lidar,,P3 in,Slamtec,12900,piece,in_stock,3,https://tesrshop.com/p/b,,,,,,,\n" + \
        "C,unknown_part,accessory,,Cable,,150,piece,in_stock,,,,,,,,,\n"
    cat = Catalog.parse(text)
    best = cat.for_hardware("slamtec_p3")
    assert [p.sku for p in best] == ["B", "A"] and best[0].price_thb == 12900 and best[0].lead_time_days == 3
    assert cat.for_hardware("nothing") == []


def test_catalog_missing_column_is_error():
    with pytest.raises(CatalogError, match="missing columns"):
        Catalog.parse("sku,name_en\nA,B\n")


def test_sheet_url_forms():
    assert sheet_csv_url("1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg").endswith("gviz/tq?tqx=out:csv")
    assert "gid=42" in sheet_csv_url("https://docs.google.com/spreadsheets/d/1AbC_def-123/edit#gid=42")


def test_bom_quantities_and_csv(registry, warehouse):
    cat = Catalog.parse(HEADER + "\n" + "M1,tesr_bldc_400w,motor,,BLDC 400W,TESR,8500,piece,in_stock,,https://tesrshop.com/p/m1,,,,,,,\n")
    lines = bill_of_materials(resolve(warehouse, registry), registry, cat)
    by = {l.hw_id: l for l in lines}
    assert by["tesr_bldc_400w"].qty == 2 and by["tesr_bldc_400w"].line_total == 17000
    assert by["tesr_md400"].qty == 1 and by["dcdc_48_5"].qty == 1 and by["rpi5"].role == "compute"
    text = bom_csv(lines)
    assert text.splitlines()[0].startswith("hw_id,category") and "17000.00" in text and "not_in_catalog" in text


def test_drivetrain_and_power_fit_helpers():
    res = size_drivetrain(353.4, 1.0, 0.5, 0.16, 2, gear_ratio=20, slope_deg=5)
    assert res.force_peak_n > res.force_cont_n > 0 and res.motor_rpm == pytest.approx(2387.3, abs=0.1)
    assert motor_fits(1.3, 3.9, 3000, res)  # the 400 W BLDC placeholder
    assert not motor_fits(0.05, 0.1, 3000, res)
    pw = size_battery(res.power_mech_cont_w, res.power_elec_peak_w, 8, 48, electronics_w=16)
    assert pw.capacity_ah > 0 and battery_fits(51.2, 40, 60, 48, pw) and not battery_fits(24, 40, 60, 48, pw)


def test_export_web_writes_registry_json(registry, tmp_path):
    cat = Catalog.load(ROOT / "catalog" / "products.csv")
    written = export_web_data(registry, cat, tmp_path)
    assert {p.name for p in written} == {"registry.json", "products.csv"}
    import json
    data = json.loads((tmp_path / "registry.json").read_text())
    assert len(data["hardware"]) == len(registry.hardware) and "drive_profiles" in data
    assert any(h.get("motor") for h in data["hardware"])  # category extras survive the export
