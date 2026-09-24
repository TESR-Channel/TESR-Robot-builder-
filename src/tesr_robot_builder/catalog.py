"""Product catalog — the commercial layer (SKU, price, tesrshop link) that joins the registry by ``hardware_ref``.

Source of truth is a spreadsheet the team edits together (Google Sheet or ``catalog/products.csv``);
the engine only *reads* it. Column names are fixed (see ``catalog/README.md``):

    sku, hardware_ref, category, name_th, name_en, brand, price_thb, unit, stock_status,
    lead_time_days, shop_url, image_url, datasheet_url, spec_summary, compatible_with,
    recommended_for, notes, updated

``TESR_RB_CATALOG`` may point to a local CSV, an https CSV URL, or a Google Sheet id / URL
(read through the gviz CSV export — the sheet must be shared "anyone with the link can view").
"""
from __future__ import annotations

import csv
import io
import os
import re
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from .resolve import ResolvedRobot

COLUMNS = [
    "sku", "hardware_ref", "category", "name_th", "name_en", "brand", "price_thb", "unit", "stock_status",
    "lead_time_days", "shop_url", "image_url", "datasheet_url", "spec_summary", "compatible_with",
    "recommended_for", "notes", "updated",
]
STOCK_STATUSES = {"in_stock", "preorder", "out_of_stock", "discontinued", ""}

# Presentation order + Thai labels for catalog / BOM grouping (used by the CLI, the checklist and the web app)
CATEGORY_LABELS = [
    ("wheel", "ล้อ"), ("motor", "มอเตอร์"), ("motor_driver", "Low-level control (มอเตอร์ไดรเวอร์)"), ("encoder", "เอ็นโค้ดเดอร์"),
    ("compute", "คอมพิวเตอร์"), ("lidar", "LiDAR"), ("depth_camera", "กล้อง depth"), ("rgb_camera", "กล้อง"), ("imu", "IMU"),
    ("battery", "แบตเตอรี่"), ("power_supply", "แหล่งจ่ายไฟ / DC-DC"), ("estop", "ความปลอดภัย (E-stop)"), ("safety_lidar", "Safety LiDAR"),
    ("gnss", "GNSS"), ("ultrasonic", "อัลตราโซนิก"), ("bumper", "บัมเปอร์"), ("comm", "สื่อสาร"), ("digital_io", "Digital I/O"),
    ("arm", "แขนกล"), ("lift", "ลิฟต์"), ("gearbox", "เกียร์บ็อกซ์"), ("accessory", "อุปกรณ์เสริม"),
]
CATEGORY_ORDER = {k: i for i, (k, _) in enumerate(CATEGORY_LABELS)}
CATEGORY_TH = dict(CATEGORY_LABELS)


@dataclass
class Product:
    sku: str
    hardware_ref: str
    category: str
    name_th: str
    name_en: str
    brand: str
    price_thb: float | None
    unit: str
    stock_status: str
    lead_time_days: int | None
    shop_url: str
    image_url: str
    datasheet_url: str
    spec_summary: str
    compatible_with: list[str]
    recommended_for: list[str]
    notes: str
    updated: str

    @property
    def name(self) -> str:
        return self.name_en or self.name_th or self.sku


def _num(s: str):
    s = (s or "").replace(",", "").strip()
    if not s:
        return None
    return float(s)


def _int(s: str):
    v = _num(s)
    return int(v) if v is not None else None


def _list(s: str) -> list[str]:
    return [x.strip() for x in (s or "").split(",") if x.strip()]


def sheet_csv_url(ref: str) -> str:
    """Google Sheet id or URL → gviz CSV export URL (first sheet unless #gid given)."""
    m = re.search(r"/spreadsheets/d/([A-Za-z0-9_-]+)", ref)
    sheet_id = m.group(1) if m else ref
    gid = re.search(r"[#&?]gid=(\d+)", ref)
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv"
    return url + (f"&gid={gid.group(1)}" if gid else "")


class CatalogError(Exception):
    pass


@dataclass
class Catalog:
    source: str
    products: list[Product] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)

    @property
    def by_ref(self) -> dict[str, list[Product]]:
        out: dict[str, list[Product]] = {}
        for p in self.products:
            if p.hardware_ref:
                out.setdefault(p.hardware_ref, []).append(p)
        return out

    def for_hardware(self, hw_id: str) -> list[Product]:
        """Products for a registry id, in-stock and priced first."""
        rank = {"in_stock": 0, "preorder": 1, "": 2, "out_of_stock": 3, "discontinued": 4}
        return sorted(self.by_ref.get(hw_id, []), key=lambda p: (rank.get(p.stock_status, 2), p.price_thb is None, p.price_thb or 0))

    @classmethod
    def parse(cls, text: str, source: str = "<text>") -> "Catalog":
        rows = list(csv.DictReader(io.StringIO(text)))
        cat = cls(source=source)
        if rows:
            missing = [c for c in COLUMNS if c not in rows[0]]
            if missing:
                raise CatalogError(f"{source}: missing columns {missing}")
        for i, row in enumerate(rows, start=2):
            if not any((row.get(c) or "").strip() for c in ("sku", "hardware_ref", "name_en", "name_th")):
                continue  # blank line
            try:
                p = Product(
                    sku=(row.get("sku") or "").strip(), hardware_ref=(row.get("hardware_ref") or "").strip(),
                    category=(row.get("category") or "").strip(), name_th=(row.get("name_th") or "").strip(),
                    name_en=(row.get("name_en") or "").strip(), brand=(row.get("brand") or "").strip(),
                    price_thb=_num(row.get("price_thb")), unit=(row.get("unit") or "piece").strip(),
                    stock_status=(row.get("stock_status") or "").strip(), lead_time_days=_int(row.get("lead_time_days")),
                    shop_url=(row.get("shop_url") or "").strip(), image_url=(row.get("image_url") or "").strip(),
                    datasheet_url=(row.get("datasheet_url") or "").strip(), spec_summary=(row.get("spec_summary") or "").strip(),
                    compatible_with=_list(row.get("compatible_with")), recommended_for=_list(row.get("recommended_for")),
                    notes=(row.get("notes") or "").strip(), updated=(row.get("updated") or "").strip(),
                )
            except ValueError as exc:
                cat.problems.append(f"row {i}: {exc}")
                continue
            if p.stock_status not in STOCK_STATUSES:
                cat.problems.append(f"row {i} ({p.sku or p.hardware_ref}): unknown stock_status '{p.stock_status}'")
            cat.products.append(p)
        return cat

    @classmethod
    def load(cls, ref: str | Path | None = None) -> "Catalog":
        ref = str(ref or os.environ.get("TESR_RB_CATALOG") or default_catalog_path())
        if ref.startswith("http://") or ref.startswith("https://"):
            url = sheet_csv_url(ref) if "docs.google.com/spreadsheets" in ref else ref
            with urllib.request.urlopen(url, timeout=20) as resp:  # noqa: S310 (user-supplied URL)
                return cls.parse(resp.read().decode("utf-8-sig"), source=url)
        path = Path(ref)
        if path.is_file():
            return cls.parse(path.read_text(encoding="utf-8-sig"), source=str(path))
        if re.fullmatch(r"[A-Za-z0-9_-]{20,}", ref):  # bare Google Sheet id
            url = sheet_csv_url(ref)
            with urllib.request.urlopen(url, timeout=20) as resp:  # noqa: S310
                return cls.parse(resp.read().decode("utf-8-sig"), source=url)
        raise CatalogError(f"catalog not found: {ref}")


def default_catalog_path() -> Path:
    cwd = Path.cwd() / "catalog" / "products.csv"
    if cwd.is_file():
        return cwd
    return Path(__file__).resolve().parents[2] / "catalog" / "products.csv"


# ------------------------------------------------------------------------- BOM
@dataclass
class BomLine:
    hw_id: str
    category: str
    name: str
    qty: int
    product: Product | None
    role: str

    @property
    def unit_price(self) -> float | None:
        return self.product.price_thb if self.product else None

    @property
    def line_total(self) -> float | None:
        return None if self.unit_price is None else self.unit_price * self.qty


def bill_of_materials(resolved: ResolvedRobot, registry, catalog: Catalog | None) -> list[BomLine]:
    """Every registry part the definition references, with quantities and the best catalog match."""
    d = resolved.definition
    qty: dict[str, int] = {}
    role: dict[str, str] = {}

    def add(hw_id: str, n: int, what: str) -> None:
        qty[hw_id] = qty.get(hw_id, 0) + n
        role.setdefault(hw_id, what)

    add(d.target.compute, 1, "compute")
    add(d.drive.motor.hw, d.drive.motor.count, "motor")
    wheel = wheel_for(registry, d.drive.type, d.drive.wheels.diameter_m)
    if wheel is not None:
        per_set = int((wheel.model_dump().get("wheel") or {}).get("per_set") or 1)
        add(wheel.id, max(1, -(-d.drive.motor.count // per_set)), "wheel")
    for h in d.hardware:
        add(h.hw, 1, h.id)
    if d.drive.motor.driver not in qty:
        add(d.drive.motor.driver, 1, "motor driver")
    add(d.power.battery.hw, d.power.battery.series * d.power.battery.parallel, "battery")
    for r in d.power.rails:
        if r.hw:
            add(r.hw, 1, f"{r.v:g} V rail")
    lines = []
    for hw_id, n in qty.items():
        rec = registry.hw(hw_id)
        products = catalog.for_hardware(hw_id) if catalog else []
        lines.append(BomLine(
            hw_id=hw_id, category=rec.category if rec else "?", name=rec.name if rec else hw_id, qty=n,
            product=products[0] if products else None, role=role[hw_id],
        ))
    return sorted(lines, key=lambda l: (CATEGORY_ORDER.get(l.category, 99), l.hw_id))


def wheel_for(registry, drive_type: str, diameter_m: float):
    """Registry wheel of the right type (mecanum / standard) closest to the requested diameter (±15 %)."""
    want = "mecanum" if drive_type == "mecanum" else "standard"
    best, best_err = None, None
    for rec in registry.by_category("wheel"):
        w = rec.model_dump().get("wheel") or {}
        if w.get("type") != want or not w.get("diameter_m"):
            continue
        err = abs(w["diameter_m"] - diameter_m) / diameter_m
        if err <= 0.15 and (best_err is None or err < best_err):
            best, best_err = rec, err
    return best


def bom_csv(lines: list[BomLine]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["hw_id", "category", "name", "qty", "role", "sku", "unit_price_thb", "line_total_thb", "stock_status", "shop_url"])
    for l in lines:
        p = l.product
        w.writerow([
            l.hw_id, l.category, l.name, l.qty, l.role,
            p.sku if p else "", "" if l.unit_price is None else f"{l.unit_price:.2f}",
            "" if l.line_total is None else f"{l.line_total:.2f}",
            p.stock_status if p else "not_in_catalog", p.shop_url if p else "",
        ])
    total = sum(l.line_total for l in lines if l.line_total is not None)
    missing = sum(1 for l in lines if l.product is None)
    w.writerow(["TOTAL", "", f"{missing} part(s) without catalog entry", "", "", "", "", f"{total:.2f}", "", ""])
    return buf.getvalue()


def todo_markdown(catalog: "Catalog", registry) -> str:
    """Checklist for the sales/back-office team, grouped by category: every part that still lacks a price or a shop link."""
    groups: dict[str, list] = {}
    total = 0
    for rec in sorted(registry.hardware.values(), key=lambda r: (CATEGORY_ORDER.get(r.category, 99), r.id)):
        prods = catalog.for_hardware(rec.id)
        p = prods[0] if prods else None
        missing = []
        if p is None:
            missing.append("แถวในชีต")
        else:
            if not p.sku: missing.append("sku")
            if p.price_thb is None: missing.append("price_thb")
            if not p.shop_url: missing.append("shop_url")
            if not p.stock_status: missing.append("stock_status")
        if missing:
            total += 1
            groups.setdefault(rec.category, []).append((rec.id, rec.name, (p.spec_summary if p else ""), ", ".join(missing)))
    lines = [
        "# รายการสินค้าที่ทีมหลังบ้านต้องเติมข้อมูล (auto-generated: `tesr-rb catalog-todo`)",
        "",
        "เติมในชีต **TESR Robot Builder — Product Catalog** (นำเข้าจาก `catalog/products.csv`) คอลัมน์ `sku`, `price_thb` (ตัวเลข), `shop_url` (ลิงก์ tesrshop.com), `stock_status` (`in_stock`/`preorder`/`out_of_stock`)",
        "แถวหนึ่ง = สินค้าหนึ่งรายการ ใช้ `hardware_ref` ตามตารางนี้ (ห้ามเปลี่ยน) — เว็บและ BOM จะขึ้นราคาและปุ่มสั่งซื้อทันทีที่บันทึก",
        "",
        f"ยังขาดข้อมูล {total} จาก {len(registry.hardware)} รายการ",
    ]
    n = 0
    for cat, items in groups.items():
        lines += ["", f"## {CATEGORY_TH.get(cat, cat)} (`{cat}`)", "", "| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |", "|---|---|---|---|---|"]
        for hw, name, spec, miss in items:
            n += 1
            lines.append(f"| {n} | `{hw}` | {name} | {spec} | {miss} |")
    lines += ["", "หมายเหตุ: สินค้าที่ยังไม่มีใน `registry/hardware/` (สเปกวิศวกรรม) ให้แจ้งทีมวิศวกรรมเพิ่มไฟล์ YAML ก่อน แล้วค่อยเติมราคาที่นี่", ""]
    return "\n".join(lines)
