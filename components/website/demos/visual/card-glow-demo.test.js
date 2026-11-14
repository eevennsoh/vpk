const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");

const ROOT = path.join(__dirname, "../../../..");
const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "card-glow-demo.tsx"), "utf8");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const COMPONENTS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/component-manifest.ts"), "utf8");
const MANIFEST_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/component-manifest.ts"), "utf8");
const NAV_UTILS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/nav-utils.ts"), "utf8");
const DETAILS_SOURCE = readDetailCategorySource("visual");

test("Card Glow is registered as a top-level visual component", () => {
	assert.match(REGISTRY_SOURCE, /"card-glow": dynamic\(\(\) => import\("\.\/demos\/visual\/card-glow-demo"\)/);
	assert.ok(COMPONENTS_SOURCE.includes('visualComponent("card-glow", "Card Glow", "@/components/website/demos/visual/card-glow-demo")'));
	assert.ok(MANIFEST_SOURCE.includes('visualComponent("card-glow", "Card Glow", "@/components/website/demos/visual/card-glow-demo")'));
	assert.match(DETAILS_SOURCE, /(?:"card-glow"): \{/);

	const shadersStart = NAV_UTILS_SOURCE.indexOf("shaders: [");
	const shadersEnd = NAV_UTILS_SOURCE.indexOf("],", shadersStart);
	assert.notEqual(shadersStart, -1);
	assert.notEqual(shadersEnd, -1);
	assert.doesNotMatch(NAV_UTILS_SOURCE.slice(shadersStart, shadersEnd), /"card-glow"/);
});

test("Card Glow exposes CodePen-equivalent defaults and GUI controls", () => {
	for (const expected of [
		"export interface CardGlowConfig",
		"export const CARD_GLOW_DEFAULT_CONFIG",
		"theme: \"light\"",
		"iconBlur: 28",
		"iconSaturate: 5",
		"iconBrightness: 1.3",
		"iconContrast: 1.4",
		"iconScale: 3.4",
		"iconOpacity: 0.25",
		"borderSpread: 120",
		"borderWidth: 1",
		"borderBlur: 0",
		"borderSaturate: 4.2",
		"borderBrightness: 2.5",
		"borderContrast: 2.5",
		"exclude: false",
		"css: true",
		"label=\"blur\"",
		"label=\"saturate\"",
		"label=\"brightness\"",
		"label=\"contrast\"",
		"label=\"scale\"",
		"label=\"opacity\"",
		"label=\"spread\"",
		"label=\"width\"",
		"label=\"exclude\"",
		"label=\"css\"",
		"label=\"theme\"",
	]) {
		assert.ok(DEMO_SOURCE.includes(expected), expected);
	}
});

test("Card Glow uses the Studio Insights bento tile data locally", () => {
	for (const expected of [
		"Customer Insights",
		"Jira Theme Analyzer",
		"Transcript Insights Reporter",
		"Meeting Insights",
		"Trend Spotter",
		"/avatar-agent-new/blue/customer-insight.svg",
		"/avatar-agent-new/lime/auto-review.svg",
		"/avatar-agent-new/orange/default.svg",
		"/avatar-agent-new/purple/product-requirements.svg",
		"/avatar-agent-new/yellow/comms-drafter.svg",
		"accentColor: \"#6A9A23\"",
		"accentColor: \"#FFC400\"",
		"auto-rows-[144px]",
		"lg:grid-cols-5",
	]) {
		assert.ok(DEMO_SOURCE.includes(expected), expected);
	}

	assert.doesNotMatch(DEMO_SOURCE, /HOME_STARTER_VIEWS/);
	assert.doesNotMatch(DEMO_SOURCE, /components\/projects\/studio\/components\/rovo-app-shell/);
});

test("Card Glow tracks pointer position from each tile center", () => {
	assert.match(DEMO_SOURCE, /const centerX = rect\.left \+ rect\.width \/ 2/);
	assert.match(DEMO_SOURCE, /const centerY = rect\.top \+ rect\.height \/ 2/);
	assert.match(DEMO_SOURCE, /const normalizedX = relativeX \/ \(rect\.width \/ 2\)/);
	assert.match(DEMO_SOURCE, /const normalizedY = relativeY \/ \(rect\.height \/ 2\)/);
	assert.match(DEMO_SOURCE, /--card-glow-pointer-x", normalizedX\.toFixed\(3\)/);
	assert.match(DEMO_SOURCE, /--card-glow-pointer-y", normalizedY\.toFixed\(3\)/);
	assert.match(DEMO_SOURCE, /resetTilePointer/);
	// Jank regression: never CSS-transition the per-frame pointer variables.
	// Interpolating --card-glow-pointer-x/y forces the radial-gradient (and the
	// backdrop-filtered ring that reads it) to re-paint every frame between moves,
	// which is what made the demo janky vs the snap-to-pointer Studio landing.
	assert.doesNotMatch(DEMO_SOURCE, /transition-\[[^\]]*--card-glow-pointer/);
});

test("Card Glow duplicates avatars for the glow and renders a masked border ring", () => {
	assert.match(DEMO_SOURCE, /import \{ Avatar, AvatarFallback, AvatarImage \} from "@\/components\/ui\/avatar";/);
	assert.match(DEMO_SOURCE, /getCardGlowFilter/);
	assert.match(DEMO_SOURCE, /url\(#\$\{filterId\}\)/);
	assert.match(DEMO_SOURCE, /<feGaussianBlur in="SourceGraphic" stdDeviation=\{config\.iconBlur\}/);
	assert.match(DEMO_SOURCE, /calc\(var\(--card-glow-pointer-x, -10\) \* 50cqi\)/);
	assert.match(DEMO_SOURCE, /scale: "var\(--card-glow-icon-scale\)"/);
	assert.match(DEMO_SOURCE, /opacity-\[var\(--card-glow-icon-opacity\)\]/);
	assert.match(DEMO_SOURCE, /group-hover\/card-glow:opacity-\[var\(--card-glow-icon-opacity\)\]/);
	assert.match(DEMO_SOURCE, /const CARD_GLOW_THEME_STYLES: Record<CardGlowTheme, CardGlowThemeStyles> = \{/);
	assert.match(DEMO_SOURCE, /const borderGlowStyle: CSSProperties = \{/);
	assert.match(DEMO_SOURCE, /backdropFilter: borderFilter/);
	assert.match(DEMO_SOURCE, /circle at /);
	assert.match(DEMO_SOURCE, /var\(--card-glow-tile-accent\) 0 calc\(var\(--card-glow-border-core\) \* 1px\)/);
	// Jank regression: the gradient stop uses the accent directly (like Studio),
	// not a per-frame color-mix() that re-evaluates as the gradient repaints.
	assert.doesNotMatch(DEMO_SOURCE, /color-mix/);
	assert.match(DEMO_SOURCE, /"--card-glow-border-spread": config\.borderSpread/);
	assert.match(DEMO_SOURCE, /"--card-glow-border-core": Math\.max\(1, config\.borderSpread \* 0\.3\)/);
	assert.match(DEMO_SOURCE, /transparent calc\(var\(--card-glow-border-spread\) \* 1px\)/);
	assert.match(DEMO_SOURCE, /"--card-glow-tile-accent": tile\.accentColor/);
	assert.match(DEMO_SOURCE, /const themeStyles = CARD_GLOW_THEME_STYLES\[config\.theme\]/);
	assert.match(DEMO_SOURCE, /themeStyles\.borderClassName/);
	assert.match(DEMO_SOURCE, /absolute inset-0 z-\[1\] rounded-\[inherit\] border/);
	assert.match(DEMO_SOURCE, /absolute inset-0 z-\[2\] overflow-hidden rounded-\[inherit\] border border-transparent/);
	assert.match(DEMO_SOURCE, /<Avatar shape="hexagon" size="default">/);
	assert.match(DEMO_SOURCE, /<AvatarImage[\s\S]*src=\{tile\.iconSrc\}[\s\S]*className=\{cn\("object-contain", tile\.iconClassName\)\}[\s\S]*\/>/);
	assert.match(DEMO_SOURCE, /<AvatarFallback>\{tile\.title\.slice\(0, 2\)\.toUpperCase\(\)\}<\/AvatarFallback>/);
	assert.match(DEMO_SOURCE, /text-sm font-semibold leading-5 text-text/);
	assert.match(DEMO_SOURCE, /text-sm leading-5 text-text-subtle/);
	assert.match(DEMO_SOURCE, /"--ds-text": "#F7F8FA"/);
	assert.match(DEMO_SOURCE, /"--ds-text-subtle": "rgb\(255 255 255 \/ 62%\)"/);
	assert.match(DEMO_SOURCE, /style=\{\{ \.\.\.effectStyle, \.\.\.themeStyles\.previewTextStyle \}\}/);
	assert.match(DEMO_SOURCE, /style=\{borderGlowStyle\}/);
	assert.match(DEMO_SOURCE, /borderColor: "transparent"/);
	assert.match(DEMO_SOURCE, /maskComposite: "exclude"/);
	assert.match(DEMO_SOURCE, /WebkitBackdropFilter: borderFilter/);
	assert.match(DEMO_SOURCE, /WebkitMaskComposite: "xor"/);
	assert.doesNotMatch(DEMO_SOURCE, /style=\{borderStyle\}/);
	assert.doesNotMatch(DEMO_SOURCE, /const borderGlowLayerStyle/);
	assert.doesNotMatch(DEMO_SOURCE, /borderColor: "var\(--card-glow-tile-accent\)"/);
	assert.doesNotMatch(DEMO_SOURCE, /--card-glow-proximity/);
	assert.doesNotMatch(DEMO_SOURCE, /hover:border/);
	assert.doesNotMatch(DEMO_SOURCE, /hover:bg/);
	assert.doesNotMatch(DEMO_SOURCE, /rounded-lg border p-4/);
	assert.doesNotMatch(DEMO_SOURCE, /function getSubtleTextClassName/);
	assert.doesNotMatch(DEMO_SOURCE, /function getPreviewThemeClassName/);
	assert.doesNotMatch(DEMO_SOURCE, /function getCardThemeClassName/);
	assert.doesNotMatch(DEMO_SOURCE, /function getCardBorderClassName/);
	assert.doesNotMatch(DEMO_SOURCE, /function getPreviewTextStyle/);
});
