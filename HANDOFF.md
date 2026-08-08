# HANDOFF.md — สถานะงานล่าสุด

> ใช้ไฟล์นี้ส่งต่องานข้ามเครื่อง (บ้าน ↔ ที่ทำงาน) — อ่านไฟล์นี้ก่อนเริ่ม session ถัดไป

**อัปเดตล่าสุด:** 2026-08-08 (บ่าย) — รอทำต่อช่วงเย็นวันเดียวกัน

---

## ✅ สิ่งที่ทำเสร็จแล้วใน session นี้

1. สร้าง `CLAUDE.md` (guidance สำหรับ Claude Code — commands, CI/CD flow, architecture ของ Vite/ES-modules migration) — commit `8eb5de8`, push ขึ้น `origin/main` แล้ว
2. เสนอ **Architecture Blueprint** สำหรับฟีเจอร์ใหม่: ระบบแนะนำเชิงปริมาณ (data-driven SOP suggestion) จากประวัติ Action Log จริง — พี่ A ตอบ "OK" แต่ขอหยุดไว้ก่อนเพื่อเขียน HANDOFF.md นี้ **ยังไม่เริ่มเขียนโค้ด**

## ⏳ งานที่กำลังจะเริ่ม (รอ "อนุมัติ" ชัดเจนตอนกลับมาทำต่อ)

**เป้าหมาย:** เมื่อพารามิเตอร์ (เช่น 4-CBA) หลุดสเปค/เข้าเขต warning ให้ระบบคำนวณจากประวัติ Action จริงว่า "เคยปรับ Control Variable เท่าไหร่ แล้วพารามิเตอร์เปลี่ยนไปเท่าไหร่จริง" (เช่น "ปรับ PC-2201.SV +2 → 4-CBA ลดจาก 16.0→15.5 ppm") แทนคำแนะนำ hardcode เดิมใน `SmartAssistant.getAdvice()`

**สรุป Blueprint ที่เสนอไว้:**

| ไฟล์ | สิ่งที่ต้องแก้ |
|---|---|
| `src/modules/action-log.js` | `checkOutcomes` เก็บ `resultValue`/`resultTimestamp` เพิ่มตอน mark success (ไม่ต้อง migrate DB) + ฟังก์ชันใหม่ `getEffectStats(sheet, paramName, bucket, controlVariable)` คำนวณ avg Δparam / avg Δcontrol จาก action ที่ success แล้ว — คืน `null` ถ้า N < 3 |
| `src/modules/smart-assistant.js` | ใช้ `getEffectStats` แสดงคำแนะนำเชิงตัวเลข (พร้อม N) แทน/เสริม `getAdvice()` เดิม เมื่อมีข้อมูลพอ; ส่วน "เคยทำมาก่อน" เพิ่ม Δ ของ parameter ต่อแถว |
| `tests/action-log.test.js` | เพิ่มเทสต์ `getEffectStats` (N<3 → null, ปัดข้อมูลที่ parse ไม่ได้, คำนวณ average ถูกต้อง) |

**หลักการที่ต้องคงไว้:** คำแนะนำเป็นข้อมูลประกอบการตัดสินใจเท่านั้น ไม่สั่งงานอัตโนมัติกับ DCS/Exapilot, ทุกคำแนะนำต้องโชว์ N เสมอ, ถ้า N<3 ไม่เดา — fallback ไป advice text เดิม

## 📌 ข้อมูลสำคัญที่ต้องรอ — SOP อ้างอิงค่ามาตรฐาน

พี่ A แจ้งว่ามี **ไฟล์ SOP มาตรฐานสำหรับการปรับค่าควบคุมของ PTA Quality** อยู่ (ยังไม่ได้แนบ — จะทยอยอัปโหลดให้ทีหลัง)

**สำคัญ:** ควรอ่านไฟล์นี้ก่อนเริ่ม implement บล็อกข้างบน เพราะอาจกระทบการออกแบบโดยตรง เช่น:
- รายชื่อ Control Variable ที่ถูกต้อง/ครบถ้วน (ตอนนี้ `APP_CONFIG.CONTROL_VARIABLES` เป็น hardcode list 7 ตัว — `src/modules/app-config.js`)
- ช่วงค่ามาตรฐาน/ทิศทางการปรับที่ถูกต้องตาม SOP จริง ซึ่งควรใช้ตรวจสอบไขว้กับตัวเลขที่คำนวณได้จากประวัติ Action (ไม่ใช่พึ่งสถิติจากประวัติอย่างเดียว)
- นี่คือเป้าหมายข้อ 3 ที่เคย pending ไว้ใน `PROGRESS.md` ด้วย ("ตรวจสอบ Spec/ตัวแปรควบคุมให้ถูกต้องขึ้น")

## 🚀 จุดเริ่มต้น session ถัดไป

1. เช็คว่าพี่ A แนบไฟล์ SOP มาแล้วหรือยัง (`git status` / ถามตรงๆ) — ถ้ามาแล้วให้อ่านก่อน แล้ว map เข้ากับ Blueprint ด้านบนว่าต้องปรับตรงไหนไหม
2. ถ้ายังไม่มีไฟล์ SOP และพี่ A ต้องการเริ่มเลย — ยืนยัน "อนุมัติ" Blueprint เดิมแล้วเริ่ม implement ตามตารางด้านบนได้เลย (ไฟล์ไม่มาก็ยังทำได้ แค่ยังไม่ได้ cross-check กับ SOP จริง)
3. `git pull --ff-only` ก่อนเริ่มเสมอ เผื่อมีการแก้จากเครื่องอื่น

## 📁 ไฟล์สำคัญที่เกี่ยวข้องกับงานนี้

- `src/modules/action-log.js` — deviation bucketing, logAction, findSimilarActions, checkOutcomes
- `src/modules/smart-assistant.js` — alert sidebar, getAdvice (hardcode เดิม), analyzeAndRender
- `src/modules/action-log-ui.js` — ฟอร์มบันทึก action (controlVariable, fromValue, toValue เป็น free-text input)
- `src/modules/app-config.js` — `CONTROL_VARIABLES` hardcode list
- `tests/action-log.test.js` — เทสต์เดิมของ business logic จุดนี้
- `PROGRESS.md` — งาน pending เดิม (ข้อ 1 กับ 3 เกี่ยวโยงกับงานนี้โดยตรง)
