const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");
const { PAPER_TEXTURE_NUMBER_CONTROLS, LENS_DISTORTION_NUMBER_CONTROLS } = require("./shaders-paper-control-meta.ts");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");

const ROOT = path.join(__dirname, "../../../..");
const COMPONENTS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/components.ts"), "utf8");
const MANIFEST_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/component-manifest.ts"), "utf8");
const DETAILS_SOURCE = readDetailCategorySource("visual");
const NAV_UTILS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/nav-utils.ts"), "utf8");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const WEBSITE_PREVIEW_SOURCE = fs.readFileSync(path.join(ROOT, "components/website/website-preview.tsx"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "shaders-paper-demo.tsx"), "utf8");
const PACKAGE_SOURCE = fs.readFileSync(path.join(ROOT, "package.json"), "utf8");

const PAPER_SHADER_SLUGS = [
	"paper-color-panels",
	"paper-dithering",
	"paper-dot-grid",
	"paper-dot-orbit",
	"paper-fluted-glass",
	"paper-gem-smoke",
	"paper-god-rays",
	"paper-grain-gradient",
	"paper-halftone-cmyk",
	"paper-halftone-dots",
	"paper-heatmap",
	"paper-image-dithering",
	"paper-lens-distortion",
	"paper-liquid-metal",
	"paper-mesh-gradient",
	"paper-metaballs",
	"paper-neuro-noise",
	"paper-paper-texture",
	"paper-perlin-noise",
	"paper-pulsing-border",
	"paper-simplex-noise",
	"paper-smoke-ring",
	"paper-spiral",
	"paper-static-mesh-gradient",
	"paper-static-radial-gradient",
	"paper-swirl",
	"paper-voronoi",
	"paper-warp",
	"paper-water",
	"paper-waves",
];

const IMAGE_BACKED_RUNTIME_SLUGS = [
	"paper-fluted-glass",
	"paper-gem-smoke",
	"paper-halftone-cmyk",
	"paper-halftone-dots",
	"paper-heatmap",
	"paper-image-dithering",
	"paper-lens-distortion",
	"paper-liquid-metal",
	"paper-paper-texture",
	"paper-water",
];

function getPaperShaderGroupBody() {
	const match = NAV_UTILS_SOURCE.match(/"shaders-paper": \[([\s\S]*?)\n\t\],/u);
	assert.ok(match, "Shaders Paper nav group should be present");
	return match[1];
}

test("Shaders Paper dependency is declared", () => {
	assert.equal(JSON.parse(PACKAGE_SOURCE).dependencies["@paper-design/shaders-react"], "^0.0.81");
});

test("Shaders Paper catalog wiring covers every shader route", () => {
	const navGroupBody = getPaperShaderGroupBody();

	for (const slug of PAPER_SHADER_SLUGS) {
		assert.ok(COMPONENTS_SOURCE.includes(`"${slug}"`), `components.ts missing ${slug}`);
		assert.ok(MANIFEST_SOURCE.includes(`"${slug}"`), `component-manifest.ts missing ${slug}`);
		assert.ok(DETAILS_SOURCE.includes(`slug: "${slug}"`), `visual details missing ${slug}`);
		assert.ok(REGISTRY_SOURCE.includes(`"${slug}": dynamic(() => import("./demos/visual/shaders-paper-demo")`), `registry missing ${slug}`);
		assert.ok(navGroupBody.includes(`"${slug}"`), `Shaders Paper nav group missing ${slug}`);
		assert.ok(DEMO_SOURCE.includes(`"${slug}"`), `demo runtime missing ${slug}`);
	}
});

test("Shaders Paper stay grouped and do not expose ShaderMount as a route", () => {
	assert.match(NAV_UTILS_SOURCE, /"shaders-paper": \[/u);
	assert.doesNotMatch(COMPONENTS_SOURCE, /paper-shader-mount|ShaderMount/u);
	assert.doesNotMatch(MANIFEST_SOURCE, /paper-shader-mount|ShaderMount/u);
	assert.doesNotMatch(REGISTRY_SOURCE, /paper-shader-mount/u);
});

test("Paper image-backed runtime demos use a stable local image", () => {
	assert.match(DEMO_SOURCE, /const DEMO_IMAGE = "\/ambient\/ado\/combo\/primary\/blue\.svg";/u);
	const demosStart = DEMO_SOURCE.indexOf("const PAPER_SHADER_DEMOS");
	assert.notEqual(demosStart, -1, "PAPER_SHADER_DEMOS should be present");
	const demosSource = DEMO_SOURCE.slice(demosStart);

	for (const slug of IMAGE_BACKED_RUNTIME_SLUGS) {
		const start = demosSource.indexOf(`"${slug}":`);
		assert.notEqual(start, -1, `${slug} should be present`);
		const end = demosSource.indexOf("\n\t},", start);
		assert.notEqual(end, -1, `${slug} block should be parseable`);
		assert.match(demosSource.slice(start, end), /image: DEMO_IMAGE/u, `${slug} should use DEMO_IMAGE`);
	}
});

test("Paper shader demos expose generated GUI controls", () => {
	assert.match(DEMO_SOURCE, /import \{ GUI \} from "@\/components\/utils\/gui";/u);
	assert.match(DEMO_SOURCE, /<GUI\.Panel title="Shader controls" values=\{values\}>/u);
	assert.match(DEMO_SOURCE, /label="Preset"/u);
	assert.match(DEMO_SOURCE, /<GUI\.ImageInput/u);
	assert.match(DEMO_SOURCE, /<GUI\.ColorList/u);
	assert.match(DEMO_SOURCE, /<GUI\.ColorInput/u);
	assert.match(DEMO_SOURCE, /<GUI\.Toggle/u);
	assert.match(DEMO_SOURCE, /<GUI\.Select/u);
	assert.match(DEMO_SOURCE, /<GUI\.Control/u);
	assert.match(DEMO_SOURCE, /valueKeys=\{controlKey\}/u);
	assert.match(DEMO_SOURCE, /valueKeys="preset"/u);
	assert.match(DEMO_SOURCE, /PAPER_SHADER_NUMBER_CONTROL_META/u);
	assert.match(DEMO_SOURCE, /PAPER_SHADER_SELECT_OPTIONS/u);
	assert.match(DEMO_SOURCE, /PAPER_SHADER_COLOR_LIMITS/u);
	assert.doesNotMatch(DEMO_SOURCE, /rendered with the first/u);
});

test("Paper shader preview centers inside the full-width docs shell", () => {
	assert.match(DEMO_SOURCE, /className="mx-auto flex w-full max-w-2xl flex-col"/u);
});

test("Paper shader catalog previews use the component slug instead of the current route", () => {
	assert.match(WEBSITE_PREVIEW_SOURCE, /<PreviewDemo slug=\{slug\} \/>/u);
	assert.match(DEMO_SOURCE, /type PaperShadersDemoProps = \{\n\tslug\?: string;\n\};/u);
	assert.match(DEMO_SOURCE, /function getPaperShaderSlug\(previewSlug: string \| undefined, pathname: string \| null\): PaperShaderSlug/u);
	assert.match(DEMO_SOURCE, /if \(previewSlug && previewSlug in PAPER_SHADER_DEMOS\) \{/u);
	assert.match(DEMO_SOURCE, /const slug = getPaperShaderSlug\(previewSlug, pathname\);/u);
});

test("Paper shader controls match the live site control surface", () => {
	assert.match(DEMO_SOURCE, /fit: \["contain", "cover"\]/u);
	assert.doesNotMatch(DEMO_SOURCE, /fit: \["none"/u);
	assert.match(DEMO_SOURCE, /const INTERNAL_CONTROL_KEYS = new Set\(\["frame", "originX", "originY", "worldWidth", "worldHeight"\]\);/u);
	assert.match(DEMO_SOURCE, /const PAPER_SHADER_VISIBLE_COMMON_CONTROL_KEYS/u);
	assert.match(DEMO_SOURCE, /"paper-mesh-gradient": \["speed", "scale", "rotation", "offsetX", "offsetY"\]/u);
	assert.match(DEMO_SOURCE, /"paper-static-radial-gradient": \["offsetX", "offsetY"\]/u);
	assert.match(DEMO_SOURCE, /"paper-fluted-glass": \["marginLeft", "marginRight", "marginTop", "marginBottom"\]/u);
	assert.match(DEMO_SOURCE, /"paper-pulsing-border": \["margin"\]/u);
	assert.match(DEMO_SOURCE, /getPaperShaderControlGroups\(slug, params\)/u);
});

test("Paper shader routes cover the published package presets", async () => {
	const paper = await import("@paper-design/shaders-react");
	const publishedSlugs = Object.keys(paper)
		.filter((name) => name.endsWith("Presets"))
		.map((name) => `paper-${name.replace(/Presets$/u, "").replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`);
	assert.deepEqual([...PAPER_SHADER_SLUGS].sort(), publishedSlugs.sort());
	assert.equal((DEMO_SOURCE.match(/\n\t\tcomponent: /gu) ?? []).length, PAPER_SHADER_SLUGS.length);
	assert.equal((getPaperShaderGroupBody().match(/"paper-[a-z-]+"/gu) ?? []).length, PAPER_SHADER_SLUGS.length);
});

async function renderShaderDemo(slug) {
	const paper = await import("@paper-design/shaders-react");
	// Keep the published presets; replace only the GPU host so props are observable.
	const shaderMock = Object.entries(paper).map(([name, value]) => name.endsWith("Presets")
		? `export const ${name} = ${JSON.stringify(value)};`
		: `export function ${name}(props) { return <output data-shader="${name}" data-props={JSON.stringify(props)} />; }`
	).join("\n");
	return renderComponent({
		entry: "components/website/demos/visual/shaders-paper-demo.tsx",
		props: { slug },
		mocks: {
			"@paper-design/shaders-react": shaderMock,
			"motion/react": "export const useReducedMotion = () => true;",
		},
	});
}

function renderedShaderProps(view) {
	return JSON.parse(view.container.querySelector("output[data-shader]").getAttribute("data-props"));
}

test("Paper Texture exposes the rebuilt controls, signed distortion, and standalone mode", async () => {
	const view = await renderShaderDemo("paper-paper-texture");
	const props = renderedShaderProps(view);
	for (const key of ["colorPaper", "colorShadow", "blending", "clip", "angle", "roughnessSize", "roughnessRows", "foldSizeX", "foldSizeY", "foldOffsetX", "foldOffsetY", "wrinkles", "wrinkleSize", "crumpleCount"]) {
		assert.ok(Object.hasOwn(props, key), `missing rebuilt prop ${key}`);
		assert.ok(view.container.querySelector(`[id^="paper-paper-texture-${key}"]`) !== null, `missing control ${key}`);
	}
	for (const key of ["colorFront", "contrast", "fade", "foldCount", "crumpleSize"]) {
		assert.equal(Object.hasOwn(props, key), false, `retired prop ${key}`);
	}
	assert.deepEqual(PAPER_TEXTURE_NUMBER_CONTROLS.distortion, { min: -1, max: 1, step: 0.01 });
	assert.deepEqual(PAPER_TEXTURE_NUMBER_CONTROLS.crumpleCount, { min: 2, max: 15, step: 1 });
	await view.fill(view.getByRole("textbox", { name: "Distortion" }), "-1");
	assert.equal(renderedShaderProps(view).distortion, -1);
	await view.click(view.getByRole("button", { name: "Clear" }));
	assert.equal(renderedShaderProps(view).image, undefined);
	await view.click(view.getByRole("button", { name: "Creased" }));
	assert.equal(renderedShaderProps(view).distortion, -0.5);
	assert.equal(renderedShaderProps(view).crumpleCount, 4);
	assert.equal(renderedShaderProps(view).image, undefined);
	assert.equal(renderedShaderProps(view).speed, 0);
});

test("Lens Distortion exposes normalized noise offset and the full layer count range", async () => {
	const view = await renderShaderDemo("paper-lens-distortion");
	assert.equal(view.container.querySelector("output").getAttribute("data-shader"), "LensDistortion");
	assert.equal(renderedShaderProps(view).image, "/ambient/ado/combo/primary/blue.svg");
	assert.deepEqual(LENS_DISTORTION_NUMBER_CONTROLS.count, { min: 2, max: 50, step: 1 });
	await view.fill(view.getByRole("textbox", { name: "Count" }), "50");
	assert.equal(renderedShaderProps(view).count, 50);
	assert.deepEqual(LENS_DISTORTION_NUMBER_CONTROLS.noiseOffset, { min: 0, max: 1, step: 0.01 });
	await view.fill(view.getByRole("textbox", { name: "Noise Offset" }), "0.01");
	assert.equal(renderedShaderProps(view).noiseOffset, 0.01);
	await view.fill(view.getByRole("textbox", { name: "Swirl" }), "-1");
	assert.equal(renderedShaderProps(view).swirl, -1);
	assert.equal(view.queryByRole("button", { name: "Clear" }) === null, true);
});
