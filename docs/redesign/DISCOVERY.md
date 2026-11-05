# Product discovery: roomlist-kit (2026-11-05)

The source of truth for the 2026-11 redesign. It consolidates six parallel investigations (product and business, feature audit, technical architecture, visual audit, UX/CX journeys, niche opportunities) plus screenshots of the running app taken before any change. The UX/CX investigation was cut short by a usage limit; its scope was covered by the lead from the screenshots and the code, and by overlapping findings of the other five.

**Tags.** **[V]** verified in code or docs (path given). **[O]** observed in the running app. **[A]** assumption from industry knowledge, not stated in the repo. **[R]** recommendation.

---

## 1. Product overview

roomlist-kit takes a group's hotel *rooming list* (the spreadsheet of who sleeps where, which nights, who shares with whom), checks it against the contracted *room block*, counts rooms and room nights, and writes the import file the hotel's property management system (PMS) expects: Oracle OPERA 5 (XML), Oracle OPERA Cloud (Excel) or Maestro (CSV), plus canonical JSON/CSV. It also compares two versions of a list. [V README.md:3-19]

It ships as one library with three front doors: `@alihdrndm/roomlist-core`, the `roomlist` CLI, a NestJS REST API and a Next.js web app. [V docs/ARCHITECTURE.md:3] The name reads as "rooming list" + "kit" (the bundle of surfaces). [V packages/cli/package.json, inferred meaning]

Philosophy, quoted from the repo: nothing you upload is stored [V README.md:3]; "the report is the product" [V README.md:167]; every issue has a row, a stable code and a plain-English fix [V README.md:21]; honesty about what is verified vs assumed [V docs/ASSUMPTIONS.md]; colour is never the only signal [V apps/web/src/components/ui.tsx:47]; the app is hardened against hostile files (5 MB, 5,000 rows). [V README.md:23]

## 2. Business model and value proposition

- MIT open source, v0.1.0, one maintainer, never deployed, not published to npm, no pricing, no accounts. [V LICENSE; docs/DEPLOY.md:3; README.md:211-217] It is a quality-first open-source tool without a business model yet. [inferred]
- Value: catches the mistakes that otherwise surface at the front desk (stays outside the block, sharers pointing at nobody, duplicates, unknown room types), removes hand re-keying per PMS, and shows what changed between list versions. [V README.md:9]
- Differentiators: block-aware validation with 31 numbered rules; per-night and per-room-type room nights; PMS-specific output; transparent provenance; stateless privacy. No competitor is named in the repo. [V]

## 3. Target audience

| Who | Evidence | Role |
|---|---|---|
| **The planner** (keeps the list, receives versions from a client) | the only persona the repo names [V README.md:9; summarize.ts:37-41] | primary web user |
| **Hotel group-reservations staff** who import the file | FAQ and ASSUMPTIONS speak to whoever runs the import [V README.md:184; ASSUMPTIONS.md] | primary web user / recipient |
| The planner's client | sends versions, never uses the tool [inferred] | indirect |
| Developers, self-hosters, contributors | library, CLI `--json`, OpenAPI, Docker/SST [V] | secondary |

Segments: group hotel stays tied to events and contracts. The samples use "TECH26" (a tech event) and a VIP column. [V fixtures] MICE, DMC, TMC, weddings and sports are never mentioned, so treat them as hypotheses. [A]

## 4. Customer problems and use cases

1. "Is this list safe to send to the hotel?" Validate, see what to fix, by row.
2. "How many rooms do we need each night, by room type?" These are the contract numbers. [V README.md:17]
3. "Give me the file OPERA/Maestro will import." Convert.
4. "The client sent v7. What changed?" Compare.
5. "Can I trust this format?" Check what is verified and what is assumed.

Pain points found: lists arrive in client templates with odd headers; multi-tab workbooks; US vs European dates; sharers expressed in many ways; repeated re-uploads per version; issue lists retyped into emails. [V/A, see section 9]

## 5. Feature inventory (before the redesign)

| Capability | Core | CLI | API | Web (before) |
|---|---|---|---|---|
| Parse CSV/XLSX, header aliases, title-row skip, MDY/DMY | ✓ | ✓ | ✓ | ✓ (date order only) |
| `columnMap` (map a header to a field by hand) | ✓ | – | ✓ | **–** |
| `sheetName` (choose a worksheet) | ✓ | ✓ `--sheet` | ✓ | **–** |
| 31 rules (F001, F003-F007, R001-R015, W201-W208, X001, X101) | ✓ | ✓ | ✓ | ✓ |
| Block: codes, dates, shoulder days, room types | ✓ | ✓ file | ✓ | ✓ form |
| Block: `maxOccupancy` per room type | ✓ | ✓ file | ✓ | **only via the sample** |
| Summary: entries, rooms, room nights, by night | ✓ | ✓ | ✓ | ✓ |
| Summary: primaries, sharers, people, first/last date, **by room type** | ✓ | ✓ | ✓ | **–** |
| Parsed guest list (`entries`) and column mapping (`columns`) | ✓ | json | ✓ | **–** |
| Issue `value` and `line` | ✓ | ✓ | ✓ | **–** |
| Export: 5 targets, options from JSON Schema, provenance | ✓ | ✓ | ✓ | ✓ |
| Diff: added/removed/changed, room-night delta | ✓ | ✓ | ✓ | ✓ (raw field names) |
| Accounts, roles, DB, history, settings, notifications, i18n, dark mode | – | – | – | – (by design: stateless, light theme only [V DECISIONS.md:46-48]) |

Classification:
- **Fully implemented:** parse, validate, summarize, export, diff, formats; the API with problem+json errors, API key, rate limit 120/min, OpenAPI. [V]
- **Partially surfaced:** the web shows a fraction of the report (see the table). [V grep of apps/web/src]
- **Planned (README roadmap):** more PMS targets, confirmation-number merge, OHIP push, saved column mappings per hotel, npm publish. [V README.md:211-217]
- **Not existing, natural fit:** see section 12.

## 6. Screen and route inventory (before)

| Route | Kind | Purpose | States |
|---|---|---|---|
| `/` | static page + client component (684 lines) | upload, optional block form, validate, tiles, issues table, nights table, convert | empty, validating, problem, report, convert locked/unlocked, converting, downloaded |
| `/compare` | static page + client | two files, date order, compare, tiles, three tables | empty, comparing, problem (LIST_INVALID with side), result |
| `/formats` | dynamic server component | every target: options, verified vs assumed | loading, problem, list |
| `/api/{validate,convert,diff,formats}` | route handlers | bounded proxy, adds the API key | 413/422/502 problem+json |
| 404, error | Next defaults | – | default page leaks dark mode [O] |

## 7. Existing user journeys (before)

1. **Validate & convert:** choose a file (or "Load sample") → optionally open "Block details (optional)" → Validate → read tiles, issues and nights → choose a format → fill options → Download. Any input change clears the report.
2. **Fix loop:** the user fixes the spreadsheet outside the app and re-uploads. There is no editing in the app (by design, the report is the product).
3. **Compare:** two files + date order → Compare → tiles + Added/Removed/Changed tables. If either list has errors, a 422 lists the first 10 errors.
4. **Formats:** read provenance before trusting a target.

## 8. Existing design language [V apps/web/src; O screenshots]

- Stock Tailwind starter look: zinc neutrals, blue-700 buttons, 1px rounded-lg boxes, dashed placeholders; system font stack; no tokens, icons, shadows or charts; stock favicon; default 404.
- Good foundations: high text contrast, a global focus ring, skip link, live regions, severity shown as icon + word.
- Defects: input borders 2.6:1 (fails WCAG 1.4.11); no success state; the verdict is 14px grey text; the issues table is unusable at 390px (page 6,007px tall, message column off-screen); on /formats a 146-character URL pushes the "Assumed" column off-screen; 4 tiles in a 5-column grid; raw camelCase field names; ISO-only dates with no weekday; native "Choose File / No file chosen" contradicts "Chosen: we1.csv".

## 9. UX/CX audit

Severity: **C** critical, **M** major, **m** minor.

| # | Finding | Sev | Evidence |
|---|---|---|---|
| 1 | No clear verdict: "can I send this?" is answered by small grey status text and identical tiles | C | validate-convert.tsx:258-264; screenshot desktop-02 |
| 2 | Mobile issue list unreadable (messages off-screen) | C | mobile-03 |
| 3 | `0 errors` without a block is false confidence: R004, R005, R013, W202 and W204 do not run, and the UI does not say so | M | rules.ts:105-106,124-125,172-173,313,434 |
| 4 | W201 says "map it if it matters", but the web app has no way to map a column; F005 (missing column) is a dead end | M | headers.ts:220; parse.ts |
| 5 | The date-order switch, needed by W205/R002, is hidden in the "optional" block panel | M | validate-convert.tsx:221-247 |
| 6 | Issues lack the guest name, the bad value and readable field names; the row number is shown twice | M | validate-convert.tsx:380-389 |
| 7 | Data the user needs is hidden: by room type, people, sharers, stay window, column mapping, the guest list itself | M | section 5 |
| 8 | Every input change wipes the report; there is no "stale" state, so tweaking the block loses context | M | validate-convert.tsx:93-97 |
| 9 | Communicating back to the client means retyping issues into an email; no export of the issue list | M | – |
| 10 | Compare shows raw field names, no +/- emphasis, no per-night or per-type effect, no update text for the hotel | M | compare.tsx:225 |
| 11 | Export preconditions (Maestro needs a group reservation number, building code) are discovered only after Download, with no path to the field | M | maestro-csv.ts:99-152 |
| 12 | Max occupancy cannot be entered, so R013 only runs for the sample | m | forms.ts:13-14 |
| 13 | The convert panel says "Validate the list first" even after validating with errors; stale "Downloaded …" text | m | validate-convert.tsx:542-546 |
| 14 | Nav has no active state (`aria-current`); no footer; the request id is never shown | m | layout.tsx:34-42; ui.tsx:64-84 |
| 15 | Re-uploading between Validate and Compare (no continuity) | m | – |

Heuristics (Nielsen), in short: visibility of system status (weak verdict, #1); match with the real world (camelCase, ISO only, #6); user control (no stale state, cannot remove a file, #8); consistency (three table styles, four button looks); error prevention (silent no-block checks, #3); recognition over recall (codes without explanations); flexibility (no mapping or sheet, #4); minimalist design (ok); recovery from errors (dead ends, #4 and #11); help (no rule catalogue or template).

## 10. Technical architecture [V docs/ARCHITECTURE.md; agent 3 report]

- pnpm monorepo, Node 24, TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Biome (recommended + a11y rules), Vitest, Playwright (Chromium, 1280×720).
- Web: Next 16 App Router, React 19, Tailwind 4 (CSS-only config). Browser → `/api/*` route handlers → `lib/proxy.ts` (Content-Length bound, adds `x-api-key`, header allow-list) → NestJS `/v1` → core. `process.env` only in `src/env.ts`. Client components import **types only** from core (DECISIONS M7), and a test keeps `env`/`proxy` out of client files.
- API: NestJS, Zod schemas, problem+json filter, API-key guard (SHA-256 + timingSafeEqual), throttler 120/min, helmet, pino without bodies, OpenAPI at `/docs`.
- Core: pure TypeScript; parse/validate/summarize/diff use only browser-safe dependencies, but the single barrel export also pulls in exceljs and xmlbuilder2. `plain-date.ts` has no imports.
- No database, cache, cookies or storage anywhere.
- Constraints for the redesign: OP7 (web runtime deps limited to Next, React, Tailwind, plus zod by decision); light theme only; offline builds (no `next/font/google`); Playwright selectors listed in agent 3's section (d).

## 11. Limitations and technical debt

- 684-line client component with 16 `useState`s; fetch lifecycle duplicated 4 times; the network-problem literal duplicated 4 times; 5 copies of table styling; no tokens or primitives.
- Field errors from the API (`errors[].path`) are not shown on fields.
- No error/not-found boundaries; no security headers in the web app.
- Product risks found while reading (owner decisions, see section 14): Maestro export has no rooms column, so `rooms > 1` imports as 1 room without a warning; OPERA 5 and Maestro drop special requests, email and phone silently; non-UTF-8 CSV and `.xls` are refused outright.

## 12. Enhancement opportunities (prioritised)

**Implement now (no API contract change):**
1. **Verdict + checks coverage.** A designed ready / ready-with-warnings / blocked state, and an explicit note of which block checks ran.
2. **Reading check.** Column mapping override (`columnMap`), sheet name for `.xlsx` (`sheetName`), and a top-level date-order switch. This turns W201/F005 from dead ends into fixes.
3. **Block setup.** Max occupancy per room type, inline field errors, load/save the block as the same JSON file the CLI and API accept.
4. **Actionable issues.** Filter with counts, search, group by row or by check, guest names, readable field names, the offending value, rule explanations, pagination, mobile cards, an issue list CSV (formula-safe) and "copy for the client".
5. **Summary parity + nights.** People, sharers, stay window, by room type; a night strip with the block window and shoulder nights marked; a nights × room-type grid.
6. **Rooms view.** Who sleeps with whom (primary + sharers), occupancy vs max, searchable.
7. **Export guidance.** The selected format's assumptions as a checklist; precondition failures link to the field that fixes them.
8. **Compare as a change brief.** Human labels, +/− emphasis, before→after with strike-through, per-night and per-room-type deltas, filters and search, "copy update for the hotel", CSV, a sample pair, a swap button, and an explanation of how guests are matched.
9. **Guide page.** The workflow, the columns we read (from core's alias table), every check explained, a template CSV, privacy and limits.
10. **Shell quality.** Active nav, footer with the privacy promise, custom 404 and error pages, favicon/brand mark, print stylesheet for reports.

**Need owner approval (documented, not built):** contract terms in the block (contracted inventory, attrition, cut-off, comps); Maestro `rooms > 1` behaviour and field coverage per target in `/v1/formats`; additive report fields (`entryRows`, `sheets`, before/after `byNight` in the diff); diff with errors or per-file options; remembering settings in browser storage; Windows-1252 rescue; sharers by room number or name; confirmation-number merge; new PMS targets.

## 13. Design direction considerations

- The audience works under deadline pressure in spreadsheets and PMS screens: favour density with clear hierarchy, tabular numbers, codes in monospace, and a verdict first.
- Hospitality context: hotel stationery and ledgers suggest a warm paper canvas, ink text and one blue-ink accent; red, amber and green are reserved for status.
- Trust signals matter as much as looks: provenance visible where a format is chosen, the privacy promise in the shell, and no fake data.
- Mobile matters for on-site work: cards instead of wide tables.

## 14. Implementation risks and dependencies

| Risk | Mitigation |
|---|---|
| Playwright selectors are loose substring matches (Format, Validate, Download, Errors, tiles with one `<p>`) | keep the semantics (native select labelled Format, one Validate button, tiles as labelled groups); update tests deliberately where the design changes |
| Client code may not import core runtime (exceljs would ship) | add pure subpath exports to core (`plain-date`, `rules`, `header-aliases`) and a test that client files import nothing else from core at runtime |
| Shared rate limit (120/min, shared by web users once deployed) | requests only on explicit actions and on file choice; never on keystrokes |
| Offline builds | self-hosted OFL fonts committed as woff2 files |
| OP7 (no new runtime deps) | hand-written SVG icons and primitives; no component or chart library |
| Core coverage thresholds (lines 90, branches 85, functions 90) | unit tests for every core addition |
