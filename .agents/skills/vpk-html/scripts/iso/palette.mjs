// iso/palette — role → token map for the kit's one style (manual), the grayscale allowlist, and the
// dark-theme tone overrides (illustrations.md § Tone map; integration K13/R5: tops lightest in
// both themes, top > near side > far side by luminance).
//
// Every paint value the kit emits comes from here. ALLOWED_ISO_TOKENS is a strict subset of
// check-html's ALLOWED_FIGURE_TOKENS with no status, heat, selected or code token (Decision 2). The accent pair
// (iso/accent.mjs) is kept apart in ACCENT_ISO_TOKENS: only the focal part, the hovered part, the active label chip and the
// focal leader dot may paint it (audit A3).

import { ACCENT_FACES, ACCENT_TOKENS, NEUTRAL_LINES, RAY_TOKENS, SHADOW } from "./accent.mjs";

export const ALLOWED_ISO_TOKENS = Object.freeze(new Set([
	"--paper",
	"--surface-raised",
	"--surface-sunken",
	"--ill-tone1",
	"--ill-tone2",
	"--ill-tone3",
	"--ill-line",
	"--ill-guide",
	"--ill-guide-dashed",
	"--ill-ink50",
	"--focal",
]));

export const ACCENT_ISO_TOKENS = Object.freeze(new Set(ACCENT_TOKENS));

// The spectrum ray tokens (iso/accent.mjs RAY): only a `line` annotation with `spectrum` paints them, as the stroke of a path (and
// the fill of its end dots) in data-vpk-iso-role="ray", on a root marked data-vpk-iso-spectrum (audit A1). Never a face or a mix.
export const RAY_ISO_TOKENS = Object.freeze(new Set(Object.values(RAY_TOKENS)));
export const rayPaint = key => `var(${RAY_TOKENS[key]})`;

// Glow (plan § 2 W): radial gradients, the only gradients the kit emits, each from the accent towards the raised surface (a glowing
// part's faces: opaque, so the part still covers what stands behind it) or towards transparent (a `glow` part, a soft flat halo).
// Their stops are the accent pair and grey tokens only (audit A1), so a glow reads as heat or light in the figure's one accent, not as
// a new hue. Ids are vpk-iso-<figure>-glow-<k>: check-html accepts an iso root's gradients only when every id matches that.
export const GLOW_STOPS = Object.freeze({
	body: Object.freeze([
		[0, "var(--ill-accent)"],
		[0.55, "color-mix(in srgb, var(--ill-accent) 60%, var(--surface-raised))"],
		[1, "color-mix(in srgb, var(--ill-accent) 22%, var(--surface-raised))"],
	]),
	halo: Object.freeze([
		[0, "color-mix(in srgb, var(--ill-accent) 90%, transparent)"],
		[0.45, "color-mix(in srgb, var(--ill-accent) 45%, transparent)"],
		// 1%, not 0%: the outer stop keeps the accent's hue at near-zero alpha, so the gradient (interpolated unpremultiplied) never
		// passes through transparent black, which drew a grey fringe round the halo.
		[1, "color-mix(in srgb, var(--ill-accent) 1%, transparent)"],
	]),
});

// CSS-only overrides under [data-theme="dark"], keyed by data-vpk-iso-tone. Light values are the
// presentation attributes; author CSS beats them, so dark tops stay the lightest face.
export const DARK_TONE_OVERRIDES = Object.freeze({
	top: "var(--ill-tone2)",
	dark: "var(--surface-sunken)",
});

// The pale fill of a part in state "new" or "active" is a light step, not a grey one (rule 4). Tone 3 pulled towards the
// raised surface is that step in the light theme; in dark the same mix lands on the tops, so the dark theme takes tone 3
// itself (the CSS rule in runtime-css, keyed on data-vpk-iso-tone="pale", the tone name only pale faces carry).
export const DARK_MANUAL_OVERRIDES = Object.freeze({ pale: "var(--ill-tone3)" });

// An `ink` part (part.tone "ink": black pins, dark slats, keys) is drawn in the ink: three mixes of --ill-line into the raised
// surface, so the top stays the lightest face (62%, 78%, 90% ink). The three faces count as one fill for A2 ("ink"). In dark
// --ill-line is the light ink, so the same mixes run the other way; DARK_INK_OVERRIDES swaps the top and the far side so the top
// is still the lightest face there (runtime-css, keyed on data-vpk-iso-tone).
const inkMix = percent => `color-mix(in srgb, var(--ill-line) ${percent}%, var(--surface-raised))`;
export const INK_TONES = Object.freeze({ top: inkMix(62), light: inkMix(78), dark: inkMix(90) });
export const INK_TONE_NAMES = Object.freeze({ top: "ink-top", light: "ink-light", dark: "ink-dark" });
export const DARK_INK_OVERRIDES = Object.freeze({ "ink-top": INK_TONES.dark, "ink-dark": INK_TONES.top });
// A recess (a well, slot or vent: detail type "recess") is one tone darker than the face it is cut into, never the shade: tone 3
// pulled 55% into the raised surface. In dark the same mix lands near the tops, so DARK_RECESS_OVERRIDES takes tone 1 pulled into
// the sunken surface (runtime-css, keyed on data-vpk-iso-tone="recess"). It counts as one fill for A2 ("recess").
export const RECESS_TONE = "color-mix(in srgb, var(--ill-tone3) 55%, var(--surface-raised))";
export const DARK_RECESS_OVERRIDES = Object.freeze({ recess: "color-mix(in srgb, var(--ill-tone1) 50%, var(--surface-sunken))" });
// Detail on an ink part is drawn lighter than its faces; face text on an ink part is the raised surface.
const INK_MARK = "color-mix(in srgb, var(--ill-line) 35%, var(--surface-raised))";
export const isInkFace = value => Object.values(INK_TONES).includes(String(value).trim().replace(/\s+/g, " "));
// A cutaway's section faces (detail role "cut", plan § 2 C): the cut material, flat, darker than every face of the shell (tone 3
// pulled 20% towards the ink). In dark the same mix lands near the light ink, so DARK_CUT_OVERRIDES takes the sunken surface pulled
// towards tone 3 (runtime-css, keyed on data-vpk-iso-tone="cut"). Counts as one fill for A2 ("cut").
export const CUT_TONE = "color-mix(in srgb, var(--ill-tone3) 80%, var(--ill-line))";
export const DARK_CUT_OVERRIDES = Object.freeze({ cut: "color-mix(in srgb, var(--ill-tone3) 40%, var(--surface-sunken))" });

// How a figure emphasises its focal parts (brief.emphasis, rule 4): "accent" (default) paints them with the three accent faces
// and a 2 px darker-accent outline; "ink" keeps their faces and draws a 2 px ink outline, with no accent anywhere in the figure
// (rest art, entry hand-off or hover); "none" has no focal part and no accent.
export const EMPHASES = Object.freeze(["accent", "ink", "none"]);

const mix = (token, percent) => `color-mix(in srgb, var(${token}) ${percent}%, var(--paper))`;

// The kit's one style. Briefs may omit `style` or say "manual"; anything else is an error (presetFor).
export const KIT_STYLE = "manual";

export const ISO_PRESET = Object.freeze({
	stroke: 1,
	activeStroke: 2,
	focalStroke: 2,
	radius: 2,
	bevel: 0,
	labels: true,
	placement: "near",
	shading: true,
	// Tops lightest in both themes (the dark overrides are keyed by the same tone names). `pale` (a part in state new or
	// active) is one light step from the tops (1.3:1 in light, 1.2:1 in dark through DARK_MANUAL_OVERRIDES). The focal part
	// takes the accent faces (`accent`, iso/accent.mjs ACCENT_FACES, shared with the 3D prototype) and a 2 px outline in the darker
	// accent (ACCENT_FACES.edge, also its creases and marks); the edges and creases of every other part recede towards the paper
	// (NEUTRAL_LINES), so the accent leads.
	tones: Object.freeze({ top: "var(--surface-raised)", light: "var(--ill-tone1)", dark: "var(--ill-tone2)", pale: "color-mix(in srgb, var(--ill-tone3) 60%, var(--surface-raised))" }),
	accent: ACCENT_FACES,
	// A flat ring (the Done-flash disc) is drawn as a stroked arc, never as a filled wedge.
	ringFill: false,
	edge: NEUTRAL_LINES.edge,
	crease: NEUTRAL_LINES.crease,
	// Cast shadows (SHADOW): one flat fill, no stroke, under every part.
	shadow: SHADOW.TONE,
	// A shadow on a part's top face (SHADOW.RECEIVED), clipped to the face; runtime-css repaints it on an accented top.
	received: SHADOW.RECEIVED,
	mark: mix("--ill-line", 45),
	guide: Object.freeze({ stroke: mix("--ill-line", 72), dash: "3 3" }),
	leader: mix("--ill-line", 72),
	// Labels are sentence case as the brief writes them (never forced to capitals), so mono needs no extra tracking.
	label: Object.freeze({ fill: "var(--ill-line)", size: 11, spacingEm: 0, family: "Geist Mono, monospace" }),
	focalEdge: ACCENT_FACES.edge,
	ink: "var(--ill-line)",
	paper: "var(--paper)",
	texture: null,
});

// `style` from a brief or CLI flag: absent or "manual" is the one style; anything else throws.
export function presetFor(style) {
	if (style === undefined || style === KIT_STYLE) return ISO_PRESET;
	throw new RangeError(`style ${JSON.stringify(style)} is not supported; the iso kit has one style: "${KIT_STYLE}"`);
}

// Fill/stroke per data-vpk-iso-role for one part. Under the default emphasis ("accent") the focal part takes the accent faces
// (top, near side `light`, far side `dark`) and the darker accent on its outline, creases and marks; under "ink" a focal part
// keeps its faces and takes a 2 px ink outline. A part in state "new"/"active" takes the pale fill and no outline; an `ink` part
// (tone "ink") the three ink faces with an ink edge. A `glow` part (tone "glow") paints all three faces with its glow gradient
// (`glow` is its url(#…) paint); the accent focal treatment wins over it.
export function rolesFor({ focal = false, active = false, tone: partTone = null, emphasis = "accent", glow = null } = {}) {
	const p = ISO_PRESET;
	const accent = focal && emphasis === "accent";
	const inkFocal = focal && emphasis === "ink";
	const ink = partTone === "ink";
	const glowing = partTone === "glow" && Boolean(glow) && !accent;
	const face = tone => (accent ? p.accent[tone] : glowing ? glow : active ? p.tones.pale : ink ? INK_TONES[tone] : p.tones[tone]);
	// Accent, pale, ink and glow faces carry their own tone name, so the dark-theme overrides (keyed top/dark/pale) never repaint them.
	const tone = name => (accent ? "accent" : glowing ? "glow" : active ? "pale" : ink ? INK_TONE_NAMES[name] : name);
	const edge = accent ? p.focalEdge : inkFocal || ink ? p.ink : p.edge;
	return Object.freeze({
		fill: { fill: face("light"), tone: tone("light") },
		top: { fill: face("top"), tone: tone("top") },
		shade: { fill: face("dark"), tone: tone("dark") },
		edge: { stroke: edge, width: accent || inkFocal ? p.focalStroke : p.stroke },
		crease: { stroke: accent ? p.focalEdge : p.crease, width: p.stroke },
		mark: { stroke: accent ? p.focalEdge : ink ? INK_MARK : p.mark, width: p.stroke },
		// Detail (detail.mjs): dots take the mark's paint as a fill; a recess the recess tone (the darker accent face on an accent
		// focal, the ink far side on an ink part); face text the leader ink (the ink on an accent focal, the raised surface on ink).
		dot: { fill: accent ? p.focalEdge : ink ? INK_MARK : p.mark },
		recess: accent ? { fill: p.accent.dark, tone: "accent" } : ink ? { fill: INK_TONES.dark, tone: INK_TONE_NAMES.dark } : { fill: RECESS_TONE, tone: "recess" },
		text: { fill: accent ? p.ink : ink ? "var(--surface-raised)" : p.leader },
		// A cutaway's section faces (role "cut"): one flat tone a step below the far side (the accent's far side on an accent focal).
		cut: accent ? { fill: p.accent.dark, tone: "accent" } : { fill: CUT_TONE, tone: "cut" },
		guide: { stroke: p.guide.stroke, width: p.stroke, dash: p.guide.dash },
		leader: { stroke: p.leader, width: p.stroke },
	});
}

// The stroke-width attribute values the kit may emit (A4): the 1 px edge, the numbered mark's paper ring (1.5) and the
// focal outline (2). Hover/selection widths come only from CSS.
export const STROKE_SET = Object.freeze([ISO_PRESET.stroke, 1.5, ISO_PRESET.focalStroke]);

export function tokensOf(value) {
	return [...String(value).matchAll(/var\((--[\w-]+)\)/g)].map(match => match[1]);
}

// A paint value the kit may emit: none, transparent, a local url(#…), var(--t) or a srgb mix of
// two allowed tokens (A1), where an accent token (ACCENT_ISO_TOKENS) may take the place of a grey token or lead a mix; a mix may
// also fade into `transparent` (the glow halo's stops). The ray tokens are not here: audit A1 admits them on rays only.
// Where accent may appear is audit A3's job. Stricter than check-html's isAllowedFigureColorValue.
export function isAllowedIsoPaint(value, { localIds = null } = {}) {
	const v = String(value).trim().replace(/\s+/g, " ");
	if (/^(none|transparent)$/i.test(v)) return true;
	const url = /^url\(#([\w-]+)\)$/.exec(v);
	if (url) return localIds ? localIds.has(url[1]) : true;
	const token = /^var\((--[\w-]+)\)$/.exec(v);
	if (token) return ALLOWED_ISO_TOKENS.has(token[1]) || ACCENT_ISO_TOKENS.has(token[1]);
	const blend = /^color-mix\(in srgb, var\((--[\w-]+)\) [\d.]+%, (?:var\((--[\w-]+)\)|transparent)\)$/i.exec(v);
	return Boolean(blend && (ALLOWED_ISO_TOKENS.has(blend[1]) || ACCENT_ISO_TOKENS.has(blend[1])) && (blend[2] === undefined || ALLOWED_ISO_TOKENS.has(blend[2])));
}

// True when a paint value uses an accent token (audit A3 limits where it may appear).
export function isAccentPaint(value) {
	return tokensOf(value).some(token => ACCENT_ISO_TOKENS.has(token));
}
