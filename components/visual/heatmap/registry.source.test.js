import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const requireRegistrySource = createRequire(import.meta.url);
const { readWebsiteRegistrySource } = requireRegistrySource(process.cwd() + "/components/website/registry/test-source.cjs");
const ROOT = process.cwd();

const DEMO_SLUGS = [
	"heatmap-demo-shapes",
	"heatmap-demo-color-ramp",
	"heatmap-demo-glow-balance",
	"heatmap-demo-contour-and-grain",
	"heatmap-demo-angle",
];

function readProjectFile(filePath) {
	return readFileSync(path.join(ROOT, filePath), "utf8");
}

test("Heatmap is registered in the visual catalog and manifest", () => {
	const componentsSource = readProjectFile("app/data/components.ts");
	const manifestSource = readProjectFile("app/data/component-manifest.ts");

	assert.match(
		componentsSource,
		/visualComponent\("heatmap", "Heatmap", "@\/components\/visual\/heatmap"\)/u,
	);
	assert.match(
		manifestSource,
		/visualComponent\("heatmap", "Heatmap", "@\/components\/visual\/heatmap"\)/u,
	);
});

test("Heatmap detail record is wired into the visual detail barrel", () => {
	const barrelSource = readProjectFile("app/data/details/visual.ts");

	assert.match(barrelSource, /import \{ HEATMAP_DETAIL \} from "\.\/visual\/heatmap";/u);
	assert.match(barrelSource, /^\theatmap: HEATMAP_DETAIL,$/mu);
});

test("Heatmap docs register the main preview and every example demo", () => {
	const detailsSource = readProjectFile("app/data/details/visual/heatmap.ts");
	const registrySource = readWebsiteRegistrySource();

	assert.match(registrySource, /\theatmap: dynamic\(\(\) => import\("\.\/demos\/visual\/heatmap-demo"\)/u);
	for (const demoSlug of DEMO_SLUGS) {
		assert.match(detailsSource, new RegExp(`demoSlug: "${demoSlug}"`, "u"));
		assert.match(registrySource, new RegExp(`"${demoSlug}"`, "u"));
	}

	assert.match(registrySource, /visual: VISUAL_VARIANT_DEMOS/u);
});

test("Heatmap example demos are all lazy and browser-only", () => {
	const registrySource = readWebsiteRegistrySource();

	for (const demoSlug of DEMO_SLUGS) {
		const entry = new RegExp(
			`"${demoSlug}": dynamic\\(\\s*\\(\\) =>\\s*import\\("\\./demos/visual/heatmap-demo"\\)\\.then\\(\\(mod\\) => \\(\\{\\s*default: mod\\.HeatmapDemo[A-Za-z]+,\\s*\\}\\)\\),\\s*\\{ ssr: false \\},\\s*\\),`,
			"u",
		);
		assert.match(registrySource, entry);
	}
});

test("Heatmap docs describe the decorative, reduced-motion-safe contract", () => {
	const detailsSource = readProjectFile("app/data/details/visual/heatmap.ts");

	assert.match(detailsSource, /aria-hidden/u);
	assert.match(detailsSource, /pointer-events-none/u);
	assert.match(detailsSource, /reduced motion/iu);
	for (const propName of [
		"colorBack",
		"colors",
		"colorCount",
		"contour",
		"innerGlow",
		"outerGlow",
		"angle",
		"noise",
		"speed",
	]) {
		assert.match(detailsSource, new RegExp(`name: "${propName}"`, "u"));
	}
});

/**
 * The reference effect animates continuously; reduced motion must freeze the
 * frame rather than remove the graphic, so the surrounding composition holds.
 */
test("Heatmap freezes rather than disappears under reduced motion", () => {
	const source = readProjectFile("components/visual/heatmap/index.tsx");

	assert.match(
		source,
		/const shouldReduceMotion = useMediaQuery\("\(prefers-reduced-motion: reduce\)"\);/u,
	);
	assert.match(source, /speed: shouldReduceMotion \? 0 : speed,/u);
	assert.doesNotMatch(source, /if \(shouldReduceMotion\) return null;/u);
});

test("Heatmap is decorative and never in the tab order", () => {
	const source = readProjectFile("components/visual/heatmap/index.tsx");

	assert.match(source, /aria-hidden="true"/u);
	assert.match(source, /pointer-events-none/u);
	assert.match(source, /\binert\b/u);
});

/**
 * `@paper-design/shaders-react` is ~700K of shader runtime, and it touches
 * WebGL at module scope. A static import would pull it into every bundle that
 * imports this module and break SSR.
 */
test("Heatmap loads the shader runtime lazily and browser-only", () => {
	const source = readProjectFile("components/visual/heatmap/index.tsx");

	assert.match(
		source,
		/dynamic\(\s*\(\) => import\("@paper-design\/shaders-react"\)\.then\(\(mod\) => mod\.Heatmap\),\s*\{ ssr: false \},\s*\)/u,
	);
	assert.match(source, /suspendWhenProcessingImage/u);
});

test("Heatmap hands its WebGL context back when the shader unmounts", () => {
	const releaseSource = readProjectFile("components/visual/heatmap/use-shader-context-release.ts");
	const effectSource = readProjectFile("components/visual/heatmap/index.tsx");

	// The shader library disposes GL resources but never loses the context, so
	// remounts would otherwise pile up contexts until the browser force-loses
	// canvases it has no way to restore.
	assert.match(releaseSource, /getExtension\("WEBGL_lose_context"\)\?\.loseContext\(\)/u);
	assert.match(releaseSource, /isContextLost\(\)/u);
	assert.match(releaseSource, /queueMicrotask\(/u);

	assert.match(
		effectSource,
		/import \{ useShaderContextRelease \} from "\.\/use-shader-context-release";/u,
	);
	assert.match(effectSource, /useShaderContextRelease\(hostRef\);/u);
});

/**
 * Each shader instance holds a live WebGL2 context. The examples on the detail
 * page add up to well past Chrome's ~16-context cap, and the shader library
 * registers no `webglcontextrestored` handler, so a force-lost tile stays blank
 * for the rest of the page's life. Mounting every example unconditionally
 * reproducibly lost three contexts, so the stage must gate on the viewport.
 */
test("Heatmap example tiles only hold a WebGL context while on screen", () => {
	const demoSource = readProjectFile("components/website/demos/visual/heatmap-demo.tsx");

	assert.match(demoSource, /import \{ useInView \} from "motion\/react";/u);
	assert.match(demoSource, /useInView\(hostRef, \{ amount: [\d.]+ \}\)/u);
	assert.match(demoSource, /\{isInView \? <Heatmap \{\.\.\.heatmapProps\} \/> : null\}/u);

	// Every example goes through the gated stage; a bare <Heatmap> in an example
	// would sidestep the gate. The only ungated instance is the single main preview.
	const previewInstances = demoSource.match(/<Heatmap$/gmu) ?? [];
	assert.equal(previewInstances.length, 1);
});

/**
 * The one-shot creation-bloom framing this component was briefly built around is
 * gone. If any of it comes back, the reference parity claim in the docs breaks.
 */
test("No creation-effect surface survives anywhere in the tree", () => {
	for (const filePath of [
		"components/visual/heatmap/index.tsx",
		"components/visual/heatmap/data.ts",
		"components/visual/heatmap/shape.ts",
		"components/website/demos/visual/heatmap-demo.tsx",
		"app/data/details/visual/heatmap.ts",
	]) {
		assert.doesNotMatch(readProjectFile(filePath), /creation[- ]?effect/iu, filePath);
	}
});
