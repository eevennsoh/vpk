#!/usr/bin/env node
/*
 * ads-tokens — the vpk-html colour layer, sourced from the VPK app's design tokens (ADS, @atlaskit/tokens).
 *
 * Every colour role in references/tokens.json names one ADS token below. The values are resolved from the
 * atlassian-light and atlassian-dark themes (the pair VPK's theme-wrapper passes to setGlobalTheme) and written
 * into tokens.json as plain hex, so documents stay offline single files: nothing links @atlaskit/tokens at
 * render time. ADS tokens that carry alpha (color.border, color.background.neutral) are flattened over
 * elevation.surface, the page they sit on, because the shared layer holds opaque values only.
 *
 *   node scripts/ads-tokens.mjs            # rewrite references/tokens.json from @atlaskit/tokens, then run
 *   node scripts/build.mjs --write-styles  # to mirror it into styles.css
 *   node scripts/ads-tokens.mjs --check    # exit 1 when tokens.json or iso/accent.mjs drifts from ADS
 *
 * Needs the VPK checkout's node_modules (a standalone skill install has none; tokens.json stays as committed).
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveRepoRoot } from "./repo-root.mjs";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS_FILE = path.join(SKILL_ROOT, "references", "tokens.json");

// role -> ADS token. Grouped as references/design.md § ADS token map lists them.
export const ADS_TOKEN_MAP = Object.freeze({
	// Page and surfaces: pure white in light (elevation.surface).
	paper: "elevation.surface",
	paperBackground: "elevation.surface",
	surfaceRaised: "elevation.surface.raised",
	surfaceOverlay: "elevation.surface.overlay",
	surfaceSunken: "elevation.surface.sunken",
	// Text.
	headline: "color.text",
	bodyText: "color.text",
	ink: "color.text",
	mutedText: "color.text.subtle",
	subtlestText: "color.text.subtlest",
	inverseText: "color.text.inverse",
	// Grayscale chrome.
	accent: "color.background.neutral.bold",
	accentSoft: "color.background.accent.gray.subtlest",
	accentSoftStrong: "color.background.accent.gray.subtler",
	focal: "color.text.accent.gray.bolder",
	// Figure ramp. Line art is drawn in the icon colour; the three face tones are one stepped neutral scale
	// (gray.subtlest rest / hovered / pressed), so tops (surface.raised) stay lightest in both themes.
	illLine: "color.icon",
	illTone1: "color.background.accent.gray.subtlest",
	illTone2: "color.background.accent.gray.subtlest.hovered",
	illTone3: "color.background.accent.gray.subtlest.pressed",
	illHatch: "color.background.accent.gray.subtler.hovered",
	illInk50: "color.icon.subtle",
	illGuide: "color.background.accent.gray.subtler.hovered",
	illGuideDashed: "color.background.accent.gray.subtler",
	illFrame: "color.border.accent.gray.subtle",
	illFill: "color.background.accent.gray.subtlest.hovered",
	illFillAlt: "color.background.accent.gray.subtlest",
	// Rules and controls.
	rule: "color.border",
	ruleStrong: "color.border.accent.gray.subtle",
	tableHeader: "color.background.neutral",
	chipBorder: "color.border",
	chipText: "color.text.subtlest",
	chipSelected: "color.text.subtle",
	pillBorder: "color.border",
	pillFill: "color.background.neutral.bold",
	pillFillHover: "color.background.neutral.bold.hovered",
	searchBorder: "color.border.input",
	searchFocus: "color.border.focused",
	metaText: "color.text.subtlest",
	reviewMeta: "color.text.subtlest",
	// Heatmap: a neutral ramp that darkens towards the ink in light and lightens towards it in dark.
	heat0: "color.background.accent.gray.subtlest",
	heat1: "color.background.accent.gray.subtler",
	heat2: "color.background.accent.gray.subtle",
	heat3: "color.background.accent.gray.bolder",
	heat4: "color.text.subtle",
	// Links stay ink (underlined on hover/focus); the editorial identity keeps chrome grayscale.
	link: "color.text",
	linkPressed: "color.text",
	selected: "color.background.selected",
	// Decorative accents (backgrounds of chips, cards and tags).
	accentLime: "color.background.accent.lime.subtler",
	accentPurple: "color.background.accent.purple.subtler",
	accentSaffron: "color.background.accent.yellow.subtler",
	accentOrange: "color.background.accent.orange.subtler",
	accentNavy: "color.text.accent.blue.bolder",
	accentGreen: "color.background.accent.green.subtler",
	accentRed: "color.text.accent.red",
	collectionSoftware: "color.background.accent.blue.subtler",
	collectionProduct: "color.background.accent.teal.subtler",
	collectionService: "color.background.accent.magenta.subtler",
	focusRing: "color.border.focused",
	// Code.
	codeSurface: "color.background.neutral",
	codeInk: "color.text",
	codeInverse: "color.text.inverse",
	syntaxKeyword: "color.text.code.keywords",
	syntaxIdentifier: "color.text",
	syntaxString: "color.text.code.strings",
	syntaxComment: "color.text.code.comments",
	syntaxLiteral: "color.text.code.numbers",
	mathHighlight: "color.background.accent.yellow.subtlest",
	// Status.
	success: "color.text.success",
	successTint: "color.background.success",
	warning: "color.text.warning",
	warningTint: "color.background.warning",
	danger: "color.text.danger",
	dangerTint: "color.background.danger",
	info: "color.text.information",
	infoTint: "color.background.information",
	diffAddText: "color.text.accent.green",
	diffDelText: "color.text.accent.red",
	diffAddTint: "color.background.accent.green.subtlest",
	diffDelTint: "color.background.accent.red.subtlest",
});

// The iso accent pair (scripts/iso/accent.mjs ACCENT, also read by the 3D prototype): the VPK app's bright orange
// (tailwind-theme orange-300, #FCA700) in both themes with dark ink on it (AA). ADS names that hue `orange.subtle` in light
// and `orange.bolder` in dark, so the map is per theme.
export const ADS_ACCENT_MAP = Object.freeze({
	light: Object.freeze({ accent: "color.background.accent.orange.subtle", ink: "color.text" }),
	dark: Object.freeze({ accent: "color.background.accent.orange.bolder", ink: "color.text.inverse" }),
});

// The iso spectrum rays (scripts/iso/accent.mjs RAY): ADS icon accents red, green and blue, the same token names in both themes.
// Only a ray (data-vpk-iso-role="ray") on an iso root marked data-vpk-iso-spectrum may paint them (check-html ISO_RAY_TOKENS).
export const ADS_RAY_MAP = Object.freeze({ r: "color.icon.accent.red", g: "color.icon.accent.green", b: "color.icon.accent.blue" });

const cssName = token => `--ds-${token.replace(/^(color|elevation)\./, "").replace(/\./g, "-")}`;

function themeFile(repoRoot, theme) {
	const require = createRequire(path.join(repoRoot, "package.json"));
	const pkg = path.dirname(require.resolve("@atlaskit/tokens/package.json"));
	return path.join(pkg, "dist", "esm", "artifacts", "themes", `atlassian-${theme}.js`);
}

// { light: { "--ds-surface": "#FFFFFF", ... }, dark: {...} } from the installed @atlaskit/tokens.
export async function loadAdsThemes(repoRoot = resolveRepoRoot()) {
	if (!repoRoot) throw new Error("ads-tokens needs the VPK checkout (node_modules/@atlaskit/tokens)");
	const out = {};
	for (const theme of ["light", "dark"]) {
		const css = (await import(pathToFileURL(themeFile(repoRoot, theme)).href)).default;
		out[theme] = Object.fromEntries([...css.matchAll(/(--ds-[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
	}
	return out;
}

const hexBytes = hex => [0, 1, 2, 3].map(i => (i === 3 && hex.length === 7 ? 255 : Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)));

// An alpha token flattened over the page surface it sits on; opaque tokens pass through. Lower-case #rrggbb.
function flatten(value, surface) {
	if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) throw new Error(`unexpected ADS value ${value}`);
	const [r, g, b, a] = hexBytes(value);
	const bg = hexBytes(surface);
	const k = a / 255;
	return `#${[r, g, b].map((c, i) => Math.round(c * k + bg[i] * (1 - k)).toString(16).padStart(2, "0")).join("")}`;
}

export function resolveAds(themes, map = ADS_TOKEN_MAP) {
	const out = {};
	for (const theme of ["light", "dark"]) {
		const t = themes[theme];
		const surface = t[cssName("elevation.surface")];
		out[theme] = {};
		for (const [role, token] of Object.entries(map[theme] ?? map)) {
			const value = t[cssName(token)];
			if (!value) throw new Error(`${theme}: ADS token ${token} (${cssName(token)}) not found`);
			out[theme][role] = flatten(value, surface);
		}
	}
	return out;
}

// illAccent / illAccentInk are the iso accent pair, and illRayR / G / B the spectrum rays. They are not in the shared styles.css block (only figures that paint the
// accent inline it, through iso/accent.mjs ACCENT_TOKENS_CSS), but tokens.json lists them so check-html accepts that block's
// declarations as token values and --check can hold accent.mjs to ADS.
export async function buildTokensJson(themes) {
	const resolved = resolveAds(themes);
	const accent = resolveAds(themes, ADS_ACCENT_MAP);
	const rays = resolveAds(themes, ADS_RAY_MAP);
	const pair = theme => ({ illAccent: accent[theme].accent, illAccentInk: accent[theme].ink, illRayR: rays[theme].r, illRayG: rays[theme].g, illRayB: rays[theme].b });
	const light = { ...resolved.light, ...pair("light"), shadow: "none" };
	const dark = { ...resolved.dark, ...pair("dark"), shadow: "none" };
	return { semantic: { ...light }, light, dark };
}

async function main() {
	const check = process.argv.includes("--check");
	const themes = await loadAdsThemes();
	const next = await buildTokensJson(themes);
	const text = `${JSON.stringify(next, null, "\t")}\n`;
	const accent = resolveAds(themes, ADS_ACCENT_MAP);
	const { ACCENT, RAY } = await import("./iso/accent.mjs");
	const rays = resolveAds(themes, ADS_RAY_MAP);
	const rayDrift = ["light", "dark"].flatMap(theme => ["r", "g", "b"].filter(k => RAY[theme][k].toLowerCase() !== rays[theme][k]).map(k => `iso/accent.mjs RAY.${theme}.${k} is ${RAY[theme][k]}, ADS ${ADS_RAY_MAP[k]} is ${rays[theme][k]}`));
	const accentDrift = ["light", "dark"].flatMap(theme => ["accent", "ink"].filter(k => ACCENT[theme][k].toLowerCase() !== accent[theme][k]).map(k => `iso/accent.mjs ACCENT.${theme}.${k} is ${ACCENT[theme][k]}, ADS ${ADS_ACCENT_MAP[theme][k]} is ${accent[theme][k]}`));
	if (check) {
		const current = fs.readFileSync(TOKENS_FILE, "utf8");
		const issues = [...(current === text ? [] : ["references/tokens.json differs from the ADS map (run: node scripts/ads-tokens.mjs)"]), ...accentDrift, ...rayDrift];
		for (const issue of issues) console.error(`FAIL: ${issue}`);
		if (issues.length) process.exit(1);
		console.log("OK: tokens.json and the iso accent match @atlaskit/tokens");
		return;
	}
	fs.writeFileSync(TOKENS_FILE, text);
	console.log(`wrote ${path.relative(process.cwd(), TOKENS_FILE)} from @atlaskit/tokens (${Object.keys(ADS_TOKEN_MAP).length} roles)`);
	for (const issue of accentDrift) console.warn(`WARN: ${issue}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
