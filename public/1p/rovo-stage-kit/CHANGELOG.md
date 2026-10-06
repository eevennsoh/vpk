# Rovo Stage Kit 1.3.0

What's new since kit 1.2.0.

## 23 new pieces

Each one is an animated sticker drawn from its Figma design, available on the stage and as `<RovoPiece id="…">` or `<rovo-piece piece="…">`.

| Piece | id | Group | Box (points) | Moment |
| --- | --- | --- | --- | --- |
| Agent identities | `agentIdentities` | Confidence: control, cost and risk | 564 × 377 | Its counts tick up, each agent’s row rises in, and its status lands Active. |
| Atlassian MCP | `atlassianMcp` | Confidence: control, cost and risk | 583 × 230 | Its eyebrow types in, the line under it rises, and the four tools land one after another, each settling into its tilt. |
| Redacted by your organization | `redactedPrompt` | Confidence: control, cost and risk | 539 × 354 | The question types in, a marker swipes over its product code, and the organization’s note comes up. |
| Needs input | `needsInput` | Confidence: control, cost and risk | 539 × 412.1 | The work item comes in, then the tray grows out from under it with Claude’s Needs input, and the blue dot pops. |
| Unlinked agent sessions | `agentSessions` | Confidence: control, cost and risk | 523 × 560 | Refresh turns, Canva’s new session lands on top, lit, the count ticks to 7, and every orb keeps working. |
| Request Resolver’s steps | `requestResolver` | Confidence: control, cost and risk | 946.5 × 402 | Each step ticks in turn, its line running down to the next, @Victoria is called on the last, and the sources land. |
| Onboarding work items | `jiraList` | Confidence: control, cost and risk | 1000.14 × 294 | The rows fill in, Request Resolver takes the licences, and the desk turns from In progress to Done. |
| Risk, by kind | `riskStack` | Confidence: control, cost and risk | 674 × 593 | The cards are dealt down the diagonal, their statuses pulse, and Business flags its high risks. |
| Cost by provider and model | `costByModel` | Confidence: control, cost and risk | 495 × 683 | The ring sweeps round as its total counts up to $5.6M, each provider joining the key, then the models’ bar fills. |
| Spend this month | `spendCard` | Confidence: control, cost and risk | 450 × 476 | The line draws across as the total counts up, turning orange past the budget, on to $786K. |
| Dimensions | `dimensions` | Confidence: control, cost and risk | 634 × 362 | Each bar fills segment by segment as its score counts up, the rows a beat apart. |
| Potential savings | `potentialSavings` | Confidence: control, cost and risk | 742 × 162 | The lozenge pops with a glint, and the finding streams in a few words at a time. |
| An agent session, working | `sessionCard` | Confidence: control, cost and risk | 1594.71 × 136.13 | Claude’s mark lands, the title streams in, and Working shimmers beside the turning orb. |
| Readiness | `readiness` | Working together | 432 × 385 | The toolbar’s ring fills to Medium, its menu opens to say why, and the highlight settles on Annie’s comments. |
| High readiness | `highReadiness` | Working together | 294 × 85 | The ring sweeps round its dotted track to three quarters, and High readiness lands with a beat. |
| Cursor activity | `cursorActivity` | Working together | 873 × 325 | The timeline draws out as the activity lands, and the pointer comes to rest on it, the session’s time lifting above. |
| Who’s here | `presenceFacepile` | Working together | 590 × 241 | Teammates and agents pop in apart, then gather into one facepile. |
| Rovo, with a teammate | `rovoWithYou` | Working together | 396 × 302 | Rovo’s tile lands, its four facets come together, and Aoife tucks in. |
| Agent takes the card | `workflowCard` | Working together | 603 × 433 | The card is set down in In Progress, and the agent’s row slides out from under it, Working shimmering as the orb turns. |
| Planner, in the thread | `conversation` | Working together | 603 × 348 | Liam mentions Planner and types his ask, a reaction lands, and Planner starts thinking. |
| Claude’s agent card | `agentCard` | Agents | 544 × 610 | The card drops onto its slot and swings, its spark turns in, and its description writes itself in. |
| Code search, by its syntax | `codeSearchQuery` | Rovo Dev and code | 982 × 63 | searchMode, repo and branch type in, each key turning blue as its colon lands, then the query itself. |
| Code search in the terminal | `twgSearchCli` | Rovo Dev and code | 615 × 167 | The twg command types in at the prompt, and the search starts, its half-moon turning as its dots count up. |

Most of them form a new group, **Confidence: control, cost and risk**, which the stage's `showConfidence` option turns on and off (on by default).

## Stage files

- `rovo-stage.json`: view **stage**, the stage packs its own wall from every piece; 1600 × 900 points, a 89.72 s loop.
- `stages/masonry.json`: view **masonry**, the stage packs its own wall from every piece; 1600 × 900 points, a 82.89 s loop.

## Nothing else changed

- The stage file format is still version 1, and every file written for kit 1.2.0 still reads.
- The API is unchanged: `RovoStage`, `RovoPiece`, `<rovo-stage>`, `<rovo-piece>`, `stageInfo`, `PIECES`.
