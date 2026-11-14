const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");

const SHADER_SOURCE = fs.readFileSync(path.join(__dirname, "shaders/dithering.tsx"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "dithering-demo.tsx"), "utf8");
const COMPONENTS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../../app/data/component-manifest.ts"),
	"utf8",
);
const MANIFEST_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../../app/data/component-manifest.ts"),
	"utf8",
);
const DETAILS_SOURCE = readDetailCategorySource("visual");
const NAV_UTILS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../../app/data/nav-utils.ts"),
	"utf8",
);
const REGISTRY_SOURCE = readWebsiteRegistrySource();

test("Dithering is registered as a visual shader component", () => {
	assert.match(
		COMPONENTS_SOURCE,
		/visualComponent\("dithering", "Dithering", "@\/components\/website\/demos\/visual\/shaders\/dithering"\)/,
	);
	assert.match(
		MANIFEST_SOURCE,
		/visualComponent\("dithering", "Dithering", "@\/components\/website\/demos\/visual\/shaders\/dithering"\)/,
	);
	assert.match(REGISTRY_SOURCE, /dithering: dynamic\(\(\) => import\("\.\/demos\/visual\/dithering-demo"\)/);
	assert.match(DETAILS_SOURCE, /(?:"dithering"|dithering): \{/);
	assert.match(NAV_UTILS_SOURCE, /shaders: \[[^\]]*"dithering"/);
});

test("Dithering demo exposes Shader Lab dithering controls", () => {
	assert.match(DEMO_SOURCE, /type DitheringPreset/);
	assert.match(DEMO_SOURCE, /type DitheringAlgorithm/);
	assert.match(DEMO_SOURCE, /label="Opacity"/);
	assert.match(DEMO_SOURCE, /label="Blend"/);
	assert.match(DEMO_SOURCE, /label="Mode"/);
	assert.match(DEMO_SOURCE, /label="Hue"/);
	assert.match(DEMO_SOURCE, /label="Saturation"/);
	assert.match(DEMO_SOURCE, /label="Preset"/);
	assert.match(DEMO_SOURCE, /label="Algorithm"/);
	assert.match(DEMO_SOURCE, /Bayer 2x2/);
	assert.match(DEMO_SOURCE, /Bayer 4x4/);
	assert.match(DEMO_SOURCE, /Bayer 8x8/);
	assert.match(DEMO_SOURCE, /Game Boy/);
	assert.match(DEMO_SOURCE, /Source Color/);
	assert.match(DEMO_SOURCE, /label="Levels"/);
	assert.match(DEMO_SOURCE, /label="Pixel Size"/);
	assert.match(DEMO_SOURCE, /label="Strength"/);
	assert.match(DEMO_SOURCE, /label="Dot Scale"/);
	assert.match(DEMO_SOURCE, /label="Animate Dither"/);
	assert.match(DEMO_SOURCE, /label="Dither Speed"/);
	assert.match(DEMO_SOURCE, /label="Chromatic Split"/);
	assert.match(DEMO_SOURCE, /label="Color Mode"/);
	assert.match(DEMO_SOURCE, /GUI\.ColorInput/);
});

test("Dithering shader ports Shader Lab algorithms and color modes", () => {
	assert.match(SHADER_SOURCE, /DITHERING_PRESETS/);
	assert.match(SHADER_SOURCE, /getDitheringPresetDefaults/);
	assert.match(SHADER_SOURCE, /gameboy/);
	assert.match(SHADER_SOURCE, /bayer2/);
	assert.match(SHADER_SOURCE, /bayer4/);
	assert.match(SHADER_SOURCE, /bayer8/);
	assert.match(SHADER_SOURCE, /blueNoise/);
	assert.match(SHADER_SOURCE, /u_chromaticSplit/);
	assert.match(SHADER_SOURCE, /u_animateDither/);
	assert.match(SHADER_SOURCE, /mix\(u_shadowColor, u_highlightColor, quantizedLuma\)/);
});
