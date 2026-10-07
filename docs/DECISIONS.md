# Decisions and deviations

Dated list of decisions and deviations from `HANDOFF.md`, the project spec (OP5, OP7). The spec is kept private on the owner's machine; on 2026-10-07 it and the `.claude/` folder were removed from the git history, so every commit ID changed. IDs cited below are the new ones.

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
- **Why:** these fields are required in `ParsedEntry`. The error still blocks conversion. Treating a bad cell as blank avoids a second R007 in the common case; one edge remains: `adults` unreadable with `children` = 0 (or the reverse) gives the parser's R007 and also the validator's "adults + children < 1" R007 on the same row (corrected 2026-10-06, M2 review).

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

## 2026-10-06 (M2)

### Issue rows reach the validator through `entryRows` (owner decision)
- **Spec said:** `validateRoomingList(list)`; issues carry `row` (source row) and messages name the row. Entries do not know their row.
- **Did:** `ParseResult` gains `entryRows: number[]` (source row of `entries[i]`). `validateRoomingList(list, { entryRows? })`. With rows, issues have `row` and `line` and messages start `Row N:`. Without rows, issues have only `line` and messages start `Line N:`.
- **Why:** chosen by the repo owner; keeps the entry JSON shape exactly as the spec table.

### R001 and R015 both fire on a too-long last name (owner decision)
- **Did:** the validator sees no last name and reports R001 next to the parser's R015.
- **Why:** chosen by the repo owner; the validator stays a pure function of the list.

### Cell-level rules stay in the parser
- **Spec said:** every rule is its own exported function in `validate/rules.ts`.
- **Did:** R002, R006, R014, R015, W201, W205, W207, W208 and the bad-cell half of R007 are raised in `parse/` (they need the raw cell text, which entries no longer have). The entry-level rules (R001, R003–R005, R007 sum, R008–R013, W202–W204, W206) are one exported function each in `validate/rules.ts`.
- **Why:** after parsing, a bad cell is just a missing field; only the parser can tell "blank" from "unreadable".

### Rule details the spec leaves open
- R003, R004, W202, W203 and W206 skip an entry whose needed date is missing (R002 already reported it).
- R004 and W202 check only the side of the block that has a date (`startDate` without `endDate` is allowed by the schema).
- A self-reference is R011 only, not also R010. R012 is checked only when the target exists.
- R013: the room's people are the primary plus every entry whose `sharesWithLine` is the primary's line; the maximum is looked up case-insensitively by the primary's room type; no room type or no maximum for it → not checked.
- W203: needs a last name and both dates on both entries. "Later" and "earlier" mean line numbers (file order only breaks ties between duplicate lines); reported once on the later line, naming the lowest-numbered earlier match.
- R004 reports each side separately: a stay that starts before and ends after the block gives two R004 issues.
- W206 is checked only when the target exists and is itself a primary (otherwise R010/R012 apply).
- Summary: `byRoomType` sorted by room type in code-point order, `"(none)"` last; an entry whose departure is not after its arrival counts as "invalid date" for night figures; a sharer is any entry with `sharesWithLine`.

### Validator issues show normalised values, not raw cell text
- **Spec said:** `Issue.value` is "the offending raw cell text"; the sample message shows the date as typed (`11/09/2026`).
- **Did:** issues raised by `validateRoomingList` (R001, R003–R013, W202–W206) put the normalised value in `value` and `message`: ISO dates (`2026-11-09`), upper-cased room types, line numbers as text. Parser issues (R002, R006, R014, R015, W201, W208, …) still carry the raw cell text.
- **Why:** the validator works on entries, which keep only normalised values (owner's `entryRows` decision keeps the entry shape unchanged). Carrying raw text too would mean adding fields to every entry.

### Summary `firstArrival` / `lastDeparture` include sharers
- **Did:** both come from every entry with a valid stay, sharers included. If a sharer stays longer than its primary, `byNight` runs to the sharer's departure and those extra nights show 0 rooms.
- **Why:** the spec defines `byNight` as running from `firstArrival` to `lastDeparture − 1` but does not say whose stays define them; the planner's group dates are everyone's dates. W206 already warns about the mismatched sharer.


## 2026-10-06 (M3)

### Every text export ends with one line terminator (owner decision)
- **Spec said:** Maestro "line ending `\r\n`, no trailing blank line"; nothing about the final line for the other formats.
- **Did:** each text export ends with exactly one terminator of its own style: Maestro CSV `\r\n`, canonical-csv `\n`, XML `\n`, canonical-json `\n`. There is never an empty line after the last record.
- **Why:** chosen by the repo owner. It matches "lines end with `\r\n`" in the worked example literally.

### `exportRoomingList` is async
- **Spec said:** `exportRoomingList(...): ExportResult`.
- **Did:** returns `Promise<ExportResult>`.
- **Why:** exceljs writes workbooks asynchronously (same reason as `parseRoomingList`, M1).

### Export refusal order
- **Did:** (1) unknown target → `UnknownTargetError`; (2) options checked with the target's Zod schema → `ExportOptionsError` (carries the Zod issues; the API maps it to 422 `VALIDATION_FAILED` in M6); (3) `validateRoomingList` errors → `ExportPreconditionError`; (4) each entry narrowed with the strict `RoomingEntrySchema`, a missing required field becomes X001 (this catches a date cell the parser reported as R002 and left empty, which the validator cannot see); (5) the target's own X001 checks.
- **Why:** the spec says export refuses on validation errors or a failed precondition but does not define errors for bad options or half-parsed entries.

### New rule IDs X001 and X101 in `src/issues.ts`
- **Did:** X001 `EXPORT_FIELD_REQUIRED` (error), X101 `EXPORT_OVER_RECOMMENDED_LIMIT` (warning) join the shared rule table. Messages say `Line N`: export has no source rows.

### `ExportResult.issues` carries validation warnings too
- **Did:** warnings from `validateRoomingList` plus X101 are returned in `issues`; errors make the export throw.
- **Why:** the API header `x-roomlist-warnings` and the CLI's stderr output need the warnings.

### Canonical targets have no provenance entries
- **Did:** `provenance` is `[]` for `canonical-json` and `canonical-csv`.
- **Why:** they are this project's own formats; there is no vendor document to verify against.

### XML element names: ASCII subset
- **Did:** `rootElement` and `recordElement` must match `^[A-Za-z_][A-Za-z0-9._-]*$`.
- **Why:** the spec says "validated as XML names". The full XML Name production allows many Unicode letters and colons; the ASCII subset keeps out spaces, `<` and namespace prefixes, and covers every realistic envelope name.

### Opera Cloud cells are text-formatted
- **Did:** every cell, including empty ones, gets Excel's Text number format (`@`) and string values.
- **Why:** "all cells are written as text" in the spec; it keeps `007` and `11/10/2026` exactly as written.

### Golden files and Biome
- **Did:** `fixtures/` is excluded from Biome (`biome.json`).
- **Why:** `pnpm format` reflowed `we1.canonical.json`, which breaks the byte-for-byte golden comparison. Fixtures and golden files must never be rewritten by a formatter.
- **Also:** `we1.opera5.xml` and `we1.maestro.csv` were written by hand from the spec text; the exporters reproduce them exactly. `we1.canonical.json` and `we1.canonical.csv` were generated once by the exporters and checked by eye. The `.xlsx` target is checked by reading it back (zip bytes are not stable).

### M3 review follow-ups
- **`emailType` option:** the spec says only "string, default EMAIL". The schema requires at least 1 character (an empty type would break "Email Type is mandatory when an email is given") and sets no maximum.
- **Maestro quoting:** csv-stringify only quotes a value that contains the whole `\r\n` delimiter, so `quoted_match: /[\r\n]/` quotes values with a lone `\n` or `\r` too. Otherwise one record could be split across two lines.
- **Test helper not shipped:** `src/export/test-helpers.ts` is excluded from `tsconfig.build.json` (it uses `node:fs`, which core's library code must not).
- **`.editorconfig` for fixtures:** `[fixtures/**]` unsets line-ending rules so an editor cannot rewrite the CRLF golden file on save (`.gitattributes` protects git; this protects editors).
- **Known limitation, carried forward:** `exportRoomingList` cannot see parser-level errors whose field was defaulted or dropped (R006, R007 bad cell, R014, R015). The CLI (M5) and API (M6) must also refuse to convert when `ParseResult.issues` contains any error, not only on `ExportPreconditionError`.
- **Known limitation:** a name containing a C0 control character (for example U+0001) makes the OPERA 5 XML not well-formed XML 1.0. The parser's `cleanName` only collapses whitespace. Not fixed in M3; the spec defines no rule for it.
- **A1 README text:** the README must tell users to compare the OPERA 5 output with their property's template and set `rootElement` / `recordElement` (M8).

## 2026-10-06 (M4)

### `sharesWith` change shows the primary's name (owner decision)
- **Spec said:** `sharesWith` is compared as the primary's name key; the change shape is `{ field, before, after }`.
- **Did:** `before` / `after` show the primary's name as written (`"Last, First"`, or `"Last"` without a first name), and `null` when the guest shares with nobody. The comparison itself uses the name key, so `"Müller"` vs `"Muller"` is not a change.
- **Why:** chosen by the repo owner; the web Compare page shows `before → after` to planners.

### `null` in `DiffReport.changed[].changes`
- **Spec said (API conventions):** never return `null` for absent optional fields. **Spec said (Diff):** `before: string | null, after: string | null`.
- **Did:** followed the Diff section: `null` means "no value on that side" in a change record. Everywhere else absent keys are still omitted.
- **Why:** the Diff section is the specific rule for this shape.

### Diff edge cases the spec leaves open
- A confirmation number that appears twice on one side pairs in line order; the leftover entry goes on to name matching.
- Confirmation numbers are trimmed before the case-insensitive comparison.
- In step 2, an entry with no arrival date sorts before every dated entry of the same name.
- A sharer pointing at a line that does not exist (only possible in an invalid list, which the API refuses) is compared as "missing line N" and shown as `line N (not in the list)`.
- `added`, `removed` and `changed[].before/after` use the `ParsedEntry` shape (the lists being compared are parsed lists; see M1).
- Values in a change are strings (`String(n)` for numbers), in the order of the spec's compared-field list, with `sharesWith` last.
- `list-v2.csv` also renames "Jonson, Erik" to "Johnson, Erik" with the same confirmation number. This is beyond the spec's list of differences on purpose: it proves step 1 (confirmation number) wins over name, and the pair counts as unchanged because names are not a compared field. The counts the spec asks for (3 added, 2 removed, dates on 2, room type on 1, 1 re-link) are unaffected.
- Side effect of comparing `sharesWith` by the primary's name key (spec step 4): if a primary's name is corrected but the pair is matched by confirmation number, each of its sharers shows a `sharesWith` change although they still share the same booking. Kept as the spec defines it.

## 2026-10-06 (M5)

### Source condition for workspace typechecking
- **Problem:** `pnpm verify` runs `typecheck` and `test` before `build`, but the CLI imports `@alihdrndm/roomlist-core`, whose `exports` point at `dist/`. On a fresh clone `dist/` does not exist yet.
- **Did:** core's `exports` has a custom condition first, `"@alihdrndm/source": "./src/index.ts"`. The CLI's `tsconfig.json` sets `customConditions: ["@alihdrndm/source"]`, so `typecheck` reads core's TypeScript source. `tsconfig.build.json` resets it to `[]`, so the build uses core's `.d.ts`. Node and any published consumer ignore the unknown condition. The API (M6) uses the same setup.
- **Why:** keeps the spec's root scripts and order exactly as written, with no build step hidden inside `typecheck`.

### CLI tests build before they run
- **Did:** the CLI `test` script is `pnpm --filter @alihdrndm/roomlist-core build && tsc -p tsconfig.build.json && vitest run --coverage`.
- **Why:** M5's acceptance check says tests run the **built** binary with `execa`, and `pnpm test` runs before `pnpm build` in `verify`.

### No coverage thresholds for the CLI
- **Why:** the spec sets thresholds for `packages/core` only, and code running inside the spawned binary is not measured by in-process coverage.

### CLI exit codes for cases the spec does not spell out
- `validate` prints the full report and exits 1 when the list has any error (parse or validation, including file-level F errors); warnings alone exit 0.
- `convert` refuses (exit 1, nothing written) when the parse or validation reports any error. This closes the M3 carry-forward: parser errors such as R006/R014/R015 are not visible to `exportRoomingList` alone.
- `diff` refuses (exit 1) when either list has an error, printing the issues prefixed `before:` / `after:`, mirroring the API's `LIST_INVALID`. Lists are validated without a block (the spec's `diff` command has no `--block`).
- Exit 2 for: missing or unreadable file, file over 5 MB, invalid `--block` JSON or schema, invalid `--options` JSON or options rejected by the target schema, unknown `--to`, invalid `--date-order`, output file exists without `--force`, unknown command or option.
- The 5 MB limit is 5 × 1024 × 1024 bytes, the same as the API's default `MAX_UPLOAD_BYTES`; the file size is checked with `stat` before reading.

### Colour without a dependency
- **Did:** `node:util` `styleText` (built into Node 24), passed the target stream, so `NO_COLOR` and non-TTY output turn colour off. Severity is always written as a word too.
- **Why:** OP7 names only `commander` for the CLI.

### CLI output details
- The issues table's "Code" column shows the issue `code` (for example `DATE_INVALID`), matching the web page's table; rule IDs are in `--json`.
- `convert` prints, to stderr, every parse and validation warning with its source row, plus the export's own X-rule warnings (X101). It does not repeat the export's copy of the validation warnings, which only carry line numbers.
- `packages/cli/tsconfig.json` sets `types: ["node"]` (the CLI is a Node program; the build excludes test files, which otherwise pulled in the Node typings).

### M5 review follow-ups
- **Colour rule written out:** `shouldUseColor(env, isTTY)` in `packages/cli/src/format.ts` returns true only on a TTY with `NO_COLOR` unset. Node's `styleText` lets `FORCE_COLOR` override `NO_COLOR`, which the spec forbids, so the CLI decides itself and calls `styleText` with `validateStream: false`. The rule applies to stdout (reports) and to stderr (problems) each by its own TTY state.
- **Human output now complete:** `validate` prints primaries, sharers and the per-room-type table as well; `formats` prints each provenance item's source under it.
- **Order of refusals in `convert`:** list errors (exit 1) are checked before the export options (exit 2), because core validates options inside `exportRoomingList`. A list with errors and bad `--options` therefore exits 1.
- **`--options null`** is treated as "no options" (core's `options ?? {}`).
- **`@alihdrndm/source` points at `src/`**, which `"files": ["dist"]` would not publish. Harmless: other consumers do not know the condition, and publishing is out of scope.

## 2026-10-06 (M6)

### New environment variables: `TRUST_PROXY` (owner decision) and `NODE_ENV`
- **Spec said:** extra environment variables are `MAX_UPLOAD_BYTES` and `MAX_ROWS` only.
- **Did:** `TRUST_PROXY` (number of reverse proxies, default 0) so the rate limit sees each client's own address behind a load balancer (chosen by the repo owner; compose and SST set it to 1 in M8), and `NODE_ENV` (`development | production | test`, default `development`) to choose readable or JSON logs without reading `process.env` outside `config.ts`.
- **Why:** without `TRUST_PROXY`, every user of a deployed API would share one 120-per-minute bucket (the load balancer's address).

### Workspace typecheck and tests use core's source
- **Did:** `apps/api` follows the M5 pattern: `customConditions: ["@alihdrndm/source"]` in `tsconfig.json`, reset in `tsconfig.build.json`; both Vitest configs alias `@alihdrndm/roomlist-core` to `packages/core/src/index.ts`.
- **Why:** `pnpm test` and `pnpm test:e2e` run before `pnpm build`, so core's `dist/` does not exist yet on a fresh clone.

### `vite-tsconfig-paths` removed
- **Did:** both Vitest configs use `resolve.tsconfigPaths: true`; the plugin is removed from `devDependencies`.
- **Why:** Vite supports it natively and warned on every run (M2 and M3 reviewers noted it).

### Multipart envelope
- **Did:** `block`, `options`, `target`, `targetOptions` are plain text parts; the schemas in `apps/api/src/schemas.ts` parse the JSON text and validate it in one step with core's `BlockContextSchema` and `ParseOptionsSchema`, so a bad part is a normal `VALIDATION_FAILED` under its own name. A JSON part sent as a file upload (curl `-F block=@file`) is a 422 "Unexpected field" with a hint, because the spec says JSON parts are text.
- `options` is `ParseOptionsSchema` without `maxRows`; `maxRows` always comes from `MAX_ROWS`.
- Zod issue `code` values (`invalid_type`, `unrecognized_keys`, `custom`, ...) are used for `errors[].code`; the Nest Standard Schema pipe passes Zod's issues through, so the code is read from them at runtime.

### Error mapping details
- **FILE_REQUIRED** is raised by an interceptor that runs after the upload interceptor and before body validation, so a missing file is always 400 and is never hidden behind a 422.
- **Any other 4xx from the framework** (malformed multipart, unexpected field) is `VALIDATION_FAILED` (422) with the framework's message in `detail`.
- **API key:** both sides are SHA-256 hashed before `timingSafeEqual`, because `timingSafeEqual` throws on different lengths and a length pre-check would leak the key's length. The same message is returned for a missing and a wrong key.
- **Throttler:** a global guard; the health endpoints are exempt (`@SkipThrottle`) because probes are frequent. The limit is a constant 120 per 60 s; only the test hook can change it.
- **Request id:** a caller's `x-request-id` is kept only if it is 1 to 128 characters of `A-Za-z0-9._-`; otherwise a UUID v7 replaces it.
- **Logging:** the access log serializer writes only id, method, path (no query string), user agent and status code; headers and bodies are never logged.
- **Uploads:** multer's default is memory storage when neither `dest` nor `storage` is set, so nothing is written to disk; `limits.fileSize = MAX_UPLOAD_BYTES`.

### Swagger: schemas come from Zod, and the multipart body uses `standardSchema`
- **Spec said:** use `@nestjs/swagger`'s Standard Schema integration if the installed version has one; otherwise `z.toJSONSchema()` with `@ApiBody` / `@ApiResponse`. No hand-written duplicate schemas.
- **Did:** `@nestjs/swagger` 12.0.2 has the integration. `@Body({ schema })` makes it document the Zod envelope as the request body, which hides the file parts (`file`, `before`, `after`). So each `@ApiBody` passes a multipart Zod schema (file parts plus the text parts) as `standardSchema`. `@nestjs/swagger` reads that key at runtime (it is how `@Body({ schema })` is documented), but the `ApiBody` typings do not list it, so `multipartBody()` in `apps/api/src/openapi.ts` has one commented type assertion.
- **Guard:** `docs.e2e.test.ts` asserts the documented parts, so an upgrade that changes this behaviour fails a test.
- **Components:** `BlockContext`, `ParseOptions`, `Problem`, `ValidateReport`, `DiffReport` and `TargetsResponse` are registered under `#/components/schemas` from Zod via `z.toJSONSchema(..., { target: "openapi-3.0" })`; the part descriptions point at them.
- Each endpoint documents one 422 entry whose text lists every code that can come back with that status (an OpenAPI response is keyed by status, not by `code`).
- **Helmet and `/docs`:** helmet runs with its defaults on every route. Swagger UI works under the default Content-Security-Policy (its HTML has no inline script; a test asserts this and that an asset URL from the page returns 200).

### Biome `useImportType` is off for `apps/api/src`
- **Did:** an override in `biome.json` turns `style/useImportType` off for `apps/api/src/**`.
- **Why:** Biome's autofix rewrote `import { RoomingListsService }` in the controller to `import type`, which erases the class that Nest reads from the constructor parameter type at runtime (`emitDecoratorMetadata`) and breaks dependency injection. This is a known conflict between that rule and Nest.

### Tests: log capture needs one app per file
- `nestjs-pino` keeps a single logger per process (production runs one app), so only the first app started in a test file writes to its own capture stream. Tests that read logs live in files that start exactly one app (`logging.e2e.test.ts`, `auth.e2e.test.ts`, `auth-open.e2e.test.ts`); the note is on `startApp` in `apps/api/test/helpers.ts`.

### M6 found and fixed a bug in core (M1 code)
- **Bug:** `parseRoomingList` computed the widest row with `Math.max(headerWidth, ...dataRows.map(...))`. Spreading one argument per row overflows the call stack on a large file: a 5 MB CSV of short rows (over 200,000 rows) made the API answer 500 instead of reporting F007 (too many rows). Found by the API e2e test "a file of exactly MAX_UPLOAD_BYTES passes the size limit".
- **Fix:** a plain loop, plus a regression test in core (`parse.test.ts`). The worst case, a 5 MB file over the row limit, parses in about 0.8 s.
- **Lesson recorded:** no spread of row-count-sized arrays into function arguments.

### M6 review: hostile and oversized input (owner decisions)
Two review blockers were unbounded work from one 5 MB upload. Both fixes are in core (M1 code) and were chosen by the repo owner.
- **Excel files read only what exists.** `readXlsxRows` visits existing rows and cells (`eachRow` / `eachCell`) and keeps the result sparse, instead of looping over rowCount × columnCount of the sheet's used range. A 6 KB workbook with one cell at row 10,000 and one at column 1,000 used to keep the server busy for over five minutes (and `/healthz` stopped answering); it now parses in about a second. Rows are a sparse list (`undefined` for unused rows), which `parse.ts` and `headers.ts` handle.
- **Zip directory check.** Before unpacking, `checkZipSizes` (`parse/zip-guard.ts`, no Node APIs) reads the zip directory and refuses a workbook that declares more than 100 MB unpacked or more than 500 parts, or uses zip64 sizes, as the existing `F003 UNSUPPORTED_FORMAT` ("The workbook is too large when unpacked"). **Residual risk:** superseded by the own Excel reader (see "Resolved after the M6 reviews" below), which also enforces each limit while unpacking.
- **W201 is capped at 50 per file.** The first 50 unrecognised or headerless columns each get their W201 as the spec says; after that one extra W201 says "N more columns were not recognised and are ignored". Unknown header columns beyond 50 are also left out of `columns`. Files with 50 columns or fewer behave exactly as before (including blank headers over data in xlsx files, which the first sparse reader briefly lost and a test now guards). Before the cap, one very wide row produced 2.5 million warnings and a 414 MB response. Headerless-column detection is now one pass over the cells that exist (it was a scan of every row per column).

### M6 review: other fixes and records
- **Errors raised before Nest's router** (a malformed URL, a body-parser error) were answered by Express itself (an HTML 500, no log line), because a filter registered with `APP_FILTER` does not reach that layer. `createApp` now installs the same `ProblemFilter` instance with `useGlobalFilters`. A malformed URL is a 422 `VALIDATION_FAILED` problem+json, and its access-log line is written by the filter when pino-http never ran.
- **Body parsers are off** (`bodyParser: false`): every endpoint takes multipart, which multer reads, so a JSON body of any size or shape is never parsed and ends as `FILE_REQUIRED`.
- **Error logs withhold the message.** An unexpected error is logged with its class name and the first stack frames, never its message (a library message can contain cell text, which logs must not hold).
- **`errors[]` for unknown parts:** one Zod `unrecognized_keys` issue becomes one `errors[]` entry per unknown key (the spec says one entry per Zod issue). Chosen because each entry then has its own `path` that a form can highlight.
- **`errors[].path`** for a root-level `targetOptions` problem is `targetOptions` (no trailing dot).
- **OpenAPI parts are derived from the real body schemas** (`ValidateBodySchema.extend({ file })` and so on), the convert media types come from `listTargets()` (charset included), and the health body is a Zod schema; nothing is typed out by hand any more.
- **Dependencies (OP7):** `pino` and `pino-http` are runtime dependencies because they are peer dependencies of `nestjs-pino`, which the spec names.
- **Upload limits:** multer is configured with `files: 2`, `fields: 10`, `fieldSize: 64 KiB` next to `fileSize: MAX_UPLOAD_BYTES`; the text parts (`block`, `options`, `target`, `targetOptions`) are small JSON.
- **`pino-pretty` is optional:** development logging uses it only if it is installed (it is a dev dependency); a production image built with `pnpm deploy --prod` that leaves `NODE_ENV` unset logs JSON instead of failing to start.
- **Happy path for diff with WE1** (diffing the worked example against itself) was added next to the `list-v1`/`list-v2` test; the convert happy-path tests carry "WE1" in their names.
- **Carry-forward for M8:** Helmet's default Content-Security-Policy includes `upgrade-insecure-requests`; Swagger UI served through a plain-HTTP load balancer may not load its assets in a browser. `/docs` is proved at HTTP level only (HTML and every asset return 200); no browser was used. Check it once behind the real load balancer, or terminate TLS there.

### Resolved after the M6 reviews: own CSV and Excel readers (owner decisions)
The second review run left two unbounded-cost cases. Both are fixed in core; this work was not re-reviewed (two reviewer runs per milestone), which the owner was told.
1. **Own CSV reader (owner: "own small reader").** `csv-parse` took about 0.13 ms per row shorter than the header (a 5 MB file of one-cell rows blocked the server for minutes; no option avoids it). `parse/csv.ts` is now a single linear pass. **Spec said:** step 2 parses with `csv-parse/sync`. **Did:** `csv-parse` is now a devDependency, used only by a fast-check differential test (2,000 generated documents: LF/CRLF, `,` `;` tab, quoted delimiters, doubled quotes and newlines, empty lines, ragged rows) that proves the same rows. Deliberate differences: text after a closing quote is kept (`"Ada"Grace` → `AdaGrace`; csv-parse rejected the file), a lone `
` also ends a record, and every all-blank row is stored as one shared `[""]` (millions of blank lines must not cost an array each). Result: 2.6 million one-cell lines in 6 ms (F007), 2.6 million blank lines in under a second.
2. **Own Excel reader on `fflate` (owner: "lean own reader").** The owner's first pick, exceljs's streaming reader, was rejected: when a zip lists worksheets before `sharedStrings.xml` (exceljs's own writer does), it writes each worksheet to a temporary file on disk, which the spec forbids. `parse/xlsx.ts` (with `xlsx-parts.ts`, `xlsx-sheet.ts`, `xlsx-xml.ts`, `zip.ts`) now unpacks only the parts it needs (workbook, relationships, shared strings, styles, the chosen sheet) with fflate's streaming inflater, each part under a limit (sheet 48 MB, shared strings 24 MB, styles 8 MB, workbook/relationships 2 MB), stops a part the moment it unpacks past its declared size (a forged zip: 400 MB hidden behind a 1 KB claim is refused in 142 ms), reads shared strings lazily, and stops reading a sheet once it has `maxRows + 100` non-blank rows. **Dependency (OP7):** `fflate` (pure JavaScript, no Node APIs). exceljs stays for writing the OPERA Cloud export and as the reference in tests. **Equivalence:** tests read `clean-40.xlsx` and exceljs-written workbooks with every kind of cell (shared and inline strings, numbers, dates with built-in and custom formats, 1904 dates, booleans, formulas, rich text, hyperlinks, error cells, sparse cells, several sheets) with both readers and require identical text. Dates follow exceljs's rules exactly (a number format is a date if, without `[...]` and quoted text, it contains y m d h M s or b; built-in ids 14–22 and 45–47).
- **F007 when reading stopped early:** "The file has more than N guest rows; the limit is N." (the real total is not counted).
- **Readers are async and yield** to the event loop every 256 KB (`parse/yield.ts`, `setTimeout`, available everywhere). Measured on the built API while polling `/healthz` every 100 ms: the worst health-check delay was 291 ms for a pathological dense sheet (109 x 16,384 cells, 5 s to report F005) and 138 ms for 5 MB of blank lines.
- **Residual cost, written down:** a dense workbook just under the 48 MB sheet limit takes several seconds of CPU (the server keeps answering meanwhile), and peak memory for the worst cases measured stayed under 300 MB above baseline.

### M6 review notes recorded
- `biome.json` turns `style/useImportType` and `complexity/noStaticOnlyClass` off for `apps/api/src/**`: the first so injected classes stay value imports (see above), the second because Nest dynamic modules (`AppModule.register`, `ConfigModule.forRoot`) are static-only classes by design.
- The overflow W201 reads "N more columns are ignored (not recognised, or without a header)", because the counted columns can be unrecognised headers or headerless data columns.
- `docs/ERRORS.md` (INTERNAL) now says the log holds the error class and location, not its message.

## 2026-10-07 (M7)

### The block is built from the form, `maxOccupancy` kept
- **Did:** the request's `block` part is built from the form fields the spec lists (property code, block code, group reservation number, start and end date, shoulder days, room types). Empty fields are left out, never sent as `""`; an empty form sends no block. "Load sample" fills the form from `tech26.json` and keeps its `maxOccupancy` (not a form field) and sends it along.
- **Why:** so the sample validates in the browser exactly as it does in the CLI and API (9 room nights, no errors).

### Route handlers are a bounded proxy
- **Did:** `src/lib/proxy.ts` rejects an upload with no `Content-Length` (422 `VALIDATION_FAILED`, one `errors` entry with path `content-length`, the same shape as the API's) or one larger than 5 MB per file plus 1 MB for framing (6 MB; 11 MB for compare, which has two files) with 413 `FILE_TOO_LARGE`, before reading the body. Only then is the body read and forwarded with `x-api-key`. Only `content-type`, `content-disposition`, `x-roomlist-warnings`, `x-request-id`, and `retry-after` / `x-ratelimit-*` (so a 429 says when to retry) come back; problem+json errors pass through unchanged.
- **Why:** the web server must not buffer an unbounded body, and the API key and other API headers stay server-side.
- **New code `API_UNAVAILABLE` (502)** when the API cannot be reached, in the same problem+json shape; documented in `docs/ERRORS.md` under "Web app only".

### `x-forwarded-for` is passed through unchanged (carry-forward for M8)
- **Did:** the proxy forwards the incoming `x-forwarded-for` as it is and does not add the web server's own address. The API (with `TRUST_PROXY`) decides which entry to trust.
- **M8 (resolved):** the owner accepted shared rate-limit buckets for web users after deployment; see M8, "Rate limits for web users after deployment". In local compose, where the web port is reachable directly, a client can set `x-forwarded-for` itself, so compose keeps `TRUST_PROXY=0`.

### System fonts instead of `next/font/google`
- **Did:** the M0 scaffold's Google font is replaced by the system font stack.
- **Why:** `next build` (and the M8 Docker build) then needs no network access.

### Option inputs come from each target's JSON Schema
- **Did:** the convert panel renders each target's options from the `optionsSchema` that `/v1/formats` returns (enum → select, boolean → checkbox, string → text input, defaults prefilled). No option name is written into the UI.
- **Why:** a new target or option shows up in the web app without a UI change.

### Shared report schemas live in core
- **Did:** `ValidateReportSchema` moved from `apps/api/src/schemas.ts` to `packages/core/src/summarize.ts`. The web app imports only types from core (`import type`), so no core code reaches the browser bundle.

### Server-only files without a new dependency
- **Did:** `env.ts` and `lib/proxy.ts` are imported only by route handlers and the `/formats` server component. A unit test scans every `"use client"` file and fails if one imports them, instead of adding the `server-only` package (OP7).

### Page details the spec leaves open
- **"Guests" tile** shows `summary.entries` (one row = one guest record, 4 for WE1), not `people` (6, which counts children and infants). The tile counts what the issues table refers to.
- **`/compare`** adds one line under the tiles: room nights before and after, and the number of unchanged guests (all already in the diff summary).
- **`/formats`** provenance table: two columns, Verified and Assumed. Each cell lists that column's aspects, each with its source (a link when it is a URL). `loading.tsx` shows a status while the server component waits for the API, and an empty list says so.
- **Assumed aspects on `/`** are listed in full under the format select (not shortened to IDs), with the link to `/formats`.
- **Errors from compare** (`LIST_INVALID`) name the list each issue belongs to ("Earlier list, row 3: …"), using the API's `side`. Long lists show the first 10 errors and "…and N more errors."
- **Live region outcome:** after Validate or Compare, the status line announces the outcome ("Validated: 0 errors, 0 warnings.") rather than going quiet.

### M7 review notes recorded
- `apps/web/AGENTS.md` and `CLAUDE.md` are gitignored: `next dev` (also run by Playwright) writes them again on every start, and the M0 decision keeps one CLAUDE.md.
- The compare tables head the entry number "Line" (Glossary), not "Row", which means the file row in error messages.
- Successful API bodies are typed with `as`, not parsed with core's Zod schemas: they come from our own API through our own proxy.
- The client-boundary test checks direct imports only; no shared client module imports `env` or `proxy` today.
- `reuseExistingServer: true`: a local `pnpm dev` started with a different `API_KEY` makes the local e2e run fail with 401; stop it first.
- **M8:** the proxy's bounded buffer relies on Node's HTTP parser enforcing `Content-Length`; re-check that under the `sst.aws.Nextjs` Lambda adapter.

### Playwright: a smoke test and a keyboard test
- **Spec said:** one smoke test. **Did:** also `e2e/keyboard.spec.ts`, which runs the same flow with key presses only. It is the automated proof of the "keyboard-only walkthrough" acceptance criterion; the written steps are in `docs/walkthrough/M7.md`.
- **Did:** `apps/web/playwright.config.ts` builds core, then starts the API (`pnpm --filter api start`, port 4010, because `nest start` compiles against core's `dist/`, which a fresh clone lacks) and the web app (`next dev`, port 3010) with the same throwaway key `e2e-key`, and reuses servers already running on those ports. It reads no environment variables (env is read only in `config.ts` and `env.ts`), so CI and local runs behave the same.

## 2026-10-07 (M8)

### The API runs as a container in AWS
- **Did:** `infra/api.ts` deploys the API with `sst.aws.Vpc` → `sst.aws.Cluster` → `sst.aws.Service` built from `apps/api/Dockerfile`, with a load balancer forwarding `80/http` to `4010/http` and a health check on `/healthz`.
- **Why:** SST bundles Lambda functions with esbuild, which does not emit the decorator metadata NestJS dependency injection needs. A container built with the NestJS build avoids that.

### Rate limits for web users after deployment (owner decision)
- **Did:** SST sets `TRUST_PROXY=1` (the load balancer is the one proxy in front of the container). Direct API callers are counted by their own address. Requests from the web app arrive from its Lambda functions' addresses, so web users share those rate-limit buckets.
- **Why:** chosen by the owner over a trusted client-IP header: no extra code, and easy to explain. Documented in `docs/DEPLOY.md` ("Known limits") and `SECURITY.md`; the README roadmap stays exactly the list from HANDOFF.md. Compose keeps `TRUST_PROXY=0`.

### Seed data (owner decision)
- **Spec said:** `docker compose up --build` must bring up a working stack "with seed data". **Did:** nothing extra is seeded. The project has no database or backing service; the sample list and block ship in the web image (`apps/web/public/samples`, behind "Load sample"), and the README examples use `fixtures/`.

### SST version, typecheck and generated types
- **Did:** root devDependencies `sst` `^3.19.3` (the spec names SST v3; `latest` is already 4.x) and `typescript` `^5.9.3`. `pnpm sst install` needed no AWS credentials, so the spec's fallback (excluding the files from typecheck) was not used. The root `typecheck` script now ends with `typecheck:infra` (`sst install && tsc -p tsconfig.json`), because `.sst/` is gitignored and a fresh clone or CI has to generate the types first. This step needs network access.
- **Root `tsconfig.json`** covers `sst.config.ts` and `infra/` only and does not extend `tsconfig.base.json`: SST's generated platform files are TypeScript sources, and the base file's extra flags (`exactOptionalPropertyTypes`, `verbatimModuleSyntax`) reject them. TypeScript 5 at the root for the same reason: TypeScript 6 rejects the `module` keyword for namespaces that SST's platform code still uses.
- `pnpm-workspace.yaml` denies the install script of `aws-sdk` (pulled in by `sst`; it only prints a maintenance notice).

### Next.js 16 on SST is unverified
- The SST docs (checked 2026-10-07) say `sst.aws.Nextjs` uses OpenNext 3.9.14 for Next.js 15 and later and do not mention Next.js 16. The config does not override `openNextVersion`, because no version is documented for 16. Recorded in `docs/DEPLOY.md` as a known risk for whoever deploys.

### Helmet: no `upgrade-insecure-requests`
- **Did:** `apps/api/src/app.ts` keeps helmet's default Content-Security-Policy but removes `upgrade-insecure-requests`, with an e2e test. **Why:** the deployed load balancer has no domain and serves plain HTTP. With that directive, browsers would load Swagger UI's assets over HTTPS, where nothing answers. This closes the M6 carry-forward.

### Docker images
- Both Dockerfiles: multi-stage on `node:24-slim`, pnpm through corepack (the version pinned in `packageManager`), `pnpm deploy --filter <app> --prod`, `USER node`, and a `HEALTHCHECK` that uses Node's built-in `fetch`, because the slim image has no curl. pnpm 12.2 and later no longer need `injectWorkspacePackages` for `deploy` (pnpm docs), so no workspace setting changed. The Dockerfiles copy `dist/` (API) and `.next/`, `public/`, `next.config.ts` (web) into the deploy output only if `pnpm deploy` left them out.
- The web health check requests `/`, because the spec adds no health route to the web app.
- **Image sizes** (measured): API 457 MB on disk, web 918 MB. The web image carries Next.js's full production dependencies. `output: "standalone"` would shrink it but is a different packaging model from the `pnpm deploy` the spec asks for.
- `.dockerignore` also excludes `.env`, so a local secrets file cannot end up in an image layer.
- `compose.yaml` sets `API_KEY: ${API_KEY:-local-dev-key}`. The key is always set, as the spec requires, and the default is a public local placeholder, not a secret.

### `pnpm dev` and the CLI examples
- `pnpm dev` starts no Docker services, because the project has none ("Backing services: none"). It builds core first, because `nest start --watch` compiles against core's `dist/`, which a fresh clone does not have.
- The README "Try it" CLI examples run `node packages/cli/dist/index.js` after `pnpm build`. `pnpm --filter … exec roomlist` would run inside `packages/cli`, where the `fixtures/` paths do not resolve.

### Definition of done, item 4 (the marker-word grep)
- The grep in item 4 (for the three unfinished-work marker words) matches these files outside `HANDOFF.md`. All are intended or generated, none is a note left in our code:
  - `.claude/agents/milestone-reviewer.md`: HANDOFF.md fixes this file word for word, and it tells the reviewer to check that those markers are absent.
  - `pnpm-lock.yaml`: the sha512 integrity hash of `safer-buffer@2.1.2` happens to contain three capital X letters in a row. It is a checksum, not a note.
  - `.sst/platform/**`: SST's own generated sources, written by `sst install` during `pnpm typecheck` (gitignored).
  - `.git/hooks/*.sample`: example hooks that git writes into every clone.
  - Build output (`.next`, `dist`) after `pnpm verify` (gitignored).
- `git grep` over the committed files matches only the first two. This entry avoids writing the marker words itself, so it adds no match.

### M8 review notes recorded
- **CLI reads `NO_COLOR`.** `packages/cli/src/format.ts` reads `process.env` (as a default argument) to honour the `NO_COLOR` convention. The spec's rule names the two apps' config files; the CLI is a third program, and colour is its only environment setting. Recorded as a deviation (since M5), not moved: a separate CLI env module would read `process.env` all the same.
- **Compose publishes on `127.0.0.1` only**, because the API key in `compose.yaml` and the README is a public placeholder.
- `.gitignore` and `.dockerignore` also cover `.env.*` (Next.js loads `.env.local` and friends), keeping `.env.example`.
- **DEPLOY.md** now lists the Cloud Map namespace and its Route 53 private hosted zone (created by every `sst.aws.Vpc`, billed monthly), says secrets are stored encrypted in S3 (not SSM), and notes that the key is a plain environment variable in the task definition and the Lambda configuration.
- **Order:** the M8 commit (`c54f779`) was made before the reviewer ran; these fixes go in a follow-up commit.
