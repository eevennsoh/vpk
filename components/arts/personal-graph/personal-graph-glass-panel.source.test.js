const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const GLASS_PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "personal-graph-glass-panel.tsx"),
	"utf8",
);

test("Personal Graph glass surfaces use the demo glass values with chromatic RGB offsets", () => {
	assert.match(
		GLASS_PANEL_SOURCE,
		/import \{ Button, type ButtonProps \} from "@\/components\/ui\/button";/,
	);
	assert.match(
		GLASS_PANEL_SOURCE,
		/import \{[\s\S]*LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS,[\s\S]*\} from "@\/components\/website\/demos\/visual\/shaders\/liquid-glass-button";/,
	);
	assert.match(
		GLASS_PANEL_SOURCE,
		/export const PERSONAL_GRAPH_DEMO_GLASS_PROPS = \{\s+\.\.\.LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS,\s+displace: 5,\s+redOffset: 0,\s+greenOffset: 0,\s+blueOffset: 0,\s+xChannel: "R",\s+yChannel: "G",\s+\} satisfies PersonalGraphGlassTuningProps;/,
	);
	assert.match(
		GLASS_PANEL_SOURCE,
		/export const PERSONAL_GRAPH_CHROMATIC_RGB_GLASS_PROPS = \{\s+\.\.\.PERSONAL_GRAPH_DEMO_GLASS_PROPS,\s+distortionScale: -180,\s+dispersion: 0,\s+redOffset: 50,\s+greenOffset: -1,\s+blueOffset: -19,\s+\} satisfies PersonalGraphGlassTuningProps;/,
	);
	assert.match(
		GLASS_PANEL_SOURCE,
		/<LiquidGlass[\s\S]*\{\.\.\.PERSONAL_GRAPH_CHROMATIC_RGB_GLASS_PROPS\}[\s\S]*borderRadius=\{radius\}/,
	);
	assert.match(
		GLASS_PANEL_SOURCE,
		/const PERSONAL_GRAPH_LIQUID_GLASS_ICON_BUTTON_PROPS = \{\s+\.\.\.PERSONAL_GRAPH_CHROMATIC_RGB_GLASS_PROPS,\s+backgroundOpacity: 0,\s+borderOpacity: 0,\s+fallbackBackgroundOpacity: 0,\s+\} satisfies Partial<LiquidGlassProps>;/,
	);
	assert.match(GLASS_PANEL_SOURCE, /glassProps\?: PersonalGraphGlassTuningProps;/);
	assert.match(GLASS_PANEL_SOURCE, /\{\.\.\.glassProps\}/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /backgroundOpacity=\{PERSONAL_GRAPH_GLASS_BACKGROUND_OPACITY\}/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /distortionScale=\{-64\}/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /chromaticEdge/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /PERSONAL_GRAPH_CHROMATIC_EDGE_STYLE/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /data-personal-graph-chromatic-edge/);
});

test("Personal Graph liquid glass icon buttons preserve the previous icon glyph size", () => {
	assert.match(GLASS_PANEL_SOURCE, /import \{ Button, type ButtonProps \} from "@\/components\/ui\/button";/);
	assert.match(GLASS_PANEL_SOURCE, /PersonalGraphLiquidGlassIconButton/);
	assert.match(GLASS_PANEL_SOURCE, /size="icon"/);
	assert.match(GLASS_PANEL_SOURCE, /className=\{cn\(/);
});

test("Personal Graph liquid glass icon buttons inherit shared ghost expanded state", async () => {
	assert.match(GLASS_PANEL_SOURCE, /<Button/);
	assert.match(GLASS_PANEL_SOURCE, /variant="ghost"/);
	assert.match(GLASS_PANEL_SOURCE, /size="icon"/);
	const view = await renderComponent({
		entry: "components/arts/personal-graph/personal-graph-glass-panel.tsx",
		exportName: "PersonalGraphLiquidGlassIconButton",
		props: { "aria-label": "Search graph", "aria-expanded": true },
		mocks: { "@/components/website/demos/visual/shaders/liquid-glass": "export default function LiquidGlass() { return null; }" },
	});
	const button = view.getByRole("button", { name: "Search graph" });
	assert.equal(button.getAttribute("aria-expanded"), "true");
	for (const className of ["aria-expanded:bg-bg-selected", "aria-expanded:text-text-selected", "aria-expanded:border-border-selected"]) {
		assert.equal(button.classList.contains(className), true, className);
	}
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /aria-expanded:!bg-transparent/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /aria-expanded:!text-text-subtle/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /aria-expanded:!border-transparent/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /aria-expanded:\[&_svg\]:!text-icon-subtle/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /<LiquidGlassButton/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /buttonVariants/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /pointerFill=\{false\}/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /PERSONAL_GRAPH_SEARCH_ICON_BUTTON_CLASS_NAME/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /PERSONAL_GRAPH_SEARCH_ICON_BUTTON_GLASS_PROPS/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /dark:aria-expanded:bg-bg-selected/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /className: "!shadow-none dark:hidden"/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /pointerLayers: false/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /borderWidth: 0/);
});

test("Personal Graph liquid glass wrappers enable stage pointer tracking by default", () => {
	assert.match(
		GLASS_PANEL_SOURCE,
		/import \{[\s\S]*createContext,[\s\S]*use,[\s\S]*useCallback,[\s\S]*useEffect,[\s\S]*useRef,[\s\S]*type ReactNode,[\s\S]*type RefObject,[\s\S]*\} from "react";/,
	);
	assert.match(
		GLASS_PANEL_SOURCE,
		/const PERSONAL_GRAPH_LIQUID_GLASS_POINTER_ACTIVATION_RADIUS = Number\.POSITIVE_INFINITY;/,
	);
	assert.match(
		GLASS_PANEL_SOURCE,
		/const PERSONAL_GRAPH_LIQUID_GLASS_POINTER_SMOOTHING = 0\.2;/,
	);
	assert.match(GLASS_PANEL_SOURCE, /const PersonalGraphLiquidGlassStageContext = createContext/);
	assert.match(GLASS_PANEL_SOURCE, /export function PersonalGraphLiquidGlassStageProvider/);
	assert.match(GLASS_PANEL_SOURCE, /mouseContainer: stageRef/);
	assert.match(GLASS_PANEL_SOURCE, /pointerLayers: true/);
	assert.match(GLASS_PANEL_SOURCE, /pointerSmoothing: PERSONAL_GRAPH_LIQUID_GLASS_POINTER_SMOOTHING/);
	assert.match(GLASS_PANEL_SOURCE, /const buttonRef = useRef<HTMLButtonElement>\(null\);/);
	assert.match(GLASS_PANEL_SOURCE, /const smoothingAmount = clamp\(\s+PERSONAL_GRAPH_LIQUID_GLASS_POINTER_SMOOTHING,/);
	assert.match(GLASS_PANEL_SOURCE, /target\.addEventListener\("pointermove", handlePointerMove, \{ passive: true \}\);/);
	assert.match(GLASS_PANEL_SOURCE, /--liquid-glass-button-strength/);
	assert.match(
		GLASS_PANEL_SOURCE,
		/<LiquidGlass[\s\S]*\{\.\.\.getPersonalGraphStageTrackingGlassProps\(stageRef\)\}/,
	);
	assert.match(
		GLASS_PANEL_SOURCE,
		/const resolvedGlassProps = \{[\s\S]*\.\.\.stageTrackingGlassProps,[\s\S]*\.\.\.glassProps,[\s\S]*\} satisfies PersonalGraphGlassTuningProps;/,
	);
});
