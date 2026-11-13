const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const esbuild = require("esbuild");
const React = require("react");
const { parseHTML } = require("linkedom");
const { createRoot } = require("react-dom/client");

const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const ROOT = path.join(__dirname, "../../../..");
const COMPONENTS = fs.readFileSync(path.join(ROOT, "app/data/components.ts"), "utf8");
const MANIFEST = fs.readFileSync(path.join(ROOT, "app/data/component-manifest.ts"), "utf8");
const DETAILS_INDEX = fs.readFileSync(path.join(ROOT, "app/data/details/visual.ts"), "utf8");
const DETAIL = fs.readFileSync(path.join(ROOT, "app/data/details/visual/gooey.ts"), "utf8");
const REGISTRY = fs.readFileSync(path.join(ROOT, "components/website/registry/visual.ts"), "utf8");
const DEMO = fs.readFileSync(path.join(__dirname, "gooey-demo.tsx"), "utf8");
const EXAMPLES = fs.readFileSync(path.join(__dirname, "gooey-examples.tsx"), "utf8");
const UTILS = fs.readFileSync(path.join(__dirname, "gooey-demo-utils.ts"), "utf8");
const DRAG = fs.readFileSync(path.join(ROOT, "components/ui-custom/hooks/use-pointer-drag.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(ROOT, "components/visual/gooey/index.ts"), "utf8");
const VARIANT_REGISTRY = REGISTRY.slice(REGISTRY.indexOf("export const VISUAL_VARIANT_DEMOS"));

function loadUsePointerDrag() {
	const entryPoint = path.join(ROOT, "components/ui-custom/hooks/use-pointer-drag.ts");
	const result = esbuild.buildSync({
		entryPoints: [entryPoint],
		bundle: true,
		external: ["react"],
		format: "cjs",
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(ROOT, "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text, "pointer-drag-harness.cjs")
		.usePointerDrag;
}

test("Gooey is a top-level Visual component with local source attribution", () => {
	for (const source of [COMPONENTS, MANIFEST]) {
		assert.match(source, /visualComponent\("gooey", "Gooey", "@\/components\/visual\/gooey"\)/u);
	}
	assert.match(DETAILS_INDEX, /import \{ GOOEY_DETAIL \} from "\.\/visual\/gooey"/u);
	assert.match(DETAILS_INDEX, /gooey: GOOEY_DETAIL/u);
	assert.match(REGISTRY, /VISUAL_DEMOS[\s\S]*gooey: dynamic\(\(\) => import\("\.\.\/demos\/visual\/gooey-demo"\)/u);
	assert.match(REGISTRY, /VISUAL_VARIANT_DEMOS[\s\S]*"gooey-morph-menu"/u);
	assert.match(INDEX, /export const Gooey = Liquid/u);
	assert.ok(DETAIL.includes("https://gooey.jakubantalik.com/"));
	assert.ok(DETAIL.includes("37835a94a54de606ebe6e3a5a1f8d30ddf4303b0"));
	assert.ok(fs.existsSync(path.join(ROOT, "components/visual/gooey/LICENSE")));
});

test("all current upstream effects are registered and documented", () => {
	for (const [slug, exportName, title] of [
		["gooey-morph-menu", "GooeyMorphMenuExample", "Morph plus menu"],
		["gooey-morph-email", "GooeyMorphEmailExample", "Morph email input"],
		["gooey-morph-avatars", "GooeyMorphAvatarExample", "Morph avatar group with dissolve"],
		["gooey-melt-cards", "GooeyMeltCardsExample", "Melt image cards"],
		["gooey-bend-card", "GooeyBendCardExample", "Bend draggable card"],
		["gooey-move-tabs", "GooeyMoveTabsExample", "Move gooey tabs"],
		["gooey-move-slider", "GooeyMoveSliderExample", "Move liquid-rubber slider"],
	]) {
		assert.ok(VARIANT_REGISTRY.includes(`"${slug}": dynamic(`), slug);
		assert.ok(VARIANT_REGISTRY.includes(`default: mod.${exportName}`), exportName);
		assert.ok(DETAIL.includes(`title: "${title}"`), title);
		assert.ok(EXAMPLES.includes(`export function ${exportName}`), exportName);
	}
	assert.match(
		EXAMPLES,
		/min-h-\[352px\] w-full flex-1 self-stretch items-center justify-center overflow-visible/u,
	);
	assert.match(EXAMPLES, /p-0 sm:p-6/u);
	assert.match(EXAMPLES, /h-20 w-full max-w-64/u);
	assert.match(EXAMPLES, /h-16 w-full max-w-\[246px\]/u);
	assert.match(EXAMPLES, /w-full max-w-60/u);
	assert.doesNotMatch(EXAMPLES, /max-w-\[294px\]/u);
});

test("morph menu hides converged satellite icons and uses VPK icons", () => {
	assert.match(EXAMPLES, /from "@\/components\/ui\/vpk-icons"/u);
	assert.doesNotMatch(EXAMPLES, /@atlaskit\/icon/u);
	for (const icon of ["FileIcon", "ImageIcon", "FolderIcon", "PlusIcon"]) {
		assert.ok(EXAMPLES.includes(icon), icon);
	}
	assert.match(EXAMPLES, /open \? "opacity-100 blur-none" : "opacity-0 blur-\[2px\]"/u);
	assert.doesNotMatch(EXAMPLES, /scale=\{open \? 1 : 0\.35\}/u);
	assert.match(EXAMPLES, /x: -54, y: -34/u);
	assert.match(EXAMPLES, /x: 0, y: -64/u);
	assert.match(EXAMPLES, /x: 54, y: -34/u);
});

test("move slider has one liquid-owned thumb surface", () => {
	assert.match(EXAMPLES, /data-gooey-slider-track=""/u);
	assert.match(EXAMPLES, /data-gooey-slider-thumb=""/u);
	assert.match(EXAMPLES, /has-\[:focus-visible\]:outline-2 has-\[:focus-visible\]:outline-offset-2 has-\[:focus-visible\]:outline-border-focused/u);
	assert.match(EXAMPLES, /move=\{\{ springiness: 0\.5, stretch: 0\.6, trail: 0\.35 \}\}/u);
	assert.match(EXAMPLES, /const travel = 188/u);
	assert.match(EXAMPLES, /data-gooey-slider-thumb=""[\s\S]*?className="block size-6 rounded-full"/u);
	assert.doesNotMatch(EXAMPLES, /data-gooey-slider-thumb=""[\s\S]*?bg-primary transition-transform/u);
	assert.doesNotMatch(EXAMPLES, /<Gooey\.Item observe>\s*<span[^>]*data-gooey-slider-track/u);
});

test("hero and draggable examples expose pointer, reset, and keyboard interaction", () => {
	assert.match(DEMO, /usePointerDrag\(/u);
	assert.match(DEMO, /aria-label="Reset Gooey item position"/u);
	assert.match(DEMO, /aria-label="Drag or activate Gooey item; arrow keys also move it"/u);
	assert.match(DEMO, /\{\.\.\.heroDrag\.bind\}/u);
	assert.match(DEMO, /ref=\{heroRootRef\}/u);
	assert.match(DEMO, /data-gooey-playground-root=""/u);
	assert.match(DEMO, /className="min-h-\[360px\] w-full overflow-visible rounded-xl bg-bg-neutral-subtle"/u);
	assert.doesNotMatch(DEMO, /grid min-w-0 items-start/u);
	assert.doesNotMatch(DEMO, /className="absolute inset-4 sm:inset-8"/u);
	assert.doesNotMatch(DEMO, /current\.x >= 0 \? -72 : 36/u);
	assert.equal((DEMO.match(/top: "calc\(50% - 40px\)"/gu) || []).length, 2);
	assert.doesNotMatch(DEMO, /h-44 w-full max-w-80/u);
	assert.match(DRAG, /setPointerCapture\(event\.pointerId\)/u);
	assert.match(DRAG, /onKeyDown/u);
	assert.match(DRAG, /clampPosition/u);
});

test("Gooey drag clamps movement and does not activate after a cancelled pointer drag", async () => {
	const { window } = parseHTML("<!doctype html><html><body><div id='app'></div></body></html>");
	const originalGlobals = {
		document: globalThis.document,
		Event: globalThis.Event,
		HTMLElement: globalThis.HTMLElement,
		Node: globalThis.Node,
		window: globalThis.window,
		actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
	};
	Object.assign(globalThis, {
		document: window.document,
		Event: window.Event,
		HTMLElement: window.HTMLElement,
		Node: window.Node,
		window,
		IS_REACT_ACT_ENVIRONMENT: true,
	});

	const usePointerDrag = loadUsePointerDrag();
	let drag = null;
	let activationCount = 0;
	const capturedPointers = [];
	const releasedPointers = [];
	const dragTarget = {
		hasPointerCapture: (pointerId) => capturedPointers.includes(pointerId),
		releasePointerCapture: (pointerId) => releasedPointers.push(pointerId),
		setPointerCapture: (pointerId) => capturedPointers.push(pointerId),
	};

	function Probe() {
		const [position, setPosition] = React.useState({ x: 10, y: 10 });
		drag = usePointerDrag(
			position,
			setPosition,
			{ minX: 0, maxX: 20, minY: 0, maxY: 20 },
			() => {
				activationCount += 1;
			},
		);
		return null;
	}

	const root = createRoot(window.document.getElementById("app"));
	try {
		await React.act(async () => {
			root.render(React.createElement(Probe));
		});
		await React.act(async () => {
			drag.bind.onPointerDown({
				clientX: 100,
				clientY: 100,
				currentTarget: dragTarget,
				pointerId: 7,
			});
			drag.bind.onPointerMove({ clientX: 130, clientY: 70 });
		});
		assert.deepEqual(drag.position, { x: 20, y: 0 });
		assert.equal(drag.dragging, true);
		assert.deepEqual(capturedPointers, [7]);

		await React.act(async () => {
			drag.bind.onPointerCancel({ currentTarget: dragTarget, pointerId: 7 });
		});
		assert.equal(drag.dragging, false);
		assert.deepEqual(releasedPointers, [7]);

		drag.bind.onClick();
		assert.equal(activationCount, 0, "the click following a drag must be ignored");
		drag.bind.onClick();
		assert.equal(activationCount, 1, "the next independent click still activates the item");
	} finally {
		await React.act(async () => {
			root.unmount();
		});
		Object.assign(globalThis, originalGlobals);
	}
});

test("Gooey component modules keep Fast Refresh exports component-only", () => {
	assert.doesNotMatch(EXAMPLES, /export const GOOEY_SOURCE_SHADOW|export function usePointerDrag/u);
	assert.match(UTILS, /export const GOOEY_SOURCE_SHADOW = \[/u);
	assert.match(DRAG, /export function usePointerDrag/u);
});

test("images never intercept native dragging from Gooey drag targets", () => {
	for (const source of [DEMO, EXAMPLES]) {
		const imageCount = (source.match(/<Image\b/gu) || []).length;
		assert.ok(imageCount > 0);
		assert.equal((source.match(/draggable=\{false\}/gu) || []).length, imageCount);
		assert.equal((source.match(/className="[^"]*pointer-events-none[^"]*select-none[^"]*object-cover[^"]*"/gu) || []).length, imageCount);
	}
});

test("hero drag bounds follow the available preview size", () => {
	assert.match(DEMO, /if \(width === 0 \|\| height === 0\) return/u);
	assert.match(DEMO, /requestAnimationFrame\(measure\)/u);
	assert.match(DEMO, /new ResizeObserver\(measure\)/u);
	assert.match(DEMO, /observer\.observe\(root\)/u);
	assert.match(DEMO, /observer\.disconnect\(\)/u);
	assert.match(DEMO, /getHeroBounds\(width, height, config\.scale\)/u);
	assert.match(DEMO, /min: heroBounds\.minX, max: heroBounds\.maxX/u);
	assert.match(DEMO, /min: heroBounds\.minY, max: heroBounds\.maxY/u);
});

test("liquid borders and elevation belong to the merged Gooey silhouette", () => {
	assert.match(UTILS, /export const GOOEY_SOURCE_SHADOW = \[/u);
	assert.match(UTILS, /0 0 0 1px rgba\(0, 0, 0, 0\.06\)/u);
	assert.match(DEMO, /fill: "var\(--color-surface\)"/u);
	assert.match(DEMO, /shadow: GOOEY_SOURCE_SHADOW/u);
	assert.match(EXAMPLES, /shadow=\{GOOEY_SOURCE_SHADOW\}/u);
	assert.match(EXAMPLES, /shadow=\{GOOEY_THUMB_SHADOW\}/u);
	assert.doesNotMatch(DEMO, /shadow-sm/u);
	assert.doesNotMatch(EXAMPLES, /shadow-sm/u);
	assert.doesNotMatch(DEMO, /bg-surface/u);
	assert.doesNotMatch(EXAMPLES, /bg-surface/u);
	assert.doesNotMatch(DEMO, /Reset Gooey item position"[\s\S]*?className="[^"]*z-10/u);
});

test("pointer dragging bypasses transition inertia while preserving configured transitions", () => {
	assert.match(DEMO, /heroDrag\.dragging \? \{ duration: 0, ease: "linear" \} : transition/u);
	assert.match(DEMO, /transition=\{activeTransition\}/u);
	assert.doesNotMatch(DEMO, /transition: "transform var\(--duration-slower\)/u);
});

test("playground exposes the complete root, item, transition, morph, evolve, move, bend, and dissolve surface", () => {
	for (const section of ["Root", "Item", "Transition", "Morph", "Evolve", "Move", "Bend", "Dissolve"]) {
		assert.ok(DEMO.includes(`title="${section}"`), section);
	}
	for (const control of [
		"Blur", "Contrast", "Fill", "Shadow", "Filter padding", "Waviness", "Wave frequency", "Effect", "X", "Y", "Scale", "Delay", "Observe",
		"Radius", "Item className", "Item style JSON", "Children text", "Transition", "Spring stiffness", "Spring damping", "Spring mass", "Duration", "Easing",
		"Shape", "Speed", "Bounce", "Content blur", "Blob inset", "Bridge grow",
		"Mass stiffness", "Mass damping", "Size stiffness", "Size damping", "Radius stiffness", "Radius damping", "Evolve content blur", "Roundness", "Corner duration", "Corner delay", "Corner ease", "Anticipation", "Travel",
		"Springiness", "Wobble", "Stretch", "Trail", "Raw stiffness", "Raw damping", "Raw stretch", "Raw tail",
		"Vertical bow", "Horizontal caps",
		"Dissolve", "Dissolve blur", "Warp", "Pull", "Range", "Zone", "Mix", "Gravity", "Taper", "Warp frequency", "Flow speed", "Warp style", "Detail", "Active", "Release", "Fade", "Strength", "Sink",
	]) {
		assert.ok(DEMO.includes(`label: "${control}"`) || DEMO.includes(`label="${control}"`), control);
	}
	assert.match(DEMO, /<GUI\.Panel title="Gooey controls" values=\{copiedValues\}>/u);
});

test("interactive example content remains real DOM above the liquid layers", () => {
	assert.match(INDEX, /import \{ Liquid \} from "liquid-gooey"/u);
	assert.match(EXAMPLES, /<button/u);
	assert.match(EXAMPLES, /<input/u);
});

test("melt and bend examples exercise the new 0.2.1 effects", () => {
	assert.match(EXAMPLES, /effect="melt"/u);
	assert.match(EXAMPLES, /effect="bend"/u);
	assert.match(EXAMPLES, /--lg-bend-y/u);
	assert.match(EXAMPLES, /peer-focus-visible:opacity-100/u);
});

test("GUI slider labels reach Base UI thumb inputs", () => {
	const sliderSource = fs.readFileSync(path.join(ROOT, "components/ui/slider.tsx"), "utf8");
	assert.match(sliderSource, /<SliderPrimitive\.Thumb[\s\S]*aria-label=\{ariaLabel/u);
});
