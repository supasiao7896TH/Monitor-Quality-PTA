# HANDOFF.md — สถานะงานล่าสุด

> ใช้ไฟล์นี้ส่งต่องานข้ามเครื่อง (บ้าน ↔ ที่ทำงาน) — อ่านไฟล์นี้ก่อนเริ่ม session ถัดไป

**อัปเดตล่าสุด:** 2026-08-10 (เครื่องที่ทำงาน/office) — งาน "MPS alias bugfix + Smart Assistant advice UI + Action History backup/recency/episode-grouping" **โค้ดเสร็จ + push แล้ว รอเช็คผล CI จริง** ⏳

---

## ✅ งานที่ทำใน session วันนี้ (2026-08-10, ต่อเนื่องช่วงบ่าย-เย็น)

ทุก commit push ขึ้น `main` แล้ว เรียงตามลำดับเวลา:

### 1. Bugfix: MPS (Laser) ไม่ได้คำแนะนำ SOP (commit `515d169`)
Root cause: LIMS export ใช้ชื่อ "MPS (Laser)" แต่ correlation matrix (จาก SOP) ใช้ชื่อ "APS" สำหรับพารามิเตอร์เดียวกัน (particle size by laser diffraction) — พี่ A ยืนยันว่าเป็นตัวเดียวกันจริง แก้โดยเพิ่ม alias ใน `CorrelationMatrix.normalize()` (`src/modules/correlation-matrix.js`) ให้ "mps" ↔ "aps" match กัน พร้อมเพิ่ม test ใน `tests/correlation-matrix.test.js`

### 2. UI: จัดเรียงคำแนะนำ SOP ในการ์ด Smart Assistant ใหม่ (commit `50b94dc`)
เดิมคำแนะนำ SOP ต่อกันเป็นบรรทัดเดียวด้วย " | " อ่านยาก พี่ A เลือกแบบ "Stacked list + สีตามระดับผลกระทบ" — แก้ `src/modules/smart-assistant.js`: เปลี่ยน `alert.advice` จาก plain string เป็น `{kind:'text'|'sop', ...}` shape, เพิ่มฟังก์ชัน `renderAdvice()` ให้ SOP advice แสดงเป็นบรรทัดแยกตามระดับ ◎(แดง/หนา) > ○(เหลือง/อำพัน) > ▷(เทา) พร้อมเส้นสีด้านซ้าย

### 3. Action History backup + recency weighting + แก้ปัญหา "หางว่าว" ใน Smart Assistant sidebar (commit `eee2059`)
มาจากคำถามต่อเนื่อง 3 ข้อของพี่ A เกี่ยวกับฟีเจอร์ "ประวัติ Action ทั้งหมด" (ActionHistoryUI) แยกเป็น 3 ส่วน:

- **3a. Export/Import JSON backup** — ประวัติ Action อยู่ใน IndexedDB ฝั่ง browser เครื่องเดียว ไม่มีทาง backup มาก่อน เพิ่ม `ActionLog.exportBackup()`/`importBackup()` (`src/modules/action-log.js`) + ปุ่ม "ส่งออก (JSON)"/"นำเข้า (JSON)" ในหน้าต่าง ActionHistoryUI (`index.html` + `src/modules/action-history-ui.js`) นำเข้าแบบ append เท่านั้น ไม่ dedupe (เหมาะกับ use case สลับเครื่องบ้าน/ที่ทำงานที่มีข้อมูลแยกกัน)
- **3b. Recency weighting ใน `getEffectStats`** — เดิมเฉลี่ย action สำเร็จทุกครั้งแบบเท่ากันหมด ไม่สนใจว่าเก่าแค่ไหน เพิ่ม exponential half-life weighting (ยืนยันกับพี่ A แล้ว → 180 วัน) เก็บเป็น `APP_CONFIG.ACTION_RECENCY_HALFLIFE_DAYS = 180` (`src/modules/app-config.js`), แก้ `src/modules/action-log.js` `getEffectStats()`
- **3c. Smart Assistant sidebar "หางว่าว"** — ปัญหาใหญ่สุดของ session: sidebar เดิมไม่มี limit เลย ทุก sample OOS/Warn ในประวัติทั้งหมดของ sheet (ไม่จำกัดเวลา) กลายเป็นการ์ด ถ้าสะสม 6 เดือนขึ้นไปจะมีการ์ดซ้ำเป็นร้อยใบ แก้โดย (ยืนยันกับพี่ A แล้ว → "Design B" + 14 วัน): เพิ่ม `APP_CONFIG.ALERT_SIDEBAR_WINDOW_DAYS = 14` และเขียนฟังก์ชันใหม่ `SmartAssistant.buildEpisodeAlerts()` แทนที่ loop เดิมทั้งหมด — จำกัดแค่ 14 วันล่าสุด + รวม sample ที่ OOS/Warn ต่อเนื่องประเภทเดียวกันของพารามิเตอร์เดียวกันเป็น 1 "episode" การ์ด (นับจำนวนครั้ง, ค่ากลับปกติกลางทาง = ตัดเป็นคนละเหตุการณ์, สลับ Warn↔OOS = เหตุการณ์ใหม่เสมอ) Baseline (`StatEngine`) ยังคำนวณจากประวัติเต็มเหมือนเดิม ไม่ตัดทอน — จำกัดแค่ "อะไรโผล่ในแถบ"
  - ผลพลอยได้ที่ไม่ตั้งใจแต่ตรง intent เดิม: แก้บั๊กแฝงที่ alert เดิมไม่เคยส่ง `triggerTimestamp` ให้ ActionLogUI (มีแต่ `timestamp`) ทำให้ `checkOutcomes` ใช้เวลากดฟอร์มแทนเวลาจริงที่หลุดสเปค

เพิ่ม `tests/smart-assistant.test.js` ใหม่ (module นี้ไม่เคยมี test มาก่อน) + อัปเดต `tests/action-log.test.js` (export/import + recency weighting tests) + อัปเดต `CLAUDE.md` ให้ครอบคลุม test ใหม่ทั้งหมด

## 🚧 สถานะปัจจุบัน / ยังไม่ปิดสนิท

- Commit ล่าสุด: `eee2059` push ขึ้น `main` แล้ว รอ CI (GitHub Actions) ยืนยันว่า `build-and-test` ผ่านและ deploy ขึ้น production สำเร็จ — **ยังไม่ได้เช็คผล CI จริง** เพราะเครื่อง office ไม่มี Node.js ในเครื่อง (npm/node หาไม่เจอ) เทสต์ทั้งหมดตรวจด้วยการ trace โค้ดด้วยมือเท่านั้น
- ⚠️ **ความเสี่ยงเฉพาะที่ต้องเช็คก่อน**: `tests/smart-assistant.test.js` เป็นไฟล์ test แรกที่ import ผ่าน chain ที่มี circular import จริง (`smart-assistant.js` → `action-log-ui.js` → `ui-renderer.js` → `smart-assistant.js`) — วิเคราะห์โค้ดแล้วว่าปลอดภัย (DOM/circular reference ใช้แค่ใน function body ไม่ใช่ตอน module load) แต่ยังไม่เคยรันจริงเลยสักครั้ง ต้องรอ CI หรือพี่ A รันที่เครื่องมี Node ยืนยัน

## 🎯 ขั้นตอนถัดไปที่ตั้งใจจะทำ (session หน้า)

1. เช็ค GitHub Actions tab ว่า CI เขียวจริง โดยเฉพาะ `tests/smart-assistant.test.js` (ความเสี่ยง circular import ด้านบน)
2. ถ้าผ่านแล้ว ลองใช้งานจริงบนเว็บที่ deploy แล้ว (`monitor-quality-pta.supasiao.workers.dev`) อัปโหลดข้อมูลที่มีพารามิเตอร์หลุดสเปคต่อเนื่องหลายวันดูว่า:
   - การ์ดใน Smart Assistant sidebar รวมกันเป็น episode เดียวถูกต้องตามที่ออกแบบไว้ (ไม่ใช่การ์ดซ้ำเป็นสิบๆ ใบ)
   - การ์ดเก่ากว่า 14 วันหายไปจากแถบจริง
3. ลองปุ่ม Export/Import JSON ในหน้าต่าง "ประวัติ Action ทั้งหมด" ว่าใช้งานได้จริงในเบราว์เซอร์

ไม่มีคำถามค้างที่ต้องถามพี่ A เพิ่มเติมสำหรับงานชุดนี้ — งานที่วางแผนไว้ทำครบตามที่ยืนยันกันแล้วทุกจุด (half-life 180 วัน, alert window 14 วัน, Design B episode-grouping, import แบบ append-only)

## ⚠️ ข้อควรระวัง/สิ่งที่ต้องไม่ลืม

- **เครื่องที่ทำงาน (office) ไม่มี Node.js** — `npm`/`node` หาไม่เจอ trace โค้ดด้วยมือแทนการรันเทสต์จริง ซึ่งพลาดได้ (มีบั๊ก `parseSopNumbers` จาก session ก่อนเป็นตัวอย่างจริงที่เคยพลาดมาแล้ว) **อย่าเชื่อว่าโค้ดถูก 100% จนกว่าจะเห็น CI เขียวหรือรันที่เครื่องมี Node**
- คำถามค้างเก่าที่ยังไม่ได้ยืนยัน (จาก session ก่อน ยังไม่บล็อกงาน): Correlation Matrix เวอร์ชันล่าสุด (§3 ใน `PTA-Quality-Control.md`) มีแค่ 12 Item — ไม่มี THM ต่างจากตารางที่ 1 (Product Quality Items) ที่มี 13 Item ยังไม่ชัดว่าตั้งใจตัดออกหรือเป็นตกหล่น

## 🔧 คำสั่งที่ต้องรันก่อนทำงานต่อ

```bash
git pull
npm install   # ถ้าเป็นเครื่องที่มี Node
npm test      # ยืนยันผล CI ด้วยตัวเองถ้าทำได้ (โดยเฉพาะ tests/smart-assistant.test.js)
```

## 📁 ไฟล์สำคัญที่เกี่ยวข้องกับงาน session นี้

- `src/modules/correlation-matrix.js` — `normalize()` alias ใหม่ (mps↔aps)
- `src/modules/smart-assistant.js` — `renderAdvice()`, `buildEpisodeAlerts()`, `advice` shape ใหม่
- `src/modules/action-log.js` — `exportBackup`/`importBackup`, `getEffectStats` (recency weighting)
- `src/modules/action-history-ui.js`, `index.html` — ปุ่ม Export/Import JSON
- `src/modules/app-config.js` — `ACTION_RECENCY_HALFLIFE_DAYS`, `ALERT_SIDEBAR_WINDOW_DAYS`
- `tests/smart-assistant.test.js` (ใหม่), `tests/action-log.test.js`, `tests/correlation-matrix.test.js`

---

## 📜 ประวัติ session ก่อนหน้า — SOP-Grounded Recommendation Engine (ปิดงานแล้ว ✅ เมื่อ 2026-08-10 ช่วงเช้า)

เป้าหมายเดิม: เมื่อพารามิเตอร์หลุดสเปค/เข้าเขต warning ให้ระบบแนะนำ control variable ที่ควรปรับ โดยอ้างอิงข้อมูลจริง (ประวัติ Action + SOP) แทนคำแนะนำ hardcode เดิม — **เสร็จสมบูรณ์ทั้ง 2 phase แล้ว**

**เอกสาร SOP อ้างอิง**: พี่ A ส่งไฟล์ `PTA Quality Characteristics Rev.14.xls` มาให้ แปลงเป็น `PTA-Quality-Control.md` แล้ว — มี 3 ส่วน: (1) Product Quality Items + spec, (2) Process Control Factors 21 ตัว + Set Value/Unit/Fine-Fast tune/Tag, (3) Correlation Matrix เต็ม 21×12 (Factor × Item, ระดับผลกระทบ ◎/○/▷)

**Phase A** (commit `4ee650d`):
- `app-config.js`: `CONTROL_VARIABLES` เปลี่ยนจาก 7 ชื่อ generic เดา → 21 factor จริงจาก SOP พร้อม tag/unit/fineTune/fastTune
- `action-log.js`: เพิ่ม `resultValue`/`resultTimestamp` (เก็บตอน `checkOutcomes` มาร์ค success) + ฟังก์ชันใหม่ `getEffectStats()` คำนวณ avg Δparam/Δcontrol จาก action ที่สำเร็จจริง (N<3 → null เสมอ) พร้อม sanity-check เทียบ Fine/Fast tune จาก SOP (`sopFlag`)
- `smart-assistant.js`: ใช้ `getEffectStats` โชว์คำแนะนำเชิงตัวเลขพร้อม N เมื่อมีข้อมูลพอ

**Phase B** (commit `5fde5ed`):
- `correlation-matrix.js` (ใหม่): กริด Correlation Matrix เต็ม 60 คู่ factor×item จาก SOP §3
- `smart-assistant.js`: `getAdvice()` ใช้ correlation matrix จัดลำดับ ◎→○→▷ แทน keyword เดาเดิม (เก็บ keyword เดิมไว้เป็น fallback สุดท้ายสำหรับ item ที่ไม่อยู่ในกริด)
- ลำดับความสำคัญคำแนะนำตอนนั้น: **ข้อมูลจริงจากประวัติ (N≥3) > SOP correlation matrix > generic keyword fallback**

**Bugfix หลัง push** (commit `0eb2cd0`): `parseSopNumbers()` ใน `action-log.js` ดึงเลขที่ติดอยู่ในหน่วย (เช่น เลข `3` ใน `g/cm3`) มาปนด้วย ทำให้ envelope ของ sopFlag กว้างเกินจริงจนไม่ flag ค่าผิดปกติ แก้ด้วย lookbehind/lookahead ไม่ให้นับเลขที่ติดตัวอักษร

**Correlation matrix data fix** (commit `14ac33a`): อ่านข้อมูลจาก Shapes API แทนการอ่านจาก visual PDF ของ SOP spreadsheet เพื่อความแม่นยำ

**คำถามค้างปิดแล้ว** (commit `3e3ff13`): ปิดคำถามค้าง 2 ข้อของ session นี้เรียบร้อย

*ไฟล์สำคัญของงานชุดนี้*: `PTA-Quality-Control.md`, `src/modules/app-config.js`, `src/modules/action-log.js`, `src/modules/correlation-matrix.js`, `src/modules/smart-assistant.js`, `tests/action-log.test.js`, `tests/correlation-matrix.test.js`
