# Contract, content IR, and definition of done

Owner of the contract, the content IR and the definition of done for [SKILL.md](../SKILL.md). Load when you lock the contract or content IR in Phase A, or write the closing reply.

Contents: [Lock seven contract fields before any HTML](#lock-seven-contract-fields-before-any-html) · [Question budget](#question-budget) · [Figure engine](#figure-engine) · [Content IR](#content-ir) · [Each mode locks its own brief fields](#each-mode-locks-its-own-brief-fields) · [After two rounds on one element, show variants](#after-two-rounds-on-one-element-show-variants) · [Definition of done](#definition-of-done) · [Playbooks](#playbooks)

The contract makes the agent’s plan explicit before any HTML is written, and the definition of done makes the closing message honest. The content IR records the contract and the supplied facts beside the artifact, so a check can prove the page kept them. The contract and definition-of-done wording are adapted from kami (MIT).

## Lock seven contract fields before any HTML

| # | Field | Value |
|---|---|---|
| 1 | **Template** | The template, plus its playbook when `references/playbooks/<template>.md` exists |
| 2 | **Reader job** | The 30-second quick read and the deeper audit |
| 3 | **Formats** | Always `html`; optionally `pdf`, `landing`, `github`, `artifacts`, `gist`, `mp4` |
| 4 | **Length or page-weight target** | Plus the review viewport (default 1440×900, the eval viewport) |
| 5 | **Figures** | Each planned figure and its **engine** (see Figure engine) |
| 6 | **Review runtime** | On or off. When on, all four return paths ship. Live send turns on by itself when a VPK host answers the handshake, so it is never a choice |
| 7 | **Verification commands** | The commands you will run and report |

State the contract to the user in one line, then continue:

> Contract: `status-report.html` · decide the 50% rollout in 30 s, audit latency/error/capacity · HTML + PDF · ≤ 2 screens at 1440 · 2 static charts + 1 iso-kit pipeline figure · review runtime off · checks: placeholders, verify, check-html, check-content.

A template’s playbook can add items, for example the film source and labs of a motion case study.

## Question budget

Ask at most one compact question, and only when two or more of purpose, audience, hard constraints or success cannot be inferred, when the figure engine is open, or when a product-UI or animation port has no production video. When both are open, ask for both in that one question. **Asking ends the turn**: wait for the answer before drafting figures. When you ask, end the message with the rest of the contract as one line in the usual format (all seven fields, including the length/viewport target and the verification commands), with the engine marked open. When nothing needs asking, state the contract and continue; adjust if the user pushes back.

| Open at contract lock | → Your turn |
|---|---|
| Nothing, or only one of purpose, audience, constraints, success | → state the contract line and keep going |
| Two or more of purpose, audience, constraints, success | → one compact question, then stop |
| The figure engine, technical figures planned | → the engine question from Figure engine, then stop |
| A product-UI or animation port with no production video | → ask for the video; with the engine also open, both in one question |

## Figure engine

This section holds the only copy of the engine question. Ask it when the plan includes technical figures and the user has not named an engine. Data charts and the `assets/diagrams/` primitives never trigger it. Offer three options:

- **iso kit** (default): light isometric diagrams that react to the pointer. Use as many as the page needs.
- **anatomy hero**: one detailed drawing of a real machine whose one small model drives its motion and live numbers. Use it for the figure the page is built around, at the Hero tier of [figure engines](figure-engines.md) when the figure needs it. There is no part or size cap, and a page may carry several.
- **both**: anatomy heroes plus iso-kit figures, sharing one camera and one loop.

When you ask, say which planned figure each option would draw and what the others become. With the anatomy hero alone, the other figures are static diagrams.

With nobody to ask (evals, automation, the backend report generator), use the iso kit: write `figure_engine: "iso-kit"` and `figure_engine_source: "default"` in the brief, and list the choice in `assumptions` and in DoD item 3. Exception: a story explainer’s scrubbed figure defaults to `anatomy-hero` (`figure_engine_source: "default"`), because only the hero module takes `model({ time })`.

**Engine record.** Record it in the `vpk-figure-engine` meta; values and the `both` rule live in [figure engines](figure-engines.md). An absent meta means `none`. Engine roots carry `data-vpk-engine="iso-kit"` or `"anatomy-hero"`, `data-vpk-figure="<id>"` (`^[a-z][a-z0-9-]{0,39}$`) and `data-vpk-camera="45 30"`:

```html
<figure class="vpk-iso-plate" data-vpk-engine="iso-kit" data-vpk-figure="pipeline" data-vpk-camera="45 30">…</figure>
```

check-html enforces the meta once an engine root exists, and the builders insert it when absent. The brief’s `figure_engine` mirrors the meta, and `--check-content` fails on a mismatch (B9). Changing the engine in a later round re-locks the contract: update the meta, the brief and the one-line contract together.

## Content IR

### Sidecar

Every new document gets `artifacts/vpk-html/<slug>/<slug>.content.json`, written at contract lock:

```json
{
	"type": "document",
	"lang": "en",
	"brief": { "reader_job": { "quick_read": "…", "deep_audit": "…" }, "template": "status-report.html", "formats": ["html"], "acceptance_checks": ["…"] },
	"content": { "title": "…", "facts": [{ "label": "…", "value": "…" }] }
}
```

- Only `type`, `lang`, `brief` and `content` are allowed; `content` is optional, so a brief-only sidecar is a valid contract record.
- `type` is a stem of `references/schemas/*.json`: `document` for prose templates; data-driven templates bring their own (`x-thread`, `motion-case-study`). When `type` is not `document`, the brief’s template stem must equal it.
- `lang` is a language tag such as `en` or `en-GB`.
- Tooling never requires a sidecar: legacy artifacts and the backend report generator have none. New work always writes one.

A worked example that passes full coverage against a shipped demo: `references/schemas/examples/document.content.json` with `assets/demos/demo-status-report.html`.

### Brief

| Field | Rule |
| --- | --- |
| `reader_job` (required) | `{ quick_read, deep_audit }`, each 1–240 characters |
| `template` (required) | `x.html` or `x`; must exist in `assets/templates/`. A story explainer records `template: "code-understanding.html"` and `figure_engine: "anatomy-hero"`; its layout comes from the story kit |
| `formats` (required) | 1–7 of `html, pdf, landing, github, artifacts, gist, mp4`; includes `html` |
| `acceptance_checks` (required) | the verification commands (field 7) |
| `audience`, `length_target`, `narrative` | short strings |
| `viewport` | `{ width: 320–3840, height: 320–3000 }`; `--screenshot` uses it |
| `size_budget_kb` | 10–20000; a contract target, separate from the 1.57 MB data-URL warning |
| `figure_engine`, `figure_engine_source` | `none, iso-kit, anatomy-hero, both`; `user, default` |
| `figures` | ≤ 40 × `{ id, kind, engine, job, tier? }`; kind `chart, diagram, illustration, explainer, film, lab`; engine `static, iso-kit, anatomy-hero`; `tier` (`figure`, `hero`) only for anatomy; `id` equals the root’s `data-vpk-figure` |
| `review` | `{ runtime: boolean }` |
| `publish` | `artifacts`, `gist` (GitHub Pages is the `github` format) |
| `required_facts`, `preserve`, `assumptions`, `explicit_deviations`, `required_assets`, `evidence` | string lists |
| `target` | `{ surface, viewport, theme, state, element }` for a visual repair |

Rules checked by `--check-content` (E error, W warning):

- **B1 E** the template exists. **B2 E** formats include `html`. **B3 E** every `publish` entry is also a format.
- **B4 E** iso-kit or anatomy-hero figures need a `figure_engine` other than `none`.
- **B5 E** `iso-kit` excludes anatomy figures and `anatomy-hero` excludes iso figures; `both` needs one of each.
- **B6** is retired: a page may carry several anatomy heroes.
- **B7 W** `figure_engine_source: "default"` with no `assumptions`.
- **B8 E** a non-`document` type uses its own template.
- **B9 E** with the HTML: the meta and `figure_engine` agree, and engine figures have a meta.
- Figure ids are unique, and `tier` appears only on anatomy-hero figures.

### Content schemas and coverage

Schemas use a small JSON-Schema subset: `type`, `enum`, `required`, `properties`, `additionalProperties`, `items`, `minItems`, `maxItems`, `minLength`/`maxLength` (trimmed), `minimum`/`maximum`, `pattern`, plus the annotations `$comment`, `title`, `description`, `$schema`, `$id`. A schema with any other keyword is an error. `x-coverage: "skip"` excludes a value from coverage; `x-coverage: "verbatim"` forces a long value to be checked.

**Coverage** runs when the sidecar has `content` and the HTML is known. Every string value of 80 characters or fewer, and every number, must appear in the visible text with alphanumeric boundaries (`62%` does not match `162%`). Visible text excludes `<head>`, scripts, styles, templates, noscript, comments, speaker notes and simple `[hidden]` elements; a whitespace-free fallback catches values split across elements. Longer prose is counted, not matched. Write each fact exactly as the page shows it.

### In-file content islands

Data-driven templates also embed `content` in the page:

```html
<script type="application/json" data-vpk-content="<type>">…</script>
```

Write it with `scripts/json-island.mjs` `serializeJsonIsland`, never by hand. `--check-content` validates each island against its schema, requires it to equal the sidecar’s `content` when a sidecar exists, and runs the template’s extra rules from `CONTENT_TYPE_HOOKS` in `scripts/content-ir.mjs` (x-thread: `scripts/x-thread/check.mjs`). An unknown type is an error. Runtime state islands (thread state, film data, anatomy data, review data, revisions) are not content IR.

### `--check-content`

```bash
node .agents/skills/vpk-html/scripts/build.mjs --check-content <file.html|content.json> [<file.html>] [--json]
```

- An HTML path finds `<stem>.content.json` beside it; a sidecar path finds `<stem>.html` beside it.
- Modes: `full` (sidecar and HTML), `contract-only` (sidecar), `islands-only` (HTML).
- Exit 0 clean or warnings only, 1 errors, 2 usage or unreadable file. `--json` prints `{ ok, sidecar, html, type, mode, islands, checked, skipped, findings }`.

## Each mode locks its own brief fields

| Mode | Lock first | Then |
|---|---|---|
| New document | The contract and the sidecar | Draft |
| Content-only edit | Nothing new | Change content; preserve CSS and layout |
| Visual repair | `brief.target`, `brief.preserve`, `brief.evidence` | The smallest change that fixes the target |
| Review round | Each review task as a `brief.target` entry; an engine change re-locks the contract | Work one task at a time, below |

**Review round.** Run `build.mjs --review <files> <artifact> --format json` (`vpk-review-tasks/1`) and work one task at a time: `brief.target.element` = `[data-vpk-id="<blockId>"]` (or the quote when `blockId` is null); `brief.target.surface` = the artifact basename; viewport and theme from the comment’s `layout` field, else "any" and "light"; `brief.preserve` = the block ids of the other open tasks; `brief.evidence` = the saved `--review` output. Finish with the printed `--stamp … --addresses <ids>`. See [review loop](review-loop.md).

| Situation | `review.runtime` |
|---|---|
| Interactive; the request mentions reviewers, comments, feedback, sign-off, approval, "share for review", or decisions for others to answer | `true`; say "review runtime on" in the contract line, never ask just for this |
| Interactive, none of the above | `false`; offer `--inject-review` in one closing line |
| Non-interactive (evals, the work-item report generator, automation) | `false` unless the prompt asks for a reviewable document |
| The document has decision blocks | `true` (decisions capture nothing without the runtime) |
| `return_paths` | omit it: all four ship, and Send appears only when a VPK host answers |

## After two rounds on one element, show variants

| Step | Do |
|---|---|
| 1 | Name the concrete defect: the surface, viewport or theme, and the class (density, hierarchy, alignment, type, figure, cropping, text fit) |
| 2 | Lock `target` and `preserve`, make the smallest change, and verify the affected matrix |
| 3 | **After two rounds on the same element**, stop nudging. Write one comparison page, `artifacts/vpk-html/<slug>/<slug>-variants.html`, with the current state plus 2–3 labelled variants (A, B, C) that change only the compared property. Apply the pick everywhere it reaches |

A template that reaches step 3, or gets an eval finding, earns a playbook.

## Definition of done

This section owns the closing reply; [SKILL.md § Phase F](../SKILL.md#phase-f-deliver) points here. Close with these six headings, in order:

1. **Changed**: the path and size of every deliverable, `<slug>.content.json` included. Flag the HTML when check-html warns that it exceeds the 1.57 MB data-URL budget.
2. **Frames shown**: the sheet and strip paths of [verification § 9](verification.md#9-show-frames-before-you-claim-done), or "none".
3. **Checks run**: each command run in this session and its result, plus whether the prose passed the [writing](writing.md) review checklist. Never report a check you did not run.
4. **Not verified**: every skipped step, `[DATA NEEDED]` gap, assumption (a defaulted figure engine included), open finding and `warn` line.
5. **Verdict**, one word: VERIFIED, NOT VERIFIED or INCONCLUSIVE, per [verification § 9](verification.md#9-show-frames-before-you-claim-done).
6. **Decisions**: what the user chooses next, and how to review it. When the review runtime ships: "Select text and press C, or use the Review button at the bottom left. Return comments with Copy for agent, Download review, Save reviewed copy, or Send to agent inside VPK (`/html?page=…`)", and the agent then runs `build.mjs --review <files> <artifact>`. When it does not ship, offer `--inject-review` in one line. If published, give the URL and access level; otherwise one line offering GitHub Pages, a gist, or Atlassian Artifacts (view and copy only).

The reply skeleton, filled in order:

```markdown
**Changed**: <path> (<size>) · <slug>.content.json (<size>)
**Frames shown**: <sheet path> · <strip path> | none
**Checks run**: <command> → <result> · writing review checklist → pass|fail
**Not verified**: <skipped step, gap, assumption, finding or warn line>
**Verdict**: VERIFIED | NOT VERIFIED | INCONCLUSIVE
**Decisions**: <what the user chooses next, and how to review it>
```

## Playbooks

`references/playbooks/<template-stem>.md` holds template-specific guidance. Read it before drafting when it exists; `build.mjs --playbook` lists them. The format follows lavish-axi’s playbooks (MIT):

```markdown
---
template: one-pager.html
demo: demo-one-pager.html
schema: <type>                  # optional: references/schemas/<type>.json, same stem as the template
evals: [renewal-recommendation] # scenario names from evals/evals.json, never ids
figure_engines: [none, iso-kit] # subset of none, iso-kit, anatomy-hero, both
---

# one-pager playbook

<load line: see below>

## Use when
## Choose
## Structure
## Pitfalls
```

- The line under the H1 is exactly `playbookLoadLine(template)` from `scripts/playbooks.mjs`: "Load before you draft" and the template name in backticks, then "Back to" and a markdown link to `../../SKILL.md`.
- Use when, Choose, Structure and Pitfalls are required, each with at least one `- ` bullet; Design rules, Figures and Contract are optional. At most 150 lines.
- The demo must exist and be linked from `index.html`.
- `--check-evals` enforces the format, and that every template outside the legacy baselines in `scripts/playbooks.mjs` has a playbook and an eval scenario. The baselines may only shrink.
