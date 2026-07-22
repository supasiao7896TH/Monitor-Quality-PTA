# PTA Quality Monitor — Progress & Next Steps

เอกสารนี้สรุปสิ่งที่ทำไปแล้วและงานที่ค้างอยู่ ไว้ใช้เป็นจุดเริ่มต้นสำหรับเซสชันถัดไป

## สรุปงานที่ทำไปแล้ว (2026-07-22)

### 1. แก้ไข Baseline สถิติปนเปื้อนค่าที่หลุดสเปก — commit `6136ce9`
- **ปัญหา:** `StatEngine.computeBaseline` เดิมคำนวณ mean/SD จากค่าทั้งหมด รวมถึงค่าที่หลุดสเปกไปแล้วด้วย ทำให้เส้นเตือนอัตโนมัติ (auto warn band) เลื่อนตามข้อมูลที่ผิดปกติเอง (self-referential drift) — ยืนยันจริงกับไฟล์ Excel จริง (`2TM-304` sheet มี `Off Spec: 4-CBA` จริง)
- **แก้ไข:** กรองค่าที่หลุดสเปกออกก่อนคำนวณ baseline (`computeBaseline`/`computeRollingBaselines` รับ `specBands` เพิ่ม) + เปลี่ยนมาคำนวณครั้งเดียวต่อพารามิเตอร์แบบ rolling window แทนการคำนวณซ้ำทุกเซลล์ (แก้ปัญหาประสิทธิภาพ O(n²))
- **ไฟล์ที่แก้:** `app.js` — `StatEngine`, `Evaluator`, `SmartAssistant.analyzeAndRender`, `UIRenderer.renderTable`/`evaluateForBaseline`, `ChartManager.openModal`

### 2. แก้ปุ่มสรุป Warning/OOS แสดงรายการซ้ำกัน — commit `789ee89`
- **ปัญหา:** กดปุ่ม "จุดที่พบค่าเตือน (Warning)" กับ "จุดที่หลุดสเปค (OOS)" เปิด sidebar แสดงรายการเดียวกันหมด (ไม่กรองตามประเภทที่กด) เพราะทั้งสองปุ่มเรียก `SmartAssistant.toggle(true)` เหมือนกัน
- **แก้ไข:** เพิ่ม `activeFilter` state ใน `SmartAssistant`, ปรับ `toggle(forceOpen, filter)` ให้รับ filter type, กรองรายการใน `updateUI()`, รีเซ็ตกลับเป็น `'all'` อัตโนมัติเมื่อสลับ sheet หรือกดปุ่มกระดิ่ง/ปิด sidebar
- **ไฟล์ที่แก้:** `app.js` (`SmartAssistant`), `index.html` (onclick ของการ์ด Warning/OOS)

### 3. เพิ่มหน้า "ประวัติ Action" (Action History) — commit `7932d02`
- **Feature ใหม่:** modal แสดงประวัติ Action ที่เคยบันทึกทั้งหมด (ข้าม sheet ได้) พร้อมไทม์ไลน์ก่อน-หลัง: ค่าที่ทำให้เกิด Action (trigger, สีกลาง ไม่ตัดสิน) → follow-up samples ที่ใช้ตัดสินจริง (สีเขียว = กลับเข้าสเปก, สีแดง = ยังไม่เข้าสเปก) → badge ผลลัพธ์ (✅ สำเร็จ / ⚠️ ไม่สำเร็จ / ⏳ รอผล N/3)
- กรองได้ตาม Sheet (เฉพาะ sheet ที่มีประวัติจริง) และตามผลลัพธ์ (success/fail/pending)
- **ไม่ได้แก้ logic การตัดสิน success/fail เดิม** (`ActionLog.checkOutcomes`) — แค่เอาตัวเลขจริงที่เคยใช้ตัดสินมาแสดงประกอบให้เห็นชัดเจนขึ้น
- **ไฟล์ที่แก้:** โมดูลใหม่ `ActionHistoryUI` ใน `app.js` (วางหลัง `ActionLogUI`), modal ใหม่ `#action-history-modal` ใน `index.html`, ปุ่มใหม่ที่ header "ประวัติ Action"

## งานที่รอต่อ (ยังไม่เริ่มออกแบบ/แก้โค้ด)

ผู้ใช้แจ้งว่าจะทยอยอัปโหลดเอกสารอ้างอิงเพิ่มเติม:

1. ✅ **`Lab presentation.pdf`** (อัปโหลดแล้ว 2026-07-22, commit `86993b4`) — เอกสารอธิบายรายการทดสอบ QC ของผง PTA จากห้อง Lab SMPC มี 10 พารามิเตอร์: Appearance, Acid Value, DMF Color, Ash Content, Iron, Water Content, Average Particle Size (APS), B-value, 4-Carboxybenzaldehyde (4-CBA), p-Toluic Acid (p-TA) — แต่ละตัวมีโครงสร้างเดียวกัน: **ความหมาย / ความสำคัญ / วิธีการทดสอบ / Specification** เหมาะทำเป็นหน้า Knowledge Base เพราะชื่อพารามิเตอร์หลายตัวตรงกับคอลัมน์ที่แอปแกะมาจาก Excel อยู่แล้ว (4-CBA, p-TA, B-VALUE, MPS/APS)
2. ⏳ **เอกสารการปรับค่าต่างๆ เพื่อควบคุม Quality** — ยังไม่อัปโหลด (ผู้ใช้บอกว่า "ยังไม่หมด เดี๋ยวคราวหลังจะ upload ให้ใหม่")

เมื่อได้เอกสารครบแล้ว ผู้ใช้ยืนยัน (ผ่าน AskUserQuestion) ว่าต้องการนำไปใช้ 3 เรื่อง:

1. **ปรับปรุงคำแนะนำอัตโนมัติ (Advice)** — ปัจจุบัน `SmartAssistant.getAdvice()` (`app.js` บริเวณบรรทัด ~563-572) เป็น if/else แบบ hardcode ตาม substring ของชื่อพารามิเตอร์ (เช่น `name.includes('4-cba')` → "ตรวจสอบอุณหภูมิ Reactor หรือปริมาณ Catalyst") ต้องการแทนที่/เสริมด้วยเนื้อหาจริงจากเอกสารแทนการเดาแบบ hardcode
2. **เพิ่มหน้าอ้างอิงความรู้ (Knowledge Base)** — สร้างหน้า/ปุ่มใหม่ให้เปิดดูคำอธิบายพารามิเตอร์คุณภาพจากเอกสารได้ในแอปโดยตรง โดยไม่ต้องออกจากแดชบอร์ด
3. **ตรวจสอบ Spec/ตัวแปรควบคุมให้ถูกต้องขึ้น** — เช่น `APP_CONFIG.CONTROL_VARIABLES` (`app.js` บริเวณบรรทัด ~12-15, ปัจจุบัน hardcode: `['Rinse Ratio', 'Reactor Temperature', 'Catalyst Feed Rate', 'Residence Time', 'Oxidation Air Rate', 'Solvent Ratio', 'Crystallizer Temperature']`) และ/หรือการตีความ spec band ควรอ้างอิง/ตรวจสอบไขว้กับเอกสารแทนที่จะพึ่งแค่สิ่งที่ hardcode ไว้หรือแกะจากไฟล์ Excel เพียงอย่างเดียว

**เหตุผลที่ยังไม่เริ่มออกแบบ implementation:** ยังไม่เห็นรูปแบบข้อมูลจริงของเอกสารชุดที่ 2 (การปรับค่าควบคุม) — รูปแบบไฟล์ (PDF/Word/Excel), โครงสร้างเนื้อหา (ตาราง lookup หรือข้อความอธิบายอิสระ) จะเป็นตัวกำหนดวิธีออกแบบทั้งหมด การวางแผนตอนนี้จะเป็นการเดาโครงสร้างข้อมูลที่ยังไม่มีอยู่จริง

## จุดที่ควรเริ่มในเซสชันถัดไป
1. เช็คว่ามีไฟล์เอกสารใหม่อัปโหลดมาหรือยัง (`git fetch && git log --oneline origin/main` แล้ว `git pull --ff-only` ถ้ามี commit ใหม่)
2. อ่านเอกสารทั้งหมดที่มี (`Lab presentation.pdf` + ไฟล์ใหม่) เพื่อดูโครงสร้างข้อมูลจริง
3. Map เนื้อหาเอกสารเข้ากับ 3 เป้าหมายด้านบน แล้ววางแผนการเปลี่ยนแปลงที่ชัดเจนใน `SmartAssistant.getAdvice`, หน้า Knowledge Base ใหม่, และ/หรือ `CONTROL_VARIABLES`/spec handling

## ไฟล์สำคัญในโปรเจกต์
- `index.html` — โครงหน้าเว็บทั้งหมด, modal ต่างๆ (`chart-modal`, `action-modal`, `action-history-modal`), ปุ่มใน header (`#action-buttons`)
- `app.js` — โมดูลหลักทั้งหมดแบบ IIFE: `APP_CONFIG`, `STORAGE_ENGINE` (IndexedDB), `SpecEvaluator`, `ExcelParser`, `StatEngine`, `Evaluator`, `ActionLog`, `SmartAssistant`, `ActionLogUI`, `ActionHistoryUI`, `UIRenderer`, `ChartManager`, `ExportManager`, `APP_CORE`
- ไฟล์ Excel ตัวอย่างจริงที่มีในโปรเจกต์ (ใช้ทดสอบได้ทันที ไม่ต้องสร้างไฟล์ปลอม): `Routine_GCM-PTA 2_Analysis Report for GCM2 (PTA)_2026-04-28 (3).xlsx`, `Routine_GCM-PTA 2_Analysis Report for GCM2 (CTA)_2026-04-28.xlsx`
- `Lab presentation.pdf` — เอกสารอธิบาย QC parameters (ชุดที่ 1 จาก 2, รอเอกสารการปรับค่าควบคุมเพิ่มเติม)

## วิธีรันทดสอบในเครื่อง (local)
ไม่มี build step — เป็น static HTML/JS ล้วน:
```bash
python -m http.server 8765   # รันจาก root ของ repo
# เปิด http://localhost:8765/index.html ในเบราว์เซอร์
```
ข้อมูลเก็บใน IndexedDB ของเบราว์เซอร์ (persist ข้าม session ถ้าใช้ browser profile เดิม)
