# Contributing

## Prerequisites

- Node 24 (the version is pinned in `.nvmrc`; `nvm use` picks it up).
- pnpm, through corepack: run `corepack enable` once. The exact pnpm version is pinned in `package.json`.

## Set up and run

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the API on http://localhost:4010 (API docs at `/docs`) and the web app on http://localhost:3010.

## Check your work with `pnpm verify`

`pnpm verify` runs these in order and stops at the first failure:

1. `pnpm lint` (Biome).
2. `pnpm typecheck` (TypeScript in every package, plus `typecheck:infra`). `typecheck:infra` runs `sst install`, which downloads providers: it needs network access but no AWS credentials.
3. `pnpm test` (Vitest unit tests with coverage).
4. `pnpm test:e2e` (API e2e tests and the Playwright smoke and keyboard tests). Install the browser once with `pnpm exec playwright install chromium`.
5. `pnpm build` (every package and app).

`pnpm format` fixes most lint and formatting problems.

## Commit style and pull requests

Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`. Example: `fix: reject a sharer that points at itself`.

`main` is protected: open a pull request, wait for the `verify` and `e2e` checks, then squash-merge. The PR title becomes the commit message, so give it the Conventional Commits form.

## Adding a test

| What | Where |
|------|-------|
| Core library (Vitest) | next to the source, `packages/core/src/**/*.test.ts` |
| API end to end (supertest) | `apps/api/test/*.e2e.test.ts` |
| Web unit tests (Vitest) | `apps/web/src/**/*.test.ts` |
| Browser tests (Playwright) | `apps/web/e2e/*.spec.ts` |

Name each test after what it proves: the validation rule ID, the error code, or the worked example ID. For example `R003 flags a departure before arrival` or `WE1: converts to Maestro CSV`. A failing test name then tells you which requirement is broken.

Use synthetic data only (names like "Ada Okafor", emails at `example.com`). Never commit real guest data.

## Where deviations go

- `docs/DECISIONS.md`: anything you did differently from the project spec, with date, what the spec said, what you did, and why.
- `docs/ASSUMPTIONS.md`: any fact about a hotel system (OPERA, Maestro) that you could not check against a real system.
