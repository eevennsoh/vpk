const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");

const ROOT = path.join(__dirname, "../../../..");
const RIPPLE_SOURCE = fs.readFileSync(path.join(__dirname, "shaders/ripple.tsx"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "ripple-demo.tsx"), "utf8");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const COMPONENTS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/components.ts"), "utf8");
const MANIFEST_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/component-manifest.ts"), "utf8");
const NAV_UTILS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/nav-utils.ts"), "utf8");
const DETAILS_SOURCE = readDetailCategorySource("visual");

test("Ripple is registered as a visual shader component", () => {
	assert.match(
		COMPONENTS_SOURCE,
		/visualComponent\("ripple", "Ripple", "@\/components\/website\/demos\/visual\/shaders\/ripple"\)/u,
	);
	assert.match(
		MANIFEST_SOURCE,
		/visualComponent\("ripple", "Ripple", "@\/components\/website\/demos\/visual\/shaders\/ripple"\)/u,
	);
	assert.match(REGISTRY_SOURCE, /ripple: dynamic\(\(\) => import\("\.\/demos\/visual\/ripple-demo"\)/u);
	assert.match(DETAILS_SOURCE, /(?:"ripple"|ripple): \{/u);
	assert.match(NAV_UTILS_SOURCE, /"shaders-framer": \[[^\]]*"ripple"/u);
});

test("Ripple demo exposes every Framer reference control", () => {
	for (const expected of [
		"DEFAULT_RADIUS",
		"DEFAULT_FADE",
		"DEFAULT_SOFTNESS",
		"DEFAULT_STRENGTH",
		"DEFAULT_DECAY",
		"DEFAULT_DISPLACE",
		"DEFAULT_DISPERSION",
		"DEFAULT_CLICK",
		"DEFAULT_SPEED",
		"label=\"Image\"",
		"label=\"Radius\"",
		"label=\"Fade\"",
		"label=\"Softness\"",
		"label=\"Strength\"",
		"label=\"Decay\"",
		"label=\"Displace\"",
		"label=\"Dispersion\"",
		"label=\"Click\"",
		"label=\"Speed\"",
		"<GUI.ImageInput",
		"<GUI.Toggle",
		"placeholder=\"Default public image\"",
	]) {
		assert.ok(DEMO_SOURCE.includes(expected), expected);
	}

	for (const oldControl of [
		"label=\"Size\"",
		"label=\"Time\"",
		"label=\"Delay\"",
		"label=\"Stroke\"",
		"label=\"Color\"",
	]) {
		assert.ok(!DEMO_SOURCE.includes(oldControl), oldControl);
	}
});

test("Ripple is an interactive image shader", () => {
	assert.match(RIPPLE_SOURCE, /const CLICK_SLOTS = 9/u);
	assert.match(RIPPLE_SOURCE, /DEFAULT_RIPPLE_IMAGE_SRC = "\/ambient\/ado\/combo\/primary\/blue\.svg"/u);
	assert.match(RIPPLE_SOURCE, /canvas\.getContext\("webgl2"/u);
	assert.match(RIPPLE_SOURCE, /RIPPLE_TRAIL_FRAGMENT_SHADER/u);
	assert.match(RIPPLE_SOURCE, /CLICK_STATE_FRAGMENT_SHADER/u);
	assert.match(RIPPLE_SOURCE, /FINAL_FRAGMENT_SHADER/u);
	assert.match(RIPPLE_SOURCE, /uniform sampler2D u_texture/u);
	assert.match(RIPPLE_SOURCE, /uniform sampler2D u_rippleTrail_buffer/u);
	assert.match(RIPPLE_SOURCE, /uniform sampler2D u_clickState_buffer/u);
	assert.match(RIPPLE_SOURCE, /float neighborAverage = \(left \+ right \+ down \+ up\) \* 0\.25/u);
	assert.match(RIPPLE_SOURCE, /bool\s+spawnNow\s+= rising && \(wasRising < 0\.5\)/u);
	assert.match(RIPPLE_SOURCE, /vec2 clickRingOffset\(vec2 uv, vec2 res, float ref, vec2 originUV, float age\)/u);
	assert.match(RIPPLE_SOURCE, /vec2 dragOffset = grad \* u_trailDisplacement \* ref \/ res/u);
	assert.match(RIPPLE_SOURCE, /pointerTargetRef/u);
	assert.match(RIPPLE_SOURCE, /window\.addEventListener\("pointermove", updatePointer/u);
	assert.match(RIPPLE_SOURCE, /canvas\.addEventListener\("pointerdown", handlePointerDown\)/u);
	assert.match(RIPPLE_SOURCE, /pointerDownRef\.current\.target = 1/u);
	assert.match(RIPPLE_SOURCE, /pointerDownRef\.current\.value = Math\.max\(pointerDownRef\.current\.value, 0\.08\)/u);
	assert.match(RIPPLE_SOURCE, /pointerDownImpulseRef\.current = 1/u);
	assert.match(RIPPLE_SOURCE, /const pointerDown = Math\.max\(pointerDownRef\.current\.value, pointerDownImpulseRef\.current\)/u);
	assert.match(RIPPLE_SOURCE, /clickRipplesRef\.current\.unshift/u);
	assert.match(RIPPLE_SOURCE, /const clickStateData = new Float32Array\(CLICK_SLOTS \* 4\)/u);
	assert.match(RIPPLE_SOURCE, /gl\.texImage2D\(gl\.TEXTURE_2D, 0, gl\.RGBA32F, CLICK_SLOTS, 1, 0, gl\.RGBA, gl\.FLOAT, clickStateData\)/u);
	assert.match(RIPPLE_SOURCE, /createTargetPair\(gl, width, height, gl\.LINEAR\)/u);
	assert.match(RIPPLE_SOURCE, /swapTargetPair\(trailTargets\)/u);
	assert.doesNotMatch(RIPPLE_SOURCE, /uniform vec4 u_ripples\[16\]/u);
	assert.doesNotMatch(RIPPLE_SOURCE, /canvas\.dataset\.rippleState/u);
	assert.doesNotMatch(RIPPLE_SOURCE, /canvas\.dataset\.rippleDebug/u);
	assert.match(RIPPLE_SOURCE, /gl\.drawArrays\(gl\.TRIANGLE_STRIP, 0, 4\)/u);
	assert.match(RIPPLE_SOURCE, /useReducedMotion/u);
});
