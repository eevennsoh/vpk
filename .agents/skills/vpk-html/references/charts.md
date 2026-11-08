# vpk-html Charts

Owner of data charts for [SKILL.md](../SKILL.md). Load when you draw a data chart.

This is the foundation and catalog for charts and data diagrams. Structural diagrams remain covered in `references/diagrams.md`.

## Charts take the paper look and stay grayscale

Charts follow the one paper look in [paper system](paper-system.md) § 4: an anchored chart uses the figure page (card, ring, corner furniture and a live readout), and inline charts share the code-block card.

| Wrong | → Right |
|---|---|
| A hex fill, gradient, filter or drop shadow in the SVG | → token-only grayscale from `--ill-*`, `--rule`, `--ink`, `--muted-text` and `--focal` |
| `--accent*` or `--link*` tokens inside a generated SVG | → the same grayscale tokens; accent belongs to the page, not the figure |
| Heat tokens on a plain bar or line | → `--heat0` to `--heat4` only for heatmap-like density or intensity |
| A new hue per series | → tone, dash, marker shape, stroke width, direct labels and layering |
| Several marks competing for emphasis | → one darkest-ink focal role when the chart has a primary argument |
| Proportional labels or `stroke-width="thin"` | → Geist Mono labels and numeric strokes within 0.5-2.5 |

## Render the static chart first

| Condition | → Required result |
|---|---|
| JavaScript disabled | → the full figure, data marks, direct labels, caption and fallback legend are visible |
| Reduced motion or print | → motion classes snap to the final state immediately |
| Tooltip or legend script fails | → nothing is lost: both are progressive enhancement only |
| Any external script, stylesheet, image or font | → none: artifacts stay single-file and offline |

## Animate with the shared chart utilities

Shared chart animation CSS comes from `scripts/shared.mjs` and is emitted into `styles.css` and every template’s shared identity block.

| Utility | Effect | Use on |
|---|---|---|
| `.vpk-chart-draw` | Stroke draw-in: sets `stroke-dasharray` and `stroke-dashoffset`, then animates the offset to `0` | Lines and paths; set `--vpk-draw-length` on the mark to a path/polyline length estimate |
| `.vpk-chart-grow` | Grow-in with `transform: scaleY`, `transform-box: fill-box`, `transform-origin: center bottom` | Bars and areas |
| `.vpk-chart-reveal` | Point or label reveal | Dots, markers, callouts and direct labels |
| `.vpk-chart-focal-pulse` | Short emphasis pulse | The single focal value, never a whole series |
| `style="--vpk-stagger-index: N;"` | Staggers any of the above | Any animated mark |

Reduced motion forces draw/grow/reveal/pulse utilities to their final visible state. Do not write chart-specific keyframes unless the shared vocabulary cannot express the behavior.

Prefer these utilities. SMIL is allowed for motion they can’t express, under `svg-style.md` § SMIL motion; 22 shipped chart primitives use it.

## Wire interaction through the inline chart runtime

Use the inline `data-vpk-chart-runtime` pattern from `scripts/shared.mjs`. It is dependency-free and copyable into single-file templates. `assets/diagrams/line-chart.html` is the worked scaffold: figure block, caption, direct value labels, focal mark, animation classes, tooltip hooks, legend toggles, `data-series` grouping and keyboard traversal.

| Element | Attributes | Runtime behavior |
|---|---|---|
| SVG root | `data-vpk-chart` | Scopes the runtime |
| Series group and each interactive point | `data-series="<id>"` | Groups marks for legend toggles |
| Focusable data point | `data-vpk-point`, `aria-label`, `data-tooltip` | Adds `tabindex="0"` and `role="button"` when absent; Arrow keys move between points, Home and End jump to the first and last |
| Legend button | `data-vpk-legend-toggle data-series="<id>" aria-pressed="true"` | Toggling dims the matching series with `.is-muted` |
| Tooltip | `role="tooltip"`, `.vpk-chart-tooltip` | Token-styled; appears on hover/focus only |

Keep direct labels in the SVG whenever they read better than a legend. Use legend toggles for series visibility, not as the only way to identify series.

## Catalog

| Chart | Communicates | Animation / interaction notes |
|---|---|---|
| `bar-chart` | Category magnitudes or grouped category comparisons. | Grow bars from the baseline; use direct labels before legend toggles. |
| `line-chart` | Time-series trend and focal turning point. | Uses the full chart scaffold: draw-in lines, reveal points, tooltip points, and legend toggles. |
| `donut-chart` | Part-to-whole share when there are six or fewer slices. | Reveal slices and labels; focal slice may pulse once. Keep center label static-readable. |
| `candlestick` | OHLC movement across ordered periods. | Reveal wick/body groups by period; tooltip each candle with open/high/low/close. |
| `waterfall` | Positive and negative contributions from a start value to an end value. | Grow bridge bars in order; tooltip each bridge contribution and keep total labels visible. |
| `box-plot` | Distribution spread, median, quartiles, whiskers, and outliers by group. | Draw whiskers and reveal boxes/points; tooltip group summary and labeled outliers. |
| `histogram` | Frequency distribution and right/left-tail shape. | Grow bins from the baseline; optional cumulative line draws over the static bars. |
| `ridgeline` | Multiple normalized distributions compared across rows. | Draw density curves row-by-row; tooltip each ridge with the named queue or cohort. |
| `beeswarm` | Individual observations clustered along one measure without hiding density. | Reveal points with stagger; tooltip each point and keep jitter non-semantic. |
| `dot-strip` | Individual observations on a single axis with light jitter. | Reveal dots with stagger; tooltip each observation and use the x-axis as the only measure. |
| `slope-chart` | Before/after rank or percentage change across named entities. | Draw each slope segment; tooltip endpoints and keep direct labels at both sides. |
| `dumbbell` | Current-versus-target gaps by category. | Draw connector strokes and reveal both endpoint dots; tooltip gap size. |
| `lollipop` | Ranked category magnitude where labels matter more than bar area. | Draw stems from the baseline and reveal heads; tooltip value and rank. |
| `bullet` | Actual value against target and qualitative bands. | Grow actual bars over static range bands; tooltip target gap. |
| `population-pyramid` | Mirrored demographic or cohort shares. | Grow left/right bars from the centerline; tooltip group, side, and share. |
| `annotated-line` | Time-series trend with labeled events or interventions. | Draw line, reveal points and annotations; tooltip data points while annotations stay static. |
| `index-chart` | Relative change from a baseline index of 100. | Draw indexed series with direct labels; tooltip percent change from baseline. |
| `small-multiples` | Repeated comparable trends sharing one scale. | Draw each mini-line with stagger; tooltips stay panel-local. |
| `band-chart` | Observed value against an expected or confidence range. | Grow/reveal the band and draw the observed line; tooltip range and observed value. |
| `stacked-area` | Changing composition of a total over time. | Grow/reveal stacked areas; legend toggles dim layers without breaking the static stack. |
| `calendar-heatmap` | Daily activity or contribution intensity over a calendar year. | Reveal cells by week; use `--heat0` to `--heat4` and tooltip date/value. |
| `matrix-heatmap` | Two-dimensional intensity or risk matrix. | Reveal cells by row/column; tooltip row, column, and score. |
| `waffle` | Part-to-whole share in fixed-count units. | Reveal units in order; legend toggles dim categories while totals remain visible. |
| `grid-choropleth` | Geographic-like regional intensity without map projection complexity. | Reveal grid cells; use heat tokens and tooltip region/status. |
| `treemap` | Hierarchical budget or volume share. | Reveal rectangles by hierarchy order; tooltip full path and value. |
| `sankey` | Flow volume between stages or regions. | Draw node and ribbon strokes; tooltip ribbons with source, target, and volume. |
| `arc-diagram` | Relationship intensity among ordered nodes. | Draw arcs with stagger; hover/focus can isolate connected nodes. |
| `scatter` | Relationship between two quantitative variables. | Reveal points; tooltip entity and x/y values, using marker shape/tone for groups. |
| `connected-scatter` | Trajectory through two measures across ordered periods. | Draw path segments in order; reveal points and arrow direction, tooltip period values. |
| `icicle` | Hierarchical composition across depth levels. | Reveal cells by depth; tooltip full hierarchy path and share. |
