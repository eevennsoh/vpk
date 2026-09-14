---
name: vpk-design
description: Inspect Figma URLs, inventory or export design assets, and translate screenshots, mockups, or pixel-perfect specs into VPK code. Use the official Figma MCP first. Use the atlas ads CLI only for token/icon/a11y mapping inside Figma tasks, and vpk-component for ADS or shadcn component harvesting.
---

# VPK Design

> Translate Figma designs into production-ready VPK code using parallel agents for extraction, implementation, and validation.

## Quick Start

| Input                 | Action                               |
| --------------------- | ------------------------------------ |
| Figma URL             | Extract specs → Implement → Validate |
| Figma asset audit     | Inspect nodes → Compare local assets → Export missing files |
| Figma screenshot/mockup | Extract specs → Implement → Validate |

```
/vpk-design https://figma.com/design/abc123/File?node-id=1-2
```

---

## Figma MCP Access and Tool Routing

Use the official Figma MCP before browser automation, a personal access token, or a separate REST/CLI importer. The normal Codex setup is the OAuth-authenticated remote server at `https://mcp.figma.com/mcp`; it does not require the Figma desktop app to be open.

Figma tools may be lazy/deferred and absent from an initial compact tool inventory. Discover the exact current-runtime capability by the `mcp__figma__*` prefix or tool name. An app-connector inventory or an initial missing tool list is not proof that Figma is unavailable.

If access, authentication, or server identity is uncertain:

1. Discover and call `mcp__figma__whoami` before asking the user for credentials or declaring the file inaccessible.
2. If the Figma tools truly are not callable, check `codex mcp list` or `/mcp`. The expected server is named `figma`, enabled, OAuth-authenticated, and points to `https://mcp.figma.com/mcp`.
3. A configured server does not retrofit tools into an already-running session. Start a new Codex session only when the server is configured/authenticated but the current runtime still lacks its tools.
4. Use browser login only for UI interaction the MCP cannot provide. Ask for `FIGMA_TOKEN` only when an explicitly required REST/CLI workflow cannot use the official MCP.

| Need | Official Figma MCP tool |
| --- | --- |
| Confirm authenticated account or diagnose permissions | `mcp__figma__whoami` |
| Outline pages, frames, layer names, node IDs, and geometry | `mcp__figma__get_metadata` |
| Visually inspect one node | `mcp__figma__get_screenshot` |
| Get implementation context | Load the Figma server's `figma-design-to-code` skill, then use `mcp__figma__get_design_context` |
| Read variables and styles | `mcp__figma__get_variable_defs` |
| Deliver exports or original source images | `mcp__figma__download_assets` |

For an asset inventory/export request:

1. Use `get_metadata` on the supplied node to enumerate candidate child nodes and IDs.
2. Use `get_screenshot` to map those candidates to the visible design.
3. Compare the candidates with the target local directory before downloading anything.
4. Use `download_assets` only for missing nodes. It returns temporary URLs, so fetch them promptly. Preserve each raw image's reported format; set `defaultFormat` or `defaultScale` only when the user explicitly requests a format or resolution.
5. Verify filenames, dimensions, file types, and duplicate content after saving.

---

## Architecture: 3-Agent Pipeline

This skill orchestrates three specialized agents:

| Agent                    | Role                                    | Model  | Runs              |
| ------------------------ | --------------------------------------- | ------ | ----------------- |
| `vpk-agent-extractor`   | Extract design specs, map to ADS tokens | light/fast | First             |
| `vpk-agent-implementer` | Implement component using spec          | coding     | After extractor   |
| `vpk-agent-validator`   | Visual comparison against Figma         | light/fast | After implementer |

### Why Parallel Agents?

1. **Eliminates token mismatches** — Extractor maps ALL values before implementation
2. **Separation of concerns** — Each agent has a single responsibility
3. **Automatic validation** — No implementation ships without visual verification
4. **Faster iteration** — Validator catches issues immediately

---

## Choosing the Right Approach

Not every Figma design requires the full 3-agent pipeline. Choose the approach based on scope:

| Scenario | Approach | Why |
|---|---|---|
| **New component from scratch** | Full 3-agent pipeline | Comprehensive extraction, implementation, and validation |
| **Targeted update to existing component** | Direct implementation | Read Figma screenshot → diff against current code → apply changes directly. Faster, less overhead. |
| **Multiple components or full page** | 3-agent pipeline or parallel direct | Use agents when extraction complexity warrants it |

**When to skip the pipeline:** If the Figma node shows a single component with < 5 differences from the current code, implement directly. Take a Figma screenshot, read the current code, identify differences, and apply them.

---

## Workflow

### Phase 0: Preflight (Before Spawning Agents OR Direct Implementation)

1. **Get the Figma screenshot first** — use `mcp__figma__get_screenshot` to see the actual design before doing anything else. This is the source of truth.
2. **Understand Figma node scope** — the provided Figma node defines the boundary of what to implement. Do NOT add structural components (headers, navigation, toolbars) that aren't shown in the Figma node. If unsure about the full page layout, check the parent node.
3. Confirm the exact target files/routes by searching for distinctive text/classes.
4. **Read the current component code** to understand what already exists. Diff the Figma screenshot against the current code to identify ALL differences.
5. Re-read current component interfaces before implementation (`Props`, callback names, exported APIs). Do not rely on stale assumptions.
6. Check local workspace state (`git status --short`) and avoid touching unrelated modified files.
7. Capture the worktree's runtime URL with `pnpm ports` — prefer the Portless `🌐 https://…` URL (falling back to the port files) so the validator hits the correct worktree.
8. Run an ADS lookup pre-pass for Atlassian-like primitives (CLI first; the ADS MCP tools are only a fallback when `atlas ads` is unavailable or erroring):
   - Use `atlas ads batch --command "search <terms> --type component" --command "search <terms> --type token" --command "search <terms> --type icon"` as the primary lookup, with at least 2 likely search terms per type (one process instead of three)
   - Use the exact single lookup (`atlas ads component <Name>`, `atlas ads token <name>`, `atlas ads icon <IconName>`) when the Figma layer name makes the ADS component explicit
   - Fetch `atlas ads docs a11y <topic>` for the closest topic (`buttons`, `forms`, `focus`, `keyboard`, or `general`)
   - Use `atlas ads token --all` / `atlas ads icon --all` only as exhaustive fallback lookups when the search sweep still leaves token/icon ambiguity
   - Treat `atlas ads component --all` as an exhaustive fallback, not the default search path
   - If the design reflects legacy Atlaskit spotlight/onboarding patterns, consult `atlas ads docs migration <avatar-xsmall-to-xxsmall|jira-spotlight|single-step|multi-step|motion>` before implementation
   - Add `--json` to any command whose output an agent will parse. Portable fallback on machines without the Atlas CLI plugin: `npx @atlaskit/ads-cli <cmd>`

**Scope rules:**
- When the user provides a Figma URL, the Figma spec is the source of truth for ALL differences — not just the ones the user mentions in their text. User notes are supplementary constraints on top of the full Figma spec. Every difference between the current code and the Figma spec must be implemented.
- **Only implement what's in the Figma node.** If the Figma node shows a sidebar, implement the sidebar. Do NOT add page-level headers, navigation bars, toolbars, or other structural components unless they are explicitly visible in the provided Figma node. Adding components outside the Figma scope creates extra work to remove them later.
- **Check the parent node for context** when the Figma node is a sub-component. This reveals the full page layout and prevents adding duplicate elements (e.g., a sidebar header that duplicates a page header).

### Phase 1: Extract Design Spec

Use the repo-local `vpk-agent-extractor` prompt from `.agents/agents/` when
agent delegation is available and the task warrants a separate extraction pass.
Otherwise, perform the extraction directly with the same requirements:

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

**Extractor outputs:**

- Structured YAML spec with all design values
- Every value mapped to an ADS token
- Figma screenshot reference
- Component and icon list with component types (Button vs IconButton) and appearance/variant props
- **Exact text content**: heading copy, placeholder copy, button labels, tooltip text — verbatim
- Alignment/anchoring model per axis (not just gaps and widths)
- Explicit geometry invariants and acceptable tolerance (default ±1px)
- Grouping frames: which elements share a parent frame and the frame's gap/padding
- Relevant ADS accessibility topics and constraints for the identified controls

### Phase 2: Implement Component

Once the spec is ready, use the repo-local `vpk-agent-implementer` prompt when
agent delegation is available. Otherwise, implement directly:

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

**Implementer outputs:**

- Production-ready component code
- All files created/modified
- Lint/typecheck validation results
- Accessibility analysis results
- Notes on any intentional layout technique used to preserve anchoring intent

### Phase 3: Visual Validation

After implementation, use the repo-local `vpk-agent-validator` prompt when agent
delegation is available. Otherwise, validate directly:

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

**Validator outputs:**

- Implementation screenshots (light + dark)
- Comparison report
- List of fixes required (if any)
- APPROVE / MINOR_FIXES / MAJOR_FIXES recommendation

### Phase 4: Fix Loop (if needed)

If validator returns MINOR_FIXES or MAJOR_FIXES:

1. Read the validator's fix recommendations
2. Re-run the implementation pass with fix instructions
3. Re-run the validation pass
4. Repeat until APPROVE

---

## Validation Reliability Rules

### Lint/Typecheck in Repos With Existing Debt

Always run:

1. `pnpm run lint`
2. `pnpm run typecheck`

If full lint fails because of pre-existing unrelated issues, additionally run scoped lint on touched files:

```
pnpm exec eslint [changed-file-1] [changed-file-2] ...
```

Report both outcomes clearly:

- full-repo lint status (including that failures are pre-existing when true)
- scoped lint status for modified files
- typecheck status

### Visual Validation

Use `vpk-verify` (`control-vpk`) for all browser-driven validation — navigation, snapshots, screenshots, interaction, worktree ownership, and cleanup. It delegates to the worktree-installed agent-browser binary with a scoped session.

1. Standard: `control-vpk doctor` + snapshot/screenshot flow plus `ads_analyze_localhost_a11y` scoped to the component root.
2. Theme: follow `vpk-verify/features/switch-theme.md`; use the user-facing control and capture the accessible name plus the nearest `[data-color-mode]` owner's local mode and resolved ADS token values.
3. For a stale non-navigation command, reopen and revalidate the exact feature entrypoint first. If browser-starting `open`/`connect` stays stale after its bounded retry, or agent-browser is otherwise unavailable/blocked, fall back to:
   - server-render sanity checks for expected text/structure at the route
   - component-level a11y analysis (`ads_analyze_a11y` — MCP, no CLI equivalent)
   - targeted localhost a11y (`ads_analyze_localhost_a11y` — MCP, no CLI equivalent) with component selector
4. Use `atlas ads docs a11y <topic>` for the guideline and `ads_suggest_a11y_fixes` (MCP — no CLI equivalent) to separate real issues from noise and turn them into concrete fixes.
5. Explicitly mark validation as degraded when browser automation is blocked.

### Geometry Parity Checks (Critical)

For pixel-faithful translations, validator must verify geometry explicitly:

- Same theme as Figma reference first (usually light), then dark coverage.
- Same viewport as feedback/request when provided.
- Component crop or selector screenshot (not only full-page image).
- Container height/width and inner row height/width.
- Per-side paddings and key offsets.
- Icon-button hit area size and icon glyph size (for example, 20px button with 12px chevron).
- Center invariants: centered groups must remain centered independent of side controls.
- For voice controls, validate listening/recording visuals (pulse rings, stop icon state) and ensure no clipping at composer/container edges.

If geometry checks fail, return `MINOR_FIXES` or `MAJOR_FIXES` even when UI looks "close".

### A11y Noise Filtering

- Scope checks to the component selector whenever possible.
- Full-page a11y scans may include unrelated overlays/toolbars (for example feedback tooling). Treat those as external noise unless the task is explicitly page-wide.
- When a violation appears material, corroborate it with `atlas ads docs a11y <topic>` and convert it into a concrete fix with `ads_suggest_a11y_fixes` (MCP — no CLI equivalent) instead of leaving a vague note.

### Common Figma-to-Code Pitfalls (Learned)

- Do not infer layout intent from `justify-between`/`ml-auto` shortcuts alone; use node positions to determine anchoring model.
- A center cluster between left/right controls often requires explicit centering logic so side controls do not move the center.
- Keep box size and glyph size distinct for icon controls.
- Token names like `icon.disabled` can represent intended visual tone, not disabled interaction state.
- **Never treat user notes as the exhaustive change list.** When a Figma URL is provided, diff the FULL Figma spec against the current code. User notes highlight what they noticed, but they do not list every difference. Common misses include: text copy changes (headings, placeholders, button labels), component variant/appearance changes (e.g., icon button → text button, default → warning), and spacing/gap structure changes.
- **Extract exact text content from Figma.** Heading text, placeholder text, button labels, and tooltip text must be taken verbatim from the Figma spec. Never assume existing copy is correct just because the user didn't mention it.
- **Check component types, not just tokens.** A submit button changing from a circular icon button to a text button with a label is a component type change, not a styling change. The extractor must identify component types (Button vs IconButton), their `appearance`/`variant` props, and label text.
- **Spacing wrappers matter.** When Figma groups elements (e.g., illustration + heading in a "Greetings" frame with specific gap and padding), the implementation must replicate that grouping with a wrapper div, not just apply margins to individual elements.
- **Don't add components outside the Figma node scope.** If the Figma shows only a sidebar, implement the sidebar — not a full page-level header bar with avatar, notifications, and settings icons. Adding structural elements that aren't in the Figma creates rework. Always check the parent Figma node for layout context before adding page-level chrome.
- **For Sonner/Flag demo pages, scope each toaster instance.** If a docs/examples page renders multiple toast demos, each `<Toaster />` must have a unique `id` and every trigger must pass matching `toasterId`; otherwise one click can render through multiple toasters and visually stack shadows/containers.
- **If toast shadow appears harsher than the design token preview, inspect wrapper styles before changing tokens.** In headless Sonner flows, the wrapper `<li data-sonner-toast>` can still apply `:focus-visible` shadow; compare this layer against the custom toast surface shadow before tuning token choice.
- **Reuse VPK primitives with style overrides, not raw HTML elements.** For custom-styled buttons (e.g., dashed border), use the VPK `Button` component with `variant="ghost"` + className overrides rather than a raw `<button>`. This preserves interactive states (hover, active, focus, disabled) and accessibility features for free.
- **Wire behavioral intent from design context.** When a design shows a CTA like "Create one" in a sidebar next to a chat composer, infer that clicking it should focus the composer. Ask the user if unclear, but don't leave CTAs as no-ops when the behavioral intent is obvious from the layout.
- **Check for duplicate structural elements.** When a sidebar-rail pattern includes a page header AND a sidebar internal header, verify they don't duplicate the same elements (same Rovo branding, same collapse button). If the Figma shows only one level, implement only that level.
- **Hiding elements during overlay must collapse layout space, not just opacity.** `opacity-0` makes an element invisible but it still occupies flex layout space. When hiding an element during a state transition and adjacent elements should fill the freed space (e.g., a collapse button disappearing so a ThemeToggle sits flush right), use `w-0 overflow-hidden` to collapse the element's width alongside `opacity-0`. Wrap in a container that transitions width so flex siblings reflow naturally.
- **Sliding overlay panels need opaque backgrounds on all sections.** When a sliding panel has elements that remain visible during the transition (e.g., a ThemeToggle stays visible while the sidebar slides in), every section containing static elements must have its own opaque background. Don't rely on a parent container's background — child sections can be visually independent during slide transitions, causing content to show through transparent areas.
- **Sidebar hover mode must be context-aware (overlay vs push).** When implementing hover-to-reveal sidebar behavior, the mode should depend on the current view context. Chat mode needs push behavior (content shifts right, sidebar-gap expands naturally) while non-chat mode can use overlay (sidebar floats over content, gap forced to `w-0`). Control this by conditionally applying `w-0!` on sidebar-gap and `isOverlay` prop based on view mode.
- **Collapse/pin button position should reflect sidebar state.** In hover-reveal state, the collapse/pin button belongs on the LEFT side of the sidebar header (before branding) and clicking it pins the sidebar open. In persistent-open state, the collapse button belongs on the RIGHT side (after theme toggle). Implement with two separate button slots that toggle visibility via `w-0 opacity-0` transitions — don't try to move a single button.
- **Flex `gap-*` doesn't transition when a child collapses to `w-0`.** CSS `gap` is a container property and stays applied even when a flex child shrinks to zero width. Fix by removing `gap-*` from the parent and using a transitioning `mr-*`/`ml-*` on the collapsible element (e.g., `mr-3` → `mr-0` alongside `w-0 opacity-0`). This ensures zero residual spacing when fully collapsed.
- **Adjacent panel paddings must match across shared borders.** When a sidebar header sits next to a content title bar separated by a border, their horizontal padding values (`px-*`) must be identical (e.g., both `px-4` = 16px). Mismatched padding creates visual misalignment that's especially noticeable during hover transitions when both panels are simultaneously visible.
- **`SpeechInput` pulse rings require overflow-safe composition.** `SpeechInput` renders animated rings outside its button bounds (`-inset-*`). When used inside `PromptInput`, set `allowOverflow` on `PromptInput` so the internal `InputGroup` uses `overflow-visible`; otherwise rings/stop visuals clip against rounded composer borders.
- **Logo centering inside `Tile`.** Product logos (e.g. `ConfluenceLogo`, `AtlassianLogo`) render an SVG wrapped in one or more `<span>` elements from the Atlaskit logo. When using `Tile` with `isInset={false}`, only `[&_img]:size-full [&_svg]:size-full` was applied; the SVG’s `height: 100%` collapses because its parent `<span>` has no explicit height (inline, no size). **Fix in `Tile`:** for `isInset={false}`, also apply `[&_span]:flex [&_span]:size-full [&_span]:items-center [&_span]:justify-center` so every wrapper span fills the tile and flex-centers its content; then `[&_svg]:size-full` works and the logo sits centered. **Alternative:** for a bordered product-logo tile, use the default `isInset={true}` so the logo uses the inset size (e.g. 16px for `size="medium"`) and is centered with padding; no extra span styling needed.

---

## Quick Start Example

When user provides a Figma URL:

```
User: "Implement this design: https://figma.com/design/abc123/File?node-id=1-2"

1. Parse URL → fileKey: abc123, nodeId: 1:2

2. Run extraction pass:
   "Extract design specifications from Figma file abc123, node 1:2"

3. Wait for spec, then run implementation pass:
   "Implement using this spec: [spec]. Target: components/blocks/[feature]/"

4. Wait for implementation, then run validation pass:
   "Validate [component path] against Figma at route /[route]"

5. If fixes needed, loop back to step 3

6. Present final result to user
```

---

## Token Translation Reference

This codebase uses **Tailwind classes** that map to ADS CSS variables. The expanded `references/tokens.md` contains the complete mapping of all 200+ semantic tokens from `shadcn-theme.css`.

### Implementation Priority

1. **shadcn-theme semantic classes** — `bg-surface-raised`, `text-text-subtle`, `border-border-bold`, `bg-bg-neutral` (see `references/tokens.md` for full list)
2. **tailwind-theme accent colors** — Decorative hues only: `bg-blue-400`, `text-purple-500`
3. **CSS variables** — For edge cases without Tailwind mapping
4. **`token()`** — Only for dynamic values

**Note:** The double-prefix pattern (`bg-bg-*`, `text-text-*`) is correct Tailwind v4 behavior. See `references/tokens.md` § Naming Convention for details.

---

## ADS Coverage

Retrieve ADS content with the `atlas ads` CLI first (Atlas CLI plugin at `/opt/atlassian/bin/atlas`; there is no bare `ads` binary). The ADS MCP tools are a fallback for when the CLI is unavailable or erroring, plus the few capabilities that have no CLI equivalent.

- `atlas ads batch --command "search <terms> --type component" --command "search <terms> --type token" --command "search <terms> --type icon"` is the primary ADS lookup (a plain `atlas ads search <terms>` gives a unified sweep); `atlas ads component --all` is the package/component fallback inventory.
- `atlas ads token --all` and `atlas ads icon --all` are exhaustive fallbacks only when the search sweep still leaves concrete token or icon ambiguity.
- `atlas ads docs a11y <buttons|forms|images|colors|focus|keyboard|screenReaders|aria|wcag|general>`, plus the MCP-only `ads_analyze_a11y`, `ads_analyze_localhost_a11y`, and `ads_suggest_a11y_fixes`, form the required accessibility loop.
- `atlas ads docs migration <avatar-xsmall-to-xxsmall|jira-spotlight|single-step|multi-step|motion>` applies when the Figma work reflects legacy spotlight/onboarding patterns.
- `ads_i18n_conversion_guide` (MCP — no CLI equivalent) applies when Figma copy lands in intl-aware code or lint flags literal strings.
- Add `--json` to any command whose output an agent will parse. Portable fallback on machines without the Atlas CLI plugin: `npx @atlaskit/ads-cli <cmd>`.

---

## Agent Files

The provider-neutral agent definitions live in `.agents/agents/` and are
symlinked into provider-specific surfaces such as `.claude/agents/`:

- `vpk-agent-extractor.md` — Design extraction specialist
- `vpk-agent-implementer.md` — Implementation specialist
- `vpk-agent-validator.md` — Visual validation specialist

---

## Comparison to Single-Agent Approach

| Aspect         | Single Agent        | 3-Agent Pipeline            |
| -------------- | ------------------- | --------------------------- |
| Token accuracy | Often misses values | Extracts ALL values first   |
| Validation     | Manual or skipped   | Automatic visual comparison |
| Fix iteration  | User catches issues | Validator catches issues    |
| Separation     | All in one          | Clear responsibilities      |

---

## Checklist

Before presenting to user:

- [ ] **Preflight: Figma screenshot captured** and visually reviewed before any code changes
- [ ] **Preflight: current code was read** and diffed against the Figma screenshot
- [ ] **Scope verified:** Only implementing what's visible in the Figma node — no extra structural components
- [ ] **Parent node checked** for full page layout context (no duplicate headers/chrome)
- [ ] `atlas ads` pre-pass covered primary lookup (`atlas ads batch`/`search`), exhaustive fallbacks (`--all`), and `atlas ads docs migration` guidance where applicable
- [ ] Extractor produced complete spec with all tokens AND Tailwind mappings
- [ ] Extractor captured **exact text content** (headings, placeholders, button labels) verbatim from Figma
- [ ] Extractor identified **component types and variant props** (Button vs IconButton, appearance, etc.)
- [ ] Implementer applied **ALL differences** between current code and Figma spec — not just user-mentioned ones
- [ ] Implementer used VPK primitives (Button, etc.) with style overrides — not raw HTML elements
- [ ] Implementer used Tailwind classes (not token()) where possible
- [ ] `ads_i18n_conversion_guide` (MCP — no CLI equivalent) was used when Figma copy landed in an intl-aware surface
- [ ] Implementer passed `pnpm run typecheck`
- [ ] Full lint attempted; scoped lint on changed files reported if baseline lint debt exists
- [ ] Validator captured light and dark screenshots through the user-facing theme control and proved `data-color-mode` plus resolved ADS tokens
- [ ] Validator confirmed geometry parity (sizes, offsets, center invariants, icon button/glyph sizes)
- [ ] For `SpeechInput` inside `PromptInput`, `allowOverflow` is enabled and listening pulse rings are fully visible (no clipping)
- [ ] A11y validation scoped to component selector and free of unrelated overlay noise
- [ ] Validator comparison shows APPROVE or all fixes applied
- [ ] Component follows VPK architectural rules (<150 lines, etc.)
- [ ] CTAs are wired to behavioral intent (focus, navigate, etc.) — not left as no-ops

---

## References

For detailed token translation tables, see:

- **`references/tokens.md`** — Complete Figma-to-Tailwind-to-ADS token mappings
