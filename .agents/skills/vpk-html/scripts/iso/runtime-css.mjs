// iso/runtime-css — the <style data-vpk-iso-css> text of the iso block (ws3 §4.8, C-iso-7).
// Tokens only, no raw colours; every rule sits under :where([data-vpk-engine="iso-kit"] …) or a
// .vpk-iso-* class, except the one legacy cursor rule for pre-R6 enhancement runtimes. The plate
// rule is the first deliberate exception: host figure rules (styles.css `figure { display: flex;
// align-items: center; text-align: center }`, and the templates' unlayered vpk-algebrica-v2
// `figure { display: flex !important; align-items: center !important; … }`) would otherwise shrink
// the stage to the SVG's 300 px intrinsic width. `!important` at (0,2,0) beats both, and the
// stretched children keep the stage full width even if a stronger host rule keeps the plate a
// flex column. The SVG rule stays at zero specificity, so a host may cap it: slides.html's
// `svg { max-height: 105mm; width: auto }` makes it narrower than the stage, and `margin-inline:
// auto` centres it there (the runtime's deck fit then sizes it to the slide). The reduced-motion rule is the other deliberate
// exception: styles.css sets `body[data-vpk-motion] * { transition-duration: 200ms !important }`
// under reduce, and with the initial `transition-property: all` that would glide every SMIL landing
// and runtime transform/d write for 200 ms. Same specificity, also !important, later in the
// document, so the iso figure lands in one step (R13). The rule must cover the plate and the whole
// subtree, not just the svg: this block sits at the end of <body>, so the plate's own box rules (padding,
// border, background) arrive after the first style pass, and under reduce styles.css would glide them
// in over 200 ms. At 390 px that narrowed the figure from 343 to 293 px for a moment (G2 J2). Both
// selectors have specificity (0,2,0), above styles.css's `body[data-vpk-motion] *` (0,1,1). Plate text (the Gap label
// inherits the plate colour; the readout is --ink) must clear WCAG 1.4.3's 4.5:1 on --paper:
// --muted-text alone is 4.44:1 in light, so the plate colour is --muted-text pulled 20% towards
// --ink (5.4:1 light, 9.8:1 dark). That is the anatomy plate's muted colour: ws4b tokens.mjs mixes
// towards --body-text, which has the same value as --ink in both themes.
// Narrow stages (G2 J4): the SVG scales with its box, so the 11-unit callout text renders near 4 px on a
// phone. At up to 720 px wide a figure that carries `data-vpk-iso-narrow` hides its callouts (the labels and the
// dimension notes, whose text moves to the legend; arrow annotations stay), shows the
// numbered tags and the HTML legend, and widens the svg by the crop the emitter wrote (`--vpk-iso-crop-w`,
// `--vpk-iso-crop-x`) inside the clipped stage, so the empty label gutters fall outside it and the scene is
// drawn about twice as large. The rules are scoped to `.vpk-iso-stage` (the lightbox clone keeps its
// labels), gated on `screen` (print keeps them), and keyed on the attribute (a figure built before tags
// existed keeps its labels). A viewport query, not a container query: containment on the stage would
// collapse a plate that a host lays out shrink-to-fit. The kit's one style draws no chrome corners: the frame holds the
// drawing, its labels and the readout only (illustrations.md § Style, rule 12).
// The figcaption keeps the house figcaption style. Author CSS
// beats presentation attributes, so the dark tone overrides and the active stroke win over the
// emitted fill/stroke attributes (integration K13: tops lightest in both themes). The stroke rule
// and the dark tone overrides also match a bare svg[data-vpk-iso]: the house lightbox shows a
// static figure's SVG outside its plate, and without them the zoom inverted the dark tone order
// (top darker than both sides) and lost the non-scaling strokes (round-4 verifier).
// Accent (iso/accent.mjs, shared with the 3D prototype): the hovered or selected part (.is-active) keeps its faces and takes a
// 2 px accent outline only (a faceless part, the ring or a gap, takes the accent on its stroke too): filling a whole part made
// large parts flood orange as the pointer crossed part boundaries; labels stay ink. The
// rules are (0,2,0) or more, so they beat the dark tone overrides (0,1,0) and the presentation attributes.
// Cast shadows (SHADOW): the emitted fill is the light tone (ink 12% into the paper); a dark page takes DARK_TONE, below the paper.
// A shadow received on a top is RECEIVED (DARK_RECEIVED in dark); on an accented top (the focal, .is-active, the dropping layer)
// it is RECEIVED_ACCENT, a deeper orange.
// Motion at rest (REST_MOTION): only while the runtime sets data-vpk-iso-rest on a stage (idle 3 s after the entrance or the last
// input, on screen, tab shown, entrance done, not reduced, not printing). The svg drifts DRIFT_PX on a Lissajous path (x through the
// `translate` property, y through `transform`, two periods) and the focal part bobs BOB_PX through `translate`, which composes
// with the runtime's transform attribute. Pure CSS animations: no frame callback runs. Screen and no-preference only.

// The entry hand-off (iso/accent.mjs ENTRY; motion.mjs layerClassAnimation): each layer group (g[data-vpk-iso-enter], and each
// g[data-vpk-iso-shadow-enter]) steps its own class with one discrete SMIL animation: vpk-iso-wait hides it until its layer
// starts dropping, vpk-iso-drop paints a dropping part group with the three accent faces and the darker accent line work (the
// current step) for ENTRY.ACCENT_HOLD_MS from its start, the same for every layer, and the rest value vpk-iso-set paints nothing,
// so each layer fades back to the neutral tone map over ENTRY.HANDOFF_MS at the same point of its own drop. One rule set serves
// any number of layers. The classes exist only while SMIL plays or after it landed: a static, reduced-motion or print render
// never gains one, and a landed or printed figure is the neutral art.

import { ACCENT_FACES, ENTRY, NEUTRAL_LINES, REST_MOTION as R, SHADOW } from "./accent.mjs";
import { DARK_CUT_OVERRIDES, DARK_INK_OVERRIDES, DARK_RECESS_OVERRIDES, DARK_TONE_OVERRIDES, ISO_PRESET } from "./palette.mjs";

// The sine in-out curve, so the drift and the bob read as a slow pendulum (the 3D sway is a sine too).
const SINE = "cubic-bezier(0.37, 0, 0.63, 1)";

const restCss = [
	`@keyframes vpk-iso-drift-x { 0%, 100% { translate: 0 0; } 25% { translate: ${R.DRIFT_PX}px 0; } 75% { translate: -${R.DRIFT_PX}px 0; } }`,
	`@keyframes vpk-iso-drift-y { 0%, 100% { transform: none; } 25% { transform: translateY(${R.DRIFT_PX}px); } 75% { transform: translateY(-${R.DRIFT_PX}px); } }`,
	`@keyframes vpk-iso-bob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -${R.BOB_PX}px; } }`,
	"@media screen and (prefers-reduced-motion: no-preference) {",
	`.vpk-iso-stage[data-vpk-iso-rest] > svg { animation: vpk-iso-drift-x ${R.DRIFT_X_MS}ms ${SINE} infinite, vpk-iso-drift-y ${R.DRIFT_Y_MS}ms ${SINE} infinite; }`,
	`.vpk-iso-stage[data-vpk-iso-rest] > svg [data-vpk-iso-focal] { animation: vpk-iso-bob ${R.BOB_PERIOD_MS}ms ${SINE} infinite; }`,
	`.vpk-iso-stage[data-vpk-iso-rest="paused"] > svg, .vpk-iso-stage[data-vpk-iso-rest="paused"] > svg [data-vpk-iso-focal] { animation-play-state: paused; }`,
	"}",
].join("\n");

// The line work of a part: its edge, creases and marks.
const LINES = ':is([data-vpk-iso-role="edge"], [data-vpk-iso-role="crease"], [data-vpk-iso-role="mark"])';

// The dropping entry layer's line work (edge, crease, mark) is the darker accent (ACCENT_FACES.edge), like the focal part's.
const accentCss = [
	`:where([data-vpk-engine="iso-kit"]) .is-active > [data-vpk-iso-role="edge"] { stroke: var(--ill-accent); stroke-width: 2; }`,
	`:where([data-vpk-engine="iso-kit"]) .is-active:not(:has(> [data-vpk-iso-role="top"], > [data-vpk-iso-role="fill"])) > [data-vpk-iso-role="edge"] { stroke: var(--ill-accent); }`,
	"[data-vpk-iso-arrow-for].is-active > path { stroke: var(--ill-accent); fill: var(--ill-accent); }",
].join("\n");

// Ink parts in dark (palette DARK_INK_OVERRIDES): the top and the far side swap, so the top stays the lightest face. Recesses in
// dark (DARK_RECESS_OVERRIDES) take tone 1 pulled into the sunken surface, so a well still reads darker than its face; a cutaway's
// section faces (DARK_CUT_OVERRIDES) the sunken surface pulled towards tone 3. Glow gradients and spectrum rays need no override:
// their stops and strokes are tokens that the theme switch already repaints.
const inkCss = Object.entries({ ...DARK_INK_OVERRIDES, ...DARK_RECESS_OVERRIDES, ...DARK_CUT_OVERRIDES }).map(([tone, fill]) => `[data-theme="dark"] :where([data-vpk-engine="iso-kit"], svg[data-vpk-iso]) :where([data-vpk-iso-tone="${tone}"]) { fill: ${fill}; }`).join("\n");

// A figure with emphasis "ink" or "none" (data-vpk-iso-emphasis on the root) paints no accent: the hovered or selected part and
// an owned arrow take the ink instead. (0,4,1) and later, so they beat the accent rules above and the blink rule.
const emphasisCss = [
	'[data-vpk-engine="iso-kit"] svg[data-vpk-iso-emphasis] .is-active > [data-vpk-iso-role="edge"] { stroke: var(--ill-line); }',
	'[data-vpk-engine="iso-kit"] svg[data-vpk-iso-emphasis] [data-vpk-iso-arrow-for].is-active > path { stroke: var(--ill-line); fill: var(--ill-line); }',
].join("\n");

const DROP = ".vpk-iso-drop[data-vpk-iso-enter] > *";
const entryCss = [
	// A layer that has not started dropping is hidden, with its shadows.
	":is([data-vpk-iso-enter], [data-vpk-iso-shadow-enter]).vpk-iso-wait { visibility: hidden; }",
	// The dropping layer takes the three accent faces (one rule per face role).
	...[["top", ACCENT_FACES.top], ["fill", ACCENT_FACES.light], ["shade", ACCENT_FACES.dark]].map(([role, fill]) => `${DROP} > [data-vpk-iso-role="${role}"] { fill: ${fill}; }`),
	// A shadow on its top darkens the accent (SHADOW.RECEIVED_ACCENT), never grey on orange.
	`${DROP} > [data-vpk-iso-received] { fill: ${SHADOW.RECEIVED_ACCENT}; }`,
	// Its line work takes the darker accent too, so no grey line sits on an orange face.
	`${DROP} > ${LINES} { stroke: ${ACCENT_FACES.edge}; }`,
	// A layer hands its accent back to the tone map over HANDOFF_MS, ACCENT_HOLD_MS after it starts (motion.mjs layerClassFrames).
	`[data-vpk-iso-enter][class] [data-vpk-iso-part] > * { transition: fill ${ENTRY.HANDOFF_MS}ms var(--ease-out), stroke ${ENTRY.HANDOFF_MS}ms var(--ease-out); }`,
].join("\n");

// The camera tour (iso/tour.mjs, tour-runtime.mjs; illustrations.md § Camera tour). The runtime eases the viewBox, so the CSS only
// paints: the current step's pieces (.is-tour) take the three accent faces and the darker accent line work, like the dropping
// entry layer; while a step shows (data-vpk-iso-touring on the stage) every other part is neutral, the brief's focal part
// included (its emitted accent faces go back to the tone map), and the leader labels, tags and dimension notes hide (zoomed up to
// TOUR_MAX_ZOOM they would crowd the frame; arrows and lines stay). Faces and lines hand over on a TITLE_FADE_MS fill transition;
// the step title restarts a grey-to-ink fade over the same time (two keyframe names, so the runtime never forces a reflow). An
// emphasis "ink" or "none" figure outlines the step's parts in ink instead of the accent. The focal part's rest bob stops while a
// step shows (that rule follows restCss, so it wins). Overview and print carry none of it.
const TOUR = "[data-vpk-iso-touring] > svg";
const ON = `${TOUR}:not([data-vpk-iso-emphasis]) .is-tour`;
const OFF = `${TOUR}:not([data-vpk-iso-emphasis]) [data-vpk-iso-focal]:not(.is-tour)`;
const FACES = [["top", "top"], ["fill", "light"], ["shade", "dark"]];
const tourCss = [
	...FACES.map(([role, face]) => `${ON} > [data-vpk-iso-role="${role}"] { fill: ${ACCENT_FACES[face]}; }`),
	`${ON} > [data-vpk-iso-received] { fill: ${SHADOW.RECEIVED_ACCENT}; }`,
	`${ON} > ${LINES} { stroke: ${ACCENT_FACES.edge}; }`,
	`${ON} > [data-vpk-iso-role="edge"] { stroke-width: 2; }`,
	`${TOUR} [data-vpk-iso-arrow-for].is-tour > path { stroke: var(--ill-accent); fill: var(--ill-accent); }`,
	`${TOUR}[data-vpk-iso-emphasis] .is-tour > [data-vpk-iso-role="edge"] { stroke: var(--ill-line); stroke-width: 2; }`,
	...FACES.map(([role, face]) => `${OFF} > [data-vpk-iso-role="${role}"] { fill: ${ISO_PRESET.tones[face]}; }`),
	...FACES.filter(([, face]) => DARK_TONE_OVERRIDES[face]).map(([role, face]) => `[data-theme="dark"] ${OFF} > [data-vpk-iso-role="${role}"] { fill: ${DARK_TONE_OVERRIDES[face]}; }`),
	`${OFF} > [data-vpk-iso-received] { fill: ${SHADOW.RECEIVED}; }`,
	`[data-theme="dark"] ${OFF} > [data-vpk-iso-received] { fill: ${SHADOW.DARK_RECEIVED}; }`,
	`${OFF} > :is([data-vpk-iso-role="edge"], [data-vpk-iso-role="mark"]) { stroke: ${NEUTRAL_LINES.edge}; stroke-width: 1; }`,
	`${OFF} > [data-vpk-iso-role="crease"] { stroke: ${NEUTRAL_LINES.crease}; }`,
	`${TOUR} [data-vpk-iso-arrow-for][data-vpk-iso-accent]:not(.is-tour) > path { stroke: ${ISO_PRESET.edge}; fill: ${ISO_PRESET.edge}; }`,
	`${TOUR} :is([data-vpk-iso-label-for], [data-vpk-iso-tag], [data-vpk-iso-annotation="dimension"], [data-vpk-iso-annotation="scale"]) { visibility: hidden; }`,
	`[data-vpk-iso-tour] [data-vpk-iso-part] > * { transition: fill ${ENTRY.TITLE_FADE_MS}ms var(--ease-out), stroke ${ENTRY.TITLE_FADE_MS}ms var(--ease-out); }`,
	...[1, 2].map(k => `@keyframes vpk-iso-tour-fade-${k} { from { color: var(--muted-text); } to { color: var(--ink); } }`),
	...[1, 2].map(k => `.vpk-iso-tour__title[data-vpk-iso-tour-fade="${k}"] { animation: vpk-iso-tour-fade-${k} ${ENTRY.TITLE_FADE_MS}ms var(--ease-out) both; }`),
	":where(.vpk-iso-tour__caption) { flex: 1 1 100%; min-width: 0; }",
	":where(.vpk-iso-tour__title) { margin: 0; font: 500 13px/1.4 var(--font-sans, var(--font-body)); color: var(--ink); }",
	":where(.vpk-iso-tour__text) { margin: 2px 0 0; max-width: 72ch; font: 13px/1.5 var(--font-body); color: color-mix(in srgb, var(--muted-text) 80%, var(--ink)); }",
	":where(.vpk-iso-tour) { display: inline-flex; align-items: center; gap: 4px; padding: 2px; border: 1px solid var(--rule); border-radius: 999px; }",
	":where(.vpk-iso-tour__go) { padding: 4px 12px; border: 0; border-radius: 999px; background: none; color: var(--ink); font: 12px/1.4 var(--font-mono); cursor: pointer; }",
	":where(.vpk-iso-tour__go:hover) { background: var(--surface-sunken); }",
	":where(.vpk-iso-tour__go[aria-disabled=\"true\"]) { color: var(--muted-text); background: none; cursor: default; }",
	":where(.vpk-iso-tour__go:focus-visible) { outline: 1.5px solid var(--focus-ring, var(--ink)); outline-offset: 1px; }",
	":where(.vpk-iso-tour__count) { min-width: 6ch; text-align: center; font: 12px/1.4 var(--font-numeric, var(--font-mono)); font-variant-numeric: tabular-nums; color: var(--muted-text); }",
].join("\n");

export const ISO_CSS = `:where([data-vpk-engine="iso-kit"] svg, svg[data-vpk-iso]) :where(path, line, polyline, polygon, ellipse, circle, rect) { vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
:where([data-vpk-engine="iso-kit"] [data-vpk-iso-role="edge"]) { transition: stroke var(--duration-fast, 100ms) var(--ease-out); }
[data-vpk-iso-weight="2"] path { stroke-width: 2; }
[data-theme="dark"] :where([data-vpk-engine="iso-kit"], svg[data-vpk-iso]) :where([data-vpk-iso-tone="top"]) { fill: var(--ill-tone2); }
[data-theme="dark"] :where([data-vpk-engine="iso-kit"], svg[data-vpk-iso]) :where([data-vpk-iso-tone="dark"]) { fill: var(--surface-sunken); }
[data-theme="dark"] :where([data-vpk-engine="iso-kit"], svg[data-vpk-iso]) :where([data-vpk-iso-tone="pale"]) { fill: var(--ill-tone3); }
[data-theme="dark"] [data-vpk-iso-shadows] { fill: ${SHADOW.DARK_TONE}; }
[data-theme="dark"] :where([data-vpk-iso-received]) { fill: ${SHADOW.DARK_RECEIVED}; }
${inkCss}
svg:not([data-vpk-iso-emphasis]) [data-vpk-iso-focal] > [data-vpk-iso-received] { fill: ${SHADOW.RECEIVED_ACCENT}; }
${accentCss}
${entryCss}
:where([data-vpk-engine="iso-kit"] .vpk-iso-stage) { position: relative; overflow: clip; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
:where([data-vpk-engine="iso-kit"] .vpk-iso-stage:focus-visible) { outline: 1.5px solid var(--focus-ring, var(--ink)); outline-offset: 4px; }
[data-vpk-engine="iso-kit"] .vpk-iso-stage[data-vpk-iso-behavior], [data-vpk-engine="iso-kit"] .vpk-iso-stage[data-vpk-iso-behavior] * { cursor: default; }
.vpk-iso-plate[data-vpk-engine] { display: block !important; text-align: start !important; }
.vpk-iso-plate > * { align-self: stretch; }
:where(.vpk-iso-plate) { position: relative; padding: 40px 28px 20px; border: 1px solid var(--rule); border-radius: 6px; background: var(--paper); color: color-mix(in srgb, var(--muted-text) 80%, var(--ink)); }
:where(.vpk-iso-plate svg[data-vpk-iso]) { display: block; width: 100%; height: auto; margin-inline: auto; }
:where(.vpk-iso-plate__foot) { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; margin-top: 12px; }
:where(.vpk-iso-readout) { min-width: 9ch; font: 12px/1.4 var(--font-numeric, var(--font-mono)); font-variant-numeric: tabular-nums; color: var(--ink); }
:where(.vpk-iso-control) { display: inline-flex; align-items: center; gap: 10px; font: 12px/1.4 var(--font-mono); }
:where(.vpk-iso-control input) { accent-color: var(--ink); }
svg[data-vpk-iso].vpk-iso-assembling :is([data-vpk-iso-label-for], [data-vpk-iso-tag], [data-vpk-iso-fade]) { visibility: hidden; }
:where(.vpk-iso-switch) { display: inline-flex; padding: 2px; border: 1px solid var(--rule); border-radius: 999px; }
:where(.vpk-iso-switch button) { padding: 4px 12px; border: 0; border-radius: 999px; background: none; color: var(--muted-text); font: 12px/1.4 var(--font-mono); cursor: pointer; }
:where(.vpk-iso-switch button[aria-pressed="true"]) { background: var(--surface-sunken); color: var(--ink); }
:where(.vpk-iso-switch button:focus-visible) { outline: 1.5px solid var(--focus-ring, var(--ink)); outline-offset: 1px; }
:where(.vpk-iso-live) { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
[data-vpk-engine="iso-kit"] svg[data-vpk-iso-blink] .is-active > [data-vpk-iso-role="edge"] { stroke: var(--ill-accent); stroke-width: 2; }
${emphasisCss}
:where(.vpk-iso-plate--manual) { padding: 0; border: 0; border-radius: 0; background: none; }
:where(.vpk-iso-frame) { padding: 20px 16px 12px; border: 1px solid var(--rule); background: var(--paper); }
.vpk-iso-plate--manual svg[data-vpk-iso] { max-width: var(--vpk-iso-w, none); }
:where(.vpk-iso-frame .vpk-iso-plate__foot) { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--rule); }
:where(.vpk-iso-plate--manual > .vpk-iso-plate__foot) { margin-top: 10px; }
@media print { :where(.vpk-iso-plate__foot) { display: none; } :where(.vpk-iso-plate) { break-inside: avoid; } :where(svg[data-vpk-iso]) .iso-face-text { display: none; } }
@media screen and (max-width: 720px) {
.vpk-iso-stage svg[data-vpk-iso-narrow] :is([data-vpk-iso-label-for], [data-vpk-iso-annotation="dimension"]) { display: none; }
.vpk-iso-stage svg[data-vpk-iso-narrow] [data-vpk-iso-tag] { display: inline; }
.vpk-iso-stage svg[data-vpk-iso-narrow] [data-vpk-iso-mark-disc] { transform: scale(var(--vpk-iso-mark-scale, 1.5)); transform-box: fill-box; transform-origin: center; }
.vpk-iso-stage svg[data-vpk-iso-narrow] [data-vpk-iso-tag-disc] { transform: scale(var(--vpk-iso-tag-scale, 1)); transform-box: fill-box; transform-origin: center; }
.vpk-iso-stage > svg[data-vpk-iso-narrow] { width: var(--vpk-iso-crop-w, 100%); max-width: none; margin-inline: var(--vpk-iso-crop-x, 0) 0; }
.vpk-iso-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 12px 0 0; padding: 0; list-style: none; font: 11px/1.4 var(--font-mono); letter-spacing: 0.08em; }
.vpk-iso-legend li { display: inline-flex; align-items: center; gap: 6px; font: 11px/1.4 var(--font-mono) !important; }
.vpk-iso-legend span { display: inline-grid; place-items: center; width: 18px; height: 18px; border: 1px solid currentColor; border-radius: 50%; font-size: 10px; letter-spacing: 0; line-height: 1 !important; }
}
${tourCss}
${restCss}
[data-vpk-iso-touring] > svg [data-vpk-iso-focal] { animation-name: none; }
@media (prefers-reduced-motion: reduce) { .vpk-iso-plate[data-vpk-engine="iso-kit"], .vpk-iso-plate[data-vpk-engine="iso-kit"] * { transition: none !important; } .vpk-iso-tour__title { animation-name: none !important; } }`;
