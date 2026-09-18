# รายการสินค้าที่ทีมหลังบ้านต้องเติมข้อมูล (auto-generated: `tesr-rb catalog-todo`)

เติมในชีต **TESR Robot Builder — Product Catalog** (นำเข้าจาก `catalog/products.csv`) คอลัมน์ `sku`, `price_thb` (ตัวเลข), `shop_url` (ลิงก์ tesrshop.com), `stock_status` (`in_stock`/`preorder`/`out_of_stock`)
แถวหนึ่ง = สินค้าหนึ่งรายการ ใช้ `hardware_ref` ตามตารางนี้ (ห้ามเปลี่ยน) — เว็บและ BOM จะขึ้นราคาและปุ่มสั่งซื้อทันทีที่บันทึก

ยังขาดข้อมูล 24 จาก 24 รายการ

| # | hardware_ref | ชื่อสินค้า | หมวด | สเปกโดยย่อ | ที่ยังขาด |
|---|---|---|---|---|---|
| 1 | `lifepo4_48v_40ah` | LiFePO4 48 V 40 Ah | battery | 51.2 V 40 Ah, 60 A max | sku, price_thb, shop_url, stock_status |
| 2 | `liion_12v_20ah` | Li-ion 12 V 20 Ah pack | battery | 11.1 V 20 Ah, 20 A max | sku, price_thb, shop_url, stock_status |
| 3 | `liion_24v_30ah` | Li-ion 24 V 30 Ah pack | battery | 25.2 V 30 Ah, 40 A max | sku, price_thb, shop_url, stock_status |
| 4 | `rpi5` | Raspberry Pi 5 (8 GB) | compute | arm64, 8 GB RAM, USB3 x2; 5 V, 8/20 W | sku, price_thb, shop_url, stock_status |
| 5 | `x86_pc` | Industrial mini PC (x86-64) | compute | amd64, 16 GB RAM, USB3 x4; 12 V, 25/65 W | sku, price_thb, shop_url, stock_status |
| 6 | `realsense_d435i` | Intel RealSense D435i | depth_camera | range 3 m; FOV 87°; 30 Hz; 5 V, 2.5/4 W | sku, price_thb, shop_url, stock_status |
| 7 | `realsense_d455` | Intel RealSense D455 | depth_camera | range 6 m; FOV 87°; 30 Hz; 5 V, 3/5 W | sku, price_thb, shop_url, stock_status |
| 8 | `tesr_md400_encoder` | Wheel encoders via MD-400 feedback | encoder |  | sku, price_thb, shop_url, stock_status |
| 9 | `generic_estop` | Emergency stop button (mushroom, 2 NC contacts) | estop |  | sku, price_thb, shop_url, stock_status |
| 10 | `tesr_imu` | TESR IMU module (9-axis, UART) | imu | 100 Hz; 5 V, 0.2/0.3 W | sku, price_thb, shop_url, stock_status |
| 11 | `ld19` | LDROBOT LD19 (STL-19P) | lidar | range 12 m; FOV 360°; 10 Hz; 5 V, 1/1.5 W | sku, price_thb, shop_url, stock_status |
| 12 | `rplidar_s2` | Slamtec RPLIDAR S2 | lidar | range 30 m; FOV 360°; 10 Hz; 5 V, 3/5 W | sku, price_thb, shop_url, stock_status |
| 13 | `slamtec_p3` | Slamtec P3 (2D LiDAR) | lidar | range 40 m; FOV 360°; 10 Hz; 5 V, 5/5 W | sku, price_thb, shop_url, stock_status |
| 14 | `generic_bldc_24v_100w` | 100 W BLDC gear motor (24 V) | motor | 0.32 Nm rated, 3000 rpm; 24 V, 50/100 W | sku, price_thb, shop_url, stock_status |
| 15 | `generic_dc_gearmotor` | 12 V DC gear motor with encoder | motor | 0.5 Nm rated, 200 rpm; 12 V, 10/30 W | sku, price_thb, shop_url, stock_status |
| 16 | `tesr_bldc_400w` | 400 W BLDC hub/gear motor (48 V) | motor | 1.3 Nm rated, 3000 rpm; 48 V, 200/400 W | sku, price_thb, shop_url, stock_status |
| 17 | `generic_can_motor_driver` | Dual BLDC driver, CANopen (24 V) | motor_driver | 24 V, 3/10 W | sku, price_thb, shop_url, stock_status |
| 18 | `generic_serial_motor_driver` | Serial (UART) motor driver board with encoder feedback | motor_driver | 12 V, 1/3 W | sku, price_thb, shop_url, stock_status |
| 19 | `tesr_md400` | TESR MD-400 dual BLDC driver | motor_driver | 48 V, 5/20 W | sku, price_thb, shop_url, stock_status |
| 20 | `dcdc_12_5` | DC-DC 12 V → 5 V 5 A | power_supply | out 5 V 5 A; 12 V, 0.5/28 W | sku, price_thb, shop_url, stock_status |
| 21 | `dcdc_24_12` | DC-DC 24 V → 12 V 10 A | power_supply | out 12 V 10 A; 24 V, 2/130 W | sku, price_thb, shop_url, stock_status |
| 22 | `dcdc_24_5` | DC-DC 24 V → 5 V 8 A | power_supply | out 5 V 8 A; 24 V, 1/45 W | sku, price_thb, shop_url, stock_status |
| 23 | `dcdc_48_12` | DC-DC 48 V → 12 V 10 A | power_supply | out 12 V 10 A; 48 V, 3/130 W | sku, price_thb, shop_url, stock_status |
| 24 | `dcdc_48_5` | DC-DC 48 V → 5 V 10 A | power_supply | out 5 V 10 A; 48 V, 2/55 W | sku, price_thb, shop_url, stock_status |

หมายเหตุ: สินค้าที่ยังไม่มีใน `registry/hardware/` (สเปกวิศวกรรม) ให้แจ้งทีมวิศวกรรมเพิ่มไฟล์ YAML ก่อน แล้วค่อยเติมราคาที่นี่
