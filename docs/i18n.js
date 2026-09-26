/* TESR Robot Builder — TH / EN (docs/i18n.js)
 * Loaded by every page. The app is written in Thai; in English mode this layer translates what is on screen:
 *   text nodes, placeholder/title attributes and the page title — including everything the app re-renders later
 *   (MutationObserver). Switching back restores the original Thai. Choice is remembered in the browser.
 * Longer phrases are replaced first; very short words are only translated when they are the whole label,
 * so they never break other Thai words.
 */
(function () {
  'use strict';
  const KEY = 'tesr_rb_lang';
  const DICT = {
    // ---------- navigation / common
    'สรุปสเปก &amp; ใบเสนอราคา': 'Spec summary & quotation', 'สรุปสเปก & ใบเสนอราคา': 'Spec summary & quotation',
    'สร้าง ROS 2 workspace': 'Build ROS 2 workspace', 'เครื่องมือ': 'Tools', 'โหมดฟอร์ม': 'Form mode', 'เปิด URDF/STL': 'Open URDF/STL',
    'ประกอบหุ่นยนต์ในเบราว์เซอร์': 'build robots in your browser', 'กำลังเปิดโรงรถ…': 'Opening the garage…', 'กำลังโหลด…': 'Loading…', 'กำลังโหลด': 'Loading',
    'เอกสารสร้างในเบราว์เซอร์ของคุณ': 'document generated in your browser', 'เดียวกับ CLI/CI รันใน Pyodide · ไม่มีข้อมูลออกจากเบราว์เซอร์': 'same as CLI/CI, running in Pyodide · no data leaves your browser',
    'ในเบราว์เซอร์': 'in the browser',
    // ---------- 4-step bar / guide
    'เลือกหุ่น': 'Pick a robot', 'พิมพ์เขียวสำเร็จรูป': 'ready-made blueprints', 'แต่งหุ่น': 'Customize', 'ขนาด ล้อ เซนเซอร์ แบต': 'size, wheels, sensors, battery',
    'ทดสอบ': 'Test', 'ขับเอง หรือเล่นภารกิจ': 'drive it or play missions', 'ใช้งานจริง': 'Go real', 'ใบเสนอราคา / ROS 2': 'quotation / ROS 2',
    'เลือก': 'Pick', 'แต่ง': 'Tune', 'ขับ': 'Drive', 'เล่นภารกิจ': 'Play missions', 'ใบเสนอราคา': 'Quotation', 'วิธีใช้': 'How to use',
    'ยินดีต้อนรับสู่ TESR Robot Builder': 'Welcome to TESR Robot Builder',
    'ออกแบบหุ่นยนต์จริง ลองขับในโกดังจำลอง แล้วได้ใบเสนอราคาและโปรแกรม ROS 2 — ทำตามแถบด้านบน 4 ขั้น': 'Design a real robot, test-drive it in a simulated warehouse, then get a quotation and a ROS 2 program — follow the 4 steps in the top bar',
    'แตะการ์ดหุ่นด้านซ้าย หุ่นขึ้นกลางจอทันที': 'Tap a robot card on the left — it appears in the middle right away',
    'ปรับขนาด ล้อ เซนเซอร์ แบต ดู RANK ด้านขวา': 'Adjust size, wheels, sensors, battery — watch the RANK on the right',
    'ขับเองด้วย W A S D หรือเล่น 5 ภารกิจเก็บดาว': 'Drive with W A S D or play 5 missions for stars',
    'ใบเสนอราคาพร้อมพิมพ์ และโปรแกรม ROS 2': 'Print-ready quotation and a ROS 2 program',
    'เริ่มออกแบบ': 'Start designing', 'เล่นภารกิจเลย': 'Play missions now',
    'แตะการ์ดหุ่นด้านซ้าย (เช่น AMR 300 kg) — หุ่นจะขึ้นกลางจอทันที': 'Tap a robot card on the left (e.g. AMR 300 kg) — it appears in the middle right away',
    'ปรับขนาด ล้อ เซนเซอร์ แบต ได้ที่แท็บด้านซ้าย — ดู RANK ด้านขวาให้ได้ S หรือ A': 'Adjust size, wheels, sensors and battery in the left tabs — aim for RANK S or A on the right',
    'ได้หุ่นแล้ว! ลองกด': 'Robot ready! Try', 'ที่แถบด้านบนได้เลย': 'in the top bar', 'หรือ': 'or',
    'เพื่อขับ · มือถือใช้ภารกิจ 🏁 (มีจอยสัมผัส)': 'to drive · on phones use missions 🏁 (touch joystick)', 'หยุด': 'stop', 'กด': 'Press',
    'กำลังเตรียมภารกิจ… ลองอีกครั้งในอีกสักครู่': 'Preparing missions… try again in a moment',
    // ---------- garage tabs & panels
    'โจทย์งาน': 'Job', 'โครง': 'Chassis', 'ขับเคลื่อน': 'Drive', 'เซนเซอร์': 'Sensors', 'พลังงาน': 'Power', 'สมอง': 'Brain', 'ชิ้นส่วน': 'Parts', 'วิธีเล่น': 'Help',
    'เลือกพิมพ์เขียว': 'Choose a blueprint', 'เลือกแล้วแต่งต่อได้ทุกชิ้น — ระบบคำนวณมอเตอร์ แบต และแรงดันให้ตามภารกิจ': 'Pick one and customize every part — motors, battery and voltage are sized for the job automatically',
    'ภารกิจ': 'Mission', 'น้ำหนักของที่บรรทุก': 'Payload', 'ความเร็วสูงสุด': 'Max speed', 'ใช้งานต่อการชาร์จ': 'Runtime per charge', 'ทางลาดชันสุด': 'Max slope',
    'พื้น': 'Floor', 'สถานที่': 'Site', 'คอนกรีต': 'Concrete', 'อีพ็อกซี': 'Epoxy', 'กระเบื้อง': 'Tile', 'พรม': 'Carpet', 'ยางมะตอย': 'Asphalt', 'กรวด': 'Gravel', 'ผสม': 'Mixed',
    'โรงงาน': 'Factory', 'คลังสินค้า': 'Warehouse', 'โรงพยาบาล': 'Hospital', 'สำนักงาน': 'Office', 'ห้องแลป': 'Laboratory', 'แลป': 'Lab', 'กลางแจ้ง': 'Outdoor', 'อื่น ๆ': 'Other',
    'รูปทรงตัวถัง': 'Chassis shape', 'สี่เหลี่ยม': 'Box', 'กลม': 'Round', 'ยาว': 'Length', 'กว้าง': 'Width', 'เส้นผ่านศูนย์กลาง': 'Diameter', 'สูง (ตัวถัง)': 'Height (chassis)',
    'ระยะใต้ท้อง': 'Ground clearance', 'สี': 'Color', 'โครงจากไฟล์ของคุณ': 'Your own chassis file',
    'อัปโหลด STL ของโครง (mm หรือ m ตรวจให้อัตโนมัติ) — ระบบวัดขนาดแล้วปรับ ยาว×กว้าง×สูง ให้ตรง ใช้เป็นหน้าตาใน RViz/Gazebo': 'Upload your chassis STL (mm or m detected automatically) — it is measured, L×W×H is set to match, and it is used as the look in RViz/Gazebo',
    'อัปโหลดโครง STL': 'Upload chassis STL', 'ใช้ทรงเรขาคณิต': 'Use basic shape', 'ใช้ไฟล์': 'Using file', 'ยังไม่มีไฟล์ในเครื่องนี้ อัปโหลดอีกครั้ง': 'file not on this device — upload again',
    'ระบบขับ': 'Drive system', 'Differential 2 ล้อขับ': 'Differential, 2 driven wheels', 'เลี้ยวด้วยความเร็วล้อต่างกัน + ล้อประคอง · ทนทาน ราคาประหยัด': 'steers by wheel speed difference + casters · robust, low cost',
    'Mecanum 4 ล้อ': 'Mecanum, 4 wheels', 'สไลด์ข้าง/หมุนอยู่กับที่ · พื้นเรียบเท่านั้น': 'strafes / spins in place · smooth floors only',
    'Skid-steer 4 ล้อขับ': 'Skid-steer, 4 driven wheels', 'พื้นขรุขระ/กลางแจ้ง': 'rough ground / outdoor', 'Ackermann (เลี้ยวแบบรถยนต์)': 'Ackermann (car-like steering)', 'ความเร็วสูง ทางยาว': 'high speed, long routes',
    'เร็ว ๆ นี้': 'coming soon', 'ล้อประคอง': 'Casters', 'หน้า+หลัง': 'front+rear', '4 มุม': '4 corners', 'หลัง 1': 'rear 1', 'หน้า 1': 'front 1',
    'ล้อ & เกียร์': 'Wheels & gear', 'เส้นผ่านศูนย์กลางล้อ': 'Wheel diameter', 'หน้ากว้างล้อ': 'Wheel width', 'ระยะห่างล้อซ้าย-ขวา': 'Track (left-right)', 'ระยะล้อหน้า-หลัง': 'Wheelbase (front-rear)',
    'อัตราทดเกียร์': 'Gear ratio', 'มอเตอร์': 'Motor', 'ให้ระบบเลือก': 'Auto-pick', 'ระบบเลือกให้)': 'auto-picked)', 'แรงพอ': 'strong enough', 'แรงไม่พอ': 'too weak',
    'ติดตั้งด่วน (LiDAR)': 'Quick mount (LiDAR)', 'หลังคา 1 ตัว': '1 on roof', 'เฉียง 2 ตัว (KURO-X)': '2 diagonal (KURO-X)', '3 ตัว': '3 units', 'หน้า + หลัง': 'front + rear',
    'ติดตั้งอยู่': 'Mounted', 'ถอด': 'Remove', 'ติดตั้ง': 'Mount', 'กล้อง depth': 'Depth camera', 'ยังไม่มีเซนเซอร์': 'No sensors yet',
    'ที่การ์ดแล้วคลิกตำแหน่งบนตัวถัง (กด': 'on a card, then click a spot on the chassis (hold', 'ค้างเพื่อวางหลายตัว) · เลือกชิ้นแล้วลากลูกศรเพื่อย้าย': 'to place several) · select a part and drag the arrows to move it',
    'หมุน 45°': 'rotate 45°', 'หมุนกลับ': 'rotate back',
    'แรงดันระบบ': 'System voltage', 'ให้ระบบแนะนำ': 'Auto-suggest', 'ระบบแนะนำ)': 'suggested)', 'หุ่นเล็ก': 'small robot', 'ทั่วไป': 'general', 'หนัก': 'heavy',
    'แนะนำ': 'Recommended', 'จากกำลังสูงสุด': 'from peak power', 'มวล': 'mass', 'ใช้แบตแรงดันอื่นได้ ระบบคิดการต่ออนุกรมให้': 'other battery voltages work — series wiring is calculated for you',
    'แบตเตอรี่': 'Battery', 'อนุกรม': 'in series', 'ต่ออนุกรม': 'in series', 'ต่อขนาน': 'in parallel', 'ขนาน': 'parallel', 'ก้อน': 'packs', 'ต้องมี DC-DC': 'needs DC-DC',
    'ความปลอดภัย': 'Safety', 'ปุ่ม E-stop': 'E-stop button', 'บังคับเมื่อหุ่นหนักเกิน 50 kg': 'mandatory above 50 kg',
    'คอมพิวเตอร์': 'Computer', 'พอร์ตพอ': 'ports OK', 'ซอฟต์แวร์ทั้งหมดสร้างในขั้น 3': 'all software is generated in step 3',
    'ชิ้นส่วนเรขาคณิต': 'Basic shapes', 'กดแล้วคลิกบนตัวถังเพื่อวาง — เช่น เสา LiDAR, กันชน, ถาดบน, กล่องอุปกรณ์': 'Tap, then click on the chassis to place — e.g. LiDAR mast, bumper, top tray, equipment box',
    'กล่อง': 'Box', 'ทรงกระบอก': 'Cylinder', 'ทรงกลม': 'Sphere', 'ชิ้นส่วนจากไฟล์': 'Parts from file', 'อัปโหลด STL': 'Upload STL', 'ยังไม่มี': 'None yet',
    'ปุ่มลัด': 'Shortcuts', 'ข้อมูลอุปกรณ์': 'Hardware data', 'สเปกมาจาก': 'Specs come from',
    'ราคา/ลิงก์ TESR Shop จากไฟล์ CSV หรือ Google Sheet ของทีม (ตั้งค่าในหน้า 1) — เพิ่มสินค้าในชีตแล้วขึ้นในโรงรถทันที': 'TESR Shop prices/links come from the team CSV or Google Sheet — add a product to the sheet and it shows up in the garage',
    'ในแท็บภารกิจ แล้วปรับน้ำหนัก ความเร็ว ชั่วโมงใช้งาน': 'in the Job tab, then set payload, speed and runtime', 'หรืออัปโหลด STL ของคุณเอง': 'or upload your own STL',
    'กดติดตั้งแล้วคลิกบนตัวถัง · หลังคา': 'tap Mount, then click on the chassis · roof', 'และแถบสเตตัสด้านขวา แก้ตามแจ้งเตือนจนได้ S/A': 'and the status bars on the right — fix warnings until you reach S/A',
    'เดินหน้า-ถอย': 'forward/back', 'เลี้ยว': 'turn', 'สไลด์': 'strafe', 'สไลด์)': 'strafe)',
    'เล่น 5 ด่านในโกดังเดียวกับ Gazebo — ทำแผนที่ด้วย LiDAR ส่งของ ลอดช่องแคบ วัดแบต เก็บดาว/XP/เหรียญ': 'play 5 levels in the same warehouse as Gazebo — map with LiDAR, deliver, squeeze through a narrow aisle, test the battery, collect stars/XP/badges',
    'ส่งออก: 📋 ขั้น 2 ใบเสนอราคา · 🚀 ขั้น 3 workspace (ros2_control/Nav2/Gazebo)': 'Export: 📋 step 2 quotation · 🚀 step 3 workspace (ros2_control/Nav2/Gazebo)',
    'ยกเลิก · ลากซ้าย': 'cancel · left-drag', 'หมุนมุมกล้อง · ลากขวา': 'orbit camera · right-drag', 'เลื่อน · ล้อเมาส์': 'pan · mouse wheel', 'ซูม': 'zoom', 'ยกเลิก': 'cancel',
    'คลิกบนตัวถังเพื่อติดตั้ง': 'Click on the chassis to mount', 'มองรอบทิศ · ขอบ/มุม': 'sees all around · edge/corner', 'หันออกด้านนอก': 'faces outward', 'คลิกบนตัวถังเพื่อวางชิ้นส่วน': 'Click on the chassis to place the part',
    'ชิ้นที่เลือก': 'Selected part', 'มองได้': 'sees', 'ฝังในตัวถัง)': 'embedded in chassis)', 'บนหลังคา)': 'on roof)', 'สูง z': 'height z', 'กว้าง x': 'width x',
    // ---------- stage / HUD
    'สแกน': 'Scan', 'แสดงระยะสแกน LiDAR / กล้อง': 'Show LiDAR / camera range', 'มองทะลุตัวถัง': 'See through the chassis', 'ของ': 'Payload', 'แสดงของที่บรรทุก': 'Show payload',
    'โชว์': 'Show', 'หมุนโชว์': 'Turntable', 'ทดลองขับ': 'Test drive', 'ทดลองขับ W A S D': 'Test drive W A S D', 'มุมกล้อง': 'Camera', 'จัดมุมกล้อง': 'Fit camera', 'ภาพ': 'Photo', 'บันทึกภาพ': 'Save image',
    'โหมดเบา': 'Lite mode', 'ปิด bloom/เงา สำหรับเครื่องที่ช้า': 'Turn off bloom/shadows for slower devices', 'เล่นภารกิจกับหุ่นตัวนี้': 'Play missions with this robot',
    'สเตตัสหุ่น': 'Robot status', 'ความเร็ว': 'Speed', 'แรงขับ': 'Drive force', 'ความอึด': 'Endurance', 'การมองเห็น': 'Vision',
    'มวลรวม (หุ่น': 'Total mass (robot', 'ระบบไฟ': 'Power system', 'มอเตอร์ต้องการ @': 'Motor needs @', 'แพ็กแบต': 'Battery pack', 'ราคาอุปกรณ์': 'Hardware cost', 'รอราคา': 'price pending',
    'แจ้งเตือน': 'Warnings', 'ส่งออก / ไปต่อ': 'Export / next', 'สรุปสเปก &amp; ใบเสนอราคา (ขั้น 2) →': 'Spec summary & quotation (step 2) →', 'สร้าง ROS 2 workspace (ขั้น 3)': 'Build ROS 2 workspace (step 3)',
    'ภาพ PNG': 'PNG image', 'เซฟโรงรถ': 'Save garage', 'โหลดเซฟ': 'Load save', 'รายการสั่งซื้อ · TESR Shop': 'Shopping list · TESR Shop', 'ซื้อ': 'Buy', 'ชิ้น': 'items',
    'เลือกอยู่': 'Selected',
    // ---------- garage warnings (garage-core)
    'พร้อมออกรบ — ไม่พบปัญหา ส่งต่อไปสร้าง ROS 2 workspace หรือเปิดใน Gazebo ได้เลย': 'Mission ready — no problems found. Go ahead and build the ROS 2 workspace or open it in Gazebo',
    'ยังไม่มี LiDAR — หุ่นทำแผนที่ (SLAM) และนำทางเองไม่ได้': 'No LiDAR yet — the robot cannot map (SLAM) or navigate on its own',
    'มีจุดบอด: เพิ่ม LiDAR ตัวที่ 2 (เฉียงแบบ KURO-X) หรือย้ายขึ้นหลังคา': 'blind spots: add a 2nd LiDAR (diagonal, KURO-X style) or move it to the roof',
    'มองรอบตัวได้': 'Sees around', 'ยังไม่ได้เลือกมอเตอร์': 'No motor selected', 'แรงไม่พอ — ต้องการ ≥': 'too weak — needs ≥', 'เพิ่มอัตราทด ลดความเร็ว หรือเลือกมอเตอร์ใหญ่ขึ้น': 'raise the gear ratio, lower the speed or pick a bigger motor',
    'เสี่ยงพลิกเมื่อเลี้ยวเร็ว — ลดความเร็ว ขยายระยะล้อ หรือวางของให้ต่ำลง': 'Risk of tipping in fast turns — slow down, widen the track or lower the payload',
    'ล้อยื่นออกนอกตัวถัง — ลดระยะห่างล้อหรือขยายตัวถัง': 'Wheels stick out of the chassis — reduce the track or widen the chassis', 'ยื่นออกนอกตัวถังมาก — ระวังชน': 'sticks out far — collision risk',
    'หุ่นหนักเกิน 50 kg ต้องมีปุ่ม E-stop': 'Robots over 50 kg must have an E-stop', 'ใช้งานได้ประมาณ': 'Runtime about', 'เลือกแบตความจุสูงขึ้น': 'choose a higher-capacity battery',
    'ไม่ตรงระบบไฟ': 'does not match the power system', 'ต้องมี DC-DC ระหว่างแบตกับ bus': 'needs a DC-DC between battery and bus', 'ต้องมีไดรเวอร์ที่จ่าย': 'needs a driver that supplies',
    'ให้มอเตอร์': 'to the motor', 'ใส่ DC-DC หรือเลือกไดรเวอร์': 'add a DC-DC or pick a driver', 'ต้องมีไฟ': 'needs a rail', 'แต่ยังไม่มี DC-DC': 'but no DC-DC yet', 'ยังไม่มี DC-DC': 'no DC-DC yet',
    'อุปกรณ์ USB 3': 'USB 3 devices', 'พอร์ต — ใช้ hub มีไฟเลี้ยง หรือเลือกคอมพ์ที่พอร์ตมากขึ้น': 'ports — use a powered hub or a computer with more ports',
    'รวมระยะปลอดภัย) แต่ช่องทางแคบสุด': 'incl. safety margin) but the narrowest aisle is', 'แต่ระบบไฟ': 'but the power system is', 'มอเตอร์เป็น': 'motor is', 'ไดรเวอร์เป็น': 'driver is',
    // ---------- blueprints
    'โรงงาน 300 kg': 'factory 300 kg', 'ลากรถเข็น/พาเลทในโรงงาน · 2 LiDAR เฉียงแบบ KURO-X / Beary-X': 'moves carts/pallets in factories · 2 diagonal LiDARs like KURO-X / Beary-X',
    'หุ่นบริการ 60 kg': 'Service robot 60 kg', 'ส่งของในโรงพยาบาล/สำนักงาน · ตัวถังกลม เลี้ยวในที่แคบ': 'deliveries in hospitals/offices · round body, turns in tight spaces',
    'หุ่นเรียน IRON-X class': 'Education robot, IRON-X class', 'หุ่นเล็กสำหรับ TESR Academy · 12 V · ราคาประหยัด': 'small robot for TESR Academy · 12 V · low cost',
    'เคลื่อนที่ทุกทิศ สไลด์ข้างได้ · งานวิจัย/แลป': 'moves in any direction, strafes · research/lab',
    // ---------- missions (garage-game)
    'ภารกิจในโกดัง TESR': 'Missions in the TESR warehouse', 'ด้วยสเปกจริง': 'with its real specs', 'วินาทีภารกิจ · RANK': 'mission-seconds of battery · RANK',
    'โกดังเดียวกับ Gazebo ใน package': 'Same warehouse as Gazebo in the package', 'เล่นที่นี่ แล้วไปรันจริงในขั้น 3': 'play here, then run it for real in step 3',
    'ถึง LV': 'to LV', 'ดีที่สุด': 'best', 'กลับไปแต่งหุ่น': 'Back to the garage',
    'ขับครั้งแรก': 'First drive', 'ขับไปแตะวงแหวนทองให้ครบ 3 จุดตามลำดับ': 'Drive through the 3 gold rings in order', 'เดินหน้า-ถอย · A/D เลี้ยว · C สลับกล้อง': 'forward/back · A/D turn · C switches camera',
    'นักทำแผนที่': 'Cartographer', 'ขับสำรวจให้ LiDAR เห็นพื้นที่โกดัง 92%': 'Explore until the LiDAR has seen 92% of the warehouse',
    'นี่คือสิ่งที่ slam_toolbox ทำในขั้น 3 — LiDAR หลายตัว/มุมกว้างทำแผนที่เร็วกว่า': 'this is what slam_toolbox does in step 3 — more LiDARs / wider view map faster',
    'ส่งของด่วน': 'Express delivery', 'รับของที่ A แล้วไปส่งที่ B': 'Pick up at A and deliver to B', 'จอดนิ่งในวงแหวน 1 วินาทีเพื่อยก/วางของ': 'stop inside the ring for 1 second to load/unload',
    'ช่องแคบ': 'Narrow aisle', 'ลอดช่องระหว่างผนังกั้นกับกำแพงเหนือ (กว้าง 1.1 m)': 'Pass through the gap between the divider and the north wall (1.1 m wide)',
    'หุ่นที่กว้างเกินช่องต้องอ้อมไกล — ความกว้างที่ออกแบบใน Garage มีผลจริง': 'robots wider than the gap must go the long way — the width you designed really matters',
    'มาราธอนแบต': 'Battery marathon', 'ส่งของ 2 รอบ: A→B แล้ว A→C ก่อนแบตหมด': '2 deliveries: A→B then A→C before the battery runs out',
    'หุ่นที่แบตได้ตามชั่วโมงใช้งานที่ตั้งไว้จะเหลือแบตพอ — ถ้าไม่พอ กลับไปเพิ่มแบต/ต่อขนาน': 'a robot whose battery meets its runtime target has enough left — if not, add battery / parallel packs',
    'ออกตัว': 'Off the line', 'จบภารกิจแรก': 'finish your first mission', 'ไร้รอยขีดข่วน': 'Not a scratch', 'จบภารกิจโดยไม่ชนเลย': 'finish a mission without any collision',
    'สามดาว': 'Three stars', 'ได้ 3 ดาวในภารกิจใดก็ได้': 'get 3 stars in any mission', 'ทำแผนที่ได้ 95% ขึ้นไป': 'map 95% or more',
    'สายแบก': 'Heavy lifter', 'ส่งของสำเร็จด้วยหุ่นบรรทุก ≥ 300 kg': 'deliver with a ≥ 300 kg payload robot', 'สายซิ่ง': 'Speedster', 'จบภารกิจด้วยหุ่นความเร็ว ≥ 1.5 m/s': 'finish with a robot rated ≥ 1.5 m/s',
    'สไลด์ข้าง': 'Strafer', 'จบภารกิจด้วยหุ่น mecanum': 'finish with a mecanum robot', 'แบตอึด': 'Long-lasting', 'จบมาราธอนโดยแบตเหลือ ≥ 30%': 'finish the marathon with ≥ 30% battery',
    'ผู้พิชิตโกดัง': 'Warehouse champion', 'ผ่านครบ 5 ภารกิจ': 'clear all 5 missions',
    'ผ่านภารกิจก่อนหน้าให้ได้อย่างน้อย 1 ดาวก่อน': 'Get at least 1 star in the previous mission first',
    'ความเร็ว ': 'Speed ', 'แบตเหลือ': 'Battery left', 'ครั้งที่ชน': 'Collisions', 'เวลา (3★ ≤': 'Time (3★ ≤', 'เลื่อนเป็น LV': 'promoted to LV',
    'ภารกิจสำเร็จ!': 'Mission complete!', 'ภารกิจล้มเหลว': 'Mission failed', 'เมนูภารกิจ': 'Mission menu', 'เล่นอีกครั้ง': 'Play again', 'ภารกิจถัดไป →': 'Next mission →',
    'แบตหมดกลางทาง': 'battery ran out', 'ออกจากภารกิจ': 'left the mission', 'ออก · C กล้อง · R เริ่มใหม่': 'exit · C camera · R restart', 'ออก': 'exit',
    'สำรวจให้ได้': 'Explore', 'ของโกดัง': 'of the warehouse', 'ไปรับของที่': 'Go pick up at', 'ไปส่งของที่': 'Go deliver to', 'ไปจุดที่': 'Go to point', 'จอดนิ่ง 1 วินาที': 'stop for 1 second',
    'รับของที่': 'Picked up at', 'ส่งของที่': 'Delivered at', 'แล้ว': 'done', 'แบตเตอรี่ ': 'Battery ',
    'มอเตอร์แรงไม่พอ — ความเร่งลดลง': 'Motor too weak — reduced acceleration', 'มอเตอร์แรงไม่พอ — เร่งช้า': 'motor too weak — slow acceleration', 'หุ่นกว้าง': 'Robot is', 'เกินช่อง 1.1 m — ต้องอ้อม': 'wide, more than the 1.1 m gap — go around',
    'ไม่มี LiDAR — แผนที่จะว่าง': 'no LiDAR — the map stays empty',
    'แบตหมดก่อนจบ: ในแท็บพลังงานเลือกแบตก้อนใหญ่ขึ้น หรือเพิ่มการต่อขนาน — ชั่วโมงใช้งานจริงจะขึ้นตาม': 'Battery ran out: pick a bigger battery or add parallel packs in the Power tab — real runtime goes up with it',
    'มอเตอร์แรงไม่พอสำหรับน้ำหนักนี้ — เพิ่มอัตราทดเกียร์หรือเลือกมอเตอร์ใหญ่ขึ้นในแท็บขับเคลื่อน': 'The motor is too weak for this weight — raise the gear ratio or choose a bigger motor in the Drive tab',
    'ลองติด LiDAR แบบเฉียง 2 ตัว (KURO-X) — มองได้ 360° ทำแผนที่เร็วขึ้นมาก': 'Try 2 diagonal LiDARs (KURO-X) — 360° view maps much faster',
    'ชนบ่อย: ลดความเร็วสูงสุดหรือเพิ่ม safety margin — ใน Nav2 ค่า inflation จะกันไม่ให้หุ่นเฉียดแบบนี้': 'Many collisions: lower the max speed or add safety margin — in Nav2 the inflation radius keeps the robot from scraping like this',
    'หุ่นแบบนี้พร้อมไปขั้น 3 — ได้ workspace ที่รันโกดังเดียวกันนี้ใน Gazebo + Nav2': 'This robot is ready for step 3 — you get a workspace that runs this same warehouse in Gazebo + Nav2',
    'ลองอีกครั้ง หรือกลับไปปรับหุ่นใน Garage': 'Try again, or go back and tune the robot in the Garage',
    // ---------- summary page
    'แก้ใน Garage': 'Edit in Garage', 'พิมพ์ / บันทึก PDF': 'Print / save PDF', 'สร้าง ROS 2 workspace →': 'Build ROS 2 workspace →', 'กำลังเตรียมเอกสาร…': 'Preparing the document…',
    'ใบสรุปสเปก &amp; ใบเสนอราคา': 'Specification & Quotation', 'ใบสรุปสเปก & ใบเสนอราคา': 'Specification & Quotation', 'เลขที่': 'No.', 'วันที่': 'Date', 'ยืนราคา': 'valid for', 'วัน': 'days',
    'ลูกค้า / บริษัท': 'Customer / company', 'ชื่อบริษัท': 'Company name', 'ผู้ติดต่อ': 'Contact', 'ชื่อ-นามสกุล': 'Full name', 'โทร / อีเมล': 'Phone / email', 'หมายเหตุ / ขอบเขตงาน': 'Notes / scope of work',
    'เช่น รวมประกอบ + ติดตั้งซอฟต์แวร์ ROS 2 Jazzy + อบรม 1 วัน': 'e.g. includes assembly + ROS 2 Jazzy software setup + 1-day training',
    'ไม่มีภาพ — กด “📋 สรุปสเปก” จากหน้า Garage เพื่อถ่ายภาพหุ่น': 'No picture — press “📋 Spec summary” in the Garage to capture the robot',
    'คะแนนความพร้อมจาก Garage 3D': 'Readiness score from Garage 3D', 'ปัญหาร้ายแรง': 'critical issues', 'คำเตือน': 'warnings',
    'สเปกหุ่นยนต์': 'Robot specification', 'งาน': 'Application', 'น้ำหนักบรรทุก': 'Payload', 'คำนวณได้ ~': 'calculated ~', 'พื้น / ทางลาด': 'Floor / slope', 'ช่องทางแคบสุด': 'Narrowest aisle',
    'ตัวถัง': 'Chassis', 'รูปทรง': 'Shape', 'กลม Ø': 'Round Ø', 'สูง / ใต้ท้อง': 'Height / clearance', 'มวลหุ่น / รวมบรรทุก': 'Robot mass / with payload', 'โครงจากไฟล์': 'Chassis from file',
    'ทรงเรขาคณิต': 'basic shape', 'ชิ้นส่วนเพิ่ม': 'Extra parts', 'มี': 'Yes', 'ไม่มี': 'No', 'ระบบขับเคลื่อน': 'Drivetrain', 'ชนิด': 'Type', 'ล้อ (holonomic)': 'wheels (holonomic)',
    'ล้อขับ + ล้อประคอง': 'driven wheels + casters', 'หลัง 1 ล้อ': 'rear 1 wheel', 'หน้า 1 ล้อ': 'front 1 wheel', 'ล้อ': 'Wheels', 'ระยะล้อ': 'track', 'อัตราทด': 'Gear ratio',
    'การต่อแพ็ก': 'Pack wiring', 'กำลังเฉลี่ย / สูงสุด': 'Average / peak power', 'กระแสสูงสุด': 'Peak current', 'ไฟเลี้ยงย่อย': 'Auxiliary rails',
    'คอมพิวเตอร์ &amp; ซอฟต์แวร์': 'Computer & software', 'คอมพิวเตอร์ & ซอฟต์แวร์': 'Computer & software', 'ระบบ': 'System', 'ควบคุม': 'Control', 'ทำแผนที่ / นำทาง': 'Mapping / navigation', 'จำลอง': 'Simulation',
    'คำนวณจากขนาดและ LiDAR)': 'from size and LiDAR)', 'มองรอบตัว (LiDAR)': 'Surround view (LiDAR)', 'ตำแหน่งติดตั้งเซนเซอร์': 'Sensor mounting positions',
    'หน้า · y ซ้าย · z ขึ้น, หน่วย m)': 'forward · y left · z up, metres)', 'อุปกรณ์': 'Device', 'หัน': 'Yaw', 'มุมมอง': 'Field of view', 'ฝังมุม/ขอบ)': 'corner/edge mounted)', 'ไม่มีเซนเซอร์': 'No sensors',
    'การคำนวณทางวิศวกรรม': 'Engineering calculations', 'แรงขับต่อเนื่อง / สูงสุด': 'Continuous / peak drive force', 'แรงบิดที่ล้อ (ต่อล้อ)': 'Wheel torque (per wheel)',
    'มอเตอร์ต้องการ (rated, SF 1.3)': 'Motor required (rated, SF 1.3)', 'มอเตอร์ที่เลือก': 'Selected motor', 'ผ่าน': 'pass', 'ไม่ผ่าน': 'fail', 'พลังงานที่ต้องการ': 'Energy required',
    'เสถียรภาพ (a_tip vs a_lat)': 'Stability (a_tip vs a_lat)', 'เสี่ยงพลิก': 'tipping risk', 'จุดศูนย์ถ่วง (สูงจากพื้น)': 'Centre of gravity (height)', 'ค่าที่ใช้': 'Assumptions', 'ข้อควรทราบ': 'Notes',
    'ใบเสนอราคาอุปกรณ์': 'Hardware quotation', 'ส่วนลด (%)': 'Discount (%)', 'ยืนราคา (วัน)': 'Valid (days)', 'รายการ': 'Item', 'SKU / ลิงก์': 'SKU / link', 'จำนวน': 'Qty',
    'ราคา/หน่วย (฿)': 'Unit price (฿)', 'รวม (฿)': 'Total (฿)', 'สอบถาม': 'on request', 'รวมเป็นเงิน': 'Subtotal', 'ส่วนลด': 'Discount', 'รวมทั้งสิ้น': 'Grand total',
    'รายการที่ยังไม่มีราคาในแคตตาล็อก (“สอบถาม”) — ยอดรวมยังไม่รวมรายการเหล่านี้': 'items have no catalog price yet (“on request”) — the total excludes them',
    'ราคาอุปกรณ์จาก TESR Shop ณ วันที่ออกเอกสาร · ยังไม่รวมค่าประกอบ ติดตั้ง ซอฟต์แวร์ และอบรม เว้นแต่ระบุในหมายเหตุ · สเปกคำนวณโดย TESR Robot Builder (ตรวจด้วยกฎวิศวกรรม 16 ข้อก่อนสร้าง ROS 2 workspace)': 'Hardware prices from TESR Shop on the issue date · assembly, installation, software and training not included unless stated in the notes · specification calculated by TESR Robot Builder (checked by 16 engineering rules before generating the ROS 2 workspace)',
    'ผู้เสนอราคา · TESR Co., Ltd': 'Quoted by · TESR Co., Ltd', 'ผู้อนุมัติ / ลูกค้า': 'Approved by / customer', 'ยังไม่มีหุ่นในโปรเจกต์': 'No robot in the project yet', 'เริ่มที่': 'Start at',
    'แล้วกด “📋 สรุปสเปก &amp; ใบเสนอราคา”': 'then press “📋 Spec summary & quotation”', 'ยังไม่มีโปรเจกต์': 'no project yet', 'สร้างเอกสารไม่สำเร็จ': 'Could not build the document',
    'ความเร็วสูงสุด ': 'Max speed ',
    // categories (BOM)
    'Low-level control (มอเตอร์ไดรเวอร์)': 'Low-level control (motor driver)', 'เอ็นโค้ดเดอร์': 'Encoders', 'กล้อง': 'Camera', 'แหล่งจ่ายไฟ / DC-DC': 'Power supply / DC-DC',
    'ความปลอดภัย (E-stop)': 'Safety (E-stop)', 'อุปกรณ์เสริม': 'Accessories',
    // ---------- build page
    'สร้าง': 'Build', 'ROS 2 workspace': 'ROS 2 workspace', 'หุ่นจาก Garage → ตรวจ 16 กฎวิศวกรรม → ได้ 5 packages พร้อมจำลอง ทำแผนที่ และนำทางเองใน Gazebo': 'Robot from the Garage → 16 engineering rules → 5 packages that simulate, map and navigate on their own in Gazebo',
    'สร้าง WORKSPACE': 'BUILD WORKSPACE', 'ตรวจ + สร้าง + เตรียมคำสั่งรัน': 'check + generate + launch commands', 'Python ในเบราว์เซอร์': 'Python in your browser', 'ถูกโครงสร้าง': 'structure is valid',
    'ไฟฟ้า · กลไก · TF · Nav · ปลอดภัย': 'electrical · mechanical · TF · Nav · safety', 'จำลอง · แผนที่ · นำทาง': 'simulate · map · navigate',
    'กำลังเตรียม engine (Pyodide · ครั้งแรก ~20–40 วินาที)': 'Preparing the engine (Pyodide · first time ~20–40 s)', 'ผลตรวจ': 'Checks',
    'กด 🚀 เพื่อตรวจ — ระบบใช้ engine เดียวกับ CLI และ CI': 'Press 🚀 to check — same engine as the CLI and CI', 'สร้างจาก robot.yaml ของคุณ': 'generated from your robot.yaml',
    'ดาวน์โหลด workspace (.zip)': 'Download workspace (.zip)', 'คัดลอกไปวางใน terminal': 'copy into a terminal', 'สร้าง workspace ก่อน แล้วคำสั่งรันของหุ่นคุณจะขึ้นที่นี่': 'Build the workspace first — your robot’s launch commands appear here',
    'ไฟล์ใน workspace': 'Files in the workspace', 'คลิกเพื่อดูเนื้อหา': 'click to view', 'เลือกไฟล์ทางซ้าย': 'select a file on the left',
    'ขั้นสูง — แก้ robot.yaml เอง · ตัวอย่าง · ใส่ไฟล์ mesh': 'Advanced — edit robot.yaml · examples · add mesh files', 'จากโปรเจกต์ (Garage)': 'From project (Garage)',
    'ตัวอย่าง AMR 300 kg': 'Example AMR 300 kg', 'ตัวอย่าง Mecanum': 'Example Mecanum', 'ตัวอย่าง IRON-X': 'Example IRON-X', 'เปิดไฟล์ .robot.yaml': 'Open .robot.yaml', 'ดาวน์โหลด .robot.yaml': 'Download .robot.yaml',
    'ตรวจอย่างเดียว': 'Check only', 'วาง robot.yaml ที่นี่': 'paste robot.yaml here', 'ลาก STL/DAE ของโครงหรือชิ้นส่วนมาวาง → ใส่ใน': 'Drop chassis/part STL/DAE here → goes into',
    'ดาวน์โหลด Pyodide (Python ใน WebAssembly)…': 'Downloading Pyodide (Python in WebAssembly)…', 'โหลด pydantic · pyyaml · jinja2…': 'Loading pydantic · pyyaml · jinja2…',
    'ติดตั้ง engine ลง filesystem ของเบราว์เซอร์…': 'Installing the engine into the browser filesystem…', 'โหลด engine…': 'Loading engine…', 'โหลด engine': 'Loading engine', 'พร้อม': 'ready',
    'โหลด engine ไม่สำเร็จ': 'Engine failed to load', 'ไม่พร้อม — ตรวจการเชื่อมต่ออินเทอร์เน็ต (Pyodide/jsdelivr) แล้วรีเฟรช': 'not ready — check the internet connection (Pyodide/jsdelivr) and refresh',
    'หุ่นจาก Garage': 'Robot from the Garage', 'ยังไม่มีหุ่นในโปรเจกต์ — เริ่มที่ Garage 3D หรือใช้ตัวอย่าง': 'No robot in the project yet — start in Garage 3D or use an example',
    'โหลดตัวอย่าง': 'Loaded example', 'ยังโหลดไม่เสร็จ': 'still loading', 'ต้องแก้': 'to fix', 'ผ่าน มีคำแนะนำ': 'passed, with advice', 'ผ่านทุกข้อ': 'all passed', 'ดูผลทุกข้อ': 'Show all results',
    'ฮาร์ดแวร์': 'Hardware', 'กลไก': 'Mechanical', 'นำทาง': 'Navigation', 'ไฟฟ้า': 'Electrical',
    'มีโครงสร้างผิด — ดูรายละเอียดในผลตรวจ': 'has a structure error — see the checks', 'มีข้อที่ต้องแก้ก่อนสร้าง — ดูผลตรวจ': 'there are items to fix before building — see the checks',
    'ตรวจไม่ผ่าน — แก้ตามคำแนะนำ แล้วกดใหม่': 'Checks failed — follow the advice and try again', 'ตรวจผ่าน — กด 🚀 เพื่อสร้าง': 'Checks passed — press 🚀 to build',
    'สร้างแล้ว': 'Built', 'ไฟล์': 'files', 'พร้อมแล้ว — ดาวน์โหลด แล้วรัน sim.launch.py': 'ready — download and run sim.launch.py',
    'ครั้งแรกเท่านั้น': 'first time only', 'จำลอง + ทำแผนที่ + นำทาง': 'Simulate + map + navigate', 'คำสั่งเดียว — คลิก 2D Goal Pose ใน RViz': 'one command — click 2D Goal Pose in RViz',
    'ขับด้วยคีย์บอร์ด': 'Drive with the keyboard', 'อีก terminal': 'another terminal', 'บันทึกแผนที่ → ใช้ AMCL': 'Save the map → use AMCL', 'หลังขับสำรวจครบ': 'after exploring',
    'หุ่นจริง': 'Real robot', 'ต่อมอเตอร์ไดรเวอร์ + เซนเซอร์แล้ว': 'with motor driver + sensors connected', 'ไม่มี ROS ในเครื่อง? (Docker, Linux)': 'No ROS installed? (Docker, Linux)', 'ผ่าน X11': 'GUI via X11',
    'คัดลอก': 'Copy', 'คัดลอกแล้ว ✓': 'Copied ✓', 'ต่อไป: คำสั่ง 1 และ 2 ใน Launch pad': 'next: commands 1 and 2 in the Launch pad', 'จะใส่ใน meshes/': 'will go into meshes/',
    'ดาวน์โหลดแล้ว — ขาดไฟล์ mesh': 'Downloaded — missing mesh files', 'อัปโหลดใหม่ก่อน)': 'upload them again first)', 'โหลด JSZip ไม่ได้ — ตรวจอินเทอร์เน็ต': 'Could not load JSZip — check the internet',
    'เปิดโรงรถไม่สำเร็จ': 'Could not open the garage', 'ไม่ใช่ไฟล์เซฟโรงรถ': 'not a garage save file', 'โหลดไม่สำเร็จ': 'Load failed',
    // ---------- fill-ins
    'คิด': 'calculated', 'ชุด': 'set', 'ดู': 'view', 'ตัว': 'units', 'ที่': 'at', 'มุม': 'corner', 'มุม/ขอบ': 'corner/edge', 'ระยะ': 'range', 'รัน': 'run', 'ลิงก์': 'link',
    'สูงสุด': 'max', 'หลังคา': 'roof', 'เปิด': 'open', 'เฟรม': 'frame', 'แบต': 'battery', 'และ': 'and', 'ไม่พอ': 'not enough', 'หันออก': 'faces out', 'ดาวน์โหลด': 'Download',
    'พิมพ์เขียว': 'blueprint', 'ล้อขับ': 'driven wheels', 'ตัวอย่าง': 'example', 'จากเป้า': 'of target', 'จากโปรเจกต์': 'From project', 'ซอฟต์แวร์': 'software', 'สรุปสเปก': 'Spec summary',
    'ใบสรุปสเปก': 'Specification', 'หรือกด': 'or press', 'แล้วกด': 'then press', 'หุ่น / รวมบรรทุก': 'robot / with payload', 'ไดรเวอร์)': 'driver)', 'ในคลัง': 'in stock', 'ขั้น': 'step',
    'ห้อง 10×10 m มีลังให้ LiDAR เห็น': '10×10 m room with crates for the LiDAR to see', 'จำลองใน Gazebo Harmonic + RViz': 'simulate in Gazebo Harmonic + RViz',
    'ดูใน RViz + slider หมุนล้อ': 'view in RViz + wheel sliders', 'โมเดล + inertial + Gazebo sensors/plugins': 'model + inertial + Gazebo sensors/plugins',
    'หมายเหตุ: ล้อ mecanum ในการจำลองใช้ปลั๊กอิน kinematic (ไม่จำลองลูกกลิ้งจริง)': 'Note: mecanum wheels use a kinematic plugin in simulation (rollers are not simulated)',
    'ตรวจ 16 กฎ → 5 packages พร้อมจำลอง ทำแผนที่ และนำทางเองใน Gazebo': '16 rules → 5 packages that simulate, map and navigate on their own in Gazebo',
    'ในการจำลอง': 'in simulation', 'เลี้ยวแบบรถยนต์)': 'car-like steering)', 'ตัว · แบต': 'units · battery', 'ตัว แต่': 'units but', 'กำลังโหลดตัวอย่าง…': 'Loading example…', 'พื้นที่': 'area', 'เริ่มใหม่': 'Restart', 'เล่น': 'Play',
  };
  const RE_TH = /[\u0E00-\u0E7F]/;
  const RULES = [
    [/(^|\s)มี\s+(?=\d)/g, '$1'],               // "มี 11 รายการ…" → "11 items…"
    [/(\d)\s*ตัว/g, '$1 units'], [/(\d)\s*ก้อน/g, '$1 packs'], [/(\d)\s*ชิ้น/g, '$1 items'], [/(\d)\s*วัน(?![\u0E00-\u0E7F])/g, '$1 days'],
    [/(\d)\s*จุด/g, '$1 points'], [/ขั้น\s*(\d)/g, 'step $1'], [/(\d)\s*ล้อ(?![\u0E00-\u0E7F])/g, '$1 wheels'],
  ]; // "มี 11 รายการ…" → "11 items…"
  const unesc = (s) => s.replace(/&amp;/g, '&');
  const exact = new Map(), phrases = [], shorts = [];
  for (const [th, en] of Object.entries(DICT)) {
    const k = unesc(th).trim();
    exact.set(k, en);
    if ([...k].length >= 4) phrases.push([k, en]); else shorts.push([k, en]);
  }
  phrases.sort((a, b) => b[0].length - a[0].length);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RE = new RegExp(phrases.map(([k]) => esc(k)).join('|'), 'g');
  const P = new Map(phrases);
  // short words only when they stand alone (not glued to other Thai letters), e.g. "LiDAR 2 ตัว · แบต 300"
  const RE_SHORT = new RegExp('(?<![\\u0E00-\\u0E7F])(' + shorts.map(([k]) => esc(k)).join('|') + ')(?![\\u0E00-\\u0E7F])', 'g');
  const S = new Map(shorts);

  function tr(text) {
    if (!RE_TH.test(text)) return text;
    const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0], core = text.trim();
    if (exact.has(core)) return lead + exact.get(core) + trail;
    let out = core.replace(RE, (m) => ` ${P.get(m)} `); // whole phrases first, so numbers inside them do not split them
    for (const [re, to] of RULES) out = out.replace(re, to);
    out = out.replace(RE_SHORT, (m) => S.get(m));
    out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.):;%!?])/g, '$1').replace(/\(\s+/g, '(').trim();
    return lead + out + trail;
  }

  let lang = 'th';
  try { lang = localStorage.getItem(KEY) || 'th'; } catch (_) { /* private mode */ }
  const orig = new WeakMap(), wrote = new WeakMap(), origAttr = new WeakMap();
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'NOSCRIPT']);
  let origTitle = null;

  function textNode(n, force) {
    const p = n.parentNode; if (!p || SKIP.has(p.nodeName)) return;
    if (!force && wrote.get(n) === n.nodeValue) return; // our own write echoing back through the observer
    if (force && lang === 'en' && orig.has(n)) return; // already translated
    if (lang === 'en') {
      if (!RE_TH.test(n.nodeValue)) return;
      orig.set(n, n.nodeValue);
      const t = tr(n.nodeValue); wrote.set(n, t); if (t !== n.nodeValue) n.nodeValue = t;
    } else if (orig.has(n)) {
      const o = orig.get(n); orig.delete(n); wrote.set(n, o); n.nodeValue = o;
    }
  }
  function element(el) {
    if (el.nodeType !== 1 || SKIP.has(el.nodeName)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a); if (v == null) continue;
      let o = origAttr.get(el); if (!o) { o = {}; origAttr.set(el, o); }
      if (lang === 'en' && RE_TH.test(v)) { const t = tr(v); if (t !== v) { o[a] = v; el.setAttribute(a, t); } } // only write when it changes, or the observer would loop forever
      else if (lang === 'th' && o[a] != null && v !== o[a]) { el.setAttribute(a, o[a]); delete o[a]; }
    }
  }
  function walk(root, force) {
    if (root.nodeType === 3) { textNode(root, force); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) { if (SKIP.has(root.nodeName)) return; element(root); }
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = it.nextNode())) { if (n.nodeType === 3) textNode(n, force); else element(n); }
  }
  function doTitle() {
    if (origTitle == null || (lang === 'en' && RE_TH.test(document.title))) origTitle = document.title;
    document.title = lang === 'en' ? tr(origTitle) : origTitle;
  }
  function apply() {
    document.documentElement.lang = lang;
    walk(document.body, true); doTitle();
    document.querySelectorAll('.lang-switch button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  }
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') textNode(m.target);
      else if (m.type === 'attributes') { if (lang === 'en') element(m.target); }
      else m.addedNodes.forEach((n) => walk(n));
    }
    if (lang === 'en' && RE_TH.test(document.title)) doTitle();
  });

  function toggle() {
    const box = document.createElement('div'); box.className = 'lang-switch';
    box.innerHTML = '<button data-lang="th" title="ภาษาไทย">TH</button><button data-lang="en" title="English">EN</button>';
    const css = document.createElement('style');
    css.textContent = '.lang-switch{display:inline-flex;border:1px solid rgba(201,168,76,.55);border-radius:20px;overflow:hidden;margin-left:10px;vertical-align:middle;flex:none}'
      + '.lang-switch button{background:transparent;border:none;color:#cfcac0;font:600 12px "Chakra Petch",sans-serif;padding:4px 10px;cursor:pointer;border-radius:0}'
      + '.lang-switch button.on{background:linear-gradient(180deg,#ffe08a,#C9A84C);color:#1a1300}';
    document.head.appendChild(css);
    const header = document.querySelector('header.tesr') || document.body;
    const status = header.querySelector('.status');
    if (status) header.insertBefore(box, status); else header.appendChild(box);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-lang]'); if (!b || b.dataset.lang === lang) return;
      lang = b.dataset.lang; try { localStorage.setItem(KEY, lang); } catch (_) { /* ignore */ }
      apply();
    });
  }

  function start() {
    toggle(); apply();
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  window.TESR_I18N = { tr, get lang() { return lang; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
