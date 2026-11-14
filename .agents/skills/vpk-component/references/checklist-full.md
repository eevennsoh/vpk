# Full Enrichment Checklist

## Mapping
- [ ] ADS component visual states researched (colors, hover/active/disabled tokens)
- [ ] Visual specs extracted via computed styles (padding, border-radius, height, font-size, inner gap per size)
- [ ] **Computed style extraction completed via `/agent-browser` on live `atlassian.design` examples page** — never guess from token names
- [ ] For container/layout components: parent `gap`, `display`, `flexDirection` also extracted
- [ ] Inner layout extracted (gap values from nested flex containers, per size variant)
- [ ] For ADS Toggle parity: root + thumb geometry extracted for checked and unchecked states (regular/default and large where applicable)
- [ ] For ADS Toggle parity: icon insets and icon identity verified (`check-mark` + `cross`)
- [ ] Typography parity validated against `atlassian.design` examples (`fontSize`, `lineHeight`, visual comparison)
- [ ] shadcn component identified and source read
- [ ] Audit template filled in (visual gaps only — API columns are read-only)
- [ ] Visual styling map produced (shadcn variants → ADS visual equivalents)
- [ ] Props reference documented (read-only — no renames)
- [ ] Sub-component reference documented (read-only — no renames, if applicable)
- [ ] No-equivalent components normalized via Canonical Prop-Name Mapping (`appearance` → `variant`, etc.)
- [ ] Visual gaps documented with workarounds

## Enrichment
- [ ] Each variant has: rest, `hover:`, `active:` states with ADS tokens
- [ ] Disabled pattern follows bold/subtle convention
- [ ] Focus ring uses standard `focus-visible:border-ring ring-ring/50 ring-3`
- [ ] Invalid state uses `aria-invalid:` AND `data-invalid:` patterns (form inputs only — Base UI Field uses `data-invalid`, HTML uses `aria-invalid`)
- [ ] Loading state uses `isLoading`, `aria-busy`, `<Spinner />` (if applicable)
- [ ] Selected state uses correct selector — `aria-pressed:` / `data-checked:` / `data-active:`
- [ ] ADS Toggle geometry lock applied (`content-box` root, non-oversized thumb, 3px icon inset)
- [ ] TypeScript interface named `[Component]Props`, used as `Readonly<[Component]Props>`
- [ ] Props interface exported
- [ ] **No prop names were renamed** (shadcn convention preserved)
- [ ] **No ADS-style alias props introduced** (`appearance`, `spacing`, `isDisabled`) unless explicitly added as temporary deprecated aliases
- [ ] **No variant values were renamed** (shadcn convention preserved)
- [ ] **No size values were renamed** (shadcn convention preserved)
- [ ] **No sub-component names were renamed** (shadcn convention preserved)

## Demos & Docs
- [ ] `adsUrl` set to correct atlassian.design page in detail entry
- [ ] ADS equivalent entry added/updated in `app/data/ads-equivalents.ts`
- [ ] ADS Toggle identity check complete (`switch` mapped to `@atlaskit/toggle`, `toggle` not mapped)
- [ ] ADS InlineDialog/InlineMessage identity check complete (both consolidated into `hover-card` / `alert`)
- [ ] Header verification complete (`/components/ui/switch` shows `@atlaskit/toggle`; `/components/ui/toggle` does not)
- [ ] ADS label in doc hero stays compact (package/import text only; URL remains link target)
- [ ] Left nav shows purple ADS badge for mapped component and ADS-only filter includes it
- [ ] Demo files created in `components/website/demos/[cat]/` (primary demo `[slug]-demo.tsx`)
- [ ] `pnpm run fix:generated` run after the manifest line, so the generated primary registry region and detail barrel include the entry; example demos registered in `components/website/registry/[cat]/variants-*.ts` (or `registry/[cat].ts`)
- [ ] Examples added to the detail leaf `app/data/details/[cat]/[slug].ts` (projects, arts, utility, ui-charts: the inline record in `app/data/details/[cat].ts`); a visual leaf is also imported by hand in `app/data/details/visual.ts`
- [ ] If consolidating: all consumers updated (json-render catalog/registry, genui prompt, related arrays, generated catalog regenerated)

## Validation
- [ ] `pnpm run lint` passes (0 new errors)
- [ ] If global lint baseline is noisy, changed-file eslint passes (`pnpm exec eslint <changed-files>`)
- [ ] `pnpm run typecheck` passes (0 new errors)
- [ ] Validation report includes both global lint status and changed-file lint status
- [ ] Typography parity verified on affected examples (no visually larger/smaller text than `atlassian.design`)
- [ ] **API preservation verified** — no consumers of the modified component needed changes (no prop/variant/size renames)
- [ ] Affected route(s) smoke-tested in browser when UI behavior changed
- [ ] A11y findings classified as regression vs pre-existing/tooling noise
