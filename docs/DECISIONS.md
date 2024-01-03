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
- **Zip directory check.** Before unpacking, `checkZipSizes` (`parse/zip-guard.ts`, no Node APIs) reads the zip directory and refuses a workbook that declares more than 100 MB unpacked or more than 500 parts, or uses zip64 sizes, as the existing `F003 UNSUPPORTED_FORMAT` ("The workbook is too large when unpacked"). **Residual risk, written down:** a deliberately forged zip can lie about its sizes, and an honest but very large workbook still costs a lot (see "Open after the M6 reviews" below). The 5 MB upload limit alone is not a sufficient backstop: the measurements showed 0.5 GB is where the task dies, not a protection.
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

### Open after the M6 reviews (reported to the owner, not decided)
The second review run still found two unbounded-cost cases. The milestone rules stop at two reviewer runs, so they are recorded here for the owner:
1. **Short CSV rows are slow inside `csv-parse`.** With `relax_column_count`, a row shorter than the header costs about 0.13 ms (a normal row about 1.5 µs). It is linear but heavy: a 5 MB CSV of one-cell rows (2.6 million lines) blocks the event loop for minutes, and the 120-per-minute limit does not prevent it. The library has no option that avoids it. F007 is only checked after the whole file is parsed.
2. **Honest but very large workbooks.** A 5 MB `.xlsx` of 1,048,575 one-cell rows (about 42 MB unpacked, under every guard limit) took 8.4 s and 1.66 GB in core, and blocked `/healthz` for about 10 s through the API; a dense 109 × 16,384 sheet took 0.9 GB. The infrastructure spec gives one task 0.5 GB, so one such upload could get it killed. A forged zip (declared 1 KB, really 2.5 GB) is the case already accepted above.

### M6 review notes recorded
- `biome.json` turns `style/useImportType` and `complexity/noStaticOnlyClass` off for `apps/api/src/**`: the first so injected classes stay value imports (see above), the second because Nest dynamic modules (`AppModule.register`, `ConfigModule.forRoot`) are static-only classes by design.
- The overflow W201 reads "N more columns are ignored (not recognised, or without a header)", because the counted columns can be unrecognised headers or headerless data columns.
- `docs/ERRORS.md` (INTERNAL) now says the log holds the error class and location, not its message.
