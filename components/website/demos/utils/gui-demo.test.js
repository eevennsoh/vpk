const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const ROOT = process.cwd();
const DEMO_SOURCE = fs.readFileSync(path.join(ROOT, "components/website/demos/utils/gui-demo.tsx"), "utf8");
const DETAILS_SOURCE = fs.readFileSync(path.join(ROOT, "app/data/details/utility.ts"), "utf8");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const { renderComponent } = require(path.join(ROOT, "scripts/lib/render-component.js"));

test("GUI utility docs expose a rendered full-config example", () => {
	assert.match(DETAILS_SOURCE, /examplesContentWidth: "full"/);
	assert.match(DETAILS_SOURCE, /title: "Full config"[\s\S]*demoSlug: "gui-demo-full-config"/);
	assert.match(REGISTRY_SOURCE, /utility: \(\) => import\("@\/components\/website\/registry\/utility"\)\.then\(\(module\) => \(\{ demos: module\.UTILITY_DEMOS, variants: module\.UTILITY_VARIANT_DEMOS \}\)\)/);
	assert.match(REGISTRY_SOURCE, /const UTILITY_VARIANT_DEMOS[\s\S]*"gui-demo-full-config": dynamic\(/);
	assert.match(REGISTRY_SOURCE, /default: mod\.GUIFullConfigDemo/);
	assert.match(DEMO_SOURCE, /export function GUIFullConfigDemo\(\)/);
	assert.match(DEMO_SOURCE, /export default function GUIDemo\(\) \{\n\treturn <GUIFullConfigDemo \/>;\n\}/);
});

test("GUI full-config example covers optional control configuration paths", () => {
	for (const sourceFragment of [
		'description="Pixel size with reset, clamping, unit label, and mounted value key."',
		'description="Normalized 0..1 value displayed as a percentage."',
		'description="Boolean switch with helper copy."',
		'stickyOptionValue="brand"',
		'description="String segmented control with icons."',
		'description="Boolean segmented control path."',
		'{ value: true, label: "Snap" }',
		'{ value: false, label: "Free" }',
		'description="Text input with placeholder and live preview binding."',
		'format="hex"',
		'format="css"',
		'allowAddRemove',
		'addColor="#FFAB00"',
		'maxColors={5}',
		'description="Local file adapter with preview labels, clear action, and value callback."',
		'placeholder="No local image selected"',
		'previewClassName="bg-surface"',
		'uploadLabel="Upload file"',
		'changeLabel="Replace"',
		'clearLabel="Clear image"',
		'showClear',
		'valueKeys={["imageSrc", "imageUploaded"]}',
		"imageUploaded: Boolean(imageSrc)",
		'onChange={setImageSrc}',
		'onFile={handleImageFile}',
		'onClear={clearImage}',
		'description="Ordered multi-select circle swatches with minSelected."',
		'shape="square"',
		'<GUI.Section title="Disabled states" defaultOpen={false}>',
		'const [closedPanelNote, setClosedPanelNote] = useState("Open to mount this value key");',
		"value={closedPanelNote}",
		"onChange={setClosedPanelNote}",
		'id="gui-disabled-amount"',
		'id="gui-disabled-toggle"',
		'id="gui-disabled-color"',
		'id="gui-disabled-stops"',
		'<GUI.Panel title="Starts closed" values={config} defaultOpen={false}>',
	]) {
		assert.ok(
			DEMO_SOURCE.includes(sourceFragment),
			`expected GUI full-config demo to include: ${sourceFragment}`,
		);
	}

	assert.match(DEMO_SOURCE, /id="gui-disabled-amount"[\s\S]*disabled[\s\S]*valueKeys="disabledAmount"/);
	assert.match(DEMO_SOURCE, /id="gui-disabled-toggle"[\s\S]*disabled[\s\S]*valueKeys="disabledToggle"/);
	assert.match(DEMO_SOURCE, /id="gui-disabled-color"[\s\S]*disabled[\s\S]*valueKeys="disabledColor"/);
	assert.match(DEMO_SOURCE, /id="gui-disabled-stops"[\s\S]*disabled[\s\S]*valueKeys="disabledStops"/);
});

test("GUI full-config preview binds interactive controls to visible shader output", () => {
	for (const sourceFragment of [
		'import LiquidGradient from "@/components/visual/liquid-gradient";',
		"parseGUIColorToRgbHex(value) ?? fallback",
		"const selectedTheme = THEME_PREVIEW[theme];",
		"const shaderPalette = useMemo(",
		"rgbaUnitToRgbHex(rgbaColor)",
		"const hasSoftStyle = styleSwatches.includes(\"soft\");",
		"const hasOutlineStyle = styleSwatches.includes(\"outline\");",
		"const hasSolidStyle = styleSwatches.includes(\"solid\");",
		"const isPlaying = playback === \"play\" && enabled;",
		"<LiquidGradient",
		"seed={selectedTheme.seed + actionCount * 17}",
		"speed={isPlaying ? 0.24 + opacity * 0.5 : 0}",
		"loop={snapToGrid ? 12 : 0}",
		"jellify={!snapToGrid || hasSoftStyle}",
		"ditherMode={hasOutlineStyle ? 2 : 1}",
		"{snapToGrid ? \"Snapped\" : \"Free\"}",
		"Runs {actionCount}",
		"transform: snapToGrid ? \"translate3d(0, 0, 0) rotate(0deg)\" : \"translate3d(18px, -12px, 0) rotate(-7deg)\"",
		"key={`gui-demo-action-${actionCount}`}",
		"animationPlayState: isPlaying ? \"running\" : \"paused\"",
	]) {
		assert.ok(
			DEMO_SOURCE.includes(sourceFragment),
			`expected GUI full-config preview to bind visible output: ${sourceFragment}`,
		);
	}
});

test("GUI demo motion controls update preview mode, replay and copied settings", async (context) => {
	const copied = [];
	context.mock.method(navigator.clipboard, "writeText", async (value) => { copied.push(value); });
	const view = await renderComponent({
		entry: "components/website/demos/utils/gui-demo.tsx",
		exportName: "GUIFullConfigDemo",
		mocks: {
			"@/components/visual/liquid-gradient": "export default function LiquidGradient() { return null; }",
		},
	});
	assert.equal(view.container.querySelector("[data-gui-motion-preview]").getAttribute("data-gui-motion-preview"), "easing");
	await view.fill(view.getByRole("textbox", { name: "Bezier X1" }), "0.7");
	await view.click(view.getByRole("button", { name: "Spring" }));
	assert.equal(view.container.querySelector("[data-gui-motion-preview]").getAttribute("data-gui-motion-preview"), "spring");
	assert.equal(view.getByRole("textbox", { name: "Bezier X1" }).matches(":disabled"), true);
	await view.fill(view.getByRole("textbox", { name: "Stiffness" }), "320");
	await view.click(view.getByRole("button", { name: "Replay motion preview" }));
	assert.equal(view.getByText("Runs 1").textContent, "Runs 1");
	await view.click(view.getByRole("button", { name: "Copy values as JSON" }));
	const values = JSON.parse(copied.at(-1));
	assert.equal(values.motionMode, "spring");
	assert.deepEqual(values.motionEasing, [0.7, 0, 0, 1]);
	assert.deepEqual(values.motionSpring, { stiffness: 320, damping: 26, mass: 1 });
	assert.equal(typeof values.motionSeconds, "number");
});
