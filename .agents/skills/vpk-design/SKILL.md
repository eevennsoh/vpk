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
3. Confirm the exact target files/routes by searching for distinctive text/classes. Front-load key specs: spacing, radius, width constraints, shadow token.
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

Read [phase-prompts.md § Phase 1: extraction prompt](references/phase-prompts.md#phase-1-extraction-prompt) when you brief the agent or run this pass directly; use the prompt verbatim with the bracketed fields filled.

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

Read [phase-prompts.md § Phase 2: implementation prompt](references/phase-prompts.md#phase-2-implementation-prompt) when you brief the agent or run this pass directly; use the prompt verbatim with the bracketed fields filled.

**Implementer outputs:**

- Production-ready component code
- All files created/modified
- Lint/typecheck validation results
- Accessibility analysis results
- Notes on any intentional layout technique used to preserve anchoring intent

### Phase 3: Visual Validation

After implementation, use the repo-local `vpk-agent-validator` prompt when agent
delegation is available. Otherwise, validate directly:

Read [phase-prompts.md § Phase 3: validation prompt](references/phase-prompts.md#phase-3-validation-prompt) when you brief the agent or run this pass directly; use the prompt verbatim with the bracketed fields filled.

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

Read [validation-reliability.md](references/validation-reliability.md) before you report lint, typecheck, visual, geometry, or accessibility results, and when a Figma translation looks close but not exact. It holds the lint-debt reporting rule, the `vpk-verify` visual flow and its degraded fallback, the geometry parity checks, a11y noise filtering, and the learned Figma-to-code pitfalls.

Critical: for pixel-faithful work the validator checks geometry explicitly on a component crop in the reference theme and viewport: container and row sizes, per-side padding and offsets, icon-button hit area versus glyph size, and center invariants.

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

- [tokens.md](references/tokens.md): read when mapping Figma values to Tailwind classes and ADS tokens.
- [phase-prompts.md](references/phase-prompts.md): read when briefing the extractor, implementer, or validator.
- [validation-reliability.md](references/validation-reliability.md): read before reporting validation results or diagnosing a near-miss translation.
