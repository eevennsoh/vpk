# Add Component Demo

## Source Files

1. Ask the catalog verifier for the current edit plan:
	```bash
	corepack pnpm run catalog:add-plan -- <category>/<slug>
	```
	Use this output as the source of truth for the detail barrel, registry shard,
	demo path, and validation commands.
2. Add or update the component implementation under its owning folder:
	- `components/ui/`
	- `components/ui-custom/`
	- `components/ui-charts/`
	- `components/blocks/`
	- `components/projects/`
	- `components/arts/`
	- `components/visual/`
3. Add one manifest entry in `app/data/component-manifest.ts`.
4. Add `app/data/details/<category>/<slug>.ts`, then import it from `app/data/details/<category>.ts`.
5. Add the demo module under `components/website/demos/<category>/`.
6. Register the primary demo in `components/website/registry/<category>.ts`, except:
	- `ui`: use `components/website/registry/ui/primary.ts`.
	- `ui-custom`: use `components/website/registry/ui-custom/primary.ts`.
7. Register example-only variants in the category registry or matching shard:
	- `ui`: `components/website/registry/ui/variants-*.ts`.
	- `ui-custom`: `components/website/registry/ui-custom/variants-*.ts`.

## Catalog Contract

`verify:catalog` checks the source graph, not just runtime rendering:

- Every manifest category has a details category and primary registry category.
- Every manifest slug has a details record and either a primary registry entry or preview route.
- Every registry dynamic import resolves to an existing demo module.
- Every `detail.examples[].demoSlug` resolves through the primary or variant registry.
- Every default-exported `components/website/demos/**/*-demo*.{ts,tsx,js,jsx}` file is referenced by either a registry dynamic import or a manifest `importPath`.

Keep demo filenames aligned with their owning slug where possible, for example `components/website/demos/ui/button-demo.tsx` for the `ui/button` primary demo. A shared visual demo can stay outside the registry only when a manifest `importPath` points at it directly.

## Checks

Run these before handing off:

```bash
corepack pnpm run verify:catalog
corepack pnpm run test:catalog
corepack pnpm run verify:repo-map
corepack pnpm run lint
corepack pnpm run typecheck
```

If `verify:repo-map` fails after adding a manifest entry, refresh the generated map and rerun the check:

```bash
node scripts/generate-repo-map.js
corepack pnpm run verify:repo-map
```

## Failure Modes

- Missing details, registry, dynamic import, or demo file paths cause `verify:catalog` to name the category and slug.
- An `examples[].demoSlug` that is not in the primary or variant registry fails under `--strict-warnings`.
- A demo file left out of both registry imports and manifest import paths fails under `--strict-warnings`.
- Updating generated or assembled outputs without the source leaf/barrel makes the next catalog split drift harder to review.
