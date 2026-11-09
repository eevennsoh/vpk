---
template: one-pager.html
demo: demo-one-pager.html
evals: [renewal-recommendation, security-governance]
figure_engines: [none, iso-kit]
---

# one-pager playbook

Load before you draft `one-pager.html`. Back to [SKILL.md](../../SKILL.md).

Format and checker: [contract](../contract.md#playbooks). Routing for every template:
[authoring detail](../authoring-detail.md).

## Use when

- One reader or small group must make or ratify a single decision: renew, approve, expand, fund, stop.
- The evidence fits on about two screens at 1440 px: a handful of numbers, two short arguments, one caveat.
- Executive briefs, proposals, conditional approvals and governance summaries.

## Choose

- `long-doc.html` when the argument needs chapters, appendices or more than two screens of evidence.
- `letter.html` when it is a memo addressed to one named reader rather than a decision page.
- `status-report.html` when the job is a recurring progress update, not a single decision.
- `exploration-code-approaches.html` when the reader is comparing several technical options in depth.
- `slides.html` when the decision is presented live, one point per screen.

## Structure

- Header: eyebrow (Proposal, Brief, Governance), a verb-led `h1` that states the decision, a subtitle with the sharpest claim, and author, date and status in the meta block.
- Metrics strip: at most four numbers that the decision rests on, each with a label that says what it measures.
- Lead paragraph: 30–40 words that restate the decision and its condition; one ink emphasis on the deciding number.
- Two-column sections: the case for, and the evidence or risks. Each gets one or two sentences plus three short bullets.
- Roadmap: keep it for proposals with phases; delete it for a pure decision or governance brief rather than inventing phases.
- Callout: the caveat or condition that must not be missed.
- Footer: confidentiality and contact. Fill it or remove it; never leave the template text.

## Contract

- Lock the decision sentence and every condition before filling. They go in `brief.required_facts`.
- Record each supplied number as a `content.facts` entry in `<slug>.content.json`, so `--check-content` proves the page kept it verbatim.
- Figures: usually none or one static chart. An iso-kit figure only when the decision depends on a mechanism the reader must see.
- Review runtime on when the brief asks for sign-off from more than the requester.

## Pitfalls

- The recommendation sits below the metrics or in a section body. It must be the headline and the lead, readable in a 30-second scan.
- The caveat is softened, merged into a bullet or dropped. Excluded populations, open exceptions and the limits of a clean track record stay visible in the callout or beside the number they qualify.
- Comparable values on different scales. Put actual, target and peer benchmark on one scale, or in one row, so the comparison is honest.
- Conditions without owners or dates. Each condition names its owner and deadline as actionable text, not decorative metadata.
- Invented evidence, quotations or causal claims. Mark gaps as `[DATA NEEDED: …]` instead.
- Generic dashboard cards. Four metrics with labels are the ceiling; more numbers belong in a table inside a section.
- Placeholder residue in the metric slots, meta block or footer. `--check-placeholders` must pass.
