const assert = require("node:assert/strict");
const { readdirSync, existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadDirectoryModule } = require(path.join(
	__dirname,
	"..",
	"..",
	"..",
	"app",
	"data",
	"directory",
	"__tests__",
	"load-directory-module.js",
));

let logoUsageModulePromise;

function loadLogoUsageModule() {
	logoUsageModulePromise ??= loadDirectoryModule(`
		export {
			THIRD_PARTY_BORDERLESS_LOGO_IDS,
			THIRD_PARTY_BORDERED_LOGO_IDS,
			THIRD_PARTY_DARK_GLYPH_LOGO_IDS,
			darkModeGlyphContrastClassName,
			darkModeGlyphContrastClassNameForSrc,
			resolveBrandLogoPresentation,
			resolveBrandLogoInsetScale,
			resolveAtlassianLogoBorder,
		} from "@/components/ui/data/logo-usage";
	`);
	return logoUsageModulePromise;
}

// components/ui/data -> repo root -> public/3p
const THIRD_PARTY_DIR = path.join(__dirname, "..", "..", "..", "public", "3p");

/**
 * The borderless ID list in logo-usage.json is a hand-maintained mirror of which
 * `/public/3p/<id>/` folders ship a `16-borderless.svg`. If a new 3P asset is
 * added (or a borderless variant added/removed) without updating the JSON, the
 * border treatment silently breaks — so assert the list equals on-disk reality.
 */
test("THIRD_PARTY_BORDERLESS_LOGO_IDS matches the folders shipping 16-borderless.svg", async () => {
	const { THIRD_PARTY_BORDERLESS_LOGO_IDS } = await loadLogoUsageModule();
	const onDisk = readdirSync(THIRD_PARTY_DIR, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.filter((entry) => existsSync(path.join(THIRD_PARTY_DIR, entry.name, "16-borderless.svg")))
		.map((entry) => entry.name)
		.sort();

	const inSet = [...THIRD_PARTY_BORDERLESS_LOGO_IDS].sort();

	assert.deepEqual(
		inSet,
		onDisk,
		"borderlessIds in components/ui/data/logo-usage.json is out of sync with " +
			"/public/3p. Update the JSON to match the folders containing a 16-borderless.svg.",
	);
});

test("2P partner logos always get a bordered tile, src unchanged", async () => {
	const { resolveBrandLogoPresentation } = await loadLogoUsageModule();

	assert.deepEqual(resolveBrandLogoPresentation("/2p/appfire.png"), {
		src: "/2p/appfire.png",
		hasBorder: true,
	});
});

test("white-tile 3P logos swap to the borderless variant and get a border", async () => {
	const { resolveBrandLogoPresentation } = await loadLogoUsageModule();

	assert.deepEqual(resolveBrandLogoPresentation("/3p/airtable/20.svg"), {
		src: "/3p/airtable/16-borderless.svg",
		hasBorder: true,
	});
});

test("solid-fill 3P logos render bare (no border), src unchanged", async () => {
	const { resolveBrandLogoPresentation } = await loadLogoUsageModule();

	assert.deepEqual(resolveBrandLogoPresentation("/3p/github/24.svg"), {
		src: "/3p/github/24.svg",
		hasBorder: false,
	});
});

/**
 * Transparent-glyph 3P marks paint no background of their own and ship no
 * `16-borderless.svg`, so before `borderedIds` existed they fell through to the
 * solid-fill branch and rendered bare — visibly inconsistent beside every
 * bordered package mark in the same grid. They must get a border, and unlike the
 * white-tile marks they keep their base src (there is no variant to swap to).
 */
test("transparent-glyph 3P logos get a bordered tile with src unchanged", async () => {
	const { resolveBrandLogoPresentation, THIRD_PARTY_BORDERED_LOGO_IDS } =
		await loadLogoUsageModule();

	assert.ok(THIRD_PARTY_BORDERED_LOGO_IDS.size > 0, "borderedIds must not be empty");

	for (const id of THIRD_PARTY_BORDERED_LOGO_IDS) {
		assert.deepEqual(
			resolveBrandLogoPresentation(`/3p/${id}/24.svg`),
			{ src: `/3p/${id}/24.svg`, hasBorder: true },
			`${id} must render inside a bordered tile from its base asset`,
		);
	}
});

/**
 * The two lists encode different facts (needs-a-border vs. has-a-variant-to-swap
 * -to) and must not overlap: `borderlessIds` is checked first, so an id in both
 * would silently resolve to a `16-borderless.svg` that `borderedIds` implies does
 * not exist.
 */
test("borderedIds is disjoint from borderlessIds and names no folder with a borderless variant", async () => {
	const { THIRD_PARTY_BORDERED_LOGO_IDS, THIRD_PARTY_BORDERLESS_LOGO_IDS } =
		await loadLogoUsageModule();

	for (const id of THIRD_PARTY_BORDERED_LOGO_IDS) {
		assert.ok(
			!THIRD_PARTY_BORDERLESS_LOGO_IDS.has(id),
			`${id} is in both borderedIds and borderlessIds — borderlessIds wins, so the bordered entry is dead`,
		);
		assert.ok(
			existsSync(path.join(THIRD_PARTY_DIR, id)),
			`${id} is in borderedIds but has no /public/3p/${id} folder`,
		);
		assert.ok(
			!existsSync(path.join(THIRD_PARTY_DIR, id, "16-borderless.svg")),
			`${id} ships a 16-borderless.svg — it belongs in borderlessIds, not borderedIds`,
		);
	}
});

test("unknown logo paths fall back to no border, src unchanged", async () => {
	const { resolveBrandLogoPresentation } = await loadLogoUsageModule();

	assert.deepEqual(resolveBrandLogoPresentation("/illustration/foo.svg"), {
		src: "/illustration/foo.svg",
		hasBorder: false,
	});
});

test("VS Code renders inset (20px glyph in a 24px box) via its inset scale", async () => {
	const { resolveBrandLogoInsetScale } = await loadLogoUsageModule();

	// 20 / 24 — the glyph is smaller than its box so it sits inset with padding.
	assert.equal(resolveBrandLogoInsetScale("/3p/vs-code/24.svg"), 20 / 24);
});

test("3P logos without an inset override render full-bleed (scale 1)", async () => {
	const { resolveBrandLogoInsetScale } = await loadLogoUsageModule();

	assert.equal(resolveBrandLogoInsetScale("/3p/github/24.svg"), 1);
	assert.equal(resolveBrandLogoInsetScale("/2p/appfire.png"), 1);
	assert.equal(resolveBrandLogoInsetScale("/illustration/foo.svg"), 1);
});

test("the Atlassian master logo (no solid background) gets a bordered tile", async () => {
	const { resolveAtlassianLogoBorder } = await loadLogoUsageModule();

	assert.equal(resolveAtlassianLogoBorder("atlassian"), true);
});

test("solid-background 1P product logos render bare (no border)", async () => {
	const { resolveAtlassianLogoBorder } = await loadLogoUsageModule();

	for (const name of ["jira", "confluence", "loom", "trello", "compass"]) {
		assert.equal(
			resolveAtlassianLogoBorder(name),
			false,
			`expected ${name} to render without a border`,
		);
	}
});

/* -- Dark-mode glyph contrast ------------------------------------- */

const AGENT_AVATAR_SURFACE_DARK = "#1F1F21"; // --ds-surface in the ADS dark theme

/** WCAG relative luminance for a #rgb / #rrggbb string. */
function relativeLuminance(hex) {
	let value = hex.replace("#", "");
	if (value.length === 3) {
		value = value
			.split("")
			.map((char) => char + char)
			.join("");
	}
	value = value.slice(0, 6);
	const [r, g, b] = [0, 2, 4]
		.map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
		.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex, against) {
	const a = relativeLuminance(hex);
	const b = relativeLuminance(against);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const NAMED_FILLS = { black: "#000", white: "#fff" };

/** The exact class list the shared helper emits for a near-black glyph. */
const EXPECTED_INVERT = "dark:invert [[data-color-mode=dark]_&]:invert";

/** Every literal fill color in a brand's shipped markup, package or local asset. */
function glyphFillColors(id, entrypoint) {
	const packageFile = entrypoint
		? path.join(
				path.dirname(require.resolve("@atlassian/logo-third-party/package.json")),
				"dist",
				"esm",
				"entry-points",
				`${entrypoint}.js`,
			)
		: null;
	const localFile = path.join(THIRD_PARTY_DIR, id, "24.svg");
	const file = packageFile && existsSync(packageFile) ? packageFile : localFile;
	if (!existsSync(file)) {
		return null;
	}

	return [
		...new Set(
			[...readFileSync(file, "utf8").matchAll(/fill="([^"]+)"/gu)]
				.map(([, fill]) => NAMED_FILLS[fill] ?? fill)
				.filter((fill) => fill.startsWith("#")),
		),
	];
}

/** brand id -> package entrypoint, read from the manifest source. */
function manifestEntrypoints() {
	const source = readFileSync(path.join(__dirname, "logo-third-party-data.ts"), "utf8");
	const entries = new Map();
	for (const line of source.split("\n")) {
		const name = line.match(/^\s*\{ name: "([a-z0-9-]+)"/u);
		if (!name) {
			continue;
		}
		entries.set(name[1], (line.match(/entrypoint: "([a-z0-9-]+)"/u) ?? [])[1]);
	}
	return entries;
}

/**
 * `darkGlyphIds` is DERIVED data, not a preference list: a mark belongs there
 * when its own shipped artwork is monochrome near-black. Recomputing it here is
 * what makes the list survive a package upgrade — 3.1.0 already recolored
 * several marks, and a silent recolor would otherwise leave an agent avatar
 * invisible (or needlessly inverted) with every test still green.
 *
 * The 1.5:1 threshold deliberately excludes genuinely colored dark marks
 * (Datadog purple 1.91, Box blue 2.88) — inverting those corrupts the brand hue.
 */
test("darkGlyphIds matches the marks that are actually near-black in the shipped artwork", async () => {
	const { THIRD_PARTY_DARK_GLYPH_LOGO_IDS } = await loadLogoUsageModule();
	const entrypoints = manifestEntrypoints();

	const shouldInvert = [];
	for (const [id, entrypoint] of entrypoints) {
		const fills = glyphFillColors(id, entrypoint);
		if (!fills || fills.length === 0) {
			continue;
		}
		const best = Math.max(...fills.map((fill) => contrastRatio(fill, AGENT_AVATAR_SURFACE_DARK)));
		if (best < 1.5) {
			shouldInvert.push(id);
		}
	}

	assert.deepEqual(
		[...THIRD_PARTY_DARK_GLYPH_LOGO_IDS].sort(),
		shouldInvert.sort(),
		"logo-usage.json darkGlyphIds is out of sync with the shipped brand artwork. " +
			"Recompute it: a mark belongs there when every fill scores below 1.5:1 against " +
			`${AGENT_AVATAR_SURFACE_DARK} (--ds-surface, dark theme).`,
	);
});

/**
 * The whole point of the list. Without inversion these sit near 1:1 on the dark
 * avatar backdrop — the hexagon renders visibly empty.
 */
test("every dark-glyph mark clears WCAG non-text contrast once inverted", async () => {
	const { THIRD_PARTY_DARK_GLYPH_LOGO_IDS } = await loadLogoUsageModule();
	const entrypoints = manifestEntrypoints();

	assert.ok(THIRD_PARTY_DARK_GLYPH_LOGO_IDS.size > 0, "darkGlyphIds must not be empty");

	for (const id of THIRD_PARTY_DARK_GLYPH_LOGO_IDS) {
		const fills = glyphFillColors(id, entrypoints.get(id));
		assert.ok(fills && fills.length > 0, `${id} is in darkGlyphIds but ships no measurable fill`);

		for (const fill of fills) {
			// CSS `invert` maps each channel c -> 255 - c.
			const inverted =
				"#" +
				[0, 2, 4]
					.map((offset) => {
						let value = fill.replace("#", "");
						if (value.length === 3) {
							value = value
								.split("")
								.map((char) => char + char)
								.join("");
						}
						return (255 - Number.parseInt(value.slice(offset, offset + 2), 16))
							.toString(16)
							.padStart(2, "0");
					})
					.join("");
			assert.ok(
				contrastRatio(inverted, AGENT_AVATAR_SURFACE_DARK) >= 3,
				`${id} fill ${fill} still fails 3:1 after inversion (${contrastRatio(inverted, AGENT_AVATAR_SURFACE_DARK).toFixed(2)}:1)`,
			);
		}
	}
});

test("darkModeGlyphContrastClassName inverts only the near-black marks", async () => {
	const { darkModeGlyphContrastClassName } = await loadLogoUsageModule();

	// Both selectors: theme-wrapper.tsx sets the `dark` class and the
	// `data-color-mode` attribute on the same root, and surfaces rendered outside
	// the wrapper may carry only the attribute. Same element, so one filter wins.
	assert.equal(darkModeGlyphContrastClassName("github"), EXPECTED_INVERT);
	assert.equal(darkModeGlyphContrastClassName("notion"), EXPECTED_INVERT);

	// Colored marks must keep their brand hue.
	for (const id of ["claude", "figma", "slack", "google-gemini", "datadog"]) {
		assert.equal(
			darkModeGlyphContrastClassName(id),
			undefined,
			`${id} is colored — inverting it would corrupt the brand hue`,
		);
	}

	assert.equal(darkModeGlyphContrastClassName(undefined), undefined);
});

/**
 * `CustomLogo` and `BrandLogoMark` only hold an asset path, and both draw the
 * mark on a themed `bg-surface` tile — so a near-black glyph is invisible there
 * for the same reason it is on an agent avatar.
 */
test("darkModeGlyphContrastClassNameForSrc inverts near-black 3P assets only", async () => {
	const { darkModeGlyphContrastClassNameForSrc } = await loadLogoUsageModule();

	assert.equal(darkModeGlyphContrastClassNameForSrc("/3p/github-copilot/24.svg"), EXPECTED_INVERT);
	assert.equal(darkModeGlyphContrastClassNameForSrc("/3p/github/16-borderless.svg"), EXPECTED_INVERT);

	// Colored marks keep their hue.
	assert.equal(darkModeGlyphContrastClassNameForSrc("/3p/vs-code/24.svg"), undefined);
	assert.equal(darkModeGlyphContrastClassNameForSrc("/3p/slack/24.svg"), undefined);

	// Non-3P paths never qualify: 2P marks are opaque PNGs we cannot measure.
	assert.equal(darkModeGlyphContrastClassNameForSrc("/2p/appfire.png"), undefined);
	assert.equal(darkModeGlyphContrastClassNameForSrc("/illustration/foo.svg"), undefined);
	assert.equal(darkModeGlyphContrastClassNameForSrc(undefined), undefined);
});

/**
 * Dark-mode glyph inversion is centralized in the logo components themselves
 * (`LogoThirdParty`, `CustomLogo`, `BrandLogoMark`). A caller that wraps one of
 * them in its own `dark:invert` double-inverts the glyph straight back to
 * near-black, because CSS filters on *nested* elements compose — which is
 * exactly how GitHub, Cursor and Codex avatars went invisible once.
 *
 * `filter` does not compound when two utilities land on the SAME element, which
 * is why this is easy to get wrong by inspection. Only nesting composes.
 */
const INVERT_OWNERS = new Set([
	// Declares the treatment.
	"components/ui/data/logo-usage.ts",
	// Apply it internally, on the glyph node.
	"components/ui/logo-third-party.tsx",
	"components/ui/logo.tsx",
	"components/ui/logo-mark.tsx",
	// Plain <img> for AI provider marks — not routed through a logo component,
	// so nothing else inverts it and there is nothing to compose with.
	"components/ui-custom/model-selector.tsx",
]);

const DARK_INVERT_UTILITY = /(?:^|\s)dark:(?:\[[^\]]*\]:)*invert(?:$|\s)/u;

/**
 * Whether a string literal is an applied Tailwind class list rather than prose
 * that merely names the utility. Docs and demo copy legitimately mention
 * `dark:invert` in a sentence; only a real class list is a bug.
 */
function isClassListContainingInvert(literal) {
	if (!DARK_INVERT_UTILITY.test(` ${literal} `)) {
		return false;
	}
	return literal
		.trim()
		.split(/\s+/u)
		.every((tokenText) => /^[a-z0-9][a-z0-9:_\-[\]&>./%#()!]*$/u.test(tokenText));
}

test("dark-mode glyph inversion stays centralized in the logo components", () => {
	const repoRoot = path.join(__dirname, "..", "..", "..");
	const roots = ["components", "app"];
	const offenders = [];

	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== "node_modules") {
					walk(full);
				}
				continue;
			}
			if (!/\.tsx?$/u.test(entry.name) || /\.test\.tsx?$/u.test(entry.name)) {
				continue;
			}
			const rel = path.relative(repoRoot, full);
			if (INVERT_OWNERS.has(rel)) {
				continue;
			}
			const source = readFileSync(full, "utf8");
			const literals = [...source.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/gu)].map(
				(match) => match[1] ?? match[2] ?? match[3] ?? "",
			);
			if (literals.some(isClassListContainingInvert)) {
				offenders.push(rel);
			}
		}
	};

	for (const root of roots) {
		walk(path.join(repoRoot, root));
	}

	assert.deepEqual(
		offenders.sort(),
		[],
		"These files apply their own dark-mode invert around a brand mark. The logo " +
			"components already invert near-black glyphs, and filters on nested elements " +
			"compose, so this double-inverts back to near-black. Remove the caller-level " +
			"class, or add the file to INVERT_OWNERS if it genuinely owns an un-nested mark.",
	);
});
