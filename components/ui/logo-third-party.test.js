const assert = require("node:assert/strict");
const { existsSync, readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadDirectoryModule } = require(path.join(
	__dirname,
	"..",
	"..",
	"app",
	"data",
	"directory",
	"__tests__",
	"load-directory-module.js",
));

let modulePromise;
const LOGO_THIRD_PARTY_SOURCE = require("node:fs").readFileSync(path.join(__dirname, "logo-third-party.tsx"), "utf8");
const LOGO_THIRD_PARTY_DEMO_SOURCE = require("node:fs").readFileSync(
	path.join(process.cwd(), "components", "website", "demos", "ui", "logo-third-party-demo.tsx"),
	"utf8",
);

function loadLogoThirdPartyData() {
	modulePromise ??= loadDirectoryModule(`
		export {
			THIRD_PARTY_LOGO_MANIFEST,
			THIRD_PARTY_LOGO_NAMES,
			THIRD_PARTY_LOGO_LABELS,
			THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES,
			THIRD_PARTY_LOGO_LOCAL_FALLBACKS,
			thirdPartyLogoSrc,
		} from "@/components/ui/data/logo-third-party-data";
	`);
	return modulePromise;
}

// components/ui -> repo root -> public/3p
const THIRD_PARTY_DIR = path.join(__dirname, "..", "..", "public", "3p");

test("THIRD_PARTY_LOGO_NAMES derives from the manifest", async () => {
	const { THIRD_PARTY_LOGO_MANIFEST, THIRD_PARTY_LOGO_NAMES } = await loadLogoThirdPartyData();

	assert.deepEqual(
		THIRD_PARTY_LOGO_NAMES,
		THIRD_PARTY_LOGO_MANIFEST.map((entry) => entry.name),
		"THIRD_PARTY_LOGO_NAMES must be derived from THIRD_PARTY_LOGO_MANIFEST",
	);
});

test("the owned local resolver preserves standard marks and selects the compact Codex glyph", async () => {
	const { thirdPartyLogoSrc } = await loadLogoThirdPartyData();
	assert.equal(thirdPartyLogoSrc("openai-codex"), "/3p/openai-codex/24.svg");
	assert.equal(thirdPartyLogoSrc("openai-codex", "glyph"), "/3p/openai-codex/glyph.svg");
	assert.equal(thirdPartyLogoSrc("cursor"), "/3p/cursor/24.svg");
	assert.match(LOGO_THIRD_PARTY_SOURCE, /artwork = "package"/u);
});

/**
 * Brand marks are now sourced primarily from `@atlassian/logo-third-party`, so
 * `THIRD_PARTY_LOGO_NAMES` is a superset of the on-disk `public/3p` folders. The
 * `THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES` subset is the contract with `public/3p`
 * (it types `thirdPartyLogoSrc`), so it MUST equal the folders exactly — a drift
 * would mean either a `thirdPartyLogoSrc` id with no asset (404) or a shipped
 * asset no helper can reach.
 */
test("THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES matches the public/3p folders", async () => {
	const { THIRD_PARTY_LOGO_MANIFEST, THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES } = await loadLogoThirdPartyData();

	const onDisk = readdirSync(THIRD_PARTY_DIR, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	const inList = [...THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES].sort();
	const inManifest = THIRD_PARTY_LOGO_MANIFEST
		.filter((entry) => entry.localAsset === true)
		.map((entry) => entry.name)
		.sort();

	assert.deepEqual(
		inList,
		inManifest,
		"THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES must be derived from manifest localAsset entries",
	);

	assert.deepEqual(
		inList,
		onDisk,
		"THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES in components/ui/data/logo-third-party-data.ts " +
			"is out of sync with /public/3p. Update the list to match the folders.",
	);
});

test("local fallback brands derive from manifest local-only assets with public folders", async () => {
	const {
		THIRD_PARTY_LOGO_MANIFEST,
		THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES,
		THIRD_PARTY_LOGO_LOCAL_FALLBACKS,
		THIRD_PARTY_LOGO_NAMES,
	} = await loadLogoThirdPartyData();

	const onDisk = new Set(
		readdirSync(THIRD_PARTY_DIR, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name),
	);
	const registered = new Set(THIRD_PARTY_LOGO_NAMES);
	const localAssets = new Set(THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES);
	const manifestFallbacks = THIRD_PARTY_LOGO_MANIFEST
		.filter((entry) => entry.localAsset === true && !entry.packageIcon)
		.map((entry) => entry.name)
		.sort();

	assert.deepEqual(
		[...THIRD_PARTY_LOGO_LOCAL_FALLBACKS].sort(),
		manifestFallbacks,
		"THIRD_PARTY_LOGO_LOCAL_FALLBACKS must be derived from manifest local-only entries",
	);

	for (const name of THIRD_PARTY_LOGO_LOCAL_FALLBACKS) {
		assert.ok(localAssets.has(name), `local-fallback brand "${name}" missing from local asset ids`);
		assert.ok(onDisk.has(name), `local-fallback brand "${name}" has no public/3p/${name} folder`);
		assert.ok(registered.has(name), `local-fallback brand "${name}" missing from THIRD_PARTY_LOGO_NAMES`);
	}
});

test("every brand name has a display label", async () => {
	const { THIRD_PARTY_LOGO_NAMES, THIRD_PARTY_LOGO_LABELS } = await loadLogoThirdPartyData();

	for (const name of THIRD_PARTY_LOGO_NAMES) {
		const label = THIRD_PARTY_LOGO_LABELS[name];
		assert.equal(typeof label, "string", `missing label for ${name}`);
		assert.ok(label.length > 0, `empty label for ${name}`);
	}
});

test("package-backed logo exports match the installed package entrypoints", async () => {
	const { THIRD_PARTY_LOGO_MANIFEST } = await loadLogoThirdPartyData();
	const packageRoot = path.dirname(require.resolve("@atlassian/logo-third-party/package.json"));

	for (const entry of THIRD_PARTY_LOGO_MANIFEST) {
		if (!entry.packageIcon) {
			continue;
		}

		const declaration = readFileSync(
			path.join(packageRoot, "dist", "types", "entry-points", `${entry.packageIcon.entrypoint}.d.ts`),
			"utf8",
		);
		assert.match(
			declaration,
			new RegExp(`export declare function ${entry.packageIcon.exportName}\\b`, "u"),
			`missing ${entry.packageIcon.exportName} from ${entry.packageIcon.entrypoint}`,
		);
	}
});

/**
 * Brands the upstream package ships that VPK deliberately does not surface.
 * `types` is the shared type entrypoint, not a brand; the rest are published
 * upstream but not yet wanted in the VPK catalog.
 *
 * This list exists so the drift guard below stays a *decision* record. Deleting
 * a name here and adding it to `THIRD_PARTY_LOGO_MANIFEST` is how a new brand
 * gets adopted.
 */
const INTENTIONALLY_UNSURFACED_ENTRYPOINTS = new Set([
	"types",
	"confluent",
	"coralogix",
	"crowdstrike-falcon",
	"google",
	"honeycomb",
	"lansweeper",
	"linkedin",
	"lovable",
	"lumos",
	"mabl",
	"microsoft-intune",
	"port",
	"replit",
	"webflow",
	"wiz",
]);

/**
 * The parity test above is one-directional: it proves every *declared* entry
 * exists upstream, but not that every *upstream* brand is declared. That gap is
 * how `codex` shipped in the package for a full major version without ever
 * appearing in the VPK set — nothing failed, it was simply invisible.
 *
 * This is the other direction. When a package upgrade adds a brand, this test
 * fails until someone either adopts it in the manifest or records the decision
 * to skip it above.
 */
test("every upstream package brand is either surfaced or explicitly skipped", async () => {
	const { THIRD_PARTY_LOGO_MANIFEST } = await loadLogoThirdPartyData();
	const packageRoot = path.dirname(require.resolve("@atlassian/logo-third-party/package.json"));

	const declared = new Set(
		THIRD_PARTY_LOGO_MANIFEST.filter((entry) => entry.packageIcon).map(
			(entry) => entry.packageIcon.entrypoint,
		),
	);
	const shipped = readdirSync(path.join(packageRoot, "dist", "types", "entry-points"))
		.filter((file) => file.endsWith(".d.ts"))
		.map((file) => file.replace(/\.d\.ts$/u, ""));

	const unaccounted = shipped
		.filter((entrypoint) => !declared.has(entrypoint))
		.filter((entrypoint) => !INTENTIONALLY_UNSURFACED_ENTRYPOINTS.has(entrypoint))
		.sort();

	assert.deepEqual(
		unaccounted,
		[],
		`@atlassian/logo-third-party ships brands VPK neither surfaces nor skips: ${unaccounted.join(", ")}. ` +
			"Add them to THIRD_PARTY_LOGO_MANIFEST (plus an import + module-map entry in " +
			"logo-third-party-icons.ts), or record the skip in INTENTIONALLY_UNSURFACED_ENTRYPOINTS.",
	);

	// Keep the skip list honest: a name that upstream removed should not linger.
	const stale = [...INTENTIONALLY_UNSURFACED_ENTRYPOINTS]
		.filter((entrypoint) => !shipped.includes(entrypoint))
		.sort();
	assert.deepEqual(
		stale,
		[],
		`INTENTIONALLY_UNSURFACED_ENTRYPOINTS lists entrypoints the package no longer ships: ${stale.join(", ")}`,
	);
});

/**
 * Every manifest `packageIcon` needs a matching static import + module-map entry
 * in `logo-third-party-icons.ts` — the package ships no root `exports` map, so
 * the binding cannot be resolved dynamically. A missing binding throws at
 * runtime from `resolvePackageIcon`, which a source-level check catches earlier.
 */
test("every declared package entrypoint has an icon-module binding", async () => {
	const { THIRD_PARTY_LOGO_MANIFEST } = await loadLogoThirdPartyData();
	const iconsSource = readFileSync(
		path.join(__dirname, "data", "logo-third-party-icons.ts"),
		"utf8",
	);
	const bound = new Set(
		[...iconsSource.matchAll(/entry-points\/([a-z0-9-]+)"/gu)].map(([, entrypoint]) => entrypoint),
	);

	const unbound = THIRD_PARTY_LOGO_MANIFEST.filter((entry) => entry.packageIcon)
		.map((entry) => entry.packageIcon.entrypoint)
		.filter((entrypoint) => !bound.has(entrypoint))
		.sort();

	assert.deepEqual(
		unbound,
		[],
		`manifest entrypoints with no import in logo-third-party-icons.ts: ${unbound.join(", ")}`,
	);
});

/**
 * Next.js resolves every static import at compile time. A leftover
 * `entry-points/<brand>` import that the package no longer ships is a
 * "Module not found" build error, even when the manifest no longer claims it.
 */
test("icon-module imports exist in the installed package", () => {
	const packageRoot = path.dirname(require.resolve("@atlassian/logo-third-party/package.json"));
	const iconsSource = readFileSync(
		path.join(__dirname, "data", "logo-third-party-icons.ts"),
		"utf8",
	);
	const imported = [...iconsSource.matchAll(/entry-points\/([a-z0-9-]+)"/gu)].map(
		([, entrypoint]) => entrypoint,
	);
	const missing = imported.filter(
		(entrypoint) =>
			!existsSync(path.join(packageRoot, "dist", "esm", "entry-points", `${entrypoint}.js`)),
	);

	assert.deepEqual(
		missing,
		[],
		`logo-third-party-icons.ts imports entrypoints the package does not ship: ${missing.join(", ")}`,
	);
});

test("thirdPartyLogoSrc resolves the canonical 24px asset path", async () => {
	const { thirdPartyLogoSrc } = await loadLogoThirdPartyData();

	assert.equal(thirdPartyLogoSrc("slack"), "/3p/slack/24.svg");
	assert.equal(thirdPartyLogoSrc("github"), "/3p/github/24.svg");
	assert.equal(
		thirdPartyLogoSrc("github-copilot"),
		"/3p/github-copilot/24.svg?v=transparent-bg",
	);
});

test("GitHub Copilot source SVGs have no painted background rectangle", () => {
	for (const size of [16, 20, 24, 32]) {
		const source = readFileSync(
			path.join(THIRD_PARTY_DIR, "github-copilot", `${size}.svg`),
			"utf8",
		);

		assert.doesNotMatch(source, /fill="white"/u);
	}
});

/**
 * `microsoft-copilot` shipped the GitHub Copilot glyph verbatim — same exported
 * `clip0_325_734` paths, differing only by a painted white `<rect>` — under a
 * second brand id, so the directory rendered the same mark twice under two
 * labels. It had no callsites and no upstream `@atlassian/logo-third-party`
 * entrypoint, so it was removed in favour of the curated `github-copilot` id.
 */
test("the duplicate microsoft-copilot brand id is not reintroduced", async () => {
	const { THIRD_PARTY_LOGO_NAMES } = await loadLogoThirdPartyData();

	assert.ok(
		!THIRD_PARTY_LOGO_NAMES.includes("microsoft-copilot"),
		"microsoft-copilot duplicated the github-copilot glyph — add a genuinely distinct mark or reuse github-copilot",
	);
	assert.ok(
		!readdirSync(THIRD_PARTY_DIR, { withFileTypes: true }).some(
			(entry) => entry.isDirectory() && entry.name === "microsoft-copilot",
		),
		"public/3p/microsoft-copilot must stay deleted",
	);
});

test("third-party logos use the shared tile size scale in tile demos", () => {
	assert.match(LOGO_THIRD_PARTY_SOURCE, /toThirdPartyLogoTileSize\(size\)/u);
	assert.match(LOGO_THIRD_PARTY_DEMO_SOURCE, /LOGO_TILE_SIZES/u);
	assert.doesNotMatch(LOGO_THIRD_PARTY_DEMO_SOURCE, /const BRAND_TILE_SIZES/u);
});

/**
 * `@atlaskit/tile` compiles the upstream `backgroundColor="white"` to a literal
 * `background-color:#fff` (see `_bfhku67f` in `tile.compiled.css`) rather than a
 * token, so the tile stays white in dark mode even though its sibling
 * `border-color:var(--ds-border)` themes correctly. `tileBackground` is the
 * escape hatch. The overrides MUST be `!important` — ADS `@compiled` CSS is
 * unlayered, and unlayered rules beat every layered Tailwind utility.
 */
test("tileBackground overrides target the Tile span with important themeable fills", () => {
	assert.match(
		LOGO_THIRD_PARTY_SOURCE,
		/surface: "\[&>span\]:bg-surface-raised!"/u,
		'tileBackground="surface" must map to the themeable --ds-surface-raised token, with `!` to beat unlayered @compiled CSS',
	);
	assert.match(
		LOGO_THIRD_PARTY_SOURCE,
		/transparent: "\[&>span\]:bg-transparent!"/u,
		'tileBackground="transparent" must clear the fill and leave the (already themeable) border',
	);
	assert.match(
		LOGO_THIRD_PARTY_SOURCE,
		/borderless: "\[&>span\]:bg-transparent! \[&>span\]:border-0!"/u,
		"borderless must still strip both the fill and the border",
	);

	// Every override has to win against unlayered @compiled CSS.
	const overrideBlock = LOGO_THIRD_PARTY_SOURCE.match(
		/const TILE_CHROME_OVERRIDES = \{[\s\S]*?\} as const;/u,
	);
	assert.ok(overrideBlock, "TILE_CHROME_OVERRIDES must exist");
	const utilities = [...overrideBlock[0].matchAll(/\[&>span\]:[\w-]+!?/gu)].map(([match]) => match);
	assert.ok(utilities.length > 0, "TILE_CHROME_OVERRIDES must declare Tile-span utilities");
	for (const utility of utilities) {
		assert.ok(
			utility.endsWith("!"),
			`${utility} must be marked important — ADS @compiled CSS is unlayered and beats layered Tailwind utilities`,
		);
	}
});

/**
 * `borderless` leaves no tile to fill, so it must short-circuit `tileBackground`
 * outright. Composing them would emit two `!important` `background-color` rules
 * on the same element, leaving the winner up to stylesheet order.
 */
test("borderless short-circuits tileBackground instead of composing with it", () => {
	assert.match(
		LOGO_THIRD_PARTY_SOURCE,
		/function tileChromeOverride\([\s\S]*?if \(borderless\) \{\s*return TILE_CHROME_OVERRIDES\.borderless;\s*\}/u,
		"borderless must return early so two important background rules never race",
	);
	assert.match(
		LOGO_THIRD_PARTY_SOURCE,
		/return tileBackground === "white" \? null : TILE_CHROME_OVERRIDES\[tileBackground\];/u,
		'tileBackground="white" must leave the upstream Tile untouched (no wrapper span)',
	);
});

test("tileBackground defaults to the upstream white tile", () => {
	assert.match(
		LOGO_THIRD_PARTY_SOURCE,
		/tileBackground = "white",/u,
		"the default must preserve upstream behaviour for existing callsites",
	);
});

/**
 * The `public/3p` fallback brands (GitHub Copilot, Gemini, Codex, VS Code,
 * Microsoft Copilot) now resolve to a bordered tile via `threeP.borderedIds`, so
 * `borderless` MUST reach `CustomLogo`. It previously did not — harmless only
 * because those brands rendered bare anyway. Callsites such as
 * `jira-work-item/**\/context-title-actions.tsx` pass `borderless` for exactly
 * these ids and would regress into an unwanted tile without this.
 */
test("borderless forwards to the public/3p CustomLogo fallback", () => {
	const fallback = LOGO_THIRD_PARTY_SOURCE.match(/<CustomLogo\b[\s\S]*?\/>/u);
	assert.ok(fallback, "the local-fallback CustomLogo branch must exist");
	assert.match(
		fallback[0],
		/borderless=\{borderless\}/u,
		"borderless must forward so bordered fallback brands can still opt out of the tile",
	);
});

/**
 * Monochrome near-black marks (GitHub #1d2022, Cursor #26251e, Codex #000) are
 * invisible once the upstream white tile is removed. Every treatment that
 * removes it must therefore invert those glyphs in dark mode — and the default
 * `"white"` tile must NOT, because the mark still sits on #fff there.
 */
test("dark-glyph marks invert only when the white tile is removed", () => {
	assert.match(
		LOGO_THIRD_PARTY_SOURCE,
		/const glyphContrast = chromeOverride \? darkModeGlyphContrastClassName\(name\) : undefined;/u,
		'a chrome override is exactly the set of treatments that drop the white tile; tileBackground="white" must never invert',
	);
	assert.match(
		LOGO_THIRD_PARTY_SOURCE,
		/cn\("inline-flex", chromeOverride, glyphContrast && DARK_GLYPH_INVERT\)/u,
		"the contrast class must ride along with the chrome override wrapper",
	);
});

/**
 * The invert MUST target the package's glyph span, not our wrapper. The DOM is
 * `wrapper > Tile span > glyph span > svg`, and TILE_CHROME_OVERRIDES paints the
 * Tile span at `[&>span]` — so `dark:invert` on the wrapper would flip
 * `bg-surface-raised` back to a near-white block and reinstate the exact
 * contrast failure it exists to fix.
 */
test("the dark-glyph invert targets the glyph span, never the tile fill", () => {
	assert.match(
		LOGO_THIRD_PARTY_SOURCE,
		/const DARK_GLYPH_INVERT =\s*\n?\s*"dark:\[&>span>span\]:invert \[\[data-color-mode=dark\]_&\]:\[&>span>span\]:invert";/u,
		"invert must reach past the Tile fill ([&>span]) to the glyph ([&>span>span]), under both theme selectors",
	);
	assert.doesNotMatch(
		LOGO_THIRD_PARTY_SOURCE,
		/"dark:invert"/u,
		"a bare dark:invert on the wrapper would flip the tile background too",
	);
});
