# HANDOFF.md — สถานะงานล่าสุด

> ใช้ไฟล์นี้ส่งต่องานข้ามเครื่อง (บ้าน ↔ ที่ทำงาน) — อ่านไฟล์นี้ก่อนเริ่ม session ถัดไป

**อัปเดตล่าสุด:** 2026-08-10 — งาน SOP recommendation engine (Phase A + B) **ปิดงานแล้ว** ✅

---

## ✅ งานที่ปิดแล้วใน session นี้ — SOP-Grounded Recommendation Engine

เป้าหมายเดิม: เมื่อพารามิเตอร์หลุดสเปค/เข้าเขต warning ให้ระบบแนะนำ control variable ที่ควรปรับ โดยอ้างอิงข้อมูลจริง (ประวัติ Action + SOP) แทนคำแนะนำ hardcode เดิม — **เสร็จสมบูรณ์ทั้ง 2 phase แล้ว**

**เอกสาร SOP อ้างอิง**: พี่ A ส่งไฟล์ `PTA Quality Characteristics Rev.14.xls` มาให้ (ที่รอไว้ในเวอร์ชันก่อนหน้าของ HANDOFF นี้) แปลงเป็น `PTA-Quality-Control.md` แล้ว — มี 3 ส่วน: (1) Product Quality Items + spec, (2) Process Control Factors 21 ตัว + Set Value/Unit/Fine-Fast tune/Tag, (3) Correlation Matrix เต็ม 21×12 (Factor × Item, ระดับผลกระทบ ◎/○/▷)

**Phase A** (commit `4ee650d`):
- `app-config.js`: `CONTROL_VARIABLES` เปลี่ยนจาก 7 ชื่อ generic เดา → 21 factor จริงจาก SOP พร้อม tag/unit/fineTune/fastTune
- `action-log.js`: เพิ่ม `resultValue`/`resultTimestamp` (เก็บตอน `checkOutcomes` มาร์ค success) + ฟังก์ชันใหม่ `getEffectStats()` คำนวณ avg Δparam/Δcontrol จาก action ที่สำเร็จจริง (N<3 → null เสมอ) พร้อม sanity-check เทียบ Fine/Fast tune จาก SOP (`sopFlag`)
- `smart-assistant.js`: ใช้ `getEffectStats` โชว์คำแนะนำเชิงตัวเลขพร้อม N เมื่อมีข้อมูลพอ

**Phase B** (commit `5fde5ed`):
- `correlation-matrix.js` (ใหม่): กริด Correlation Matrix เต็ม 60 คู่ factor×item จาก SOP §3
- `smart-assistant.js`: `getAdvice()` ใช้ correlation matrix จัดลำดับ ◎→○→▷ แทน keyword เดาเดิม (เก็บ keyword เดิมไว้เป็น fallback สุดท้ายสำหรับ item ที่ไม่อยู่ในกริด)
- ลำดับความสำคัญคำแนะนำตอนนี้: **ข้อมูลจริงจากประวัติ (N≥3) > SOP correlation matrix > generic keyword fallback**

**Bugfix หลัง push** (commit `0eb2cd0`): พี่ A รัน `npm test` บนเครื่องที่มี Node แล้วเจอเทสต์แดง — `parseSopNumbers()` ใน `action-log.js` ดึงเลขที่ติดอยู่ในหน่วย (เช่น เลข `3` ใน `g/cm3`) มาปนด้วย ทำให้ envelope ของ sopFlag กว้างเกินจริงจนไม่ flag ค่าผิดปกติ แก้ด้วย lookbehind/lookahead ไม่ให้นับเลขที่ติดตัวอักษร — trace มือผ่านทั้ง 21 factor แล้วว่าไม่พังจุดอื่น

**สถานะ CI/Deploy**: ทุก commit push แล้ว, CI ผ่าน, deploy ขึ้น production (`monitor-quality-pta.supasiao.workers.dev`) เรียบร้อย

## ⚠️ ข้อจำกัดที่ต้องรู้ก่อนแก้โค้ด business logic รอบต่อไป

**เครื่องที่ทำงาน (office) ไม่มี Node.js** — `npm`/`node` หาไม่เจอ Claude รันเทสต์เองไม่ได้ ต้อง trace โค้ดด้วยมือแทน ซึ่งพลาดได้ (ดูบั๊ก `parseSopNumbers` ข้างบนเป็นตัวอย่างจริง) **แนะนำ**: หลัง push ให้พี่ A รัน `npm test` เองที่เครื่องที่มี Node (หรือรอเช็ค CI status) ก่อนเชื่อว่าโค้ดถูกต้อง 100% อย่าเชื่อแค่ "trace มือแล้วน่าจะถูก"

## 📌 คำถามค้างที่ยังไม่ได้ยืนยันกับพี่ A (ไม่บล็อกงาน แต่ควรถามถ้าจะต่อยอด)

- Correlation Matrix เวอร์ชันล่าสุด (§3 ใน `PTA-Quality-Control.md`) มีแค่ 12 Item — **ไม่มี THM** ต่างจากตารางที่ 1 (Product Quality Items) ที่มี 13 Item พร้อม spec ≤10 ppm/1 time/month ยังไม่ชัดว่าตั้งใจตัดออกหรือ ตกหล่นตอนพี่ A สร้างชีตกริดใหม่

## 📁 ไฟล์สำคัญที่เกี่ยวข้องกับงานนี้

- `PTA-Quality-Control.md` — เอกสาร SOP แปลงจาก Excel/PDF ต้นฉบับ (3 ส่วน: Item spec, Factor, Correlation Matrix)
- `src/modules/app-config.js` — `CONTROL_VARIABLES` (21 factor จริง)
- `src/modules/action-log.js` — `getEffectStats`, `parseSopNumbers`/`sopStepEnvelope`/`checkAgainstSop`
- `src/modules/correlation-matrix.js` — กริด Correlation Matrix + `getRankedFactorsForItem`
- `src/modules/smart-assistant.js` — `getAdvice`, `getSmartAdvice`, `formatSmartAdvice` (advice priority chain)
- `tests/action-log.test.js`, `tests/correlation-matrix.test.js` — เทสต์ครอบคลุมทั้งหมดข้างต้น

---

*ไม่มีงานค้างที่ต้องทำต่อทันที — session ถัดไปเริ่มจากงานใหม่ได้เลย เว้นแต่พี่ A จะหยิบคำถามค้างด้านบนมาต่อยอด*
