---
template: status-report.html
demo: demo-status-report.html
evals: [api-performance-status]
figure_engines: [none, iso-kit]
---

# status-report playbook

Format and checker: [contract](../contract.md#playbooks). Routing for every template:
[authoring detail](../authoring-detail.md). Honesty rules:
[anti-patterns](../anti-patterns.md).

## Use when

- A recurring engineering update: weekly status, rollout progress, a performance review for leadership.
- The reader must learn what changed, how confident the team is, what is blocked, and what decision or help is needed next.
- The evidence is measurements over a stated window: latency, error rate, capacity, deploys, incidents.

## Choose

- `one-pager.html` when the page argues for one decision rather than reporting a period.
- `incident-report.html` for a single incident's timeline, impact and follow-ups.
- `implementation-plan.html` when the content is a forward plan with phases and owners, not progress.
- `changelog.html` for release notes aimed at users.
- `research-feature-explainer.html` for a benchmark or capability study with methodology.

## Structure

- Executive Readout: what changed since the last update, then current confidence and why. The decision or rollout state goes here first.
- Progress and Blockers: shipped work, then blocked or slipping work, each with an owner and the next action.
- Next Window: what happens next, which decision or help is needed, and the validation or delivery milestones.
- Acceptance checklist: keep the three checks and make each true before handing over.
- Evidence: before and after values in one table or one chart on a shared axis, with the sample window and volume beside them.

## Contract

- Lock the rollout or decision state and every exception before filling; both go in `brief.required_facts`.
- Record each measurement as a `content.facts` entry, written exactly as the page shows it (`118 ms`, `0.4%`), so `--check-content` can prove coverage.
- Figures: static charts by default. An iso-kit figure only for a mechanism, such as a request path, that the numbers alone cannot explain.

## Pitfalls

- Aggregate improvements bury the exception. A regional cap, a slipped milestone or a held-back cohort is stated in the readout, not only in a table footnote.
- Only positive deltas. Real reports include slippage; if nothing slipped, say why.
- Causality beyond the measurements. Report what moved and over which window; do not claim the change caused it unless the source says so.
- Missing sample context. State the measurement window and the sample volume next to the numbers.
- Blockers without an owner and a next action.
- Charts that do not improve comparison. Before and after values share one axis or sit in one row; otherwise use a table.
- Template prompts left in the `prompt-row` slots. `--check-placeholders` must pass.
