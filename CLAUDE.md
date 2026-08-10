# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PTA Quality Monitor — a client-only web app for GC-M PTA plant operators. They drag in LIMS Excel exports of lab QC results (PTA/CTA powder parameters), and the app tracks out-of-spec/warning values, suggests actions, and stores a history of corrective actions taken. All data stays in the browser (IndexedDB) — nothing is uploaded to a server.

Live: https://monitor-quality-pta.supasiao.workers.dev (auto-deployed from `main`)

## Commands

```bash
npm install
npm run dev          # Vite dev server with hot reload
npm test             # run all Vitest tests once
npm run test:watch   # Vitest watch mode
npm run build        # production build -> dist/
npm run preview      # preview the dist/ build
```

Run a single test file: `npx vitest run tests/stat-engine.test.js`

No lint/typecheck script is configured — this is plain JavaScript (ES modules), not TypeScript. JSDoc comments are used for type hints instead.

## CI/CD

`.github/workflows/ci.yml`:
- `build-and-test` runs on every push/PR: `npm ci`, `npm run build`, `npm test`.
- `deploy` runs only on push to `main` and only if `build-and-test` passes: builds, then deploys `dist/` to Cloudflare Workers via `wrangler` (needs `CLOUDFLARE_API_TOKEN` secret). Config in `wrangler.jsonc`.

This means: pushing straight to `main` ships to production automatically once tests pass. There is no separate staging step.

## Architecture

Single-page app: `index.html` holds all markup/modals, `src/main.js` is the entry point, business logic lives in `src/modules/*.js` as one exported const-object namespace per file (no classes, no build-time DI — modules just `import` each other directly). Third-party libraries (Tailwind, SheetJS/`XLSX`, Chart.js, Lucide icons, html2pdf.js) are loaded via CDN `<script>` tags in `index.html`, not npm — modules that use them declare `/* global XLSX, lucide */` rather than importing them.

Data flow for a typical upload:

1. `APP_CORE` (in `main.js`) reads the dropped file and hands the workbook to `ExcelParser.parseWorkbook`.
2. `ExcelParser` finds each sheet's header block (LIMS exports repeat several `Parameter`/`Unit`/`Test Method`/`Specifications`/`Specifications (Warning)` label rows) and produces `{ params, samples }` per sheet. Values are parsed defensively — pending statuses (`Initial`/`Received`), asterisked numbers, and non-numeric text all need distinct handling.
3. `APP_CORE.mergeParamsWithExisting` unions newly-seen params with whatever was already known for that sheet (a later upload may test fewer parameters than an earlier one — never discard history).
4. Samples and per-sheet param metadata are persisted via `STORAGE_ENGINE` (IndexedDB, DB name `PTAQualityDB`, stores: `samples`, `sheetMeta`, `actions`).
5. `UIRenderer` renders the table; each cell's status comes from `Evaluator.evaluate(param, value, baseline)`, which:
   - parses spec/warn bands from the file's own spec/warning-spec text via `SpecEvaluator` (handles several inconsistent LIMS band formats: `min < X < max`, `X <= n`, bare `<= n`, `min - max`, and two-band disjoint warnings like `<1.8 < X > 3.0`);
   - falls back to a statistical warn band from `StatEngine` (rolling mean ± `BASELINE_K` SD over `BASELINE_WINDOW` samples) when the file has no explicit warning spec;
   - returns one of `normal | warn | oos | pending | na`.
6. `StatEngine.computeRollingBaselines` computes each sample's baseline as of *just before* that sample, in one forward pass — baselines are computed only from values already in-spec at the time, so a drifting/OOS run of samples can't widen its own warn band and get relabeled "normal" (this was a real bug, fixed and now covered by tests — see `tests/stat-engine.test.js`).
7. `SmartAssistant` builds the alert sidebar (warn/OOS cards). Advice text is layered: a data-driven suggestion from `ActionLog.getEffectStats` (average control-variable/parameter deltas from past *successful* actions, N≥3 only) takes priority when history is thick enough; otherwise `SmartAssistant.getAdvice` falls back to `CorrelationMatrix.getRankedFactorsForItem` (the SOP's Factor×Item ◎/○/▷ severity grid — see `PTA-Quality-Control.md` §3); if the item isn't in that matrix either, a last-resort generic keyword-matched string is used.
8. Operators can log a corrective action via `ActionLogUI` → `ActionLog.logAction`, which buckets the deviation by severity/direction (`ActionLog.deviationBucket`) for later similarity matching. `ActionLog.checkOutcomes` retroactively marks a pending action `success`/`fail` by checking whether the next 3 follow-up samples of that parameter recovered into spec, and records the recovery sample's value (`resultValue`/`resultTimestamp`) for `getEffectStats` to use — this is the logic covered by `tests/action-log.test.js`.
9. `ActionHistoryUI` renders a before/after audit timeline across all logged actions.

Other modules: `ChartManager` (Chart.js trend modal per parameter, with spec/warn reference lines), `ExportManager` (PDF export via html2pdf.js), `AppConfig` (`src/modules/app-config.js` — DB name/version, baseline window/K, `CONTROL_VARIABLES` — the 21 real process factors from the plant's SOP, each with tag/unit/fineTune/fastTune — status enum), `CorrelationMatrix` (`src/modules/correlation-matrix.js` — static Factor×Item severity data transcribed from the plant's SOP spreadsheet; see `PTA-Quality-Control.md` for the human-readable source and how it was extracted).

`index.html` still uses inline `onclick`/`onchange` attributes referencing global function names, so `main.js` explicitly attaches the functions/namespaces those handlers need onto `window` (see the `window.foo = ...` block at the bottom of `main.js`) — ES modules aren't global by default.

### Tests

`tests/*.test.js` (Vitest) cover the business logic that has previously had real bugs: `StatEngine.computeBaseline` (self-referential baseline drift), `Evaluator`/`SpecEvaluator` (OOS/warning classification across the various LIMS band text formats), and `ActionLog.checkOutcomes` (success/fail determination). When touching any of these three modules, run/extend the corresponding test file rather than only testing manually in the browser.

## History note

This app was originally a single `index.html` + `app.js` file (per this repo owner's usual "Single HTML File" convention for internal tools). It was migrated to Vite + ES modules + Vitest + GitHub Actions CI/CD in August 2026 specifically because the work machine has no admin rights to install Node.js locally — GitHub Actions runs `npm`/`vite`/`wrangler` on its own runner, so the work machine only needs to `git push`. See `README.md` and `PROGRESS.md` for more session history; `PROGRESS.md` predates the module split and still refers to the old single-file `app.js` layout in places.
