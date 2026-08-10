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

ตารางต้นฉบับ (ทั้งใน .xls และ .pdf) มีกริดสัญลักษณ์ ◎/○/▷ (3 ระดับ) เชื่อมโยงว่าแต่ละ Factor ในตารางที่ 2 ส่งผลกระทบต่อ Item คุณภาพในตารางที่ 1 มากน้อยเพียงใด (เดิมภาพ PDF มี **●** ปรากฏในแถว BFM ด้วย แต่ยืนยันแล้วว่าเป็นแค่ไฮไลต์สีทึบของแถว ไม่ใช่สัญลักษณ์ระดับที่ 4 — พี่ A เอาไฮไลต์นี้ออกจากไฟล์ Excel แล้ว)

**ความหมายสัญลักษณ์ (ยืนยันโดยพี่ A แล้ว)**:

- ▷ สามเหลี่ยม = **Low effect** — ปรับ factor แล้ว item เปลี่ยนแปลงน้อย
- ○ วงกลมชั้นเดียว = **Medium effect** — ปรับ factor แล้ว item เปลี่ยนแปลงปานกลาง
- ◎ วงกลม 2 ชั้น = **High effect** — ปรับ factor แล้ว item เปลี่ยนแปลงมาก

ตัวอย่างจากพี่ A: ปรับลด **Slurry density** (factor) → **4-CBA** (item) เปลี่ยนแปลง**น้อย** → cell ที่จับคู่ Slurry density × 4CBA ควรเป็น ▷

**สิ่งที่ยังดึงเป็นข้อมูลไม่ได้**: ตำแหน่งจับคู่จริงราย cell (Factor ตัวไหน × Item ตัวไหน = สัญลักษณ์อะไร) เพราะ:

- ไฟล์ `.xls`: cell values ของคอลัมน์ Severity ทั้งหมดว่างเปล่า (สัญลักษณ์เป็นรูปวาด/shape ไม่ใช่ text)
- ไฟล์ `.pdf`: เป็นภาพสแกนหมุน 90° สัญลักษณ์เล็กมาก อ่านตำแหน่งจับคู่รายเซลล์แม่นยำไม่ได้

**แนะนำ**: หากต้องใช้ correlation matrix นี้จริงจัง (เช่น ทำฟีเจอร์ auto-suggest ว่า factor ไหนกระทบ item ไหนใน Monitor-Quality-PTA) ให้เปิดไฟล์ `PTA Quality Characteristics Rev.14.xls` ด้วย Excel โดยตรงแล้วอ่านค่ากริดด้วยตา (ตอนนี้รู้ความหมายสัญลักษณ์แล้ว เหลือแค่ต้องกรอกตำแหน่งจับคู่ราย cell) หรือขอให้ผู้ดูแลเอกสารส่งเวอร์ชันที่กรอกสัญลักษณ์เป็นตัวอักษร/ตัวเลขในเซลล์แทนรูปวาด

---

## Source

- ไฟล์ต้นฉบับหลัก: `PTA Quality Characteristics Rev.14.xls` (sheet `PTA`, 48 rows × 30 cols)
- ไฟล์อ้างอิงรอง: `PTA Quality control.pdf` (สแกนภาพของตารางเดียวกัน — ใช้ยืนยัน layout เท่านั้น)
- วิธีแปลง: อ่านค่า cell ด้วย Python `xlrd` โดยตรง (ไม่ผ่าน OCR) แปลงเป็น Markdown เมื่อ 2026-08-10
- ข้อจำกัดที่เหลืออยู่: กริด Severity/Correlation Matrix (ส่วนที่ 3) — ความหมายสัญลักษณ์ ▷/○/◎ ยืนยันแล้ว แต่ตำแหน่งจับคู่รายเซลล์ (Factor × Item) ยังดึงจากไฟล์ไม่ได้ ต้องตรวจสอบด้วยตาจากไฟล์ต้นฉบับ
