# Monitor-Quality-PTA — PTA Quality Monitor

เว็บแอปสำหรับ Boardman โรงงาน GC-M PTA ใช้ติดตามค่าคุณภาพ PTA/CTA จากผล Lab (Excel) พร้อมแจ้งเตือนค่าที่หลุดสเปค/ใกล้หลุดสเปค แนะนำ Action และเก็บประวัติการปรับแก้ — ข้อมูลทั้งหมดเก็บในเครื่องผู้ใช้ผ่าน IndexedDB ไม่มีข้อมูลขึ้น server

## 🔗 ใช้งานออนไลน์

**https://monitor-quality-pta.supasiao.workers.dev**

deploy อัตโนมัติทุกครั้งที่ push เข้า `main` (ผ่าน GitHub Actions → Cloudflare Workers)

แปะเป็นลิงก์ในไฟล์ Excel ได้ด้วยสูตรนี้:

```
=HYPERLINK("https://monitor-quality-pta.supasiao.workers.dev/", "@Open PTA Quality Monitor")
```

## Tech Stack

- Vite + ES Modules (JavaScript ล้วน ไม่ใช้ TypeScript — ใช้ JSDoc comment แทน)
- Vitest — unit test สำหรับ business logic
- Tailwind CSS, SheetJS (xlsx), Chart.js, Lucide icons, html2pdf.js (โหลดผ่าน CDN)
- IndexedDB — เก็บข้อมูลฝั่ง browser
- GitHub Actions — CI (build+test ทุก push/PR) และ CD (deploy ขึ้น Cloudflare Workers เมื่อ push เข้า `main` และ test ผ่านเท่านั้น)

## รันในเครื่อง (local)

```bash
npm install
npm run dev       # เปิด dev server พร้อม hot reload
npm test          # รัน unit tests (Vitest)
npm run build     # build ออกมาที่ dist/
```

## โครงสร้างโค้ด

```
src/
  main.js               # entry point (เดิมคือ APP_CORE)
  modules/               # 12 module แยกไฟล์ (เดิมรวมอยู่ใน app.js ไฟล์เดียว)
tests/                    # Vitest — ครอบ StatEngine, SpecEvaluator/Evaluator, ActionLog
```

## 📜 Session Log

### 2026-08-08 — Migrate to Vite + Multi-File + Vitest + CI/CD

**บริบท:** โปรเจกต์นี้เริ่มจาก Single HTML File (`index.html` + `app.js` รวมไฟล์เดียว ตามมาตรฐาน Vibe Coding เดิม) พอโค้ดยาวขึ้นถึงจุดหนึ่ง (`app.js` ~1,400 บรรทัด) พี่ A ตัดสินใจอยากเรียนรู้และขยับไปใช้เครื่องมือแบบมืออาชีพมากขึ้น (Vite + Multi-File + Testing + CI/CD) โดยยังคงหลักการ "Vibe Coder" คือให้ Claude Code เขียนโค้ดแทน ไม่ได้เรียน Programming เอง

**ข้อจำกัดสำคัญที่กำหนดการตัดสินใจ:** เครื่อง Office ไม่มีสิทธิ์ admin ติดตั้งโปรแกรมไม่ได้ (เจอ UAC popup ตอนลองติดตั้ง Node.js) ทำให้เครื่องมือที่ต้องพึ่ง Node.js/npm ในเครื่องโดยตรงใช้ที่ Office ไม่ได้ — แก้ปัญหานี้ได้เพราะ **GitHub Actions รัน `npm`/`vite`/`wrangler` บน cloud runner ทั้งหมด** เครื่อง Office แค่ push โค้ดขึ้น GitHub ก็พอ ไม่ต้องติดตั้งอะไรเพิ่มเลย

**สิ่งที่ทำ:**

1. แยก `app.js` (14 module แบบ IIFE รวมไฟล์เดียว) → 12 ไฟล์ ES Module ใน `src/modules/` + `src/main.js`
2. เพิ่ม Vitest unit tests ครอบ business logic หลัก — `StatEngine.computeBaseline` (จุดที่เคยมีบั๊กจริงมาก่อน), `SpecEvaluator`/`Evaluator` (การตัดสิน OOS/Warning), `ActionLog.checkOutcomes` (การตัดสิน success/fail ของ action) — รวม 26 tests ผ่านหมด
3. ตั้ง GitHub Actions (`ci.yml`): job `build-and-test` รันทุก push/PR, job `deploy` รันต่อเมื่อ test ผ่านและ push เข้า `main` เท่านั้น
4. Deploy ขึ้น Cloudflare Workers ผ่าน `wrangler` — ได้ URL สาธารณะเอาไปแปะเป็น Hyperlink ในไฟล์ Excel ได้
5. คง CDN libraries เดิมทั้งหมดไว้ (Tailwind, SheetJS, Lucide, Chart.js, html2pdf.js) ไม่แตะ — ลดความเสี่ยงกับแอปที่ใช้งานจริงอยู่แล้ว (แผนต่อไปถ้าอยากทำต่อ: ย้าย 5 ตัวนี้เป็น npm import แบบเต็มรูปแบบ)
6. ทดสอบ manual ผ่านเบราว์เซอร์จริง (อัปโหลด Excel ตัวอย่าง, เปิด Smart Assistant, บันทึก Action, ดูกราฟ Trend, สลับ Dark mode, เปิดประวัติ Action) — ทำงานถูกต้องครบ ไม่มี console error ก่อนลบ `app.js` เดิมทิ้ง

**ผลลัพธ์:** โค้ดจัดระเบียบเป็นไฟล์แยกตาม module อ่าน/แก้ง่ายขึ้น มี automated test คุ้มครอง business logic ที่เคยมีบั๊กมาก่อน มี CI/CD deploy อัตโนมัติ — ทั้งหมดนี้ทำได้โดยไม่ต้องติดตั้งอะไรเพิ่มที่เครื่อง Office เลย

---

ดูรายละเอียดการพัฒนาฟีเจอร์ก่อนหน้านี้ได้ที่ [`PROGRESS.md`](./PROGRESS.md)
