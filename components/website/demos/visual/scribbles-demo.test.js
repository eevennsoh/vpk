const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");

const ROOT = path.join(__dirname, "../../../..");
const SCRIBBLES_SOURCE = fs.readFileSync(path.join(__dirname, "scribbles.tsx"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "scribbles-demo.tsx"), "utf8");
const SOURCE_SOURCE = fs.readFileSync(path.join(__dirname, "scribbles-source.ts"), "utf8");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const COMPONENTS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/component-manifest.ts"), "utf8");
const MANIFEST_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/component-manifest.ts"), "utf8");
const NAV_UTILS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/nav-utils.ts"), "utf8");
const DETAILS_SOURCE = readDetailCategorySource("visual");
const {
	DEFAULT_SCRIBBLES_SVG_SOURCE,
	DEFAULT_SCRIBBLES_SVG_SRC,
	isScribblesSvgFile,
} = require("./scribbles-source.ts");

test("Scribbles exposes the hand-drawn SVG filter shape", () => {
	assert.match(SCRIBBLES_SOURCE, /<feTurbulence/);
	assert.match(SCRIBBLES_SOURCE, /type="turbulence"/);
	assert.match(SCRIBBLES_SOURCE, /<feDisplacementMap/);
	assert.match(SCRIBBLES_SOURCE, /xChannelSelector="R"/);
	assert.match(SCRIBBLES_SOURCE, /yChannelSelector="G"/);
	assert.match(SCRIBBLES_SOURCE, /filter: `url\(#\$\{resolvedFilterId\}\)`/);
});

test("Scribbles keeps the line-boil animation reduced-motion aware", () => {
	assert.match(SCRIBBLES_SOURCE, /useReducedMotion/);
	assert.match(SCRIBBLES_SOURCE, /window\.setInterval/);
	assert.match(SCRIBBLES_SOURCE, /window\.clearInterval/);
	assert.match(SCRIBBLES_SOURCE, /SCRIBBLES_DEFAULT_OFFSETS = \[-0\.02, 0\.01, -0\.01, 0\.02\] as const/);
	assert.match(SCRIBBLES_SOURCE, /SCRIBBLES_DEFAULT_INTERVAL_MS = 100/);
	assert.match(SCRIBBLES_SOURCE, /SCRIBBLES_DEFAULT_AMOUNT = 0\.5/);
});

test("Scribbles demo exposes the expected GUI controls", () => {
	for (const expected of [
		"SCRIBBLES_DEFAULT_SCALE",
		"SCRIBBLES_DEFAULT_BASE_FREQUENCY",
		"SCRIBBLES_DEFAULT_NUM_OCTAVES",
		"SCRIBBLES_DEFAULT_SEED",
		"SCRIBBLES_DEFAULT_AMOUNT",
		"SCRIBBLES_DEFAULT_INTERVAL_MS",
	]) {
		assert.ok(DEMO_SOURCE.includes(expected), expected);
	}

	assert.match(SOURCE_SOURCE, /DEFAULT_SCRIBBLES_SVG_SRC = "\/illustration-ai\/chat\/light\.svg"/);
	assert.match(DEMO_SOURCE, /title="Source"/);
	assert.match(DEMO_SOURCE, /<GUI\.ImageInput/);
	assert.match(DEMO_SOURCE, /accept="image\/svg\+xml,\.svg"/);
	assert.match(DEMO_SOURCE, /clearLabel="Reset to default SVG"/);
	assert.match(DEMO_SOURCE, /URL\.createObjectURL/);
	assert.match(DEMO_SOURCE, /URL\.revokeObjectURL/);
	assert.match(DEMO_SOURCE, /label="scale"/);
	assert.match(DEMO_SOURCE, /label="base frequency"/);
	assert.match(DEMO_SOURCE, /label="octaves"/);
	assert.match(DEMO_SOURCE, /label="seed"/);
	assert.match(DEMO_SOURCE, /label="play"/);
	assert.match(DEMO_SOURCE, /label="amount"/);
	assert.match(DEMO_SOURCE, /label="frame interval"/);
	assert.match(DEMO_SOURCE, /unit="ms"/);
});

test("Scribbles SVG source defaults to the catalog asset", () => {
	assert.equal(DEFAULT_SCRIBBLES_SVG_SRC, "/illustration-ai/chat/light.svg");
	assert.deepEqual(DEFAULT_SCRIBBLES_SVG_SOURCE, {
		src: "/illustration-ai/chat/light.svg",
		name: "illustration-ai/chat/light.svg",
		uploaded: false,
	});
});

test("Scribbles SVG upload accepts only SVG files", () => {
	assert.equal(isScribblesSvgFile({ type: "image/svg+xml", name: "from-clipboard" }), true);
	assert.equal(isScribblesSvgFile({ type: "", name: "sketch.SVG" }), true);
	assert.equal(isScribblesSvgFile({ type: "application/octet-stream", name: "vector.svg" }), true);
	assert.equal(isScribblesSvgFile({ type: "image/png", name: "diagram.png" }), false);
	assert.equal(isScribblesSvgFile({ type: "image/svg", name: "diagram.png" }), false);
});

test("Scribbles demo uses a real SVG asset instead of the inline placeholder illustration", () => {
	assert.doesNotMatch(DEMO_SOURCE, /function ScribblesIllustration/);
	assert.doesNotMatch(DEMO_SOURCE, /Hand-drawn marks/);
	assert.doesNotMatch(DETAILS_SOURCE, /Hand-drawn marks/);
	assert.match(DEMO_SOURCE, /<ScribblesSourceImage source=\{svgSource\} \/>/);
});

test("Scribbles is wired into the visual catalog", () => {
	assert.match(REGISTRY_SOURCE, /"scribbles": dynamic\(\(\) => import\("\.\/demos\/visual\/scribbles-demo"\)/);
	assert.ok(COMPONENTS_SOURCE.includes('visualComponent("scribbles", "Scribbles"'));
	assert.ok(MANIFEST_SOURCE.includes('visualComponent("scribbles", "Scribbles"'));
	assert.match(DETAILS_SOURCE, /(?:"scribbles"|scribbles): \{/u);
});

test("Scribbles stays visible as a top-level Visual nav item", () => {
	const shadersStart = NAV_UTILS_SOURCE.indexOf("shaders: [");
	const shadersEnd = NAV_UTILS_SOURCE.indexOf("],", shadersStart);
	assert.notEqual(shadersStart, -1);
	assert.notEqual(shadersEnd, -1);
	assert.doesNotMatch(
		NAV_UTILS_SOURCE.slice(shadersStart, shadersEnd),
		/"scribbles"/,
	);
});
