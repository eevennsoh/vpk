# vpk-design validation reliability

Read this before you report lint, typecheck, visual, geometry, or accessibility results, and when a Figma translation looks close but not exact. Back to [SKILL.md](../SKILL.md).

## Lint/Typecheck in Repos With Existing Debt

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

## Visual Validation

Use `vpk-verify` (`control-vpk`) for all browser-driven validation — navigation, snapshots, screenshots, interaction, worktree ownership, and cleanup. It delegates to the worktree-installed agent-browser binary with a scoped session.

1. Standard: `pnpm control-vpk doctor` + snapshot/screenshot flow plus `ads_analyze_localhost_a11y` scoped to the component root.
2. Theme: follow `vpk-verify/features/switch-theme.md`; use the user-facing control and capture the accessible name plus the nearest `[data-color-mode]` owner's local mode and resolved ADS token values.
3. For a stale non-navigation command, reopen and revalidate the exact feature entrypoint first. If browser-starting `open`/`connect` stays stale after its bounded retry, or agent-browser is otherwise unavailable/blocked, fall back to:
   - server-render sanity checks for expected text/structure at the route
   - component-level a11y analysis (`ads_analyze_a11y` — MCP, no CLI equivalent)
   - targeted localhost a11y (`ads_analyze_localhost_a11y` — MCP, no CLI equivalent) with component selector
4. Use `atlas ads docs a11y <topic>` for the guideline and `ads_suggest_a11y_fixes` (MCP — no CLI equivalent) to separate real issues from noise and turn them into concrete fixes.
5. Explicitly mark validation as degraded when browser automation is blocked.

## Geometry Parity Checks (Critical)

For pixel-faithful translations, validator must verify geometry explicitly:

- Same theme as Figma reference first (usually light), then dark coverage.
- Same viewport as feedback/request when provided.
- Component crop or selector screenshot (not only full-page image). Crop and compare with `pnpm image-tools crop` and `pnpm image-tools diff`; PIL is not installed.
- Container height/width and inner row height/width.
- Per-side paddings and key offsets.
- Icon-button hit area size and icon glyph size (for example, 20px button with 12px chevron).
- Center invariants: centered groups must remain centered independent of side controls.
- For voice controls, validate listening/recording visuals (pulse rings, stop icon state) and ensure no clipping at composer/container edges.

If geometry checks fail, return `MINOR_FIXES` or `MAJOR_FIXES` even when UI looks "close".

## A11y Noise Filtering

- Scope checks to the component selector whenever possible.
- Full-page a11y scans may include unrelated overlays/toolbars (for example feedback tooling). Treat those as external noise unless the task is explicitly page-wide.
- When a violation appears material, corroborate it with `atlas ads docs a11y <topic>` and convert it into a concrete fix with `ads_suggest_a11y_fixes` (MCP — no CLI equivalent) instead of leaving a vague note.

## Common Figma-to-Code Pitfalls (Learned)

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
