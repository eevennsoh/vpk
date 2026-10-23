# Contract, content IR, and definition of done

Read this before locking the contract for a new document (SKILL.md step 2). The
contract makes the agent's plan explicit before any HTML is written, and the
definition of done makes the closing message honest. The content IR records the
contract and the supplied facts beside the artifact, so a check can prove the
page kept them. The contract and definition-of-done wording are adapted from
kami (MIT).

## The seven contract fields

1. **Template**, plus its playbook when `references/playbooks/<template>.md` exists.
2. **Reader job**: the 30-second quick read and the deeper audit.
3. **Formats**: always `html`; optionally `pdf`, `landing`, `github`, `artifacts`, `gist`, `mp4`.
4. **Length or page-weight target**, and the review viewport (default 1440×900, the eval viewport).
5. **Figures** you plan, and the **engine** for each (see Figure engine).
6. **Review runtime** on or off. When it is on, all four return paths ship. Live send turns on by itself when a VPK host answers the handshake, so it is never a choice.
7. **Verification commands**.

State the contract to the user in one line, then continue:

> Contract: `status-report.html` · decide the 50% rollout in 30 s, audit
> latency/error/capacity · HTML + PDF · ≤ 2 screens at 1440 · 2 static charts +
> 1 iso-kit pipeline figure · review runtime off · checks: placeholders, verify,
> check-html, check-content.

A template's playbook can add items, for example the film source and labs of a
motion case study.

## Question budget

Ask at most one compact question, and only when two or more of purpose,
audience, hard constraints or success cannot be inferred, or when the figure
engine is open. **Asking ends the turn**: wait for the answer before drafting
figures. When you ask, end the message with the rest of the contract as one
line in the usual format (all seven fields, including the length/viewport
target and the verification commands), with the engine marked open. When
nothing needs asking, state the contract and continue; adjust if the user
pushes back.

## Figure engine

SKILL.md step 2 holds the only copy of the engine question and its three
options (iso kit, anatomy hero, both). Ask it when the plan includes technical
figures and the user has not named an engine. Data charts and the
`assets/diagrams/` primitives never trigger it. An anatomy hero is never an
Epic tier, and a document has at most one.

With nobody to ask (evals, automation, the backend report generator), use the
iso kit: write `figure_engine: "iso-kit"` and `figure_engine_source: "default"`
in the brief, and list the choice in `assumptions` and in DoD item 3.

**Engine record.** The canonical record is in the HTML head:

```html
<meta name="vpk-figure-engine" content="none|iso-kit|anatomy-hero|both">
```

An absent meta means `none`. Engine roots carry `data-vpk-engine="iso-kit"` or
`"anatomy-hero"`, `data-vpk-figure="<id>"` (`^[a-z][a-z0-9-]{0,39}$`) and
`data-vpk-camera="45 30"`. check-html enforces the meta once an engine root
exists, and the builders insert it when absent. The brief's `figure_engine`
mirrors the meta, and `--check-content` fails on a mismatch (B9). Changing the
engine in a later round re-locks the contract: update the meta, the brief and the
one-line contract together.

## Content IR

### Sidecar

Every new document gets `artifacts/vpk-html/<slug>/<slug>.content.json`, written
at contract lock:

```json
{
	"type": "document",
	"lang": "en",
	"brief": { "reader_job": { "quick_read": "…", "deep_audit": "…" }, "template": "status-report.html", "formats": ["html"], "acceptance_checks": ["…"] },
	"content": { "title": "…", "facts": [{ "label": "…", "value": "…" }] }
}
```

- Only `type`, `lang`, `brief` and `content` are allowed; `content` is optional, so a brief-only sidecar is a valid contract record.
- `type` is a stem of `references/schemas/*.json`: `document` for prose templates; data-driven templates bring their own (`x-thread`, `motion-case-study`). When `type` is not `document`, the brief's template stem must equal it.
- `lang` is a language tag such as `en` or `en-GB`.
- Tooling never requires a sidecar: legacy artifacts and the backend report generator have none. New work always writes one.

A worked example that passes full coverage against a shipped demo:
`references/schemas/examples/document.content.json` with
`assets/demos/demo-status-report.html`.

### Brief

| Field | Rule |
| --- | --- |
| `reader_job` (required) | `{ quick_read, deep_audit }`, each 1–240 characters |
| `template` (required) | `x.html` or `x`; must exist in `assets/templates/` |
| `formats` (required) | 1–7 of `html, pdf, landing, github, artifacts, gist, mp4`; includes `html` |
| `acceptance_checks` (required) | the verification commands (field 7) |
| `audience`, `length_target`, `narrative` | short strings |
| `viewport` | `{ width: 320–3840, height: 320–3000 }`; `--screenshot` uses it |
| `size_budget_kb` | 10–20000; a contract target, separate from the 1.57 MB data-URL warning |
| `figure_engine`, `figure_engine_source` | `none, iso-kit, anatomy-hero, both`; `user, default` |
| `figures` | ≤ 40 × `{ id, kind, engine, job, tier? }`; kind `chart, diagram, illustration, explainer, film, lab`; engine `static, iso-kit, anatomy-hero`; `tier` (`figure`, `hero`) only for anatomy; `id` equals the root's `data-vpk-figure` |
| `review` | `{ runtime: boolean }` |
| `publish` | `artifacts`, `gist` (GitHub Pages is the `github` format) |
| `required_facts`, `preserve`, `assumptions`, `explicit_deviations`, `required_assets`, `evidence` | string lists |
| `target` | `{ surface, viewport, theme, state, element }` for a visual repair |

Rules checked by `--check-content` (E error, W warning):

- **B1 E** the template exists. **B2 E** formats include `html`. **B3 E** every `publish` entry is also a format.
- **B4 E** iso-kit or anatomy-hero figures need a `figure_engine` other than `none`.
- **B5 E** `iso-kit` excludes anatomy figures and `anatomy-hero` excludes iso figures; `both` needs one of each.
- **B6 E** more than one anatomy hero, unless an `explicit_deviations` entry names the anatomy exception.
- **B7 W** `figure_engine_source: "default"` with no `assumptions`.
- **B8 E** a non-`document` type uses its own template.
- **B9 E** with the HTML: the meta and `figure_engine` agree, and engine figures have a meta.
- Figure ids are unique, and `tier` appears only on anatomy-hero figures.

### Content schemas and coverage

Schemas use a small JSON-Schema subset: `type`, `enum`, `required`,
`properties`, `additionalProperties`, `items`, `minItems`, `maxItems`,
`minLength`/`maxLength` (trimmed), `minimum`/`maximum`, `pattern`, plus the
annotations `$comment`, `title`, `description`, `$schema`, `$id`. A schema with
any other keyword is an error. `x-coverage: "skip"` excludes a value from
coverage; `x-coverage: "verbatim"` forces a long value to be checked.

**Coverage** runs when the sidecar has `content` and the HTML is known. Every
string value of 80 characters or fewer, and every number, must appear in the
visible text with alphanumeric boundaries (`62%` does not match `162%`). Visible
text excludes `<head>`, scripts, styles, templates, noscript, comments, speaker
notes and simple `[hidden]` elements; a whitespace-free fallback catches values
split across elements. Longer prose is counted, not matched. Write each fact
exactly as the page shows it.

### In-file content islands

Data-driven templates also embed `content` in the page:

```html
<script type="application/json" data-vpk-content="<type>">…</script>
```

Write it with `scripts/json-island.mjs` `serializeJsonIsland`, never by hand.
`--check-content` validates each island against its schema, requires it to
equal the sidecar's `content` when a sidecar exists, and runs the template's
extra rules from `CONTENT_TYPE_HOOKS` in `scripts/content-ir.mjs` (x-thread:
`scripts/x-thread/check.mjs`). An unknown type is an error. Runtime state
islands (thread state, film data, anatomy data, review data, revisions) are not
content IR.

### `--check-content`

```bash
node .agents/skills/vpk-html/scripts/build.mjs --check-content <file.html|content.json> [<file.html>] [--json]
```

- An HTML path finds `<stem>.content.json` beside it; a sidecar path finds `<stem>.html` beside it.
- Modes: `full` (sidecar and HTML), `contract-only` (sidecar), `islands-only` (HTML).
- Exit 0 clean or warnings only, 1 errors, 2 usage or unreadable file. `--json` prints `{ ok, sidecar, html, type, mode, islands, checked, skipped, findings }`.

## Modes

- **New document**: lock the contract and write the sidecar.
- **Content-only edit**: change content; preserve CSS and layout.
- **Visual repair**: lock `brief.target`, `brief.preserve` and `brief.evidence` first.
- **Review round**: review tasks become `brief.target` entries. An engine change re-locks the contract.
  Run `build.mjs --review <files> <artifact> --format json` (`vpk-review-tasks/1`) and work one task at a time: `brief.target.element` = `[data-vpk-id="<blockId>"]` (or the quote when `blockId` is null); `brief.target.surface` = the artifact basename; viewport and theme from the comment's `layout` field, else "any" and "light"; `brief.preserve` = the block ids of the other open tasks; `brief.evidence` = the saved `--review` output. Finish with the printed `--stamp … --addresses <ids>`. See [review loop](review-loop.md).

  | Situation | `review.runtime` |
  |---|---|
  | Interactive; the request mentions reviewers, comments, feedback, sign-off, approval, "share for review", or decisions for others to answer | `true`; say "review runtime on" in the contract line, never ask just for this |
  | Interactive, none of the above | `false`; offer `--inject-review` in one closing line |
  | Non-interactive (evals, the work-item report generator, automation) | `false` unless the prompt asks for a reviewable document |
  | The document has decision blocks | `true` (decisions capture nothing without the runtime) |
  | `return_paths` | omit it: all four ship, and Send appears only when a VPK host answers |

## Feedback protocol

1. Name the concrete defect: the surface, viewport or theme, and the class (density, hierarchy, alignment, type, figure, cropping, text fit).
2. Lock `target` and `preserve`, make the smallest change, and verify the affected matrix.
3. **After two rounds on the same element**, stop nudging. Write one comparison page, `artifacts/vpk-html/<slug>/<slug>-variants.html`, with the current state plus 2–3 labelled variants (A, B, C) that change only the compared property. Apply the pick everywhere it reaches.

A template that reaches step 3, or gets an eval finding, earns a playbook.

## Definition of done

The closing message gives:

1. the path of every deliverable, including `<slug>.content.json`;
2. each required check's result, named by command, and whether the prose passed the [writing](writing.md) review checklist;
3. every `[DATA NEEDED]` gap and every assumption, including a defaulted figure engine;
4. the visual verdict, stated honestly: if you did not look at rendered images in both themes at the contract viewport, say "build verified, visuals unconfirmed", not "done";
5. the HTML's size, flagged when check-html warns that it exceeds the 1.57 MB data-URL budget;
6. how to review it: when the runtime ships, "Select text and press C, or use the Review button at the bottom left. Return comments with Copy for agent, Download review, Save reviewed copy, or Send to agent inside VPK (`/html?page=…`)", and that the agent then runs `build.mjs --review <files> <artifact>`; when it does not ship, offer `--inject-review` in one line. If published, the URL and access level; otherwise one line offering GitHub Pages, a gist, or Atlassian Artifacts (view and copy only).

## Playbooks

`references/playbooks/<template-stem>.md` holds template-specific guidance. Read
it before drafting when it exists; `build.mjs --playbook` lists them. The
format follows lavish-axi's playbooks (MIT):

```markdown
---
template: one-pager.html
demo: demo-one-pager.html
schema: <type>                  # optional: references/schemas/<type>.json, same stem as the template
evals: [renewal-recommendation] # scenario names from evals/evals.json, never ids
figure_engines: [none, iso-kit] # subset of none, iso-kit, anatomy-hero, both
---

# one-pager playbook

## Use when
## Choose
## Structure
## Pitfalls
```

- Use when, Choose, Structure and Pitfalls are required, each with at least one `- ` bullet; Design rules, Figures and Contract are optional. At most 150 lines.
- The demo must exist and be linked from `index.html`.
- `--check-evals` enforces the format, and that every template outside the legacy baselines in `scripts/playbooks.mjs` has a playbook and an eval scenario. The baselines may only shrink.
