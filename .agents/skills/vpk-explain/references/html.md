# HTML and saved diagrams

Reuse the existing `vpk-html` resources directly for explanation artifacts.
This resource reuse does not change that skill's explicit invocation policy.
Do not copy its production machinery into `vpk-explain` or alter its shared
templates merely to create one explanation.

## Shared resources

Read [authoring detail](../../vpk-html/references/authoring-detail.md),
[design](../../vpk-html/references/design.md),
[source policy](../../vpk-html/references/source-policy.md),
[accessibility](../../vpk-html/references/accessibility.md), and
[anti-patterns](../../vpk-html/references/anti-patterns.md) for saved HTML.
For diagrams, also read [diagrams](../../vpk-html/references/diagrams.md) and
[SVG style](../../vpk-html/references/svg-style.md).
Use [quality gates](../../vpk-html/references/quality-gates.md) to select
additional checks relevant to the artifact.

Choose a shipped template based on the learning job. Useful starting points
under `.agents/skills/vpk-html/assets/templates/` include
`code-understanding.html`, `research-concept-explainer.html`,
`research-feature-explainer.html`, `flowchart-diagram.html`, and
`prototype-interaction.html`. Reuse matching SVG primitives from
`.agents/skills/vpk-html/assets/diagrams/` before drawing another implementation.

Copy and fill the template at
`artifacts/vpk-html/<slug>/<slug>.html`, preserving its Algebrica identity,
semantic structure, and runtime hooks. Keep required assets inline so the
deliverable opens offline. Keep source attribution and essential caveats
available in the artifact itself. When revising, edit only the requested
artifact; choose a new slug for a different explanation.

## Interactions that teach

Add controls only when changing them demonstrates a meaningful consequence.
For example, a cache explainer could show a hit, a miss, and expiration for a
small deterministic request sequence. Label simulated behavior and invented
values; do not suggest that a toy model measures the real system.

Reuse existing template controls and runtime seams. Keep custom logic local
to the artifact and add only what the example requires. Make initial values,
units, limits, output changes, and reset behavior clear. Provide keyboard
access, accessible names, and a static textual explanation of the same idea.
Offer pause/replay for animated teaching sequences and handle reduced motion.
Load the applicable frontend/browser skills before implementing or inspecting
the artifact. For edits served by Next.js, follow `next-dev-loop`.

## Validation

Run these existing checks against the finished HTML, replacing the path with
the actual artifact path:

```bash
node .agents/skills/vpk-html/scripts/build.mjs --check-placeholders artifacts/vpk-html/<slug>/<slug>.html
node .agents/skills/vpk-html/scripts/build.mjs --verify artifacts/vpk-html/<slug>/<slug>.html
node .agents/skills/vpk-html/scripts/check-html.mjs artifacts/vpk-html/<slug>/<slug>.html
```

Render it in a real browser using the installed `agent-browser` skill, with
Playwright CLI as the documented fallback. Check reading order, diagram
labels/connectors, overflow, console errors, keyboard controls, and offline
operation. For interactive examples, test initial state, a representative
change, a boundary case, and reset against independently calculated outcomes.
Store disposable captures under `output/agent-browser/vpk-explain/<slug>/`.

For a requested standalone SVG, save it under
`artifacts/vpk-explain/<slug>/` with an accessible title/description and a
text explanation. Inspect its rendered labels, connectors, and scaling;
HTML validators apply only if an HTML wrapper is also produced.
