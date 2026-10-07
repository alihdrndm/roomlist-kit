# roomlist-kit

Validates a hotel rooming list (CSV/XLSX), converts it to a PMS import file (OPERA 5, OPERA Cloud, Maestro), and diffs two lists. Library + CLI + NestJS API + Next.js web.

The full spec is `HANDOFF.md`. Work one milestone at a time; run `pnpm verify` before reporting.

## Root scripts

| Script | Does |
|--------|------|
| `pnpm dev` | API (watch, :4010) and web (:3010) together |
| `pnpm build` | Build every package and app |
| `pnpm lint` | `biome check .` |
| `pnpm format` | `biome check --write .` |
| `pnpm typecheck` | `tsc --noEmit` in every workspace package, then `sst install` + the SST config (`typecheck:infra`) |
| `pnpm test` | Vitest unit tests with coverage |
| `pnpm test:e2e` | API e2e and the Playwright smoke and keyboard tests |
| `pnpm verify` | lint + typecheck + test + test:e2e + build, stop at first failure |

## Conventions that matter most

1. Zod schemas in `packages/core` are the single source of truth for every data shape.
2. No `any`, no `@ts-ignore`, no `!` outside tests. Plain readable code; comments say why.
3. Calendar dates are `YYYY-MM-DD` strings (`IsoDate`); all date math goes through `plain-date.ts`.
4. `process.env` is read only in `apps/api/src/config.ts` and `apps/web/src/env.ts`.
5. Never log request/response bodies or file contents. All sample data is synthetic.

Deviations from the spec go in `docs/DECISIONS.md`; unverified facts in `docs/ASSUMPTIONS.md`.
