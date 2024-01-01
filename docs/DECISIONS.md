# Decisions and deviations

Dated list of decisions and deviations from `HANDOFF.md` (OP5, OP7).

## 2026-10-05 (M0)

### Scaffold generated Jest-style names and extra tooling
- **Spec said:** unit tests are `*.test.ts` next to source; API e2e tests are `apps/api/test/*.e2e.test.ts`; Biome is the only lint/format tool.
- **Did:** the NestJS 12 scaffold uses `*.spec.ts` / `*.e2e-spec.ts`, oxlint and prettier. Changed both Vitest configs to the spec's file patterns and removed oxlint, oxlint-tsgolint and prettier.
- **Why:** spec naming and "delete any ESLint, Prettier or oxlint config" are binding; the scaffold's build and Vitest setup was otherwise kept.

### TypeScript versions differ per workspace
- **Spec said:** TypeScript, latest stable.
- **Did:** `packages/core` and `packages/cli` use `^7.0.2` (latest). `apps/api` keeps the NestJS scaffold's `^6` and `apps/web` keeps create-next-app's `^5`.
- **Why:** the two scaffolds pin a version their tooling is tested with (decorator metadata in the API, Next's type plugin). Revisit when upgrading. Vitest is `^5` everywhere (the API was bumped from the scaffold's `^4`).

### Removed `nest deploy` script and `@nestjs/mau`
- **Did:** deleted the scaffold's `deploy` script and the `@nestjs/mau` dev dependency.
- **Why:** deploying is out of scope (OP6) and cloud commands are forbidden (OP8).

### `apps/api/tsconfig.build.json` excludes `*.test.ts`
- **Did:** changed the scaffold's `**/*spec.ts` exclude to `**/*.test.ts`.
- **Why:** unit tests use the `.test.ts` suffix, so `nest build` must not compile them into `dist`.

### `apps/web` target is ES2023
- **Did:** replaced create-next-app's `ES2017` target with `ES2023` (the base config's value).
- **Why:** spec requires the base target everywhere.

### `@playwright/test` installed at the repo root in M0
- **Spec said:** one Playwright smoke test arrives in M7.
- **Did:** added `@playwright/test` as a root dev dependency now. The CI `e2e` job runs `pnpm exec playwright install`, which fails if no workspace package provides the binary.
- **Why:** M0 requires a CI workflow that can run; Playwright is named in the spec's Toolchain table (OP7).

### CI action versions
- **Did:** `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`, the latest majors on 2026-10-06 (checked with `git ls-remote --tags`).

### Web `typecheck` runs `next typegen` first
- **Did:** `apps/web` script is `next typegen && tsc --noEmit`.
- **Why:** `LayoutProps` comes from generated `.next/types`, which is git-ignored, so a fresh clone fails `tsc` otherwise.

### `zod` added to `apps/api` and `apps/web`
- **Spec said (OP7):** web runtime dependencies are Next.js, React, Tailwind; `zod` is listed for core only.
- **Did:** added `zod` to `apps/api` (for `src/config.ts`) and `apps/web` (for `src/env.ts`).
- **Why:** the spec requires `apps/web/src/env.ts` to be the only place reading `process.env`, and Zod is the spec's validation tool.

### create-next-app extras removed
- **Did:** removed the generated `AGENTS.md`, `CLAUDE.md`, `README.md`, nested lockfile/workspace file, sample SVGs and the dark-mode CSS. Moved its `allowBuilds` (sharp, unrs-resolver set to false) into the root `pnpm-workspace.yaml`.
- **Why:** repo has one lockfile and one `CLAUDE.md`; light theme only.

### No commits by the assistant
- **Spec said (OP3, Git):** commit at the end of each milestone.
- **Did:** the repo owner asked to stage, commit and push personally, so the assistant stops before the commit and lists the changed files.
- **Why:** explicit user instruction. The reviewer reviews the working tree instead of `git diff <start-ref>`.

## 2026-10-06 (M1)

### Two entry schemas: `RoomingEntry` and `ParsedEntry` (owner decision)
- **Spec said:** `RoomingEntry` requires `lastName`, `arrivalDate`, `departureDate`; it also says an unconvertible cell leaves its field unset, and the summary skips entries with a missing date.
- **Did:** `RoomingEntry` stays strict (exporters use it). The parser and validator work on `ParsedEntry`, the same schema with those three fields optional. `RoomingList.entries` is `ParsedEntry[]`.
- **Why:** both statements can only hold if parsed entries may lack those fields. Chosen by the repo owner.

### Header row skips a title row (owner decision)
- **Spec said:** header row = first row with a non-empty cell; but `messy-headers.csv` has a title row above the header.
- **Did:** header row = first non-blank row in which at least one cell maps to a canonical field (columnMap or alias). If no row maps, the first non-blank row is used, which then raises F005.
- **Why:** the literal rule would take the title row as the header and fail the fixture. Chosen by the repo owner.

### `parseRoomingList` is async
- **Spec said:** `parseRoomingList(input, options?): ParseResult`.
- **Did:** returns `Promise<ParseResult>`.
- **Why:** exceljs only reads workbooks asynchronously (`workbook.xlsx.load` returns a Promise); there is no synchronous reader (OP5).

### Canonical field names are accepted as headers
- **Spec said:** the alias table lists `shareswith…` and `tarecordlocator…` but not `shareswithline` or `travelagentlocator`.
- **Did:** every canonical field name, normalised, is also an alias.
- **Why:** M3 requires the `canonical-csv` export (whose headers are the canonical names) to parse back to the same entries.

### Invalid count cells keep a default value
- **Spec said:** an unconvertible cell leaves the field unset.
- **Did:** for `line`, `rooms`, `adults`, `children`, `infants` the issue (R014/R006/R007) is raised and the field gets its default (file-order line, 1, the adults rule, 0, 0). `sharesWithLine` and dates are left unset.
- **Why:** these fields are required in `ParsedEntry`. The error still blocks conversion, and treating the bad cell as blank stops R007 being reported twice.

### An empty required date raises R002
- **Did:** an empty `arrivalDate` or `departureDate` cell raises R002 ("is empty"); an empty `dateOfBirth` does not.
- **Why:** the spec lists no other rule for a missing required date, and the planner must be told.

### `columnMap: null` raises no W201
- **Did:** a column the caller maps to `null` is listed in `columns` with `field: null` but gets no "not recognised" warning.
- **Why:** the caller ignored it on purpose; W201 is for headers that were not recognised.

### Corrupt `.xlsx` is F003
- **Did:** a file with the zip signature that exceljs cannot open raises F003 `UNSUPPORTED_FORMAT`.
- **Why:** no rule covers it; F003 is the closest ("cannot read this format").

### Shared rule table in `src/issues.ts`
- **Did:** codes and severities for every rule ID live in `packages/core/src/issues.ts` (not `parse/issues.ts`, as planned).
- **Why:** the parser, validator (M2) and exporters (M3) all raise issues.

### `tools/build-fixtures.ts` also generates the faker CSVs
- **Spec said:** the tool generates the `.xlsx` fixtures from the `.csv` ones.
- **Did:** it also generates `clean-40.csv`, `messy-headers.csv` and `dmy-dates.csv` (faker seed 42). Run `pnpm fixtures:build`. CSV output is byte-stable; `clean-40.xlsx` bytes change between runs (zip timestamps), its content does not.
- **Why:** one reproducible script for all generated fixtures.

### `@types/node` in `packages/core` (dev)
- **Why:** exceljs type definitions reference Node's `Buffer`, and the fixture test reads files with `node:fs`. The library code itself uses no Node-only API.

### Malformed CSV quoting: lenient, then F004 (owner decision)
- **Spec said:** nothing about malformed CSV; `csv-parse` throws on bad quotes, which crashed `parseRoomingList`.
- **Did:** `relax_quotes: true`, so a quote inside an unquoted cell (`O"Brien`) is kept as text. A quote that is opened and never closed cannot be recovered and raises F004 `FILE_ENCODING` with a message saying the CSV is malformed and the approximate row.
- **Why:** chosen by the repo owner; no new rule ID needed.

### New rule R015 `FIELD_TOO_LONG` (owner decision)
- **Spec said:** length limits in "Canonical model" (e.g. `lastName` ≤ 80, `roomType` ≤ 20) but no rule for exceeding them.
- **Did:** error R015 `FIELD_TOO_LONG` names the field, its length and the limit; the field is left unset. `email` has no limit in the spec, so none is applied. Integer cells beyond `Number.MAX_SAFE_INTEGER` raise the field's existing rule (R006, R007 or R014).
- **Why:** chosen by the repo owner. Must be added to `docs/ERRORS.md` when that file is written (M6).

### Blank header over data raises W201
- **Did:** a column whose header cell is blank raises W201 ("Column N has no header") only if some data row has a value in it; empty padding columns stay silent. The same applies to CSV cells to the right of the last header cell.
- **Why:** step 5 wants every unmapped column reported, but trailing empty columns from Excel exports are not real columns.

### Rejected-before-reading files report `format: "csv"`
- **Did:** legacy `.xls` (F003) and invalid UTF-8 (F004) return `format: "csv"`.
- **Why:** `ParseResult.format` only allows `csv` or `xlsx`; the bytes were not a readable xlsx.

### Explicit `firstName` column beats the `fullName` split
- **Did:** when names come from `fullName` and a `firstName` column also exists, a non-empty first-name cell wins.
- **Why:** an explicit column is more reliable than a guessed split.

### `.gitattributes` pins line endings
- **Did:** `* text=auto eol=lf`; `fixtures/** -text`; `*.xlsx binary`.
- **Why:** fixtures and golden files are compared byte for byte; `core.autocrlf=true` on Windows would otherwise rewrite them.
