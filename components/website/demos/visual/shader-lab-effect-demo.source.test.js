const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { getShaderLabEffectUsage } = require(process.cwd() + "/components/website/demos/visual/shader-lab/helpers.ts");
const { SHADER_LAB_LAYER_DEFINITIONS } = require(process.cwd() + "/components/website/demos/visual/shader-lab/index.ts");
const {
	SHADER_LAB_RUNTIME_EFFECT_TYPES,
	SHADER_LAB_RUNTIME_LAYER_TYPES,
	SHADER_LAB_RUNTIME_SOURCE_TYPES,
} = require(process.cwd() + "/components/website/demos/visual/shader-lab/types.ts");

const ROOT = path.join(__dirname, "../../../..");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const COMPONENTS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/component-manifest.ts"), "utf8");
const MANIFEST_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/component-manifest.ts"), "utf8");
const NAV_UTILS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/nav-utils.ts"), "utf8");
const DETAILS_SOURCE = readDetailCategorySource("visual");
const DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "shader-lab-effect-demo.tsx"),
	"utf8",
);
const CHROMATIC_ABERRATION_DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "chromatic-aberration-demo.tsx"),
	"utf8",
);
const CHROMATIC_ABERRATION_SHADER_SOURCE = fs.readFileSync(
	path.join(__dirname, "shaders/chromatic-aberration.tsx"),
	"utf8",
);
const CHROMATIC_ABERRATION_CONFIG_SOURCE = fs.readFileSync(
	path.join(__dirname, "shaders/chromatic-aberration-config.ts"),
	"utf8",
);
const FLUTED_GLASS_DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "fluted-glass-demo.tsx"),
	"utf8",
);
const PATTERN_TILE_DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "pattern-tile-demo.tsx"),
	"utf8",
);

const SHADER_LAB_V2_EFFECTS = new Set(["chromatic-aberration", "fluted-glass"]);

function getShaderLabRouteSlug(effectType) {
	return SHADER_LAB_V2_EFFECTS.has(effectType) ? `${effectType}-v2` : effectType;
}

test("remaining Shader Lab effects are wired into the visual catalog", () => {
	for (const effectType of SHADER_LAB_RUNTIME_EFFECT_TYPES) {
		const slug = getShaderLabRouteSlug(effectType);

		assert.match(REGISTRY_SOURCE, new RegExp(`${JSON.stringify(slug)}: dynamic|${slug}: dynamic`), slug);
		assert.ok(COMPONENTS_SOURCE.includes(`"${slug}"`), slug);
		assert.ok(MANIFEST_SOURCE.includes(`"${slug}"`), slug);
		assert.match(NAV_UTILS_SOURCE, new RegExp(`"${slug}"`), slug);
	}

	for (const sourceType of SHADER_LAB_RUNTIME_SOURCE_TYPES) {
		assert.match(REGISTRY_SOURCE, new RegExp(`${JSON.stringify(sourceType)}: dynamic|${sourceType}: dynamic`), sourceType);
		assert.ok(COMPONENTS_SOURCE.includes(`"${sourceType}"`), sourceType);
		assert.ok(MANIFEST_SOURCE.includes(`"${sourceType}"`), sourceType);
		assert.match(NAV_UTILS_SOURCE, new RegExp(`"${sourceType}"`), sourceType);
	}

	assert.match(DETAILS_SOURCE, /SHADER_LAB_RUNTIME_LAYER_TYPES/);
});

test("every Shader Lab demo renders its documented usage with its own layer module", () => {
	for (const layerType of SHADER_LAB_RUNTIME_LAYER_TYPES) {
		const definition = SHADER_LAB_LAYER_DEFINITIONS[layerType];
		const demoSource = fs.readFileSync(path.join(__dirname, `${getShaderLabRouteSlug(layerType)}-demo.tsx`), "utf8");
		assert.ok(demoSource.includes(getShaderLabEffectUsage(definition)), layerType);
		assert.ok(demoSource.includes(`from "./shader-lab/layers/${layerType}";`), layerType);
		assert.ok(!demoSource.includes("shader-lab/index"), layerType);
	}
});

test("Shader Lab effects composite over a replaceable default source image", () => {

	assert.ok(fs.existsSync(path.join(ROOT, "public/ambient/atlassian/pictorial/clouds/primary/blue.png")));
	assert.match(DEMO_SOURCE, /src: "\/ambient\/atlassian\/pictorial\/clouds\/primary\/blue\.png"/);
	assert.match(DEMO_SOURCE, /return \[activeLayer, createShaderLabSourceImageLayer\(sourceImage\)\]/);
	assert.match(DEMO_SOURCE, /<GUI\.ImageInput/);
	assert.match(DEMO_SOURCE, /accept="image\/\*"/);
	assert.match(DEMO_SOURCE, /clearLabel="Reset to default source image"/);
});

test("original VPK visual shaders keep the base routes", () => {
	for (const slug of ["chromatic-aberration", "fluted-glass"]) {
		assert.match(REGISTRY_SOURCE, new RegExp(`${JSON.stringify(slug)}: dynamic|${slug}: dynamic`), slug);
		assert.ok(COMPONENTS_SOURCE.includes(`"${slug}"`), slug);
		assert.ok(MANIFEST_SOURCE.includes(`"${slug}"`), slug);
		assert.ok(NAV_UTILS_SOURCE.includes(`"${slug}"`), slug);
		assert.ok(DETAILS_SOURCE.includes(`"${slug}"`), slug);
	}

	assert.match(CHROMATIC_ABERRATION_DEMO_SOURCE, /from "\.\/shaders\/chromatic-aberration"/);
	assert.match(FLUTED_GLASS_DEMO_SOURCE, /from "\.\/shaders\/fluted-glass"/);
});

test("Chromatic preserves straight source alpha", () => {
	assert.match(CHROMATIC_ABERRATION_SHADER_SOURCE, /fragColor = vec4\(color\.rgb, color\.a\);/);
	assert.match(CHROMATIC_ABERRATION_SHADER_SOURCE, /getContext\("webgl2", \{ antialias: false, alpha: true, premultipliedAlpha: false \}\)/);
});

test("Chromatic Aberration accepts image and video texture media", () => {
	assert.ok(fs.existsSync(path.join(ROOT, "public/illustration/chromatic-aberration-default.png")));
	assert.match(CHROMATIC_ABERRATION_CONFIG_SOURCE, /DEFAULT_CHROMATIC_ABERRATION_MEDIA_SRC = "\/illustration\/chromatic-aberration-default\.png"/);
	assert.match(CHROMATIC_ABERRATION_SHADER_SOURCE, /mediaSrc\?: string;/);
	assert.match(CHROMATIC_ABERRATION_SHADER_SOURCE, /mediaType\?: "image" \| "video";/);
	assert.match(CHROMATIC_ABERRATION_SHADER_SOURCE, /media\.HAVE_CURRENT_DATA/);
	assert.match(CHROMATIC_ABERRATION_DEMO_SOURCE, /accept="image\/\*,video\/\*"/);
	assert.match(CHROMATIC_ABERRATION_DEMO_SOURCE, /mediaType=\{mediaType\}/);
});

test("Chromatic keeps media alive across controls and redraws late images", () => {
	assert.match(CHROMATIC_ABERRATION_SHADER_SOURCE, /const mediaRef = useRef<HTMLImageElement \| HTMLVideoElement \| null>\(null\);/);
	assert.match(CHROMATIC_ABERRATION_SHADER_SOURCE, /const renderRef = useRef<\(\) => void>\(\(\) => undefined\);/);
	assert.match(CHROMATIC_ABERRATION_SHADER_SOURCE, /nextImage\.onload = \(\) => renderRef\.current\(\);/);
	assert.match(CHROMATIC_ABERRATION_SHADER_SOURCE, /\}, \[resolvedMediaSrc, resolvedMediaType\]\);/);
});

test("Chromatic Aberration exposes the complete Framer control contract", () => {
	for (const option of [
		'{ value: "radial", label: "Radial" }',
		'{ value: "uniform", label: "Uniform" }',
		'{ value: "edges", label: "Edges" }',
	]) {
		assert.ok(CHROMATIC_ABERRATION_DEMO_SOURCE.includes(option), option);
	}

	for (const [id, defaultValue, min, max, step] of [
		["ca-zoom", 0.5, 0.25, 1.5, 0.01],
		["ca-focus-x", 0.5, 0, 1, 0.01],
		["ca-focus-y", 0.5, 0, 1, 0.01],
		["ca-radius", 60, 0, 180, 0.5],
		["ca-angle", 90, 0, 360, 1],
		["ca-edge-amount", 100, 0, 200, 1],
		["ca-edges", 1, 0, 2, 0.01],
		["ca-falloff", 3, 0, 6, 0.1],
		["ca-swirl", 0, -10, 10, 0.1],
		["ca-dispersion", 0.5, 0, 1, 0.01],
		["ca-speed", 1, 0.1, 5, 0.01],
	]) {
		const controlSource = CHROMATIC_ABERRATION_DEMO_SOURCE.slice(
			CHROMATIC_ABERRATION_DEMO_SOURCE.indexOf(`id="${id}"`),
		);
		assert.ok(controlSource.startsWith(`id="${id}"`), id);
		assert.match(controlSource, new RegExp(`defaultValue=\\{${defaultValue}\\}[\\s\\S]*?min=\\{${min}\\}[\\s\\S]*?max=\\{${max}\\}[\\s\\S]*?step=\\{${step.toString().replace(".", "\\.")}\\}`), id);
	}

	assert.match(CHROMATIC_ABERRATION_DEMO_SOURCE, /id="ca-symmetry"[\s\S]*?\{ value: "point", label: "Point" \}[\s\S]*?\{ value: "mirror", label: "Mirror" \}/);
	assert.match(CHROMATIC_ABERRATION_DEMO_SOURCE, /id="ca-animate"[\s\S]*?\{ value: "off", label: "Off" \}[\s\S]*?\{ value: "pulse", label: "Pulse" \}/);
	assert.match(CHROMATIC_ABERRATION_DEMO_SOURCE, /id="ca-animation-amount"[\s\S]*?defaultValue=\{0\.5\}[\s\S]*?min=\{0\}[\s\S]*?max=\{1\}[\s\S]*?step=\{0\.01\}/);
	assert.match(CHROMATIC_ABERRATION_DEMO_SOURCE, /\{mode === "radial" \? \(/);
	assert.match(CHROMATIC_ABERRATION_DEMO_SOURCE, /\{mode === "uniform" \? \(/);
	assert.match(CHROMATIC_ABERRATION_DEMO_SOURCE, /\{mode === "edges" \? \(/);
	assert.match(CHROMATIC_ABERRATION_DEMO_SOURCE, /\{animate === "pulse" \? \(/);
});

test("Pattern Tile uses a non-shader route and source module", () => {
	const slug = "pattern-tile";
	const shaderGroupSource = NAV_UTILS_SOURCE.match(/shaders:\s*\[([\s\S]*?)\],/)?.[1] ?? "";

	assert.match(REGISTRY_SOURCE, new RegExp(`${JSON.stringify(slug)}: dynamic`), slug);
	assert.ok(COMPONENTS_SOURCE.includes(`"${slug}"`), slug);
	assert.ok(MANIFEST_SOURCE.includes(`"${slug}"`), slug);
	assert.ok(DETAILS_SOURCE.includes(`"${slug}"`), slug);
	assert.doesNotMatch(shaderGroupSource, /"pattern-tile"\s*,/);
	assert.match(PATTERN_TILE_DEMO_SOURCE, /from "\.\/pattern-tile"/);
});

test("Shader Lab variants use v2 routes for existing VPK shader names", () => {
	for (const slug of ["chromatic-aberration-v2", "fluted-glass-v2"]) {
		assert.match(REGISTRY_SOURCE, new RegExp(`${JSON.stringify(slug)}: dynamic`), slug);
		assert.ok(COMPONENTS_SOURCE.includes(`"${slug}"`), slug);
		assert.ok(MANIFEST_SOURCE.includes(`"${slug}"`), slug);
		assert.ok(NAV_UTILS_SOURCE.includes(`"${slug}"`), slug);
	}

	assert.match(DETAILS_SOURCE, /SHADER_LAB_V2_EFFECT_DETAILS/);
});
