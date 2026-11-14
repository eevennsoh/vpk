---
description: Unit, source-contract, behavior and Playwright tests, the unit gate, CI jobs, and perf budgets
paths:
  - "**/*.test.*"
  - "tests/**"
  - "playwright.config.ts"
  - "scripts/run-js-unit-tests.mjs"
  - "scripts/js-unit-test-*.mjs"
---

# Testing

- When changing source guarded by a source-contract test, run the colocated exact-file suite before `pnpm run ci:pr`. If implementation moves between owners, relocate the assertion instead of deleting the contract; prefer behavioral, typed, or helper-level proof over incidental prop, class, or source ordering. Lint rejects new `assert.match(*_SOURCE, …)` assertions in app/components/hooks/lib tests; existing ones are baselined in `eslint-suppressions.json`, so a file's count may only drop.
- Prove UI behavior by rendering it, not by regex-matching source: `renderComponent()` in `scripts/lib/render-component.js` bundles a real TSX component (with `@/` and mocks) into happy-dom and offers role/text queries, `click`/`press`/`focus`/`fill`, `tabOrder()`, and `isFocused()`. Assert on strings and booleans, never on DOM nodes, because a failed assert on a node can hang. Example: `components/blocks/jira-issue/uncaptured-work-chin.behavior.test.js`.
- Every `*.test.{js,mjs,ts}` file that imports `node:test` runs in the unit gate; there is no registry to edit. Name a suite by what it asserts: `*.source.test.*` for source-contract suites that read source text, `*.behavior.test.*` for rendered or driven behavior, plain `*.test.*` otherwise. The only lists are what does not run: `scripts/js-unit-test-skipped.mjs` (each entry with its reason; `artifacts/` is skipped as a root because its suites belong to vpk-html sessions) and `scripts/js-unit-test-legacy-drift.mjs`, a frozen baseline of failing suites that a merge-base ratchet lets only shrink. Unfiltered `node scripts/run-js-unit-tests.mjs` fails on a test file without a `node:test` import. `--file` force-runs a named path, including a legacy-drift suite you are graduating.
- Unit batches load `scripts/lib/register-alias-hook.mjs`, so modules a suite loads directly may use the `@/` alias and extensionless imports like the app does.
- A test that starts a long-lived process uses `spawnInGroup` from `scripts/lib/test-process.js` (own process group, killed on `t.after`). The unit runner fails a batch that leaves any process running after it exits and prints that process's command line.
- `pnpm run check`, `pnpm run ci:pr` and the unit runner take turns on this machine through one lock under the shared git directory (`scripts/lib/heavy-run-lock.js`; a no-op in CI and under `node --test` unless a test names its lock path). A run that has to wait repeats `heavy-run lock: waiting for pid N …` every 30 seconds and runs without its turn after 10 minutes; let it wait rather than killing the holder. A dead or reused holder's lock is taken over automatically. Under memory pressure these runs go one command at a time and say so.
- Browser coverage is under `tests/**/*.spec.ts` (`playwright.config.ts`); run targeted specs with `pnpm exec playwright test <spec>` after `pnpm install`. Specs reach the app through `appUrl()` in `tests/helpers/origin.ts` (lint rejects hardcoded ports and `*.localhost` hosts) and seed design settings with `?variants=` via `tests/helpers/design-variants.ts`. Board setup lives in `tests/helpers/board.ts`; wait on an observable condition, never `page.waitForTimeout` (`verify:source-guardrails` rejects new ones). Tag a fast, self-contained spec `{ tag: "@smoke" }` to put it in `pnpm run test:e2e:smoke`, which runs only the tagged files.
- GitHub Actions verifies lockfile registry URLs, runs `pnpm install --frozen-lockfile`, then runs `verify:fast`, lint (which covers the design-system pilot paths), and typecheck in its static job, then `pnpm run typecheck:build` (TypeScript 6, the checker `next build` uses, which can reject code the native TypeScript 7 accepts); unit tests run in four shards; a browser smoke job builds the static export, serves it from Express and runs `pnpm run test:e2e:smoke`; aggregate `PR checks` requires all three jobs to pass. GitHub does not enforce branch protection on this private repo, so `/vpk-git-ship` enforces it: the merge waits until `PR checks` passes.
- Bundle work: use `pnpm run perf:budget:warn`, strict `pnpm run perf:budget` before shipping, and `pnpm run perf:baseline:timing -- --base-url <URL>` for route timing. Do not commit `output/perf-baseline.json`. The Actions `Perf budget` job runs the same byte budgets on every push to `main`, and the PR smoke job checks the manifest-size budgets (all but fetched bytes) from its export build. A route the collector measures by default must have a budget in `scripts/perf-route-budgets.json`, and budgets there may only go down (its `targets` are where they should return to). A deliberate raise needs a `raises` entry in that file (route, metric, from, to, measured, reason, date) within the file's `margin` of the measured value; that is the owner's call.
- Validation freshness:
  <!-- validation-freshness:begin -->
  Commands: `pnpm run validate:preflight`, `pnpm run verify:fast` (bundles the
  following checks), `pnpm run verify:root-artifacts`,
  `pnpm run verify:url-credentials`, `pnpm run verify:route-manifest`, `pnpm run verify:api-surfaces`,
  `pnpm run verify:repo-map`, `pnpm run verify:vpk-feature-map`, `pnpm run verify:file-size`,
  `pnpm run verify:catalog`, `pnpm run verify:lazy-load`, `pnpm run verify:source-guardrails`,
  `pnpm run verify:eslint-suppressions`, `pnpm run verify:unused-code`,
  `pnpm run verify:cursor-rules`,
  `pnpm run verify:doc-scripts`, `pnpm run validate:agents`, `pnpm run validate:skills`.
  Additional checks: `pnpm run lint`, `pnpm run lint:design-system`, `pnpm run typecheck`,
  `pnpm run typecheck:build` (opt-in locally: about 45 s and several GB).
  Reference docs: `.agents/docs/architecture-overview.md`,
  `.agents/docs/workflows-extended.md`, `.agents/rules/api-surfaces.md`,
  `.agents/rules/token-priority.md`,
  `.agents/rules/component-architecture.md`,
  `.agents/rules/agent-operations.md`.
  <!-- validation-freshness:end -->
