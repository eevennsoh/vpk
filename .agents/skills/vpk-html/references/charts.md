# vpk-html Charts

This is the Phase E foundation and catalog for charts and data diagrams.
Structural diagrams remain covered in `references/diagrams.md`.

## Identity

- Use token-only grayscale figure colors from `--ill-*`, `--rule`, `--ink`,
  `--muted-text`, and `--focal`.
- Use the warm intensity ramp `--heat0` through `--heat4` only for heatmap-like
  density or intensity.
- Distinguish multi-series charts by tone, dash, marker shape, stroke width,
  direct labels, and layering. Do not introduce hue.
- Use one darkest-ink focal role when a chart has a primary argument.
- SVG labels use Geist Mono. Stroke widths stay numeric and within 0.5-2.5.
- No raw hex, gradients, filters, drop shadows, `--accent*`, or `--link*`
  tokens inside generated SVGs.

## Static First

Every chart must be complete as static HTML/SVG:

- The full figure, data marks, direct labels, caption, and fallback legend are
  visible with JavaScript disabled.
- Motion classes may enhance first paint, but reduced motion and print must
  show the final state immediately.
- Tooltip and legend behavior are progressive enhancement only.
- Keep artifacts single-file and offline: no external scripts, stylesheets,
  images, or fonts.

## Animation Utilities

Shared chart animation CSS comes from `scripts/shared.mjs` and is emitted into
`styles.css` and every template's shared identity block.

- `.vpk-chart-draw`: stroke draw-in. Set `--vpk-draw-length` on the mark to a
  path/polyline length estimate. The utility sets `stroke-dasharray` and
  `stroke-dashoffset`, then animates the offset to `0`.
- `.vpk-chart-grow`: bar/area grow-in. Uses `transform: scaleY` with
  `transform-box: fill-box` and `transform-origin: center bottom`.
- `.vpk-chart-reveal`: point or label reveal. Use for dots, markers, callouts,
  and direct labels.
- `.vpk-chart-focal-pulse`: short emphasis pulse for the single focal value.
  Do not apply it to an entire series.
- Stagger any of the above with `style="--vpk-stagger-index: N;"`.

Reduced motion forces draw/grow/reveal/pulse utilities to their final visible
state. Do not write chart-specific keyframes unless the shared vocabulary cannot
express the behavior.

Prefer these utilities. SMIL is allowed for motion they can't express, under
`svg-style.md` § SMIL motion; 22 shipped chart primitives use it.

## Interaction Pattern

Use the inline `data-vpk-chart-runtime` pattern from `scripts/shared.mjs` or the
worked `assets/diagrams/line-chart.html` scaffold. It is dependency-free and
copyable into single-file templates.

Required conventions:

- Put `data-vpk-chart` on the SVG root.
- Put `data-series="<id>"` on each series group and on each interactive point.
- Put `data-vpk-point`, `aria-label`, and `data-tooltip` on focusable data
  points. The runtime adds `tabindex="0"` and `role="button"` when absent.
- Put `data-vpk-legend-toggle data-series="<id>" aria-pressed="true"` on each
  legend button. Toggling dims the matching series by adding `.is-muted`.
- Arrow keys move focus between data points; Home and End jump to the first and
  last point.
- Tooltips are `role="tooltip"`, token-styled with `.vpk-chart-tooltip`, and
  appear on hover/focus only.

Keep direct labels in the SVG whenever they read better than a legend. Use
legend toggles for series visibility, not as the only way to identify series.

## Worked Example

`assets/diagrams/line-chart.html` demonstrates the full scaffold: figure block,
caption, direct value labels, focal mark, animation classes, tooltip hooks,
legend toggles, `data-series` grouping, and keyboard traversal.

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
