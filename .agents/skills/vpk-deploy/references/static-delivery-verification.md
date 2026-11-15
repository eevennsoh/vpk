# Static delivery verification

Read this before a compact-image plan or when a release changes static serving,
compression, or `--check-static-delivery` evidence. Back to [SKILL.md](../SKILL.md).

## Prepare the compressed export

Both packaging paths prepare gzip/Brotli siblings through
`scripts/prepare-static-export.mjs` and write `output/export-inventory.json`
outside the public export. Static serving lives in the copied canonical
`backend/lib/static-export-serving.js` and `static-asset-delivery.js`; it negotiates
codecs, revalidates HTML, and caches generated Next assets immutably. The first
release changing these runtime files requires a full image. Frontend delta
images thereafter must include refreshed siblings for changed source files.
Before a compact-image plan, run:

```bash
node scripts/prepare-static-export.mjs out --compress --report output/export-inventory.json
```

The delta planner rejects stale or retained prior compressed representations.
Compare inventories for file-size changes and use the shared UI performance
workflow for browser latency; inventory bytes alone do not prove faster use.

## Bound the HTTP checks

Static and browser-font HTTP checks use a bounded pool of six requests, keeping
all content-type, Origin, redirect, readiness, and token checks. Use one focused
local regression matrix and deployed capability smokes after exact HTML/new-chunk
parity; repeat deeper tests for a deployment-specific risk or changed evidence.
Carry forward documented findings tied to unchanged owners, inspect the new
release, and investigate new or changed findings.

## Read the static-delivery report

`--check-static-delivery` checks compression for large text, HTML revalidation,
`Vary: Accept-Encoding`, immutable Next asset caching, and gzip HTML parity.
The JSON report records decoded body bytes and the encoded Content-Length
reported by the server; absent encoded lengths remain null. It is an HTTP
delivery report, not a browser timing profile. Use this check for new prepared
releases; inspect older deployments without the flag when diagnosing migration.
