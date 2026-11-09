# vpk-html review rubric

Load when you grade a vpk-html artifact or brief a critic with [critic-prompt.md](critic-prompt.md); it is the contract the critic grades against. Back to [SKILL.md](../SKILL.md); the procedure around it is [evaluation](../references/evaluation.md). Every value lives in the linked owner; grade against the owner, never from memory.

Default to flagging. Approval is earned. Being wowed is rarer still.

## Criteria

Score five criteria at 1, 3 or 5 with a quote. Criteria 3 and 4 grade every story artifact: the `story-explainer-*` scenarios in [evals.json](evals.json) or a story artifact you capture per [verification](../references/verification.md). Criterion 2 grades any product-UI scene: against reference crops when a reference exists, otherwise against the [figure fidelity](../references/figure-fidelity.md) § 1 counts and § 3 bands; diagrams and charts keep their labels. Mark a criterion “n/a” on any other scenario.

| # | Criterion | 1 | 3 | 5 | Evidence required |
| --- | --- | --- | --- | --- | --- |
| 1 | Reader’s job | The decision or action is missing or buried below the first viewport; a supplied fact or caveat is dropped | The decision is findable in 30 seconds, but evidence is generic cards or a caveat is softened | Decision in the first viewport; every supplied number and caveat present; a deep reader audits without rebuilding the argument | Quote the decision line and each caveat with its location |
| 2 | Product-UI scene fidelity ([figure fidelity](../references/figure-fidelity.md)) | Labels or UI text inside a product-UI scene, a black fill, or bare boxes with no inner containers | Container outlines and shading near the owner’s bands, with one surface over- or under-detailed against the reference | Every surface matches its reference crop: outline counts, named text exceptions only, shading inside the owner’s bands in both themes | `sheet-crops.png` with a pair per surface type; the token ink percentages printed by [verification § 4](../references/verification.md#4-check-dark-theme-at-the-same-times) in light and dark |
| 3 | Modes ([story modes](../references/story-modes.md)) | A mode is missing, scrolls when it must fit, or shows chrome the owner removes | All four modes render; one breaks a rule of its row (centring, rail grid, timeline placement) | Every mode meets its row in the owner at 1440 and below 1024 px; hidden chrome is inert per [accessibility](../references/accessibility.md#hidden-chrome-is-hidden-and-inert) | One frame per mode per theme; the DOM check that hidden controls are inert |
| 4 | Verification evidence on disk ([verification](../references/verification.md)) | No frames, or frames without reference pairs where a reference exists; checks reported that were not run | Frames exist for some modes or one theme; behaviour tests only `seek()` | Meets the definition of done in [verification § 9](../references/verification.md#9-show-frames-before-you-claim-done); wheel-scroll and time-sweep tests pass | Paths to the sheets, strips and the filtered log; test names that scroll |
| 5 | Offline single file | Loads a remote request, a font fallback, a console error or a `{{placeholder}}` | Self-contained, with an advisory finding left unexplained | One file, zero requests, zero console errors, every advisory finding explained | `check-html.mjs` and `--verify` output, Error-filtered |

## Flag each escalation trigger as critical on sight

Whatever the scores:

- Text inside a product-UI scene outside the named exceptions in [figure fidelity § 2](../references/figure-fidelity.md#2-no-text-in-product-ui-scenes-except-named-exceptions).
- A solid black fill anywhere in a figure.
- A `title` attribute used as a tooltip on a reading control ([accessibility](../references/accessibility.md#name-icon-buttons-with-aria-label-and-show-the-tooltip-from-data-tip); the tooltip look is [paper system](../references/paper-system.md)).
- A behaviour suite that never scrolls, only calls `seek()` ([verification § 6](../references/verification.md#6-scroll-to-the-end-with-the-wheel-not-seek)).
- An object that moves on its own where production shows it carried ([verification § 7](../references/verification.md#7-sweep-time-for-invariants)).
- A straight apostrophe in reader-facing prose ([writing § Keep exactly](../references/writing.md#keep-exactly)).

## Block if

- Any escalation trigger is open.
- Any criterion scores 1.
- A check is reported as passed with no log on disk.
- The reply claims done and the user never saw frames, with no opt-out or `VPK_VERIFY=manual`.

## Approve if

- Every graded criterion scores 3 or higher; “n/a” only where the note under ## Criteria allows it.
- For a product-UI scene ported from a production reference, criteria 2 and 4 score 5.
- No escalation trigger is open.
- Every warning has a fix or a stated reason under Not verified.

## Wowed if

- Every criterion scores 5 with quoted evidence.
- Zero open findings, nits included.
- In `sheet-reference.png` you cannot tell which column is the reference at thumbnail size, and `sheet-crops.png` differs only where the owner’s rules require it.
- A reader cold to the subject states the decision and the figure’s point after one pass.

## Report one findings table, then the verdict

| Severity (critical / warning / nit) | Criterion # | File:line or frame path | Quoted evidence | Fix |
| --- | --- | --- | --- | --- |

Then list what held up and should not be touched. End with one line: `Verdict: BLOCK | APPROVE | WOWED`, and one sentence why.
