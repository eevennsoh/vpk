const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const ROOT = path.join(__dirname, "..", "..");

function readRepoFile(...segments) {
	return fs.readFileSync(path.join(ROOT, ...segments), "utf8");
}

const INDEX_SOURCE = readRepoFile("components/ui-custom/rovo-illustration/index.tsx");
const SPOT_SOURCE = readRepoFile("components/ui-custom/rovo-illustration/spot-illustration.tsx");
const SPOT_CONFIG_SOURCE = readRepoFile("components/ui-custom/rovo-illustration/spot-illustration-config.ts");
const SPOT_PROCESS_SOURCE = readRepoFile("components/ui-custom/rovo-illustration/spot-illustration-process.ts");
const CONTROLLED_SOURCE = readRepoFile("components/ui-custom/rovo-illustration/controlled-spot-illustration.tsx");
const ASSETS_SOURCE = readRepoFile("components/ui-custom/rovo-illustration/assets.generated.ts");
const DEMO_SOURCE = readRepoFile("components/website/demos/ui-custom/rovo-illustration-demo.tsx");
const COMPONENTS_SOURCE = readRepoFile("app/data/components.ts");
const MANIFEST_SOURCE = readRepoFile("app/data/component-manifest.ts");
const DETAILS_SOURCE = readDetailCategorySource("ui-custom");
const REGISTRY_SOURCE = readWebsiteRegistrySource();

test("Rovo Illustration restores the embedded spot illustration API", () => {
	assert.match(INDEX_SOURCE, /export const RovoIllustration = SpotIllustration;/u);
	assert.match(INDEX_SOURCE, /export const ControlledRovoIllustration = ControlledSpotIllustration;/u);
	assert.match(SPOT_SOURCE, /getEmbeddedSpotIllustrationSvg/u);
	assert.match(SPOT_CONFIG_SOURCE, /id: "ai-first-jira"/u);
	assert.match(SPOT_CONFIG_SOURCE, /id: "deep-research"/u);
});

test("Rovo Illustration rotates clipped mosaics around their own mask center", () => {
	assert.match(SPOT_PROCESS_SOURCE, /function getMosaicMaskBounds/u);
	assert.match(SPOT_PROCESS_SOURCE, /function getMosaicBaseUnderlayFills/u);
	assert.match(SPOT_PROCESS_SOURCE, /mg\.getAttribute\('mask'\)/u);
	assert.match(SPOT_PROCESS_SOURCE, /transform-origin: \$\{maskCenterX\}px \$\{maskCenterY\}px/u);
	assert.match(SPOT_PROCESS_SOURCE, /data-mosaic-base-underlay/u);
	assert.doesNotMatch(SPOT_PROCESS_SOURCE, /data-mosaic-color-guard/u);
	assert.doesNotMatch(SPOT_PROCESS_SOURCE, /transform-origin: \$\{cx\}px \$\{cy\}px/u);
});

test("Rovo Illustration is wired into the ui-custom catalog route", () => {
	assert.match(DEMO_SOURCE, /from "@\/components\/ui-custom\/rovo-illustration"/u);
	assert.ok(COMPONENTS_SOURCE.includes('customComponent("rovo-illustration", "Rovo Illustration")'));
	assert.ok(MANIFEST_SOURCE.includes('customComponent("rovo-illustration", "Rovo Illustration")'));
	assert.match(DETAILS_SOURCE, /"rovo-illustration": \{/u);
	assert.match(REGISTRY_SOURCE, /"rovo-illustration": dynamic\(\s*\(\) => import\("\.\/demos\/ui-custom\/rovo-illustration-demo"\)/u);
});

test("Rovo Illustration demo exposes Chat and Brainstorm animations", () => {
	assert.match(SPOT_CONFIG_SOURCE, /id: "chat", label: "Chat"/u);
	assert.match(SPOT_CONFIG_SOURCE, /id: "brainstorm", label: "Brainstorm"/u);
	assert.match(SPOT_CONFIG_SOURCE, /'brainstorm': \{ grey: \[2, 3\], mosaic: \[1\], overlap: \[4\] \}/u);
	assert.match(ASSETS_SOURCE, /"brainstorm": BRAINSTORM_LIGHT_SVG/u);
	assert.match(ASSETS_SOURCE, /"brainstorm": BRAINSTORM_DARK_SVG/u);
	assert.match(DEMO_SOURCE, /illusIds=\{SPOT_ILLUSTRATIONS\.map/u);
	assert.match(DEMO_SOURCE, /SPOT_ILLUSTRATIONS\.map\(\(illustration\) => \(/u);
	assert.doesNotMatch(DEMO_SOURCE, /FEATURED_ILLUSTRATIONS/u);
	assert.doesNotMatch(DEMO_SOURCE, /SUPPORTING_ILLUSTRATIONS/u);
	assert.doesNotMatch(DEMO_SOURCE, /id !== "chat"/u);
	assert.doesNotMatch(DEMO_SOURCE, /id: "create", label: "Brainstorm"/u);
});

test("Controlled Rovo Illustration scales a default-sized scene into a compact render box", () => {
	assert.match(SPOT_SOURCE, /const pr = size \/ 300;/u);
	assert.doesNotMatch(SPOT_SOURCE, /motionSize/u);
	assert.match(CONTROLLED_SOURCE, /motionSize\?: number;/u);
	assert.match(CONTROLLED_SOURCE, /function GenericControlledSpotIllustration\(\{[\s\S]*motionSize = size/u);
	assert.match(CONTROLLED_SOURCE, /motionSize = size/u);
	assert.match(CONTROLLED_SOURCE, /const stageSize = Math\.max\(size, motionSize\);/u);
	assert.match(CONTROLLED_SOURCE, /const stageScale = size \/ stageSize;/u);
	assert.match(CONTROLLED_SOURCE, /overflow: "clip"/u);
	assert.match(CONTROLLED_SOURCE, /transform: `translateX\(-50%\) scale\(\$\{stageScale\}\)`/u);
	assert.match(CONTROLLED_SOURCE, /transformOrigin: "center bottom"/u);
	assert.match(CONTROLLED_SOURCE, /size=\{stageSize\}/u);
});

test("Rovo Illustration keeps the chat overlap canvas in sync with browser zoom", () => {
	assert.match(SPOT_SOURCE, /function getCanvasPixelSize\(devicePixelRatio: number\)/u);
	assert.match(SPOT_SOURCE, /Math\.round\(size \* devicePixelRatio\)/u);
	assert.match(SPOT_SOURCE, /function getResizedIntersectionContext\(canvas: HTMLCanvasElement, devicePixelRatio: number\)/u);
	assert.match(SPOT_SOURCE, /canvas\.width !== pixelSize \|\| canvas\.height !== pixelSize/u);
	assert.match(SPOT_SOURCE, /const dpr = window\.devicePixelRatio \|\| 1;/u);
	assert.match(SPOT_SOURCE, /const \{ ctx, pixelSize \} = getResizedIntersectionContext\(cvs, dpr\);/u);
	assert.match(SPOT_SOURCE, /ctx\.setTransform\(1, 0, 0, 1, 0, 0\);/u);
	assert.match(SPOT_SOURCE, /ctx\.clearRect\(0, 0, pixelSize, pixelSize\);/u);
	assert.doesNotMatch(SPOT_SOURCE, /if \(!intersectionCtxRef\.current\) \{[\s\S]*cvs\.width = size \* dpr/u);
});

test("Rovo Illustration demo includes compact controlled 72 px variants with default motion", () => {
	assert.match(DEMO_SOURCE, /const CONTROLLED_ILLUSTRATION_SIZE = 180;/u);
	assert.match(DEMO_SOURCE, /const COMPACT_CONTROLLED_ILLUSTRATION_SIZE = 72;/u);
	assert.match(DEMO_SOURCE, /className="flex h-\[min\(760px,calc\(100vh-160px\)\)\] w-full flex-col overflow-y-auto overscroll-contain"/u);
	assert.match(DEMO_SOURCE, /className="sticky top-0 z-20 flex justify-end bg-surface pb-3"/u);
	assert.match(DEMO_SOURCE, /aria-label="Replay illustration entrance animations"/u);
	assert.doesNotMatch(DEMO_SOURCE, />\s*Refresh\s*</u);
	assert.match(DEMO_SOURCE, /<IllustrationStage compact key=\{`compact-\$\{illustration\.id\}`\} label=\{`\$\{illustration\.label\} 72 px`\}>/u);
	assert.match(DEMO_SOURCE, /motionSize=\{CONTROLLED_ILLUSTRATION_SIZE\}/u);
	assert.match(DEMO_SOURCE, /size=\{COMPACT_CONTROLLED_ILLUSTRATION_SIZE\}/u);
});
