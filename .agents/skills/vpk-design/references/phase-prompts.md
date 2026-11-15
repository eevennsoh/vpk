# vpk-design phase prompts

Read this when you brief `vpk-agent-extractor`, `vpk-agent-implementer`, or `vpk-agent-validator`, or run a phase directly. Back to [SKILL.md](../SKILL.md).

## Phase 1: extraction prompt

```
Extract design specifications from this Figma design:
URL: [Figma URL]

Output a structured YAML spec with all values mapped to ADS tokens.
Include the Figma screenshot reference for validation.

CRITICAL — extract ALL of the following:
- EXACT text content: heading copy, placeholder copy, button labels, tooltip text (verbatim from Figma, not from existing code)
- Component types: Button vs IconButton, text label vs icon-only, appearance/variant props
- element box sizes vs icon glyph sizes
- per-side paddings (top/right/bottom/left), not only shorthand
- alignment model for each row (edge-pinned, centered cluster, distributed)
- center invariants (what must remain mathematically centered)
- grouping frames: which elements are grouped in a parent frame and what gap/padding that frame has

ADS lookup rules (CLI first; ADS MCP tools only when `atlas ads` is unavailable or erroring):
- Use `atlas ads batch --command "search <terms> --type component" --command "search <terms> --type token" --command "search <terms> --type icon"` as the primary ADS lookup and provide at least 2 likely search terms per type
- Use the exact single lookup (`atlas ads component <Name>` / `atlas ads token <name>` / `atlas ads icon <IconName>`) when a Figma layer name makes the target explicit
- Use `atlas ads docs a11y <topic>` for the most relevant topics and include the applicable rules in the output
- Use `atlas ads token --all` / `atlas ads icon --all` only as exhaustive fallbacks when token/icon matching is still ambiguous
- Add `--json` to any command whose output you will parse
- If ADS mapping remains ambiguous, record the ambiguity instead of guessing
```

## Phase 2: implementation prompt

```
Implement this component using the extracted design spec:

[Paste the YAML spec from extractor]

Target file: [exact file path of existing component]
Component name: [ComponentName]

IMPORTANT: Read the current file first and diff it against the spec.
Apply ALL differences, not just the ones the user explicitly mentioned.
This includes: text copy, placeholder text, button labels, component types,
variant/appearance props, spacing/gap structure, and grouping wrappers.

Use ONLY the tokens specified in the spec.
Run `atlas ads docs a11y <topic>` for the relevant control types before finalizing.
Run `ads_analyze_a11y` (MCP — no CLI equivalent), then use `ads_suggest_a11y_fixes`
(MCP — no CLI equivalent) for any material violation instead of improvising a
remediation.
If the target file is intl-aware or lint flags literal JSX strings, use
`ads_i18n_conversion_guide` (MCP — no CLI equivalent) before leaving Figma copy
hardcoded in code.
Preserve layout invariants from spec. If center content must stay centered,
implement it so side controls cannot shift it.
Run lint and typecheck before completing.
```

## Phase 3: validation prompt

```
Validate this implementation against Figma:

Figma screenshot: [reference from extractor]
Component path: [path from implementer]
Test route: /[route]
Component root selector or data-testid: [selector]

Capture screenshots in light and dark mode.
Use `vpk-verify` / `control-vpk` and the user-facing theme control from the
`switch-theme` recipe. Do not mutate html classes, `data-theme`,
`data-color-mode`, `style.colorScheme`, localStorage, or ADS variables directly.
For each mode, use an IIFE to find the theme control's nearest
`[data-color-mode]` owner, then prove the accessible name, local color mode,
and non-empty computed `--ds-surface` / `--ds-text` values agree. Restore the
original theme through the same control before scoped cleanup.

Run `ads_analyze_localhost_a11y` (MCP — no CLI equivalent) scoped to the
component root selector (not only full-page scans). If it reports material
issues, use `atlas ads docs a11y <topic>` for the guideline and
`ads_suggest_a11y_fixes` (MCP — no CLI equivalent) to turn them into
concrete follow-up actions.
Verify geometry parity (sizes/offsets/centering), not just visual similarity.
Compare against Figma and report discrepancies.
```
