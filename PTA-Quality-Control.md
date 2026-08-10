# PTA Production QC Process Chart

> ที่มา: `PTA Quality Characteristics Rev.14.xls` (sheet `PTA`, ต้นฉบับตัวจริง — ใช้แทน `PTA Quality control.pdf` ซึ่งเป็นสแกนภาพหมุน 90° ของตารางเดียวกัน)
> อ่านค่าด้วย `xlrd` (cell values ล้วนๆ ไม่ใช่ OCR) เมื่อ 2026-08-10
> ใช้เป็นเอกสารอ้างอิงความรู้โดเมน (spec/threshold ของ parameter จริงในโรงงาน) ประกอบการพัฒนา Monitor-Quality-PTA

⚠️ **ข้อจำกัดที่ยังเหลืออยู่แม้อ่านจาก Excel ต้นฉบับ**: กริด **Severity / Correlation Matrix** (สัญลักษณ์ ◎○▷ ที่จับคู่ว่า Factor แต่ละตัวกระทบ Item คุณภาพตัวไหนมาก/น้อย — ความหมายของสัญลักษณ์ยืนยันแล้วโดยพี่ A ดูหัวข้อ [Legend](#legend)) ในไฟล์ต้นฉบับทุก cell ของคอลัมน์นี้ (คอลัมน์ APS ถึง Appearance ในทุกแถว Factor) อ่านค่าออกมาเป็นค่าว่างทั้งหมด — แปลว่าสัญลักษณ์เหล่านี้ **ไม่ได้เป็น text ในเซลล์** แต่น่าจะเป็นรูปวาด/shape/ไอคอนที่วางทับ (`xlrd` อ่านค่า cell แต่ไม่อ่าน embedded drawing ของไฟล์ `.xls`) จึงดึง**ตำแหน่งจับคู่รายเซลล์**ออกมาเป็นข้อความอัตโนมัติไม่ได้ ต้อง**เปิดไฟล์ Excel ด้วยตาเพื่อตรวจสอบกริดนี้โดยตรง**หากต้องใช้งานจริง (เช่น จะทำ auto-suggest ว่า factor ไหนกระทบ item ไหนใน Monitor-Quality-PTA)

---

## Legend

| คำย่อ | ความหมาย |
| --- | --- |
| SM | Section Manager |
| PE | Process Engineer |
| F/M | Foreman |
| Q | Quality |
| C | Cost |
| D | Delivery |
| S | (ปรากฏร่วมกับ Q/D ในคอลัมน์ Q,C,D เช่น "Q,S" — ไม่มีคำอธิบายแยกในต้นฉบับ นอกเหนือจาก Q/C/D ที่ระบุไว้) |
| ▷ (สามเหลี่ยม) | **Low effect** — ปรับ factor นี้แล้ว item ที่เกี่ยวข้องเปลี่ยนแปลง**น้อย** เช่น ลด Slurry density แล้ว 4-CBA เปลี่ยนแปลงน้อย |
| ○ (วงกลมชั้นเดียว) | **Medium effect** — ปรับ factor นี้แล้ว item ที่เกี่ยวข้องเปลี่ยนแปลง**ปานกลาง** |
| ◎ (วงกลม 2 ชั้น) | **High effect** — ปรับ factor นี้แล้ว item ที่เกี่ยวข้องเปลี่ยนแปลง**มาก** |

ที่มา (footer ของ sheet, แถว R47): *"SM = Section Manager, PE = Process Engineer, F/M = Foreman   Q = Quality, C = Cost, D = Delivery"*
ที่มาความหมาย ▷/○/◎: ยืนยันโดยพี่ A ในบทสนทนา (2026-08-10) — ไม่ได้มาจากไฟล์ต้นฉบับโดยตรง เพราะ Legend ในภาพ/ไฟล์ Excel ไม่มีคำอธิบายสัญลักษณ์เหล่านี้ตรงๆ

**อัปเดต (2026-08-10)**: สัญลักษณ์ **●** (วงกลมทึบ) ที่เคยพบในแถว BFM จากภาพ PDF ไม่ใช่สัญลักษณ์ correlation ตัวที่ 4 — เป็นแค่**ไฮไลต์สีทึบ**ของแถวนั้นในไฟล์ Excel ต้นฉบับ (ไม่ได้สื่อความหมายเพิ่มเติมในระบบ Severity) พี่ A เอาไฮไลต์นี้ออกจากไฟล์ `PTA Quality Characteristics Rev.14.xls` แล้ว ดังนั้นระบบ Severity มีแค่ 3 ระดับ: ▷ / ○ / ◎

**โครงสร้างตาราง**: Process Stage → Decision Maker (SM/PE/F/M) → Factor → Q,C,D → [Severity matrix ต่อ Item — ดึงไม่ได้] → Set Value/Unit → Step of adjustment (Fine tune / Fast-Emergency tune) → Related document → Frequency/Location/Tag (check point)

---

## 1. Product Quality Items (สเปกคุณภาพผลิตภัณฑ์ PTA/CTA powder)

| Item | Standard Value | Sampling Frequency |
| --- | --- | --- |
| APS | Follow Criteria Silo * | 12 times/day |
| P-TA | Follow Criteria Silo * | 12 times/day |
| b-value | Follow Criteria Silo * | 1 time/day |
| T-400 | Follow Criteria Silo * | 12 times/day |
| T-340 | Follow Criteria Silo * | 12 times/day |
| 4CBA | Follow Criteria Silo * | 12 times/day |
| Moisture | (ไม่ระบุในตารางนี้) | 1 time/day |
| Co | (ไม่ระบุในตารางนี้) | 1 time/week |
| Ash | ≤ 6 ppm | 1 time/day |
| THM | ≤ 10 ppm | 1 time/month |
| BFM | ≤ 3.0 pc/g | 1 time/day |
| *(คอลัมน์ไม่มีชื่อ Item ระหว่าง BFM กับ Fe)* ** | ≤ 4.5 pc/g | 1 time/day |
| Fe | ≤ 2 ppm | 1 time/day |
| Appearance | No contamination | Before sending to BG |

\* ในไฟล์ Excel ข้อความ "Follow Criteria Silo" อยู่ในเซลล์เดียวที่ครอบคลุม (merge) ตั้งแต่คอลัมน์ APS ถึง 4CBA — หมายถึงกลุ่มนี้ไม่มี standard value ตัวเลขแยกเฉพาะในตารางนี้ ให้ใช้เกณฑ์ตามที่อ้างอิงในเอกสารอื่น (ดู Related document ของ Factor ที่เกี่ยวข้องในตารางที่ 2)

\*\* มีคอลัมน์ spec (≤4.5 pc/g, 1 time/day) แทรกอยู่ระหว่าง BFM กับ Fe ในต้นฉบับ แต่ไม่มีชื่อ Item กำกับที่ `xlrd` อ่านได้ — อาจเป็น text box/WordArt/ชื่อที่ตกหล่นตอนบันทึกไฟล์ ควรเปิด Excel ตรวจสอบด้วยตา

---

## 2. Process Control Factors (เรียงตามลำดับกระบวนการจริง: Feed → Reactor → Crystallization → Separation → Drying → Silo)

> ลำดับนี้ตรงกับลำดับแถวจริงใน sheet Excel และตรงกับกระบวนการผลิต PTA จริง (Feed เข้า Reactor → Crystallization → Separation (centrifuge) → Drying → เก็บที่ Silo)

| # | Stage | Factor | Decision Maker | Q,C,D | Set Value | Unit | Fine tune | Fast (Emergency) | Related document | Frequency | Location | Tag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Feed | CTA T-340 | SM | Q | > 5 | % | 0.01 | 2 - 3 % | P1(2,3)-F-1004 | 6 times/day | Lab sampling | TM-304 |
| 2 | Feed | CTA 4-CBA | SM | Q | < 4500 | ppm | 100 ppm | 200 - 300 ppm | P1(2,3)-F-1004 | 8 times/day | Lab sampling | TM-304 |
| 3 | Feed | Reprocess from TTK-401 | SM | Q | 0.5 ~ 8 | t/h | 0.5-1 t/h | 2 - 3 t/h | P1(2,3)-F-1002 | 4 time/day | DCS | XC1401 |
| 4 | Feed | CTA feed rate | SM | D,S | P1: 40-60 / P2: 40-60 / P3: 45-78 | t/h | 0.5-1 t/h | 2.5-5 t/h | P1(2,3)-F-2002 | 4 times/day | DCS | FC2101A |
| 5 | Feed | Slurry density | SM | Q,S | 1.070 ~ 1.090 | g/cm3 | 0.001 g/cm3 | 0.002-0.005 g/cm3 | P1(2,3)-F-2002 | 4 times/day | DCS | AI2100 |
| 6 | Feed | Hot oil flow rate | SM | Q,S | 400 - 650 | t/h | 1 -2 t/h | 4-5 t/h | P1(2,3)-F-2003 | 4 times/day | DCS | FC-2604 |
| 7 | Feed | H2 purity | SM | Q | Min: 98 | % vol. | - | - | COA form | 1 time/week | Form | COA |
| 8 | Reactor | Reactor pressure | SM, PE, F/M | Q,S | 72 - 81 | kg/cm2 | 0.1 kg/cm2 | 0.2-0.5 kg/cm2 | P1(2,3)-F-2002 † | 4 times/day | DCS | PC-2201 |
| 9 | Reactor | PCV-2201.MV | SM, PE, F/M | Q | - | % | - | - | DCS | Real Time | DCS | PC-2201 |
| 10 | Crystallization | Pressure of PD-301 | SM, PE, F/M | Q | 35 - 49 | kg/cm2 | 0.5 Kg/>1Hr | 0.5 Kg/<1Hr | P1(2,3)-F-2002 | 4 times/day | DCS | PC-2301 |
| 11 | Crystallization | Level of PD-301 | SM, PE, F/M | Q | 15 - 45 | % | 1%/>30min | 1%/<30min | P1(2,3)-F-2002 | 4 times/day | DCS | LC-2301 |
| 12 | Separation | Temperature of reslurry water | SM, PE, F/M | Q | 85 ~ 110 | °C | 1 °C | 2-5 °C | P1(2,3)-F-2002 | 4 times/day | DCS | TC-2401 |
| 13 | Separation | Reslurry water to PM-401 | SM, PE, F/M | Q | 20 ~ 35 | t/h | 0.5-1.0 t/h | 1.0-2.0 t/h | P1(2,3)-F-2002 | 4 times/day | DCS | FC-2401A/B |
| 14 | Separation | LPW to suction PP-304 | SM, PE, F/M | Q | 0 - 14 | t/h | 1 t/h | 2-3 t/h | P1(2,3)-F-2002 | 4 times/day | DCS | FC-2704 |
| 15 | Separation | RPF Torque | SM, PE, F/M | S | 40 - 450 | N.m | - | - | P3-F-2003 | 4 times/day | DCS | XI-2400A/B |
| 16 | Separation | CoAc flow rate | SM, PE, F/M | Q,S | < 70 | cc/min | 1 cc/min | 2 cc/min | P3-F-2003 | 4 times/day | DCS | FI-2450 |
| 17 | Separation | Rinse Ratio RPF | SM, PE, F/M | Q | 0.45 - 0.75 | % | 0.02 | 0.04-0.06 | P3-F-2003 | 4 times/day | DCS | RC-2402A/B |
| 18 | Separation | Recycle water | SM, PE, F/M | Q | 0 - 40 | % | 5 - 10 % | 20 -50 % | P1(2,3)-F-2002 | 4 times/day | DCS | LC-2501A |
| 19 | Drying | Dryout Temperature | SM | Q,S | 110 - 132 | °C | - | - | P1(2,3)-F-2003 | 4 times/day | DCS | TC-2410 |
| 20 | Drying | Dryer steam pressure | SM, PE, F/M | Q,S | 4.5 max. | kg/cm2 | 0.02 kg/cm2 | 0.03-0.05 kg/cm2 | P1(2,3)-F-0002 | 4 times/day | DCS | PC-2404A |
| 21 | Silo | Vibration screen | SM | Q,S | No damage | - | - | - | P1(2,3)-F-0002 | P1,P3 10 batch/time, P2 Every batch | Local | PM-802A(B,C) |

† ต้นฉบับพิมพ์เป็น `P1(2,)-F-2002` (ขาดเลข 3) — สันนิษฐานว่าพิมพ์ตกหล่น ควรตรวจสอบกับเอกสารจริง

**หมายเหตุ H2 purity (#7)**: มีข้อความเพิ่มเติมในแถวถัดไปของ Excel ระบุ "suppliers" ทั้งในช่อง Related document และ Location — สื่อว่าค่า H2 purity มาจาก COA ของ supplier ไม่ได้วัดเองในโรงงาน

---

## 3. Correlation Matrix (Factor × Item Severity)

กริดสัญลักษณ์ ◎/○/▷ เชื่อมโยงว่าแต่ละ Factor (ตารางที่ 2) ส่งผลกระทบต่อ Item คุณภาพ (ตารางที่ 1) มากน้อยเพียงใด

⚠️ **แก้ไขเมื่อ 2026-08-10 (ครั้งที่ 2)**: เวอร์ชันแรกของตารางนี้ (อ่านด้วยตาจากภาพ PDF export) **ผิดหลายจุด** — พี่ A ทดสอบใช้งาน Smart Assistant จริงแล้วเทียบกับ SOP พบว่าคอลัมน์ P-TA ไม่ตรง ตรวจสอบเพิ่มเติมพบว่าคอลัมน์ b-value, T-400, T-340, 4CBA ก็ผิดหลายจุดเช่นกัน (เช่น RPF Torque ที่ถูกต้องคือกระทบ **BFM** ไม่ใช่ Ash; Dryout/Dryer steam pressure ที่ถูกต้องคือกระทบ **Moisture** ไม่ใช่ 4CBA)

**สาเหตุ**: ไฟล์ Excel มีคอลัมน์ที่ 13 ที่ไม่มีหัวข้อ (header) แทรกอยู่ระหว่าง APS กับ P-TA — เกิดจาก header "APS" เป็น merged cell ที่กินพื้นที่ 2 คอลัมน์จริง แต่แถวข้อมูลด้านล่างไม่ได้ merge ตาม ทำให้ตอนอ่านภาพด้วยตา นับคอลัมน์เพี้ยนไป

**วิธีอ่านที่แก้ไขแล้ว (แม่นยำกว่าเดิมมาก)**: แทนที่จะอ่านภาพด้วยตา ใช้ Excel COM automation (PowerShell) ดึงข้อมูลจาก `Worksheet.Shapes` collection ตรงๆ — แต่ละ shape มี property `.TopLeftCell.Row`/`.Column` บอกตำแหน่ง cell ที่แน่นอน และ `.Type`/`.AutoShapeType` บอกชนิดสัญลักษณ์ (`msoGroup` = วงกลม 2 ชั้น = ◎, `msoShapeOval` = วงกลมชั้นเดียว = ○, `msoShapeIsoscelesTriangle` = สามเหลี่ยม = ▷) วิธีนี้ไม่ต้องเดาตำแหน่งจากภาพเลย พบ shape ทั้งหมด 62 ชิ้น (55 ชิ้นเป็นข้อมูลจริง, 5 ชิ้นซ้ำซ้อนกับ APS เพราะ shape ไปวางอยู่ในคอลัมน์ที่ 13 ที่ซ่อนอยู่ — ค่าตรงกับคอลัมน์ APS จริงทุกจุด จึงถือเป็นการวาดซ้ำ ไม่ใช่ item ที่ 13 แยกต่างหาก, และ 2 ชิ้นเป็น shape ขนาด 0×0 พิกเซล ที่ตำแหน่ง Dryout Temperature×T-400 และ Vibration screen×T-400 — มองไม่เห็นจริงในชีต จึงตัดออกจากตารางนี้ ถือเป็น artifact ไม่ใช่ข้อมูลจริง ควรตรวจสอบกับพี่ A ถ้าจริงๆ แล้วมีความหมาย)

**ตรวจสอบความถูกต้อง**: เทียบกับ 2 คอลัมน์ที่พี่ A ยืนยันตรงจาก SOP เองแล้ว (APS 6 คู่, P-TA 10 คู่ — รวม 16 คู่) **ตรงกันทุกคู่ (16/16)**

**ความหมายสัญลักษณ์**:

- ▷ สามเหลี่ยม = **Low effect** — ปรับ factor แล้ว item เปลี่ยนแปลงน้อย
- ○ วงกลมชั้นเดียว = **Medium effect** — ปรับ factor แล้ว item เปลี่ยนแปลงปานกลาง
- ◎ วงกลม 2 ชั้น = **High effect** — ปรับ factor แล้ว item เปลี่ยนแปลงมาก

⚠️ หมายเหตุ: กริดเวอร์ชันนี้มี 12 Item (ไม่มี **THM** เทียบกับตารางที่ 1 ซึ่งมี 13 Item) — อาจเป็นเพราะ THM ไม่ได้อยู่ในขอบเขตการวิเคราะห์ correlation นี้ หรือคอลัมน์ตกหล่นตอนสร้างชีตใหม่ ควรตรวจสอบกับพี่ A หากต้องใช้ THM ในฟีเจอร์ auto-suggest — จุดนี้ยังไม่เปลี่ยนจากเวอร์ชันก่อน

### กริดเต็ม (21 Factor × 12 Item) — แก้ไขแล้ว, ยืนยันด้วย Shapes API

| Factor | APS | P-TA | b-value | T-400 | T-340 | 4CBA | Moisture | Co | Ash | BFM | Fe | Apperance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CTA T-340 | | | | ◎ | ◎ | | | | | | | |
| CTA 4-CBA | | ◎ | | | | ○ | | | | | | |
| Reprocess from TTK-401 | | ○ | | ◎ | ◎ | ○ | | | | | | |
| CTA feed rate | ○ | ○ | ○ | ◎ | ◎ | ○ | | | | ○ | | |
| Slurry density | ▷ | ▷ | | ▷ | ▷ | | | | | ○ | | |
| Hot oil flow rate | | | | | | | | | | ○ | | |
| H2 purity | | | | ▷ | ▷ | ▷ | | | | | | |
| Reactor pressure | ◎ | ▷ | ◎ | ▷ | ▷ | ◎ | | | | | ○ | |
| PCV-2201.MV | ◎ | | | | | | | | | | | |
| Pressure of PD-301 | ◎ | | | ▷ | ▷ | | | | | | | |
| Level of PD-301 | ◎ | ▷ | | ▷ | ▷ | | | | | | | |
| Temperature of reslurry water | | | | ▷ | ▷ | | | | | | | |
| Reslurry water to PM-401 | | ○ | | ▷ | ▷ | | | | | | | |
| LPW to suction PP-304 | | ◎ | | | | | | | | | | |
| RPF Torque | | | | | | | | | | ◎ | | ◎ |
| CoAc flow rate | | | | | | | | ◎ | | | | |
| Rinse Ratio RPF | | ◎ | | | | | | | | | | |
| Recycle water | | ○ | | | | | | | | | | |
| Dryout Temperature | | | | | | | ◎ | | | | | ○ |
| Dryer steam pressure | | | | | | | ◎ | | | | | ○ |
| Vibration screen | | | | | | | | | | | | ◎ |

หมายเหตุ: ช่องว่าง = ไม่มีความสัมพันธ์ที่ระบุไว้ในกริดต้นฉบับ (ไม่ใช่ "ไม่ทราบ")

**สังเกตที่น่าสนใจ (อัปเดตตามข้อมูลที่แก้ไขแล้ว)**:

- **P-TA** ยังคงเป็น item ที่ถูก factor กระทบเยอะที่สุด (10 factor) แต่กลุ่มที่กระทบมาก (◎) เปลี่ยนไป: CTA 4-CBA, LPW to suction PP-304, Rinse Ratio RPF — ไม่ใช่กลุ่ม Crystallization (PCV-2201.MV/Pressure-Level of PD-301) เหมือนที่เข้าใจผิดในเวอร์ชันแรก
- **APS** สัมพันธ์กับกลุ่ม Reactor/Crystallization เป็นหลัก (Reactor pressure, PCV-2201.MV, Pressure/Level of PD-301 = ◎ ทั้งหมด)
- **Moisture** และ **Fe** ตอนนี้มีข้อมูลปรากฏ (Moisture: Dryout/Dryer steam pressure = ◎; Fe: Reactor pressure = ○) ต่างจากเวอร์ชันแรกที่ไม่มีข้อมูล Moisture เลย
- **Ash** ไม่มี factor จับคู่เลยในกริดนี้ (ต่างจากเวอร์ชันแรกที่เข้าใจผิดว่า RPF Torque กระทบ Ash — จริงๆ แล้ว RPF Torque กระทบ **BFM**)
- **Co** ยังคงมีแค่ 1 factor จับคู่ (CoAc flow rate = ◎) เหมือนเดิม

---

## Source

- ไฟล์ต้นฉบับ §1-2: `PTA Quality Characteristics Rev.14.xls` เวอร์ชันแรก (sheet `PTA`, 48 rows × 30 cols) — อ่านด้วย Python `xlrd` โดยตรง
- ไฟล์ต้นฉบับ §3: `PTA Quality Characteristics Rev.14.xls` เวอร์ชันอัปเดต (2026-08-10, sheet `PTA`, 45 rows × 14 cols — พี่ A ปรับเป็นชีตกริด correlation ล้วนๆ แทนตารางเดิม)
  - **ความพยายามที่ 1** (ผิด, แก้ไขแล้ว): `xlrd` อ่าน text ไม่ได้ (สัญลักษณ์เป็นรูปวาด) จึงใช้ Excel COM automation export เป็น PDF (vector) แล้วอ่านด้วยตาแทน — มีบั๊กจากคอลัมน์ที่ 13 ที่ไม่มี header ซ่อนอยู่ ทำให้นับคอลัมน์เพี้ยนหลายจุด (พี่ A ทดสอบเทียบกับ SOP เจอ)
  - **ความพยายามที่ 2** (แก้ไขแล้ว, ใช้จริง): ใช้ Excel COM automation อ่าน `Worksheet.Shapes` collection โดยตรง — ได้พิกัด cell ที่แน่นอนของทุก shape (62 ชิ้น) ไม่ต้องอ่านภาพด้วยตาอีก ยืนยันตรงกับ 2 คอลัมน์ที่พี่ A confirm จาก SOP เอง (APS, P-TA) 16/16 คู่
- ไฟล์อ้างอิงรอง: `PTA Quality control.pdf` (สแกนภาพของตารางเวอร์ชันแรก — ใช้ยืนยัน layout เท่านั้น)
- แปลงเป็น Markdown ครั้งแรก: 2026-08-10, อัปเดต §3 ครั้งที่ 1 (Correlation Matrix เต็ม แต่มีบั๊ก): 2026-08-10, แก้ไข §3 ครั้งที่ 2 (Shapes API, ยืนยันถูกต้อง): 2026-08-10
- บทเรียน: การอ่านภาพ/PDF ด้วยตา (แม้จะเป็น vector PDF คมชัด) มีความเสี่ยงผิดพลาดสูงกว่าที่คาดไว้มาก โดยเฉพาะกับ grid ที่มี merged header cells — ควรใช้วิธีดึงข้อมูลเชิงโปรแกรม (เช่น Shapes API) แทนการอ่านภาพเสมอเมื่อทำได้ และควรขอให้ผู้ใช้ spot-check ผลลัพธ์อย่างน้อย 1-2 จุดก่อนเชื่อข้อมูลทั้งหมด
