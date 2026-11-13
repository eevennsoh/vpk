---
description: Dependency pinning tiers, catalog families, and how to update dependencies
paths:
  - "package.json"
  - "backend/package.json"
  - "pnpm-workspace.yaml"
  - "pnpm-lock.yaml"
---

# Dependency Pinning

Pin dependencies so routine in-range updates stay semver-safe; the lockfile is the gate. **Float** (`^x.y.z`) libraries take patch + minor updates; **Cautious** (`~x.y.z`) libraries take patches only; **Locked** exact versions cover framework core (`react`, `react-dom`, `next`, `eslint-config-next`, `recharts`, `@modelcontextprotocol/sdk`) and coordinated families.

- Coordinated tiptap, json-render, and remotion families live in the `catalog:` block of `pnpm-workspace.yaml`; update it once, never individual `"catalog:"` references.
- Use `overrides:` only to force one version across the whole tree, including transitives.

- Survey what is behind: `pnpm run deps:check` (wraps `pnpm outdated` with an explicit status line — bare `pnpm outdated` prints nothing and exits 0 when current, which reads as silence)
- Pull all in-range Float/Cautious updates and report status: `pnpm run deps:update` (runs `pnpm update`, then `deps:check`)
- For Locked deps edit `package.json`; for catalog families edit `pnpm-workspace.yaml`; then run `pnpm install`.
- After any update run `pnpm run lint` and `pnpm run typecheck`; for major bumps also smoke-test `pnpm run dev`
