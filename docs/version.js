/* TESR Robot Builder — the one place for the version number (docs/version.js)
 * Bump `version` + `date` here AND in src/tesr_robot_builder/__init__.py + pyproject.toml (tests/test_version.py checks they match),
 * then add a line at the top of `releases`. Shown in every page header (nav.js) and on the quotation.
 */
window.TESR_RB = {
  version: '0.6.2',
  date: '2026-11-22',
  releases: [
    ['0.6.2', '2026-11-22', 'IMU WitMotion WT901CM (TESR Shop 1,650 ฿) เป็นค่าเริ่มต้น · ระบบเลือกมอเตอร์ฮับ ZLTECH + ไดรเวอร์ ZLAC ที่ร้านมีขายก่อน (ปรับแรงดันให้ถ้าจำเป็น) · เตือนเมื่อมอเตอร์ไม่มีขายในร้าน', 'WitMotion WT901CM IMU (TESR Shop 1,650 ฿) as default · auto-pick prefers TESR Shop ZLTECH hub motors + ZLAC drivers (changes voltage if needed) · warning when a motor is not sold by the shop'],
    ['0.6.1', '2026-11-22', 'อุปกรณ์ TESR Shop: hub motor, ZLAC driver, Camera 3D By TESR · แสดงเลขเวอร์ชันทุกหน้า + หน้าต่าง “มีอะไรใหม่”', 'TESR Shop parts: hub motors, ZLAC drivers, Camera 3D By TESR · version number on every page + “What’s new” window'],
    ['0.6.0', '2026-11-20', 'ส่งออกสำหรับมือใหม่: ชั้น TF, เลือกสนาม, รัน Gazebo + RViz ด้วยคำสั่งเดียว', 'Beginner export: TF layers, field picker, one-command Gazebo + RViz'],
    ['0.5.0', '2026-10-17', 'หน้าออกแบบแบบทีละขั้น (7 ขั้น) · แยกหน้า ทดสอบ & เกม · เมนู 4 ขั้นทุกหน้า', 'Step-by-step design (7 steps) · separate Test & play page · 4-step menu on every page'],
    ['0.4.0', '2026-10-07', 'LiDAR Slamtec S3/C1 · ตัวออกแบบสนาม + ArUco · Jetson Orin Nano / Xavier NX · ชุดสมอง AGV → AMR ผ่าน PLC · คู่มือไฟล์ · ช่องทางติดต่อในใบเสนอราคา', 'Slamtec S3/C1 · arena editor + ArUco · Jetson Orin Nano / Xavier NX · AGV → AMR brain kit via PLC · file guide · contacts on the quotation'],
    ['0.3.0', '2026-09-26', 'Garage 3D · ใบเสนอราคา · Mission Control · Gazebo + Nav2 · ภารกิจ 5 ด่าน · TH/EN · รองรับมือถือ', 'Garage 3D · quotation · Mission Control · Gazebo + Nav2 · 5 missions · TH/EN · mobile layout'],
    ['0.2.0', '2026-09-18', 'เว็บแอปในเบราว์เซอร์: Spec & Sizing, Model Studio, engine Python ผ่าน Pyodide', 'Web app: Spec & Sizing, Model Studio, Python engine via Pyodide'],
    ['0.1.0', '2026-09-13', 'Engine รุ่นแรก: Robot Definition, registry อุปกรณ์, สร้าง ROS 2 package', 'First engine: Robot Definition, parts registry, ROS 2 package generator'],
  ],
};
