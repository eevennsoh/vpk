const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));
const test = require("node:test");
const esbuild = require("esbuild");

const GLASS_TABS_FILE = path.join(__dirname, "glass-tabs.tsx");
const GLASS_TABS_MOTION_FILE = path.join(__dirname, "glass-tabs-motion.ts");
const GLASS_TABS_SOURCE = fs.readFileSync(GLASS_TABS_FILE, "utf8");
const GLASS_TABS_MOTION_SOURCE = fs.readFileSync(
	GLASS_TABS_MOTION_FILE,
	"utf8",
);

async function loadGlassTabsMotionHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import { getGlassTabsKeyboardIndex } from "./components/visual/glass-tabs-motion.ts";

				export { getGlassTabsKeyboardIndex };
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "glass-tabs-motion-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("GlassTabs keeps the tighter keyboard animation path in the shared motion hook", () => {
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const KEYBOARD_SPRING = \{/,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const KEYBOARD_MAX_STRETCH_PX = 8;/,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const KEYBOARD_STRETCH_RATIO = 0\.06;/,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const EDGE_PILL_STRETCH_FOLLOW_RATIO = 0\.94;/,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/function getEdgeFollowerLeft\(\s*baseLeft: number,\s*stretch: number,\s*index: number \| null,\s*\): number \{/s,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/function getEdgeFollowerWidth\(\s*baseWidth: number,\s*stretch: number,\s*index: number \| null,\s*lastIndex: number,\s*\): number \{/s,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const selectionInputModeRef = useRef<"pointer" \| "keyboard">\("pointer"\);/,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/selectionInputModeRef\.current = "keyboard";/,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const isKeyboardSelection = selectionInputModeRef\.current === "keyboard";/,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const motionSpring = isKeyboardSelection \? KEYBOARD_SPRING : SPRING;/,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/if \(isKeyboardSelection\) \{[\s\S]*const keyboardOptions = \{\s+\.\.\.motionSpring,\s+onComplete: \(\) => \{\s+leftAnimRef\.current = null;\s+widthAnimRef\.current = null;\s+\},\s+\};\s+leftAnimRef\.current = animate\(pillLeft, target\.left, keyboardOptions\);\s+widthAnimRef\.current = animate\(pillWidth, target\.width, keyboardOptions\);\s+return;\s+\}/s,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const stretchCap = isKeyboardSelection\s+\? KEYBOARD_MAX_STRETCH_PX\s+\: MAX_STRETCH_PX;/s,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const stretchRatio = isKeyboardSelection\s+\? KEYBOARD_STRETCH_RATIO\s+\: PILL_STRETCH_RATIO;/s,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/return baseWidth \+ stretch \* EDGE_PILL_STRETCH_FOLLOW_RATIO;/,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const pillDisplayLeft = useTransform\(\(\) => \{\s+return getEdgeFollowerLeft\(\s+pillLeft\.get\(\),\s+shellStretch\.get\(\),\s+selectedIndexRef\.current,\s+\);\s+\}\);/s,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/const hoverPillDisplayWidth = useTransform\(\(\) => \{\s+return getEdgeFollowerWidth\(\s+hoverPillWidth\.get\(\),\s+shellStretch\.get\(\),\s+hoveredIndexRef\.current,\s+lastIndex,\s+\);\s+\}\);/s,
	);
	assert.match(
		GLASS_TABS_MOTION_SOURCE,
		/if \(\s*keyboardSelectionPulseKey === previousKeyboardSelectionPulseKeyRef\.current\s*\) \{/,
	);
});

test("GlassTabs keyboard navigation clamps at the first and last option instead of cycling", async () => {
	const { getGlassTabsKeyboardIndex } = await loadGlassTabsMotionHarness();

	assert.equal(getGlassTabsKeyboardIndex("ArrowLeft", 0, 4), 0);
	assert.equal(getGlassTabsKeyboardIndex("ArrowUp", 0, 4), 0);
	assert.equal(getGlassTabsKeyboardIndex("ArrowRight", 3, 4), 3);
	assert.equal(getGlassTabsKeyboardIndex("ArrowDown", 3, 4), 3);
	assert.equal(getGlassTabsKeyboardIndex("ArrowRight", 1, 4), 2);
	assert.equal(getGlassTabsKeyboardIndex("ArrowLeft", 2, 4), 1);
	assert.equal(getGlassTabsKeyboardIndex("Home", 2, 4), 0);
	assert.equal(getGlassTabsKeyboardIndex("End", 1, 4), 3);
});

test("GlassTabs exposes the shared controlled component surface", () => {
	assert.match(
		GLASS_TABS_SOURCE,
		/export interface GlassTabsOption<TValue extends string> \{/,
	);
	assert.match(
		GLASS_TABS_SOURCE,
		/export interface GlassTabsProps<TValue extends string> \{/,
	);
	assert.match(
		GLASS_TABS_SOURCE,
		/keyboardSelectionPulseKey\?: number;/,
	);
	assert.match(
		GLASS_TABS_SOURCE,
		/export function GlassTabs<TValue extends string>\(/,
	);
	assert.match(
		GLASS_TABS_SOURCE,
		/<motion\.span[\s\S]*style=\{\{ x: labelMagnetX, y: labelMagnetY \}\}/,
	);
	assert.match(
		GLASS_TABS_SOURCE,
		/backgroundColor:\s+"color-mix\(in srgb, var\(--ds-surface\) 85%, transparent\)"/,
	);
	assert.doesNotMatch(GLASS_TABS_SOURCE, /focus-visible:ring-/);
});
