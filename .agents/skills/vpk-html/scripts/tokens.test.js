#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const TOKENS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "references", "tokens.json"), "utf8"));
const MIN_TEXT_CONTRAST = 4.5;
const MIN_MUTED_TEXT_CONTRAST = 4.6;

function parseColor(value) {
	const normalized = value.trim();
	const hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex) {
		const raw = hex[1].length === 3
			? hex[1].split("").map(char => char + char).join("")
			: hex[1];
		return {
			r: Number.parseInt(raw.slice(0, 2), 16),
			g: Number.parseInt(raw.slice(2, 4), 16),
			b: Number.parseInt(raw.slice(4, 6), 16),
			a: 1,
		};
	}

	const rgb = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+)\s*)?\)$/i);
	if (rgb) {
		return {
			r: Number(rgb[1]),
			g: Number(rgb[2]),
			b: Number(rgb[3]),
			a: rgb[4] === undefined ? 1 : Number(rgb[4]),
		};
	}

	throw new Error(`Unsupported color value: ${value}`);
}

function composite(foreground, background) {
	const fg = parseColor(foreground);
	const bg = parseColor(background);
	const alpha = fg.a;
	return {
		r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
		g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
		b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
		a: 1,
	};
}

function channelLuminance(value) {
	const srgb = value / 255;
	return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
	const parsed = typeof color === "string" ? parseColor(color) : color;
	return 0.2126 * channelLuminance(parsed.r)
		+ 0.7152 * channelLuminance(parsed.g)
		+ 0.0722 * channelLuminance(parsed.b);
}

function contrastRatio(foreground, background) {
	const fg = relativeLuminance(foreground);
	const bg = relativeLuminance(background);
	const lighter = Math.max(fg, bg);
	const darker = Math.min(fg, bg);
	return (lighter + 0.05) / (darker + 0.05);
}

function assertContrast(label, foreground, background, minimum = MIN_TEXT_CONTRAST) {
	const ratio = contrastRatio(foreground, background);
	assert.ok(
		ratio >= minimum,
		`${label} contrast ${ratio.toFixed(2)} is below ${minimum}: ${foreground} on ${typeof background === "string" ? background : JSON.stringify(background)}`,
	);
}

function assertDistinct(themeName, names) {
	for (let i = 0; i < names.length; i += 1) {
		for (let j = i + 1; j < names.length; j += 1) {
			assert.notEqual(
				TOKENS[themeName][names[i]].toLowerCase(),
				TOKENS[themeName][names[j]].toLowerCase(),
				`${themeName}.${names[i]} must be distinct from ${names[j]}`,
			);
		}
	}
}

test("semantic tokens mirror light tokens", () => {
	assert.deepEqual(TOKENS.semantic, TOKENS.light);
});

test("functional tokens meet contrast guarantees in both themes", () => {
	for (const themeName of ["light", "dark"]) {
		const theme = TOKENS[themeName];
		for (const role of ["syntaxKeyword", "syntaxIdentifier", "syntaxString", "syntaxComment", "syntaxLiteral"]) {
			assertContrast(`${themeName}.${role} on codeSurface`, theme[role], theme.codeSurface);
		}

		for (const role of ["success", "warning", "danger", "info"]) {
			assertContrast(`${themeName}.${role} on paper`, theme[role], theme.paper);
			assertContrast(`${themeName}.${role} on ${role}Tint`, theme[role], composite(theme[`${role}Tint`], theme.paper));
		}

		assertContrast(`${themeName}.diffAddText on diffAddTint`, theme.diffAddText, composite(theme.diffAddTint, theme.paper));
		assertContrast(`${themeName}.diffDelText on diffDelTint`, theme.diffDelText, composite(theme.diffDelTint, theme.paper));
		assertContrast(`${themeName}.bodyText on paper`, theme.bodyText, theme.paper);
		assertContrast(`${themeName}.bodyText on surfaceRaised`, theme.bodyText, theme.surfaceRaised);
		// B2 decision 16: figcaptions, anatomy hero text and iso captions are body-size muted text. The light
		// value was #706e6e (4.44:1 on paper, below 4.5); it must clear 4.6 so a rounding step cannot slip under AA.
		assertContrast(`${themeName}.mutedText on paper`, theme.mutedText, theme.paper, MIN_MUTED_TEXT_CONTRAST);
		assertContrast(`${themeName}.mutedText on surfaceRaised`, theme.mutedText, theme.surfaceRaised, MIN_MUTED_TEXT_CONTRAST);
		assertDistinct(themeName, ["accentSaffron", "accentGreen", "collectionSoftware", "ruleStrong"]);
	}
});

test("check-html still accepts the pre-decision-16 light --muted-text in documents built earlier (B2 decision 16)", async () => {
	const { collectColorTokenIssues } = await import(require("node:url").pathToFileURL(path.join(__dirname, "check-html.mjs")).href);
	const block = value => `<style>\n:root {\n\t--muted-text: ${value};\n}\n</style>`;
	assert.deepEqual(collectColorTokenIssues(block("#706e6e")), [], "an inline token block from before the change keeps validating");
	assert.deepEqual(collectColorTokenIssues(block(TOKENS.light.mutedText)), [], "the current value validates");
	assert.equal(collectColorTokenIssues(block("#706e6f")).length, 1, "any other literal is still a raw colour");
});

// Redline 2c: every colour role comes from the VPK app's ADS tokens (scripts/ads-tokens.mjs), with a white page in light.
test("tokens.json is the ADS map resolved from @atlaskit/tokens, white paper in light, and the iso accent matches it", async () => {
	const { ADS_TOKEN_MAP, buildTokensJson, loadAdsThemes } = await import(require("node:url").pathToFileURL(path.join(__dirname, "ads-tokens.mjs")).href);
	const { ACCENT } = await import(require("node:url").pathToFileURL(path.join(__dirname, "iso", "accent.mjs")).href);
	assert.equal(TOKENS.light.paper, "#ffffff", "light paper is ADS elevation.surface: pure white");
	assert.equal(ADS_TOKEN_MAP.paper, "elevation.surface");
	for (const theme of ["light", "dark"]) {
		assert.equal(ACCENT[theme].accent, TOKENS[theme].illAccent, `${theme} --ill-accent`);
		assert.equal(ACCENT[theme].ink, TOKENS[theme].illAccentInk, `${theme} --ill-accent-ink`);
		assertContrast(`${theme} accent ink on accent`, ACCENT[theme].ink, ACCENT[theme].accent);
	}
	const { resolveRepoRoot } = await import(require("node:url").pathToFileURL(path.join(__dirname, "repo-root.mjs")).href);
	if (!resolveRepoRoot()) return; // a standalone skill install has no @atlaskit/tokens; tokens.json stays as committed
	assert.deepEqual(await buildTokensJson(await loadAdsThemes()), TOKENS, "run: node scripts/ads-tokens.mjs");
});
