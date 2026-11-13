const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");

const ROOT = path.join(__dirname, "../../../..");
const MELT_SOURCE = fs.readFileSync(path.join(__dirname, "melt.tsx"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "melt-demo.tsx"), "utf8");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const COMPONENTS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/components.ts"), "utf8");
const MANIFEST_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/component-manifest.ts"), "utf8");
const NAV_UTILS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/nav-utils.ts"), "utf8");
const DETAILS_SOURCE = readDetailCategorySource("visual");

test("Melt exposes the SVG filter shape from the reference effect", () => {
	assert.match(MELT_SOURCE, /<feTurbulence/);
	assert.match(MELT_SOURCE, /type="fractalNoise"/);
	assert.match(MELT_SOURCE, /<feDisplacementMap/);
	assert.match(MELT_SOURCE, /xChannelSelector="R"/);
	assert.match(MELT_SOURCE, /yChannelSelector="G"/);
	assert.match(MELT_SOURCE, /x="-150%"/);
	assert.match(MELT_SOURCE, /width="400%"/);
	assert.match(MELT_SOURCE, /colorInterpolationFilters="sRGB"/);
	assert.match(MELT_SOURCE, /filter: `url\(#\$\{resolvedFilterId\}\)`/);
});

test("Melt demo preserves the full reference control surface", () => {
	for (const expected of [
		"DEFAULT_SCALE_ONLY = 0",
		"DEFAULT_FREQUENCY_SCALE = 20",
		"DEFAULT_FREQUENCY_X = 0.012",
		"DEFAULT_FREQUENCY_Y = 0.035",
		"DEFAULT_ANIMATION_SCALE_FROM = 0",
		"DEFAULT_ANIMATION_SCALE_TO = 40",
		"DEFAULT_ANIMATION_FREQUENCY_X_FROM = 0.005",
		"DEFAULT_ANIMATION_FREQUENCY_X_TO = 0.012",
		"DEFAULT_ANIMATION_FREQUENCY_Y_FROM = 0.02",
		"DEFAULT_ANIMATION_FREQUENCY_Y_TO = 0.035",
		"DEFAULT_IMAGE_SCALE = 12",
		"DEFAULT_TEXT_SCALE = 6",
	]) {
		assert.ok(DEMO_SOURCE.includes(expected), expected);
	}

	assert.match(DEMO_SOURCE, /label="frequency X"/);
	assert.match(DEMO_SOURCE, /label="frequency Y"/);
	assert.match(DEMO_SOURCE, /label="scale from"/);
	assert.match(DEMO_SOURCE, /label="scale to"/);
	assert.match(DEMO_SOURCE, /max=\{80\}/);
	assert.match(DEMO_SOURCE, /max=\{60\}/);
	assert.match(DEMO_SOURCE, /max=\{20\}/);
	assert.match(DEMO_SOURCE, /step=\{0\.001\}/);
	assert.match(DEMO_SOURCE, /step=\{0\.5\}/);
});

test("Melt is wired into the visual catalog", () => {
	assert.match(REGISTRY_SOURCE, /melt: dynamic\(\(\) => import\("\.\/demos\/visual\/melt-demo"\)/);
	assert.ok(COMPONENTS_SOURCE.includes('visualComponent("melt", "Melt"'));
	assert.ok(MANIFEST_SOURCE.includes('visualComponent("melt", "Melt"'));
	assert.ok(NAV_UTILS_SOURCE.includes('"melt"'));
	assert.match(DETAILS_SOURCE, /(?:"melt"|melt): \{/u);
});
