# Authoring detail

Owner of template filling, assets, metadata and long documents for [SKILL.md](../SKILL.md). Load when you fill a template in Phase C or place assets, metadata, long docs or spreads.

Contents: [Every file of an artifact lives in its slug folder](#every-file-of-an-artifact-lives-in-its-slug-folder) · [Intent and template selection](#intent-and-template-selection) · [Inventory the material before drafting](#inventory-the-material-before-drafting) · [The file opens offline with every asset inlined](#the-file-opens-offline-with-every-asset-inlined) · [Filling the template](#filling-the-template) · [Metadata](#metadata) · [Long documents navigate by real links](#long-documents-navigate-by-real-links) · [Inject review before the checks when the contract turns it on](#inject-review-before-the-checks-when-the-contract-turns-it-on)

## Every file of an artifact lives in its slug folder

```text
artifacts/vpk-html/<slug>/
  <slug>.html                 the deliverable
  <slug>.content.json         contract sidecar
  <slug>.pdf                  PDFs, validation images, iteration captures
  screenshots/                build.mjs --screenshot writes here
  _figures/<id>.hero.mjs      anatomy hero source
  _figures/<id>.iso.json      iso-kit figure source
```

Do not put generated HTML in the repository root, `docs/html`, or directly at the top of `artifacts/vpk-html`.

Artifacts are durable local deliverables even though Git ignores the directory. Automation and housekeeping must not delete or rewrite them. Deletion requires a separate explicit request naming the exact artifact path.

Figure-engine sources live in a `_figures/` child: `_figures/<id>.hero.mjs` for an anatomy hero (between `<!-- vpk-anatomy-hero:start … -->`/`:end` markers) and `_figures/<id>.iso.json` for iso-kit figures (between `vpk-figure:begin`/`:end` markers); the builders rebuild each region from its `src`.

## Intent and template selection

Infer purpose, audience, hard constraints, and the success outcome. Before choosing a template, write a private two-line reader-job note:

- **Quick read:** what must the reader understand, decide, or change within about 30 seconds?
- **Deep audit:** what evidence must remain available when they inspect the artifact closely?

Read `playbooks/<template>.md` when it exists, then lock the contract (`contract.md`) and write `<slug>.content.json`.

Use that job to choose and adapt the template. Do not let available slots decide the information architecture. Ask one compact question only when at least two dimensions are genuinely unclear.

### General documents

| Request | Template |
| --- | --- |
| One-pager, proposal, executive brief | `one-pager.html` |
| White paper, long document, report | `long-doc.html` |
| Letter, memo, cover letter | `letter.html` |
| Portfolio or case studies | `portfolio.html` |
| Resume or CV | `resume.html` |
| Slides, deck, keynote | `slides.html` |
| Equity report or investment memo | `equity-report.html` |
| Release notes or changelog | `changelog.html` |
| Broadsheet, index, issue opener | `broadsheet.html` |
| Annual report, brand book, colophon | `annual-report.html` |
| Interview, Q&A, profile | `interview.html` |
| Lookbook or artifact gallery | `lookbook.html` |
| Long-form or data essay | `feature-essay.html` |
| Motion case study: captured film, cue sheet, Gantt, labs | `motion-case-study.html` |
| X thread (draft, approve, post) | `x-thread.html` |

### Engineering artifacts

| Request | Template |
| --- | --- |
| Technical approaches or options | `exploration-code-approaches.html` |
| UI concepts or visual directions | `exploration-visual-designs.html` |
| Code or PR review | `code-review-pr.html` |
| Codebase map or module walkthrough | `code-understanding.html` |
| Design system or token contract | `design-system.html` |
| Component variants or state matrix | `component-variants.html` |
| Motion concept | `prototype-animation.html` |
| Interaction prototype | `prototype-interaction.html` |
| Technical deck | `slide-deck.html` |
| SVG or technical illustration brief | `svg-illustrations.html` |
| Status or weekly report | `status-report.html` |
| Incident report or postmortem | `incident-report.html` |
| Flowchart or decision process | `flowchart-diagram.html` |
| Feature research explainer | `research-feature-explainer.html` |
| Concept research note | `research-concept-explainer.html` |
| Implementation or rollout plan | `implementation-plan.html` |
| PR description or change summary | `pr-writeup.html` |
| Issue or bug triage | `editor-triage-board.html` |
| Feature flag matrix | `editor-feature-flags.html` |
| Prompt tuning or evaluation | `editor-prompt-tuner.html` |

## Inventory the material before drafting

| Wrong | → Right |
| --- | --- |
| Browsing to decorate a document | → verify factual claims only when the task depends on current or external evidence |
| Three paragraphs repeating one point | → one strong claim |
| "Significantly faster" | → the measured number |
| Filler in an empty template region | → delete the region |

Inventory the supplied material before drafting. Distinguish quoted or observed facts from interpretation, resolve conflicting figures, and retain attribution. Do not browse merely to decorate a document, but verify factual claims when the task depends on current or external evidence. Follow `source-policy.md`.

Distill repeated content into one strong claim, prefer data to adjectives, and match detail to the reader’s decision. Do not pad empty template regions.

## The file opens offline with every asset inlined

| Asset | Wrong | → Right |
| --- | --- | --- |
| CSS and scripts | `<link>` or `<script src>` | → inline |
| Raster image | `src="https://…"` or `src="file:…"` | → a `data:image/*` URI |
| SVG | `<img src="x.svg">` | → markup embedded directly |
| Fonts and primitives | A remote CDN | → the shipped ones |
| Brand-profile logo | A placeholder when missing | → base64 inlined, or nothing |
| Any image | A stock-image description or unlicensed data | → material supplied or licensed for the task |

The checker treats unresolved external assets as a failure.

Embed films only with `scripts/media/embed.mjs` (data URL, fence-checked); film documents over the data-URL budget get `<slug>.lite.html` automatically; see [media pipeline](media-pipeline.md).

## Filling the template

| Step | Do |
| --- | --- |
| 1 | Copy the selected template into the artifact folder |
| 2 | Preserve its CSS, shared runtime hooks, semantic structure, and single `<main>` landmark; replace content and explicit placeholders |
| 3 | Read `writing.md` and the document-specific reference before drafting |
| 4 | Avoid every failure mode in `anti-patterns.md` |
| 5 | Keep code samples, commands, `pre`, and inline `code` on the mono face after any document typography overrides |
| 6 | Center diagrams and technical illustrations optically unless the prompt asks for another composition. Move related SVG nodes and connectors together |
| 7 | Wrap long SVG labels or widen their nodes. Make connectors meet node edges exactly and use consistent filled-triangle markers |

| Wrong | → Right |
| --- | --- |
| `{{...}}`, `lorem ipsum`, `[Insert here]` or `TBD` left in | → real content |
| An invented metric, figure, statistic, source or quotation | → `[DATA NEEDED: description]` for a real evidence gap |
| Body copy that repeats its heading | → the claim the heading promises |

## Metadata

Fill each template’s title placeholder and these head values:

| Field | Rule |
| --- | --- |
| Author | Person for resumes/letters/portfolios; otherwise supplied identity or blank |
| Description | One sentence, no more than 150 characters, derived from opening content |
| Keywords | Three to five terms from title and headings |
| Document title | Match the visible primary heading |
| Figure engine | `<meta name="vpk-figure-engine" content="none\|iso-kit\|anatomy-hero\|both">` once any engine figure exists; the builders insert it when absent |

Keep `<meta name="generator" content="vpk-html">` unchanged.

## Long documents navigate by real links

| Wrong | → Right |
| --- | --- |
| A TOC of plain text | → real table-of-contents links to stable section IDs |
| Headings with no anchor | → visible heading self-links with `scroll-margin-top` |
| TOC page metadata `03` beside section `3` | → `Pg 03` |

When using the shared document-navigation runtime, keep visible previous/next controls, section counter, progress, keyboard navigation, and presenter support. Speaker notes are the last child of each `main > section` and remain hidden from the audience and print output. Scope dimming to navigation focus and release it on manual wheel or touch scrolling. Read `presentation.md` for the full runtime contract.

## Inject review before the checks when the contract turns it on

When the contract turns the review runtime on (reviewers, comments, sign-off, or decision blocks), run `build.mjs --inject-review <file>` after filling and before the required checks; it adds the doc-id metas, a `data-vpk-id` on every content block, the `<slug>.vpk-blocks.json` ledger and the runtime. Keep every `data-vpk-id` when you edit, never delete the ledger, and run `--stamp` after each later edit (it restores ids a regeneration dropped). Mark subtrees your own scripts rewrite after load `data-vpk-generated` or `aria-live`. A decision is `<fieldset class="vpk-decision" data-vpk-decision="<key>">` with a `<legend>` question and radio, checkbox, select, textarea or text/range controls; the `checked`/`selected` option is the recommendation:

```html
<fieldset class="vpk-decision" data-vpk-decision="rollout">
	<legend>Ship the 50% rollout on Monday?</legend>
	<label><input type="radio" name="rollout" value="ship" checked> Ship</label>
	<label><input type="radio" name="rollout" value="hold"> Hold a week</label>
</fieldset>
```

Place each decision on the claim it changes. Templates never carry review state (ids, metas, islands, runtime). Full rules, commands and contracts: [review loop](review-loop.md).
