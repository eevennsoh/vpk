// iso/palette — role → token map for the kit's one style (manual), the grayscale allowlist, and the
// dark-theme tone overrides (illustrations.md § Tone map; integration K13/R5: tops lightest in
// both themes, top > near side > far side by luminance).
//
// Every paint value the kit emits comes from here. ALLOWED_ISO_TOKENS is a strict subset of
// check-html's ALLOWED_FIGURE_TOKENS with no status, heat, selected or code token (Decision 2). The accent pair
// (iso/accent.mjs) is kept apart in ACCENT_ISO_TOKENS: only the focal part, the hovered part, the active label chip and the
// focal leader dot may paint it (audit A3).

import { ACCENT_FACES, ACCENT_TOKENS, NEUTRAL_LINES, SHADOW } from "./accent.mjs";

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

// Fill/stroke per data-vpk-iso-role for one part. The focal part takes the accent faces (top, near side `light`, far side
// `dark`) and the darker accent on its outline, creases and marks; a part in state "new"/"active" takes the pale fill and no outline.
export function rolesFor({ focal = false, active = false } = {}) {
	const p = ISO_PRESET;
	const face = tone => (focal ? p.accent[tone] : active ? p.tones.pale : p.tones[tone]);
	// Accent and pale faces carry their own tone name, so the dark-theme overrides (keyed top/dark/pale) never repaint them.
	const tone = name => (focal ? "accent" : active ? "pale" : name);
	return Object.freeze({
		fill: { fill: face("light"), tone: tone("light") },
		top: { fill: face("top"), tone: tone("top") },
		shade: { fill: face("dark"), tone: tone("dark") },
		edge: { stroke: focal ? p.focalEdge : p.edge, width: focal ? p.focalStroke : p.stroke },
		crease: { stroke: focal ? p.focalEdge : p.crease, width: p.stroke },
		mark: { stroke: focal ? p.focalEdge : p.mark, width: p.stroke },
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
// two allowed tokens (A1), where an accent token (ACCENT_ISO_TOKENS) may take the place of a grey token or lead a mix.
// Where accent may appear is audit A3's job. Stricter than check-html's isAllowedFigureColorValue.
export function isAllowedIsoPaint(value, { localIds = null } = {}) {
	const v = String(value).trim().replace(/\s+/g, " ");
	if (/^(none|transparent)$/i.test(v)) return true;
	const url = /^url\(#([\w-]+)\)$/.exec(v);
	if (url) return localIds ? localIds.has(url[1]) : true;
	const token = /^var\((--[\w-]+)\)$/.exec(v);
	if (token) return ALLOWED_ISO_TOKENS.has(token[1]) || ACCENT_ISO_TOKENS.has(token[1]);
	const blend = /^color-mix\(in srgb, var\((--[\w-]+)\) [\d.]+%, var\((--[\w-]+)\)\)$/i.exec(v);
	return Boolean(blend && (ALLOWED_ISO_TOKENS.has(blend[1]) || ACCENT_ISO_TOKENS.has(blend[1])) && ALLOWED_ISO_TOKENS.has(blend[2]));
}

// True when a paint value uses an accent token (audit A3 limits where it may appear).
export function isAccentPaint(value) {
	return tokensOf(value).some(token => ACCENT_ISO_TOKENS.has(token));
}
