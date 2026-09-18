# รายการสินค้าที่ทีมหลังบ้านต้องเติมข้อมูล (auto-generated: `tesr-rb catalog-todo`)

เติมในชีต **TESR Robot Builder — Product Catalog** (นำเข้าจาก `catalog/products.csv`) คอลัมน์ `sku`, `price_thb` (ตัวเลข), `shop_url` (ลิงก์ tesrshop.com), `stock_status` (`in_stock`/`preorder`/`out_of_stock`)
แถวหนึ่ง = สินค้าหนึ่งรายการ ใช้ `hardware_ref` ตามตารางนี้ (ห้ามเปลี่ยน) — เว็บและ BOM จะขึ้นราคาและปุ่มสั่งซื้อทันทีที่บันทึก

ยังขาดข้อมูล 27 จาก 27 รายการ

## ล้อ (`wheel`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 1 | `mecanum_wheel_152` | Mecanum wheel Ø152 mm (set of 4, 2 left + 2 right) | Ø152 mm x 50 mm, mecanum, load 60 kg | sku, price_thb, shop_url, stock_status |
| 2 | `pu_wheel_100` | Rubber drive wheel Ø100 mm (for small robots) | Ø100 mm x 30 mm, standard, load 15 kg | sku, price_thb, shop_url, stock_status |
| 3 | `pu_wheel_160` | PU drive wheel Ø160 mm (hub bore, keyed) | Ø160 mm x 50 mm, standard, load 200 kg | sku, price_thb, shop_url, stock_status |

## มอเตอร์ (`motor`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 4 | `generic_bldc_24v_100w` | 100 W BLDC gear motor (24 V) | 0.32 Nm rated, 3000 rpm; 24 V, 50/100 W | sku, price_thb, shop_url, stock_status |
| 5 | `generic_dc_gearmotor` | 12 V DC gear motor with encoder | 0.5 Nm rated, 200 rpm; 12 V, 10/30 W | sku, price_thb, shop_url, stock_status |
| 6 | `tesr_bldc_400w` | 400 W BLDC hub/gear motor (48 V) | 1.3 Nm rated, 3000 rpm; 48 V, 200/400 W | sku, price_thb, shop_url, stock_status |

## Low-level control (มอเตอร์ไดรเวอร์) (`motor_driver`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 7 | `generic_can_motor_driver` | Dual BLDC driver, CANopen (24 V) | 24 V, 3/10 W | sku, price_thb, shop_url, stock_status |
| 8 | `generic_serial_motor_driver` | Serial (UART) motor driver board with encoder feedback | 12 V, 1/3 W | sku, price_thb, shop_url, stock_status |
| 9 | `tesr_md400` | TESR MD-400 dual BLDC driver | 48 V, 5/20 W | sku, price_thb, shop_url, stock_status |

## เอ็นโค้ดเดอร์ (`encoder`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 10 | `tesr_md400_encoder` | Wheel encoders via MD-400 feedback |  | sku, price_thb, shop_url, stock_status |

## คอมพิวเตอร์ (`compute`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 11 | `rpi5` | Raspberry Pi 5 (8 GB) | arm64, 8 GB RAM, USB3 x2; 5 V, 8/20 W | sku, price_thb, shop_url, stock_status |
| 12 | `x86_pc` | Industrial mini PC (x86-64) | amd64, 16 GB RAM, USB3 x4; 12 V, 25/65 W | sku, price_thb, shop_url, stock_status |

## LiDAR (`lidar`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 13 | `ld19` | LDROBOT LD19 (STL-19P) | range 12 m; FOV 360°; 10 Hz; 5 V, 1/1.5 W | sku, price_thb, shop_url, stock_status |
| 14 | `rplidar_s2` | Slamtec RPLIDAR S2 | range 30 m; FOV 360°; 10 Hz; 5 V, 3/5 W | sku, price_thb, shop_url, stock_status |
| 15 | `slamtec_p3` | Slamtec P3 (2D LiDAR) | range 40 m; FOV 360°; 10 Hz; 5 V, 5/5 W | sku, price_thb, shop_url, stock_status |

## กล้อง depth (`depth_camera`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 16 | `realsense_d435i` | Intel RealSense D435i | range 3 m; FOV 87°; 30 Hz; 5 V, 2.5/4 W | sku, price_thb, shop_url, stock_status |
| 17 | `realsense_d455` | Intel RealSense D455 | range 6 m; FOV 87°; 30 Hz; 5 V, 3/5 W | sku, price_thb, shop_url, stock_status |

## IMU (`imu`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 18 | `tesr_imu` | TESR IMU module (9-axis, UART) | 100 Hz; 5 V, 0.2/0.3 W | sku, price_thb, shop_url, stock_status |

## แบตเตอรี่ (`battery`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 19 | `lifepo4_48v_40ah` | LiFePO4 48 V 40 Ah | 51.2 V 40 Ah, 60 A max | sku, price_thb, shop_url, stock_status |
| 20 | `liion_12v_20ah` | Li-ion 12 V 20 Ah pack | 11.1 V 20 Ah, 20 A max | sku, price_thb, shop_url, stock_status |
| 21 | `liion_24v_30ah` | Li-ion 24 V 30 Ah pack | 25.2 V 30 Ah, 40 A max | sku, price_thb, shop_url, stock_status |

## แหล่งจ่ายไฟ / DC-DC (`power_supply`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 22 | `dcdc_12_5` | DC-DC 12 V → 5 V 5 A | out 5 V 5 A; 12 V, 0.5/28 W | sku, price_thb, shop_url, stock_status |
| 23 | `dcdc_24_12` | DC-DC 24 V → 12 V 10 A | out 12 V 10 A; 24 V, 2/130 W | sku, price_thb, shop_url, stock_status |
| 24 | `dcdc_24_5` | DC-DC 24 V → 5 V 8 A | out 5 V 8 A; 24 V, 1/45 W | sku, price_thb, shop_url, stock_status |
| 25 | `dcdc_48_12` | DC-DC 48 V → 12 V 10 A | out 12 V 10 A; 48 V, 3/130 W | sku, price_thb, shop_url, stock_status |
| 26 | `dcdc_48_5` | DC-DC 48 V → 5 V 10 A | out 5 V 10 A; 48 V, 2/55 W | sku, price_thb, shop_url, stock_status |

## ความปลอดภัย (E-stop) (`estop`)

| # | hardware_ref | ชื่อสินค้า | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|
| 27 | `generic_estop` | Emergency stop button (mushroom, 2 NC contacts) |  | sku, price_thb, shop_url, stock_status |

หมายเหตุ: สินค้าที่ยังไม่มีใน `registry/hardware/` (สเปกวิศวกรรม) ให้แจ้งทีมวิศวกรรมเพิ่มไฟล์ YAML ก่อน แล้วค่อยเติมราคาที่นี่
