# Diagrams

Owner of the diagram primitives for [SKILL.md](../SKILL.md). Load when you draw a diagram or SMIL motion.

Contents: [Copy the SVG block into a figure](#copy-the-svg-block-into-a-figure) · [Pick by data shape](#pick-by-data-shape) · [Pick by intent](#pick-by-intent) · [One focal element per diagram](#one-focal-element-per-diagram) · [Token map and series encoding](#token-map-and-series-encoding) · [Anti-patterns](#anti-patterns) · [Regenerate through the library refresh](#regenerate-through-the-library-refresh)

vpk-html ships 61 standalone SVG diagram and chart primitives at `assets/diagrams/*.html`. They are data-shape diagrams in the Algebrica figure language: grayscale, token-only, flat, precise, and typography-led. For object/assembly/mechanism drawings, use `references/illustrations.md` and `assets/illustrations/`.

Read `references/svg-style.md` before drawing or modifying any SVG. For chart work, also read `references/charts.md` before editing animation, interaction, or chart-type behavior.

## Copy the SVG block into a figure

Each diagram file is a complete standalone HTML page with an inline SVG. To embed a diagram in a long-doc, portfolio, design-system, or other rich template:

1. Open `assets/diagrams/<type>.html`.
2. Copy the SVG block.
3. Place it inside a `<figure>` in the filled document.
4. Replace placeholder labels inside the SVG with real values.
5. Run `check-html.mjs` on the finished artifact.

```html
<figure>
	<svg viewBox="0 0 960 460" aria-label="Production architecture" fill="none">
		<!-- pasted SVG content -->
	</svg>
	<figcaption>FIG_001 - The origin path is the only focal path.</figcaption>
</figure>
```

Before drawing, ask: would a well-written paragraph teach the reader less than this diagram? If no, skip the diagram.

## Pick by data shape

| Data shape | Diagram |
|---|---|
| Open / high / low / close fields, or per-day price | `candlestick` |
| `+` and `-` contributions summing to a total | `waterfall` |
| One series, values sum to ~100%, <= 6 items | `donut-chart` |
| One series, values sum to ~100%, many fixed-count units | `waffle` |
| One series, values sum to a hierarchy | `treemap`, `icicle` |
| One series, values sum to ~100%, >= 7 items | `bar-chart` |
| Two or more series across time | `line-chart`, `small-multiples` |
| One annotated series across time | `annotated-line` |
| Relative change from a baseline | `index-chart` |
| Observed value within expected range | `band-chart` |
| Composition changing over time | `stacked-area` |
| One series across time, large count changes | `bar-chart` |
| Multiple categories, same snapshot, 2+ series | `bar-chart` |
| Before/after values by category | `slope-chart`, `dumbbell` |
| Actual value against target and qualitative bands | `bullet` |
| Ranked values where labels dominate | `lollipop` |
| Mirrored cohorts, age/sex, or opposing populations | `population-pyramid` |
| Distribution summary by group | `box-plot` |
| Distribution frequency | `histogram` |
| Multiple comparable distributions | `ridgeline` |
| Individual observations along one measure | `beeswarm`, `dot-strip` |
| Heat or intensity by day | `calendar-heatmap` |
| Heat or intensity by two categories | `matrix-heatmap` |
| Region-like intensity on a simplified grid | `grid-choropleth` |
| Flow volumes between stages | `sankey` |
| Ordered node relationships | `arc-diagram` |
| Relationship between two quantitative variables | `scatter` |
| Ordered trajectory across two quantitative variables | `connected-scatter` |
| 2x2 strategic or priority positioning | `quadrant` |
| Hierarchical data with depth >= 2 | `tree` |
| Process with decision branches | `flowchart` |
| Cross-team or cross-role process with >= 3 actors | `swimlane` |
| Lifecycle with named states and transitions | `state-machine` |
| Time-ordered events with milestones | `timeline` |
| Set overlaps or shared attributes between 2-3 groups | `venn` |
| Layered architecture, stack, or tier | `layer-stack` |
| Components and connections in a system | `architecture` |
| Category comparison, single series, no time axis | `bar-chart` |

## Pick by intent

| Reader should learn... | Diagram |
|---|---|
| What talks to what | `architecture` |
| What happens in what order | `flowchart`, `timeline` |
| Who owns each step | `swimlane` |
| How the parts nest | `tree`, `layer-stack` |
| What overlaps with what | `venn` |
| What’s bigger / smaller / changing | `bar-chart`, `line-chart`, `waterfall`, `slope-chart`, `dumbbell`, `lollipop`, `bullet` |
| How observations are distributed | `box-plot`, `histogram`, `ridgeline`, `beeswarm`, `dot-strip` |
| How a trend compares to events, baseline, range, or peers | `annotated-line`, `index-chart`, `band-chart`, `small-multiples`, `stacked-area` |
| Where intensity concentrates | `calendar-heatmap`, `matrix-heatmap`, `grid-choropleth` |
| How parts fill a total or hierarchy | `donut-chart`, `waffle`, `treemap`, `icicle` |
| How entities relate or flow | `sankey`, `arc-diagram`, `scatter`, `connected-scatter` |
| What’s in each quadrant of a 2x2 | `quadrant` |
| What state are we in, and how do we move | `state-machine` |
| How this breaks down into parts of a whole | `donut-chart` |
| How this price moved over time | `candlestick` |

## One focal element per diagram

Every ordinary diagram gets one darkest-ink focal element:

| Element | Paint | Stroke width |
|---|---|---|
| The focal stroke or fill | `var(--focal)` | `2` |
| Everything else | `--ill-*`, `--rule*`, `--muted-text` or `--subtlest-text` | 1-2 |

If more than one node feels important, the diagram is doing too much. Split it or demote the supporting nodes. `build.mjs --check-focal --strict` counts `var(--focal)` in ordinary SVGs and fails when a diagram exceeds the configured threshold.

## Token map and series encoding

| Role | Token |
|---|---|
| Paper / SVG background | `--paper` |
| Default ink | `--ink` |
| Focal node/path | `--focal` |
| Primary linework | `--ill-line` |
| Secondary label | `--ill-ink50` |
| Guide / axis | `--ill-guide` |
| Dashed guide | `--ill-guide-dashed` |
| Frame | `--ill-frame` |
| Primary fill | `--ill-fill`, `--ill-tone2` |
| Alternate fill | `--ill-fill-alt`, `--ill-tone1` |
| Deep fill / construction tone | `--ill-tone3`, `--ill-hatch` |
| Heatmap intensity | `--heat0` through `--heat4` |

Labels, chart numbers, figure identifiers, and technical callouts inside SVGs use Geist Mono at 11-13px when possible. Smaller labels are allowed only when the diagram geometry demands it.

Do not use color to distinguish series: the encodings are in [svg style § Separate series by tone, dash and marker](svg-style.md#separate-series-by-tone-dash-and-marker-never-hue). Put the focal series on top and draw it with stroke-width 2. For bars, combine fill tone and a small marker or direct label. For lines, combine stroke tone, dash pattern, and point marker. For heatmap-like intensity charts, use the warm mauve ramp `--heat0` through `--heat4`.

## Anti-patterns

| Anti-pattern | Symptom | Fix |
|---|---|---|
| Two focal elements | Multiple `--focal` nodes compete | Pick one, demote the rest |
| Hue series | Lines differ only by color | Use tone, dash, and marker |
| Mystery axis | Units or time anchors missing | Label the axis or remove it |
| Overlapping nodes | Semantic overlap is unclear | Move nodes apart or split the diagram |
| Decorative chart | It repeats the paragraph | Delete it |
| Caption echo | Caption restates the title | State the insight |

## Regenerate through the library refresh

The committed diagrams are maintained in place; `port-kami.mjs` re-ports from a Kami checkout into a scratch folder for comparison only. For shared CSS/font/token/runtime refreshes, use (unsandboxed):

```bash
node .agents/skills/vpk-html/scripts/build.mjs --refresh-library
node .agents/skills/vpk-html/scripts/build.mjs --check-templates
```

For advisory checks against finished documents:

```bash
node .agents/skills/vpk-html/scripts/build.mjs --check-focal <file> --strict
node .agents/skills/vpk-html/scripts/build.mjs --check-caption-echo <file>
```
