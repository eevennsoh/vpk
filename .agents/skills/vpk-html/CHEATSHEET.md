# vpk-html cheatsheet

The one intent → template, diagram and illustration lookup for [SKILL.md](SKILL.md). Load when you pick what to copy in Phase A or C. Copy the pick into `artifacts/vpk-html/<slug>/<slug>.html`, then read `references/playbooks/<template>.md` if it exists.

## Story explainers and the names that collide with them

| User intent | Route |
|---|---|
| Two-column explainer: text left, a figure right that scrubs with scroll | Copy the kit per [story modes](references/story-modes.md#copy-the-kit-then-rename-its-mode-ids); look per [paper system](references/paper-system.md); the sidecar fields are in [contract § Content IR](references/contract.md#content-ir) |
| Read it as Slides, X Threads or Video | A mode of the same page: [story modes](references/story-modes.md) |
| A slide deck with presenter view | A standalone deck: [Documents](#documents) or [Engineering templates](#engineering-templates) |
| An X thread to approve and post | A standalone composer: [Documents](#documents) |
| An MP4 file | [video export](references/video-export.md) |

## Documents

| User intent | Template |
|---|---|
| Executive summary / proposal / brief | `assets/templates/one-pager.html` |
| White paper / long-form report / chapter | `assets/templates/long-doc.html` |
| Memo / formal letter / cover letter | `assets/templates/letter.html` |
| Portfolio / case studies / work samples | `assets/templates/portfolio.html` |
| Resume / CV | `assets/templates/resume.html` |
| Slide deck / keynote with presenter view | `assets/templates/slides.html` ([presentation](references/presentation.md)) |
| Investment memo / valuation / equity research | `assets/templates/equity-report.html` |
| Release notes / changelog | `assets/templates/changelog.html` |
| Broadsheet / index / issue opener | `assets/templates/broadsheet.html` |
| Annual report / brand book / colophon | `assets/templates/annual-report.html` |
| Interview / Q&A / profile | `assets/templates/interview.html` |
| Lookbook / artifact gallery | `assets/templates/lookbook.html` |
| Long-form or data essay | `assets/templates/feature-essay.html` |
| Motion case study: captured film, cue sheet, Gantt, labs | `assets/templates/motion-case-study.html` |
| X thread to approve and post one at a time | `assets/templates/x-thread.html` ([x-thread](references/x-thread.md)) |

## Engineering templates

| User intent | Template |
|---|---|
| Compare technical implementation approaches | `assets/templates/exploration-code-approaches.html` |
| Compare UI / visual design directions | `assets/templates/exploration-visual-designs.html` |
| Pull request review findings | `assets/templates/code-review-pr.html` |
| Explain a code path or module | `assets/templates/code-understanding.html` |
| Design system / token contract | `assets/templates/design-system.html` |
| Component variant matrix | `assets/templates/component-variants.html` |
| Motion / animation prototype spec | `assets/templates/prototype-animation.html` |
| Interaction prototype spec | `assets/templates/prototype-interaction.html` |
| Engineering slide deck plan | `assets/templates/slide-deck.html` ([presentation](references/presentation.md)) |
| SVG / technical illustration brief | `assets/templates/svg-illustrations.html` |
| Engineering status report | `assets/templates/status-report.html` |
| Incident report / postmortem | `assets/templates/incident-report.html` |
| Flowchart / process diagram plan | `assets/templates/flowchart-diagram.html` |
| Feature explainer / capability research | `assets/templates/research-feature-explainer.html` |
| Concept explainer / technical research note | `assets/templates/research-concept-explainer.html` |
| Implementation plan / rollout plan | `assets/templates/implementation-plan.html` |
| Pull request writeup | `assets/templates/pr-writeup.html` |
| Static triage board snapshot | `assets/templates/editor-triage-board.html` |
| Feature flag matrix / rollout controls | `assets/templates/editor-feature-flags.html` |
| Prompt tuning / prompt eval worksheet | `assets/templates/editor-prompt-tuner.html` |

## Diagrams to embed inside a template

Embed per [diagrams](references/diagrams.md); edit chart motion per [charts](references/charts.md).

| Data shape / intent | Diagram |
|---|---|
| Components + connections in a system | `assets/diagrams/architecture.html` |
| Process with decision branches | `assets/diagrams/flowchart.html` |
| Cross-team or cross-role process | `assets/diagrams/swimlane.html` |
| Lifecycle / states + transitions | `assets/diagrams/state-machine.html` |
| Time-ordered events / milestones | `assets/diagrams/timeline.html` |
| Hierarchy / depth ≥ 2 | `assets/diagrams/tree.html` |
| Layered architecture / stack | `assets/diagrams/layer-stack.html` |
| 2×2 strategic positioning | `assets/diagrams/quadrant.html` |
| Set overlaps (2–3 groups) | `assets/diagrams/venn.html` |
| Category comparison, no time | `assets/diagrams/bar-chart.html` |
| Series across time | `assets/diagrams/line-chart.html` |
| Sums to ~100%, ≤ 6 items | `assets/diagrams/donut-chart.html` |
| OHLC / stock price history | `assets/diagrams/candlestick.html` |
| + and − bridge to a total | `assets/diagrams/waterfall.html` |
| Quartiles, whiskers, outliers | `assets/diagrams/box-plot.html` |
| Frequency distribution | `assets/diagrams/histogram.html` |
| Multiple stacked distributions | `assets/diagrams/ridgeline.html` |
| Individual observations with density | `assets/diagrams/beeswarm.html` |
| One-dimensional individual observations | `assets/diagrams/dot-strip.html` |
| Before/after rank or share change | `assets/diagrams/slope-chart.html` |
| Current vs target gap by category | `assets/diagrams/dumbbell.html` |
| Ranked values with lightweight stems | `assets/diagrams/lollipop.html` |
| Actual value against target and bands | `assets/diagrams/bullet.html` |
| Mirrored demographic cohorts | `assets/diagrams/population-pyramid.html` |
| Time series with event callouts | `assets/diagrams/annotated-line.html` |
| Relative change from baseline 100 | `assets/diagrams/index-chart.html` |
| Repeated comparable time-series panels | `assets/diagrams/small-multiples.html` |
| Observed trend against expected band | `assets/diagrams/band-chart.html` |
| Changing composition over time | `assets/diagrams/stacked-area.html` |
| Daily intensity over a calendar year | `assets/diagrams/calendar-heatmap.html` |
| Two-category intensity matrix | `assets/diagrams/matrix-heatmap.html` |
| Fixed-count part-to-whole units | `assets/diagrams/waffle.html` |
| Regional intensity on a simple grid | `assets/diagrams/grid-choropleth.html` |
| Hierarchical area share | `assets/diagrams/treemap.html` |
| Flow volumes between stages | `assets/diagrams/sankey.html` |
| Ordered node relationships | `assets/diagrams/arc-diagram.html` |
| Two-variable relationship | `assets/diagrams/scatter.html` |
| Two-variable trajectory over time | `assets/diagrams/connected-scatter.html` |
| Hierarchical composition by depth | `assets/diagrams/icicle.html` |
| Hierarchy as concentric rings | `assets/diagrams/sunburst.html` |
| Hierarchy as nested circles | `assets/diagrams/circle-packing.html` |
| Weighted share as organic cells | `assets/diagrams/voronoi-treemap.html` |
| Two-level part-to-whole, variable widths | `assets/diagrams/marimekko.html` |
| Countable units as repeated symbols | `assets/diagrams/isotype.html` |
| Category magnitude around a circle | `assets/diagrams/polar-area.html` |
| Tasks with durations and dependencies | `assets/diagrams/gantt.html` |
| Lifespans or eras on a shared time axis | `assets/diagrams/priestley-timeline.html` |
| Rank changes across many periods | `assets/diagrams/bump-chart.html` |
| Forecast with widening uncertainty bands | `assets/diagrams/fan-chart.html` |
| Many dense series in compact bands | `assets/diagrams/horizon-chart.html` |
| One trace with spikes and bursts | `assets/diagrams/seismogram.html` |
| Shifting composition around a centre line | `assets/diagrams/streamgraph.html` |
| Distribution shapes compared by group | `assets/diagrams/violin-plot.html` |
| Dense point cloud binned into hexagons | `assets/diagrams/hexbin.html` |
| Point density as nested isolines | `assets/diagrams/contour-density.html` |
| Many records across several measures | `assets/diagrams/parallel-coordinates.html` |
| Intersections of more than three sets | `assets/diagrams/upset-plot.html` |
| Flows between groups in a circle | `assets/diagrams/chord-diagram.html` |
| Network graph of nodes and links | `assets/diagrams/force-network.html` |
| Many links bundled through a hierarchy | `assets/diagrams/edge-bundling.html` |
| Regions as equal tiles sized by value | `assets/diagrams/grid-cartogram.html` |

## Technical illustrations

Use these when the reader inspects an object, assembly, mechanism, cross-section or pipeline. Draw per [illustrations](references/illustrations.md) and [SVG style](references/svg-style.md); product-UI scenes follow [figure fidelity](references/figure-fidelity.md).

| Visual job | Exemplar |
|---|---|
| Hardware shell / product surface | `assets/illustrations/isometric-device.html` |
| Layered component stack | `assets/illustrations/exploded-assembly.html` |
| Mechanism with dimension/leader lines | `assets/illustrations/annotated-mechanism.html` |
| Cutaway material section | `assets/illustrations/hatched-cross-section.html` |
| Architecture pipeline / module flow | `assets/illustrations/isometric-pipeline.html` |
| Exploded / pointer-reactive isometric figure | `assets/illustrations/iso-exploded-stack.html` (iso-kit brief) |
| Assembly-manual step / exploded product | `assets/illustrations/iso-flatpack-shelf.html` · `iso-phone-anatomy.html` (iso-kit briefs) |
| Annotated anatomy with dimensions and scale bar | `assets/illustrations/iso-turntable-anatomy.html` (iso-kit brief) |
| System or UI layers you select one at a time | `assets/illustrations/iso-cache-shelves.html` · `iso-card-stack-ui.html` (iso-kit briefs) |
| Objects in an open container | `assets/illustrations/iso-parcel-tray.html` (iso-kit brief) |
| Every iso-kit exemplar on one page | `assets/demos/demo-illustration-gallery.html` |
| One detailed interactive machine (anatomy hero) | `assets/demos/demo-anatomy-hero.html` ([figure engines](references/figure-engines.md)) |
| Both engines in one document | `assets/demos/demo-figure-engines.html` ([figure engines](references/figure-engines.md)) |

`build.mjs --help` lists every command and flag.
