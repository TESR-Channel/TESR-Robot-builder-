# Product catalog — ราคาและลิงก์ TESR Shop (ทีมช่วยกันเติม)

ชั้นข้อมูล **การขาย** ของ TESR Robot Builder: SKU · ราคา · สต๊อก · ลิงก์ tesrshop.com
เชื่อมกับข้อมูล **วิศวกรรม** ใน `registry/` ด้วยคอลัมน์ `hardware_ref` (= id ของไฟล์ใน `registry/hardware/**`)

Engine อ่านอย่างเดียว ไม่แก้ไฟล์นี้ — แหล่งจริงคือ **Google Sheet** ที่ทีมแก้ร่วมกัน (หรือ `catalog/products.csv` ใน repo)

## เริ่มใช้ Google Sheet ใน 3 ขั้น

1. สร้าง Google Sheet ใหม่ → **File → Import → Upload** `catalog/products.csv` (Replace spreadsheet) — ได้หัวตาราง + 24 แถวจาก registry ที่รอเติม `sku / price_thb / stock_status / shop_url / image_url`
2. **Share → Anyone with the link → Viewer** (ไม่ต้อง Publish to web)
3. ใช้ลิงก์ชีตได้ทั้ง 3 ทาง
   - หน้าเว็บ: วางลิงก์ในช่อง "แคตตาล็อกสินค้า" → **โหลด** (หรือเปิด `index.html?catalog=<sheet id>`)
   - CLI: `tesr-rb bom robot.yaml --catalog "<sheet url>"` หรือ `export TESR_RB_CATALOG="<sheet url>"`
   - Sync กลับ repo: ดาวน์โหลดเป็น CSV ทับ `catalog/products.csv` แล้ว `tesr-rb export-web` (อัปเดต `docs/data/products.csv` ให้ GitHub Pages)

## คอลัมน์ (ห้ามเปลี่ยนชื่อหัวตาราง — ทั้ง CLI และเว็บอ่านตามชื่อนี้)

| คอลัมน์ | กรอกอย่างไร | ใช้ทำอะไร |
|---|---|---|
| `sku` | รหัสสินค้าใน TESR Shop (ไม่ซ้ำ) | อ้างอิงใบเสนอราคา / BOM |
| `hardware_ref` | id ใน registry เช่น `slamtec_p3`, `rpi5` — ว่างได้สำหรับอุปกรณ์เสริมที่ไม่มีข้อมูลวิศวกรรม (สาย, ขายึด) | จับคู่กับ Robot Definition → BOM และปุ่ม "ซื้อ" ในหน้าเว็บ |
| `category` | หมวดเดียวกับ registry (`compute`, `lidar`, `depth_camera`, `imu`, `motor`, `motor_driver`, `encoder`, `battery`, `power_supply`, `estop`, `wheel`, …) หรือ `accessory` | จัดกลุ่ม |
| `name_th` / `name_en` | ชื่อแสดงผล (เว็บใช้ `name_en` ก่อน ถ้าว่างใช้ `name_th`) | แสดงผล |
| `brand` | ยี่ห้อ | แสดงผล |
| `price_thb` | ราคาบาท ตัวเลขล้วน (เช่น `12900` — มีจุลภาคก็อ่านได้) | รวมราคา BOM |
| `unit` | `piece` / `set` / `meter` | BOM |
| `stock_status` | `in_stock` · `preorder` · `out_of_stock` · `discontinued` (ว่าง = ไม่ระบุ) | เรียงลำดับสินค้าที่แนะนำ (in_stock มาก่อน) |
| `lead_time_days` | จำนวนวัน (ตัวเลข) | แสดงผล |
| `shop_url` | ลิงก์หน้าสินค้าใน tesrshop.com | ปุ่ม "🛒 ซื้อ" |
| `image_url` | ลิงก์รูปสินค้า | UI (Phase 2) |
| `datasheet_url` | ลิงก์ datasheet | ตรวจสเปก / อัปเดต registry |
| `spec_summary` | สรุปสเปกสั้น ๆ 1 บรรทัด | แสดงผล |
| `compatible_with` | id ที่ใช้ร่วมกันได้ คั่นด้วยจุลภาค เช่น `rpi5,x86_pc` | rules (Phase 1) |
| `recommended_for` | `amr,agv,service` หรือ `differential,mecanum` | recommendation (Phase 3) |
| `notes` | หมายเหตุภายใน | — |
| `updated` | วันที่แก้ล่าสุด `YYYY-MM-DD` | — |

กติกา: สินค้าหนึ่ง `hardware_ref` มีได้หลายแถว (หลายรุ่น/ผู้ขาย) — engine เลือกแถว `in_stock` ที่มีราคาต่ำสุดให้ BOM
ถ้าสินค้ายังไม่มีใน `registry/hardware/` ให้เพิ่มไฟล์ YAML ก่อน (ข้อมูลวิศวกรรม) แล้วจึงอ้าง `hardware_ref` — `tesr-rb bom` และหน้าเว็บจะบอกเองว่าชิ้นไหน "ไม่มีในแคตตาล็อก" / "ยังไม่มีราคา"

ทดสอบ: `pytest tests/test_catalog.py` ตรวจว่าทุก id ใน registry มีแถวใน `catalog/products.csv`
