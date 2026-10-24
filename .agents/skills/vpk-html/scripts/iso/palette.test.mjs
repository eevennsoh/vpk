import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { ALLOWED_FIGURE_TOKENS, collectSvgGrammarIssues, isAllowedFigureColorValue } from "../check-html.mjs";
import { ACCENT, ACCENT_FACES } from "./accent.mjs";
import { ACCENT_ISO_TOKENS, ALLOWED_ISO_TOKENS, DARK_MANUAL_OVERRIDES, DARK_TONE_OVERRIDES, isAccentPaint, isAllowedIsoPaint, ISO_PRESET, KIT_STYLE, presetFor, rolesFor, STROKE_SET, tokensOf } from "./palette.mjs";
import { ISO_CSS } from "./runtime-css.mjs";

const STYLES = fs.readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

function tokenBlock(selector) {
	const start = STYLES.indexOf(`${selector} {`);
	assert.ok(start >= 0, `styles.css has ${selector}`);
	const body = STYLES.slice(start, STYLES.indexOf("}", start));
	return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(match => [match[1], match[2]]));
}

// WCAG relative luminance of a #rrggbb value.
function luminance(hex) {
	const channel = index => {
		const c = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

const resolve = (value, tokens) => {
	const name = tokensOf(value)[0];
	assert.ok(tokens[name], `${name} resolves in styles.css`);
	return tokens[name];
};

// `var(--x)` or `color-mix(in srgb, var(--a) p%, var(--b))` to #rrggbb. For opaque colours a
// color-mix in srgb is a per-channel lerp of the encoded values.
function cssColor(value, tokens) {
	const mix = value.match(/^color-mix\(in srgb, var\((--[\w-]+)\) (\d+(?:\.\d+)?)%, var\((--[\w-]+)\)\)$/);
	if (!mix) return resolve(value, tokens);
	const [a, b, p] = [resolve(`var(${mix[1]})`, tokens), resolve(`var(${mix[3]})`, tokens), Number(mix[2]) / 100];
	const channel = (hex, index) => Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
	return `#${[0, 1, 2].map(index => Math.round(channel(a, index) * p + channel(b, index) * (1 - p)).toString(16).padStart(2, "0")).join("")}`;
}

const contrast = (a, b) => {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high + 0.05) / (low + 0.05);
};

function allPaints() {
	const preset = ISO_PRESET;
	const values = [];
	for (const focal of [false, true]) for (const active of [false, true]) {
		for (const role of Object.values(rolesFor({ focal, active }))) values.push(role.fill ?? role.stroke);
	}
	values.push(preset.edge, preset.crease, preset.mark, preset.guide.stroke, preset.leader, preset.label.fill, preset.focalEdge, preset.ink, preset.paper);
	return values;
}

test("every paint value passes check-html's figure grammar and the stricter iso allowlist", () => {
	for (const value of allPaints()) {
		assert.ok(isAllowedFigureColorValue(value), `${value} passes isAllowedFigureColorValue`);
		assert.ok(isAllowedIsoPaint(value), `${value} passes isAllowedIsoPaint`);
		assert.deepEqual(collectSvgGrammarIssues(`<svg aria-label="x"><style>path { fill: ${value}; }</style><path d="M0 0L1 1" stroke="${value}"/></svg>`), [], `${value} inside <svg><style>`);
	}
});

test("the kit has one style, manual: presetFor() and presetFor(\"manual\") are it, any other style throws naming it", () => {
	assert.equal(KIT_STYLE, "manual");
	assert.equal(presetFor(), ISO_PRESET);
	assert.equal(presetFor("manual"), ISO_PRESET);
	for (const style of ["hairline", "makingsoftware", "current", null, ""]) {
		assert.throws(() => presetFor(style), /the iso kit has one style: "manual"/, JSON.stringify(style));
	}
});

test("ALLOWED_ISO_TOKENS ⊂ ALLOWED_FIGURE_TOKENS, grayscale only (no status, heat, selected or code tokens)", () => {
	for (const token of ALLOWED_ISO_TOKENS) assert.ok(ALLOWED_FIGURE_TOKENS.has(token), token);
	for (const token of ALLOWED_ISO_TOKENS) assert.doesNotMatch(token, /success|warning|danger|info|heat|selected|code|math|accent|link/, token);
	assert.equal(isAllowedIsoPaint("var(--heat2)"), false);
	assert.equal(isAllowedIsoPaint("var(--danger)"), false);
	assert.equal(isAllowedIsoPaint("color-mix(in srgb, var(--ill-line) 45%, var(--selected))"), false);
	assert.equal(isAllowedIsoPaint("url(#vpk-iso-x-dots)", { localIds: new Set(["vpk-iso-x-dots"]) }), true);
	assert.equal(isAllowedIsoPaint("url(#elsewhere)", { localIds: new Set() }), false);
});

test("the accent pair is allowed apart from the grey tokens: alone, or leading a srgb mix towards a grey token", () => {
	assert.deepEqual([...ACCENT_ISO_TOKENS], ["--ill-accent", "--ill-accent-ink"]);
	for (const token of ACCENT_ISO_TOKENS) assert.ok(ALLOWED_FIGURE_TOKENS.has(token), `check-html allows ${token}`);
	for (const value of Object.values(ACCENT_FACES)) assert.ok(isAllowedIsoPaint(value) && isAllowedFigureColorValue(value), value);
	assert.equal(isAllowedIsoPaint("color-mix(in srgb, var(--ill-line) 50%, var(--ill-accent))"), false, "the accent leads the mix");
	assert.equal(isAllowedIsoPaint("color-mix(in srgb, var(--ill-accent) 50%, var(--heat2))"), false);
	assert.equal(isAccentPaint(ACCENT_FACES.dark), true);
	assert.equal(isAccentPaint(ISO_PRESET.tones.pale), false);
});

test("tone order: tops lightest and away sides darkest in both themes (K13)", () => {
	const light = tokenBlock(":root");
	const dark = { ...light, ...tokenBlock("[data-theme=\"dark\"]") };
	const tones = ISO_PRESET.tones;
	for (const [theme, tokens, overrides] of [["light", light, {}], ["dark", dark, DARK_TONE_OVERRIDES]]) {
		const L = Object.fromEntries(["top", "light", "dark"].map(tone => [tone, luminance(cssColor(overrides[tone] ?? tones[tone], tokens))]));
		assert.ok(L.top > L.light, `${theme}: top > light`);
		assert.ok(L.light > L.dark, `${theme}: light > dark`);
	}
});

// The plate's HTML text (chrome corners, the Gap label, the readout) is real 10.5-12px text on
// --paper, and so are the SVG part labels. --muted-text alone is 4.44:1 there in light, so it fails.
test("plate text and SVG labels clear WCAG 1.4.3's 4.5:1 on --paper in both themes", () => {
	const light = tokenBlock(":root");
	const dark = { ...light, ...tokenBlock("[data-theme=\"dark\"]") };
	const text = [...ISO_CSS.matchAll(/(?<![-\w])color:\s*([^;]+);/g)].map(match => match[1].trim());
	assert.ok(text.length >= 2, "the iso CSS colours the plate text and the readout");
	const labels = [ISO_PRESET.label.fill];
	for (const [theme, tokens] of [["light", light], ["dark", dark]]) {
		for (const value of [...text, ...labels]) {
			const ratio = contrast(cssColor(value, tokens), tokens["--paper"]);
			assert.ok(ratio >= 4.5, `${theme}: ${value} is ${ratio.toFixed(2)}:1 on --paper`);
		}
	}
});

test("DARK_TONE_OVERRIDES are the CSS dark rules, keyed by data-vpk-iso-tone", () => {
	for (const [tone, value] of Object.entries(DARK_TONE_OVERRIDES)) {
		// Also on a bare svg[data-vpk-iso] (the lightbox shows the SVG outside its plate).
		assert.ok(ISO_CSS.includes(`[data-theme="dark"] :where([data-vpk-engine="iso-kit"], svg[data-vpk-iso]) :where([data-vpk-iso-tone="${tone}"]) { fill: ${value}; }`), tone);
	}
	assert.deepEqual(DARK_TONE_OVERRIDES, { top: "var(--ill-tone2)", dark: "var(--surface-sunken)" });
});

test("stroke set and roles (R3, rule 4): 1 px edges, a 1.5 px paper ring, a 2 px darker-accent outline on the focal only", () => {
	assert.deepEqual([...STROKE_SET], [1, 1.5, 2]);
	assert.equal(rolesFor().edge.width, 1);
	assert.equal(rolesFor().guide.dash, "3 3");
	const focal = rolesFor({ focal: true });
	assert.deepEqual([focal.top.fill, focal.fill.fill, focal.shade.fill], [ACCENT_FACES.top, ACCENT_FACES.light, ACCENT_FACES.dark], "the focal part takes the three accent faces");
	assert.equal(focal.top.tone, "accent");
	assert.deepEqual(focal.edge, { stroke: ACCENT_FACES.edge, width: 2 }, "the focal outline is the darker accent, not ink");
	assert.deepEqual([focal.crease.stroke, focal.mark.stroke], [ACCENT_FACES.edge, ACCENT_FACES.edge], "no grey crease or mark on an orange face");
	assert.equal(ISO_PRESET.focalEdge, ACCENT_FACES.edge);
	const active = rolesFor({ active: true });
	assert.equal(active.top.fill, ISO_PRESET.tones.pale, "a new or active part takes the pale fill");
	assert.equal(active.top.tone, "pale");
	assert.equal(active.edge.width, 1, "without the outline");
});

// P5 (ws3-manual, rule 1): the tops are the lightest face in both themes, and the pale step (a part in state new or active)
// is one light step off them.
test("tones: tops lightest, then the light side, then the dark side, in both themes; the pale step leads the tops (rule 1)", () => {
	const light = tokenBlock(":root");
	const dark = { ...light, ...tokenBlock("[data-theme=\"dark\"]") };
	const { tones } = ISO_PRESET;
	// The pale fill is one light step off the tops (the 2 px ink outline carries the emphasis, rule 4), in both themes: in dark
	// the CSS takes tone 3 itself (DARK_MANUAL_OVERRIDES, keyed on data-vpk-iso-tone="pale").
	for (const [theme, tokens, overrides] of [["light", light, {}], ["dark", dark, { ...DARK_TONE_OVERRIDES, ...DARK_MANUAL_OVERRIDES }]]) {
		const face = tone => cssColor(overrides[tone] ?? tones[tone], tokens);
		const L = Object.fromEntries(["top", "light", "dark"].map(tone => [tone, luminance(face(tone))]));
		const paper = luminance(tokens["--paper"]);
		assert.ok(L.top > L.light && L.light > L.dark, `${theme}: top > light > dark (${JSON.stringify(L)})`);
		const focal = cssColor(overrides.pale ?? tones.pale, tokens);
		const lead = contrast(focal, face("top"));
		assert.ok(lead >= 1.15 && lead <= 1.5, `${theme}: the pale focal is one light step from the tops (${lead.toFixed(2)}:1), not a grey fill`);
		assert.ok(luminance(focal) < L.top && theme === "light" || luminance(focal) > L.top && theme === "dark", `${theme}: the pale fill steps away from the tops, towards the ink side (paper ${paper.toFixed(2)})`);
	}
});

test("the focal label keeps AA: --ill-accent-ink on --ill-accent is at least 4.5:1 in both themes", () => {
	for (const theme of ["light", "dark"]) {
		const [hi, lo] = [luminance(ACCENT[theme].accent), luminance(ACCENT[theme].ink)].sort((x, y) => y - x);
		const ratio = (hi + 0.05) / (lo + 0.05);
		assert.ok(ratio >= 4.5, `${theme}: ${ratio.toFixed(2)}:1`);
	}
});

// Cast shadows and the receded line work (iso/accent.mjs SHADOW, NEUTRAL_LINES): the shadow tone passes both paint grammars,
// carries no accent, and is paler than every line the kit draws, in both themes; edges recede but stay darker than the faces.
test("shadow tone: allowed by both grammars, never the accent, paler than every line, darker than the paper, both themes", async () => {
	const { SHADOW, NEUTRAL_LINES } = await import("./accent.mjs");
	const light = tokenBlock(":root");
	const dark = { ...light, ...tokenBlock("[data-theme=\"dark\"]") };
	for (const value of [SHADOW.TONE, SHADOW.DARK_TONE, ISO_PRESET.shadow]) {
		assert.ok(isAllowedIsoPaint(value) && isAllowedFigureColorValue(value), value);
		assert.equal(isAccentPaint(value), false, `${value} is not the accent`);
	}
	assert.equal(ISO_PRESET.shadow, SHADOW.TONE);
	assert.equal(ISO_PRESET.edge, NEUTRAL_LINES.edge);
	assert.equal(ISO_PRESET.crease, NEUTRAL_LINES.crease);
	assert.ok(ISO_CSS.includes(`[data-theme="dark"] [data-vpk-iso-shadows] { fill: ${SHADOW.DARK_TONE}; }`), "the dark theme takes DARK_TONE");
	const lines = [ISO_PRESET.edge, ISO_PRESET.crease, ISO_PRESET.guide.stroke, ISO_PRESET.leader];
	for (const [theme, tokens, shadow] of [["light", light, SHADOW.TONE], ["dark", dark, SHADOW.DARK_TONE]]) {
		const paper = tokens["--paper"];
		const s = cssColor(shadow, tokens);
		assert.ok(contrast(s, paper) > 1.05, `${theme}: the shadow shows on the paper (${contrast(s, paper).toFixed(2)}:1)`);
		for (const line of lines) assert.ok(contrast(cssColor(line, tokens), paper) > contrast(s, paper), `${theme}: ${line} reads stronger than the shadow`);
		const faces = [ISO_PRESET.tones.top, ISO_PRESET.tones.light, ISO_PRESET.tones.dark].map(face => cssColor(theme === "dark" ? DARK_TONE_OVERRIDES[Object.keys(ISO_PRESET.tones).find(k => ISO_PRESET.tones[k] === face)] ?? face : face, tokens));
		for (const face of faces) assert.ok(contrast(cssColor(ISO_PRESET.edge, tokens), face) >= 1.5, `${theme}: the receded edge still separates from the face ${face}`);
	}
});

// The entry hand-off (iso/accent.mjs ENTRY; the user's redline: no arrow, no ghost): the CSS hides waiting layers, accents the
// dropping one with the shared accent faces, fades the hand-off over ENTRY.HANDOFF_MS, and the rest class paints nothing.
test("entry hand-off CSS: hide, accent and hand-off rules from the shared constants; no ghost, cue or arrow rule", async () => {
	const { ISO_CSS } = await import("./runtime-css.mjs");
	const { ENTRY } = await import("./accent.mjs");
	for (let i = 0; i < 6; i++) assert.match(ISO_CSS, new RegExp(`\\.vpk-iso-h${i} :is\\(\\[data-vpk-iso-enter="${i}"\\], \\[data-vpk-iso-shadow-enter="${i}"\\]\\) \\{ visibility: hidden; \\}`));
	for (const fill of [ACCENT_FACES.top, ACCENT_FACES.light, ACCENT_FACES.dark]) assert.ok(ISO_CSS.includes(`{ fill: ${fill}; }`), fill);
	assert.ok(ISO_CSS.includes(`{ stroke: ${ACCENT_FACES.edge}; }`), "the dropping layer's line work takes the darker accent");
	assert.match(ISO_CSS, new RegExp(`transition: fill ${ENTRY.HANDOFF_MS}ms var\\(--ease-out\\), stroke ${ENTRY.HANDOFF_MS}ms`));
	assert.doesNotMatch(ISO_CSS, /vpk-iso-set|ghost|cue/, "the rest class paints nothing; no ghost or entry-arrow rule");
	assert.deepEqual(Object.keys(ENTRY).sort(), ["ACCENT_HOLD_MS", "DROP_Z", "HANDOFF_MS", "PART_MS", "STAGGER_MS", "STEP_CAMERA_MS", "TITLE_FADE_MS"]);
});

// Redline 2a: every edge, crease and mark of an accented part (focal, hovered or selected, mid-entry) is one darker shade of the
// accent (ACCENT_FACES.edge), never ink or the receded grey; the hover rule no longer paints the black --focal edge.
test("accent parts use the accent stroke: focal roles, hover and entry CSS; darker than the far face in both themes", () => {
	assert.ok(isAccentPaint(ACCENT_FACES.edge) && isAllowedIsoPaint(ACCENT_FACES.edge) && isAllowedFigureColorValue(ACCENT_FACES.edge), ACCENT_FACES.edge);
	const lines = ':is([data-vpk-iso-role="edge"], [data-vpk-iso-role="crease"], [data-vpk-iso-role="mark"])';
	assert.ok(ISO_CSS.includes('.is-active > [data-vpk-iso-role="edge"] { stroke: var(--ill-accent); stroke-width: 2; }'), "hovered or selected part: a 2 px accent outline");
	assert.doesNotMatch(ISO_CSS, /\.is-active > \[data-vpk-iso-role="(?:top|fill|shade)"\]/, "hover never fills the faces (large parts flooded orange)");
	assert.ok(ISO_CSS.includes(`[data-vpk-iso-enter="5"]) > * > ${lines} { stroke: ${ACCENT_FACES.edge}; }`), "dropping entry layer");
	assert.doesNotMatch(ISO_CSS, /\.is-active > \[data-vpk-iso-role="edge"\]\) \{ stroke: var\(--focal\)/, "no ink hover edge");
	assert.ok(ISO_CSS.includes('[data-vpk-iso-role="fill"])) > [data-vpk-iso-role="edge"] { stroke: var(--ill-accent); }'), "a faceless part keeps the accent itself");
	// The stroke is a darker shade of the same hue: below the far face's luminance (so it still draws the silhouette there).
	const light = tokenBlock(":root");
	const dark = { ...light, ...tokenBlock("[data-theme=\"dark\"]") };
	const mixL = (theme, tokens, value) => {
		const [, p, other] = /var\(--ill-accent\) (\d+)%, var\((--[\w-]+)\)/.exec(value);
		const accent = luminance(ACCENT[theme].accent);
		return { accent, p: Number(p) / 100, other: luminance(tokens[other]) };
	};
	for (const [theme, tokens] of [["light", light], ["dark", dark]]) {
		const e = mixL(theme, tokens, ACCENT_FACES.edge);
		const f = mixL(theme, tokens, ACCENT_FACES.dark);
		assert.ok(e.p < f.p, `${theme}: the stroke mixes in more line colour (${e.p}) than the far face (${f.p})`);
		if (theme === "light") assert.ok(e.other < e.accent, "light: the line colour is darker than the accent, so the stroke is a darker accent");
	}
});
