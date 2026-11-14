const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");

const GRAPH_SOURCE = fs.readFileSync(path.join(__dirname, "graph.tsx"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "graph-demo.tsx"), "utf8");
const RENDERER_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../arts/personal-graph/lib/neural-graph/renderer.ts"),
	"utf8",
);
const INTERACTION_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../arts/personal-graph/lib/neural-graph/interaction.ts"),
	"utf8",
);
const NEURAL_CANVAS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../arts/personal-graph/personal-graph-neural-canvas.tsx"),
	"utf8",
);
const PARAMS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../arts/personal-graph/lib/neural-graph/params.ts"),
	"utf8",
);
const RAY_SOUND_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../arts/personal-graph/lib/neural-graph/ray-sound.ts"),
	"utf8",
);
const COLORS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../arts/personal-graph/lib/neural-graph/colors.ts"),
	"utf8",
);
const COMPONENTS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../../app/data/component-manifest.ts"),
	"utf8",
);
const MANIFEST_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../../app/data/component-manifest.ts"),
	"utf8",
);
const DETAILS_SOURCE = readDetailCategorySource("visual");
const REGISTRY_SOURCE = readWebsiteRegistrySource();

function getGraphDetailsSource() {
	const startMatch = DETAILS_SOURCE.match(/\n(?:"graph"|graph): \{/u);
	assert.ok(startMatch?.index !== undefined);
	const start = startMatch.index + 1;
	const endMatch = DETAILS_SOURCE.slice(start).match(/\n(?:"squircle"|squircle): \{/u);
	assert.ok(endMatch?.index !== undefined);
	const end = start + endMatch.index;
	return DETAILS_SOURCE.slice(start, end);
}

test("Graph is registered as a visual component", () => {
	assert.match(
		COMPONENTS_SOURCE,
		/visualComponent\("graph", "Graph", "@\/components\/website\/demos\/visual\/graph"\)/,
	);
	assert.match(
		MANIFEST_SOURCE,
		/visualComponent\("graph", "Graph", "@\/components\/website\/demos\/visual\/graph"\)/,
	);
	assert.match(REGISTRY_SOURCE, /graph: dynamic\(\(\) => import\("\.\/demos\/visual\/graph-demo"\)/);
	assert.match(DETAILS_SOURCE, /(?:"graph"|graph): \{/u);
});

test("Graph demo renders the reusable Graph visual", () => {
	assert.match(DEMO_SOURCE, /import Graph from "\.\/graph";/);
	assert.match(DEMO_SOURCE, /return <Graph \/>;/);
});

test("Graph visual follows the VPK visual demo control structure", () => {
	assert.match(GRAPH_SOURCE, /PersonalGraphNeuralCanvas/);
	assert.match(GRAPH_SOURCE, /title="Graph controls"/);
	assert.match(GRAPH_SOURCE, /GUI\.Control/);
	assert.match(GRAPH_SOURCE, /GUI\.Select/);
	assert.match(GRAPH_SOURCE, /LAYOUT_SHAPE_OPTIONS/);
	assert.match(GRAPH_SOURCE, /NEURAL_GRAPH_PARAM_SECTIONS/);
	assert.match(GRAPH_SOURCE, /DEFAULT_NEURAL_GRAPH_PARAMS/);
	assert.match(GRAPH_SOURCE, /VISUAL_GRAPH_EXPLORER/);
	assert.match(GRAPH_SOURCE, /max-w-4xl flex-col/);
	assert.match(GRAPH_SOURCE, /data-visual-graph="true"/);
	assert.doesNotMatch(GRAPH_SOURCE, /PersonalGraphNeuralControls/);
	assert.doesNotMatch(GRAPH_SOURCE, /ShaderColorInput/);
});

test("Graph visual can be embedded as the live Personal Graph renderer", () => {
	const graphDetailsSource = getGraphDetailsSource();

	assert.match(GRAPH_SOURCE, /variant\?: "demo" \| "fill"/);
	assert.match(GRAPH_SOURCE, /params\?: NeuralGraphParams/);
	assert.match(GRAPH_SOURCE, /interactionSettings\?: Partial<NeuralGraphInteractionSettings>/);
	assert.match(GRAPH_SOURCE, /raySoundSettings\?: Partial<NeuralRaySoundSettings>/);
	assert.match(GRAPH_SOURCE, /selectedNodeId\?: string \| null/);
	assert.match(GRAPH_SOURCE, /allowEmptySelection\?: boolean;/);
	assert.match(GRAPH_SOURCE, /onSelectedNodeIdChange\?: \(nodeId: string \| null\) => void/);
	assert.match(GRAPH_SOURCE, /isFillVariant \? "flex h-full w-full flex-col"/);
	assert.match(GRAPH_SOURCE, /isLoading=\{isLoading\}/);
	assert.match(GRAPH_SOURCE, /store\?: NeuralGraphStore;/);
	assert.match(GRAPH_SOURCE, /const graphStore = useMemo\(\(\) => providedStore \?\? createNeuralGraphStore\(explorer\), \[explorer, providedStore\]\);/);
	assert.match(GRAPH_SOURCE, /const fallbackSelectedNodeId = getDefaultNeuralGraphSelectedNodeId\(graphStore\);/);
	assert.match(GRAPH_SOURCE, /function resolveGraphSelectedNodeId\(/);
	assert.match(GRAPH_SOURCE, /if \(allowEmptySelection\) return null;/);
	assert.match(GRAPH_SOURCE, /const nextSelectedNodeId = allowEmptySelection \? null : fallbackSelectedNodeId;/);
	assert.match(GRAPH_SOURCE, /onSelectedNodeIdChange\?\.\(nextSelectedNodeId\)/);
	assert.match(GRAPH_SOURCE, /store=\{graphStore\}/);
	assert.match(NEURAL_CANVAS_SOURCE, /store\?: NeuralGraphStore;/);
	assert.match(NEURAL_CANVAS_SOURCE, /const store = useMemo\(\(\) => providedStore \?\? createNeuralGraphStore\(explorer\), \[explorer, providedStore\]\);/);
	for (const propName of [
		"background",
		"interactionSettings",
		"params",
		"onParamsChange",
		"rayOriginBottomOffset",
		"raySoundSettings",
		"selectedNodeId",
		"onSelectedNodeIdChange",
		"showSelectionOverlay",
		"themeMode",
		"variant",
	]) {
		assert.match(graphDetailsSource, new RegExp(`name: "${propName}"`));
	}
	assert.match(graphDetailsSource, /flow, structure, radial, cone, icon-token node type colors, edge color states, signal streaks, ray elasticity, origin node, hover, label, and node style controls/);
});

test("Graph renderer keeps the default connector stroke width at 2 via params", () => {
	assert.match(PARAMS_SOURCE, /edgeWidth: 2,/);
	assert.match(PARAMS_SOURCE, /rayWidth: 2,/);
	assert.match(RENDERER_SOURCE, /ctx\.lineWidth = options\.params\.rayWidth;/);
	assert.match(RENDERER_SOURCE, /const edgeWidths = getEdgeLineWidth\(options\.params\);/);
	assert.match(
		RENDERER_SOURCE,
		/ctx\.lineWidth = active \? lerp\(activeLineWidth, focusedLineWidth, focusProgress\) : idleLineWidth;/,
	);
});

test("Graph renderer exposes hover, ray, edge, and label toggles through params", () => {
	assert.match(RENDERER_SOURCE, /if \(!options\.params\.showRays\) return;/);
	assert.match(RENDERER_SOURCE, /if \(!options\.params\.showEdges\) return;/);
	assert.match(RENDERER_SOURCE, /if \(!options\.params\.showLabels\) return;/);
	assert.match(GRAPH_SOURCE, /originY: 0\.52/);
	assert.match(GRAPH_SOURCE, /rayOriginY: 0\.52/);
	assert.match(GRAPH_SOURCE, /layoutShape: "radialCluster"/);
	assert.match(GRAPH_SOURCE, /radialArcAngle: 360/);
	assert.match(GRAPH_SOURCE, /radialDepthCurve: 0\.8/);
	assert.match(GRAPH_SOURCE, /rayElasticStrength: 26/);
	assert.match(GRAPH_SOURCE, /rayElasticRadius: 96/);
	assert.match(GRAPH_SOURCE, /rayElasticTension: 220/);
	assert.match(GRAPH_SOURCE, /rayElasticDamping: 24/);
	assert.match(PARAMS_SOURCE, /key: "rayOriginY", label: "Tail Y"/);
	assert.match(PARAMS_SOURCE, /key: "radialArcAngle", label: "Arc Angle"/);
	assert.match(PARAMS_SOURCE, /key: "radialDepthCurve", label: "Depth Curve"/);
	assert.match(PARAMS_SOURCE, /key: "rayElasticStrength", label: "Elastic strength"/);
	assert.match(PARAMS_SOURCE, /key: "rayElasticRadius", label: "Elastic radius"/);
	assert.match(PARAMS_SOURCE, /key: "rayElasticTension", label: "Elastic tension"/);
	assert.match(PARAMS_SOURCE, /key: "rayElasticDamping", label: "Elastic damping"/);
	assert.match(RENDERER_SOURCE, /function getRayOrigin/);
	assert.match(RENDERER_SOURCE, /function getElasticRayCurve/);
	assert.match(NEURAL_CANVAS_SOURCE, /hitTestNeuralRay/);
	assert.match(NEURAL_CANVAS_SOURCE, /rayElastic: !reduceMotion && rayElasticRef\.current\.progress > 0 \? rayElasticRef\.current : null/);
	assert.match(RENDERER_SOURCE, /viewport\.height \* params\.rayOriginY/);
	assert.match(NEURAL_CANVAS_SOURCE, /data-neural-graph-origin-node="true"/);
	assert.match(NEURAL_CANVAS_SOURCE, /const rayOriginY = getRayOriginY\(\{ params, rayOriginBottomOffset, viewport \}\);/);
	assert.match(NEURAL_CANVAS_SOURCE, /style=\{getOriginMarkerStyleForViewport\(params, viewport, rayOriginY\)\}/);
	assert.match(NEURAL_CANVAS_SOURCE, /params\.showRays && params\.showOriginMarker && hasMeasuredViewport \? \(/);
	assert.match(NEURAL_CANVAS_SOURCE, /backgroundColor: params\.originMarkerColor/);
	assert.match(NEURAL_CANVAS_SOURCE, /borderRadius: params\.nodeShape === "square" \? params\.nodeRadius : 9999/);
	assert.match(NEURAL_CANVAS_SOURCE, /height: params\.originMarkerSize/);
	assert.doesNotMatch(NEURAL_CANVAS_SOURCE, /border-2/);
	assert.match(RENDERER_SOURCE, /options\.params\.hoverScale/);
	assert.match(RENDERER_SOURCE, /getNodeViewportRadius\(node, options\.camera, options\.params, options\.selectedNodeId\)/);
	assert.match(INTERACTION_SOURCE, /params\.selectedScale/);
	assert.match(RENDERER_SOURCE, /function getNodeTypeColor/);
	assert.match(RENDERER_SOURCE, /function shouldRevealNodeTypeColors/);
	assert.match(RENDERER_SOURCE, /options\.params\.edgeColor/);
	assert.match(RENDERER_SOURCE, /options\.params\.edgeHoverColor/);
	assert.match(RENDERER_SOURCE, /options\.params\.edgeSelectedColor/);
	assert.match(RENDERER_SOURCE, /options\.params\.glowSize/);
	assert.match(RENDERER_SOURCE, /options\.params\.glowIntensity/);
	assert.match(RENDERER_SOURCE, /options\.params\.labelSize/);
	assert.match(RENDERER_SOURCE, /options\.params\.labelMetaSize/);
});

test("Graph ray sound controls stay demo-local and outside visual params", () => {
	assert.match(GRAPH_SOURCE, /DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS/);
	assert.match(GRAPH_SOURCE, /DEFAULT_NEURAL_RAY_SOUND_SETTINGS/);
	assert.match(GRAPH_SOURCE, /type NeuralGraphInteractionSettings/);
	assert.match(GRAPH_SOURCE, /type NeuralRaySoundSettings/);
	assert.match(GRAPH_SOURCE, /title="Interaction"/);
	assert.match(GRAPH_SOURCE, /label="Interaction enabled"/);
	assert.match(GRAPH_SOURCE, /label="Interaction intensity"/);
	assert.match(GRAPH_SOURCE, /label="Flow boost"/);
	assert.match(GRAPH_SOURCE, /label="Ray emphasis"/);
	assert.match(GRAPH_SOURCE, /label="Node sound enabled"/);
	assert.match(GRAPH_SOURCE, /label="Node volume"/);
	assert.match(GRAPH_SOURCE, /label="Node cooldown"/);
	assert.match(GRAPH_SOURCE, /title="Ray sound"/);
	assert.match(GRAPH_SOURCE, /label="Sound enabled"/);
	assert.match(GRAPH_SOURCE, /label="Volume"/);
	assert.match(GRAPH_SOURCE, /label="Cooldown"/);
	assert.match(GRAPH_SOURCE, /label="Pitch spread"/);
	assert.match(GRAPH_SOURCE, /const canvasInteractionSettings = showControls \? demoInteractionSettings : controlledInteractionSettings;/);
	assert.match(GRAPH_SOURCE, /const canvasRaySoundSettings = showControls \? demoRaySoundSettings : controlledRaySoundSettings;/);
	assert.match(GRAPH_SOURCE, /interactionSettings=\{canvasInteractionSettings\}/);
	assert.match(GRAPH_SOURCE, /raySoundSettings=\{canvasRaySoundSettings\}/);
	assert.match(NEURAL_CANVAS_SOURCE, /interactionSettings\?: NeuralGraphInteractionSettings/);
	assert.match(NEURAL_CANVAS_SOURCE, /raySoundSettings\?: NeuralRaySoundSettings/);
	assert.match(NEURAL_CANVAS_SOURCE, /NEURAL_NODE_HOVER_SOUND_DEFINITION/);
	assert.match(NEURAL_CANVAS_SOURCE, /NEURAL_RAY_SOUND_DEFINITION/);
	assert.match(NEURAL_CANVAS_SOURCE, /useSound\(NEURAL_NODE_HOVER_SOUND_DEFINITION/);
	assert.match(NEURAL_CANVAS_SOURCE, /useSound\(NEURAL_RAY_SOUND_DEFINITION/);
	assert.match(NEURAL_CANVAS_SOURCE, /ensureReady\(\{ latencyHint: "interactive" \}\)/);
	assert.match(NEURAL_CANVAS_SOURCE, /shouldTriggerNeuralNodeSound/);
	assert.match(NEURAL_CANVAS_SOURCE, /shouldTriggerNeuralRaySound/);
	assert.match(RAY_SOUND_SOURCE, /export interface NeuralRaySoundSettings/);
	assert.match(RAY_SOUND_SOURCE, /NEURAL_NODE_HOVER_SOUND_DEFINITION/);
	assert.match(RAY_SOUND_SOURCE, /getNeuralNodeSoundPlayOptions/);
	assert.match(RAY_SOUND_SOURCE, /getNeuralRaySoundPlayOptions/);
	assert.match(RAY_SOUND_SOURCE, /rayElasticRadius/);
	assert.match(RAY_SOUND_SOURCE, /rayElasticStrength/);
	assert.match(RAY_SOUND_SOURCE, /rayElasticDamping/);
	assert.match(RAY_SOUND_SOURCE, /rayElasticTension/);
	assert.doesNotMatch(PARAMS_SOURCE, /InteractionSettings/);
	assert.doesNotMatch(PARAMS_SOURCE, /nodeSound/);
	assert.doesNotMatch(PARAMS_SOURCE, /raySound/);
});

test("Graph controls expose node type and edge state color fields", () => {
	for (const expected of [
		/{ kind: "number", key: "nodeRadius", label: "Radius"/,
		/{ kind: "color", key: "edgeColor", label: "Default color"/,
		/{ kind: "color", key: "edgeHoverColor", label: "Hover color"/,
		/{ kind: "color", key: "edgeSelectedColor", label: "Selected color"/,
	]) {
		assert.match(PARAMS_SOURCE, expected);
	}
	assert.doesNotMatch(PARAMS_SOURCE, /{ kind: "color", key: "nodeHoverColor"/);
	assert.doesNotMatch(PARAMS_SOURCE, /{ kind: "color", key: "nodeSelectedColor"/);
	assert.match(GRAPH_SOURCE, /<GUI\.Section borderTop title="Node type colors">/);
	assert.match(GRAPH_SOURCE, /id="graph-node-color"/);
	assert.match(GRAPH_SOURCE, /label="Idle"/);
});

test("Graph color controls use design token selectors instead of hex-only pickers", () => {
	assert.match(GRAPH_SOURCE, /NEURAL_GRAPH_COLOR_TOKEN_OPTIONS/);
	assert.match(GRAPH_SOURCE, /GRAPH_COLOR_SELECT_OPTIONS/);
	assert.match(GRAPH_SOURCE, /getGraphColorSelectValue/);
	assert.match(GRAPH_SOURCE, /getNeuralGraphColorTokenOption/);
	assert.match(GRAPH_SOURCE, /description: option\.lightHex/);
	assert.match(GRAPH_SOURCE, /meta: option\.token/);
	assert.match(GRAPH_SOURCE, /swatch: option\.value/);
	assert.match(GRAPH_SOURCE, /<GUI\.Select[\s\S]*options=\{GRAPH_COLOR_SELECT_OPTIONS\}[\s\S]*valueKeys=\{definition\.key\}/);
	assert.match(GRAPH_SOURCE, /<GUI\.Select[\s\S]*id="graph-color-synthesis"[\s\S]*options=\{GRAPH_COLOR_SELECT_OPTIONS\}[\s\S]*valueKeys="colorSynthesis"/);
	assert.doesNotMatch(GRAPH_SOURCE, /function GraphColorTokenControl/);
	assert.match(COLORS_SOURCE, /token: "color\.icon"/);
	for (const accent of ["red", "orange", "yellow", "lime", "green", "teal", "blue", "purple", "magenta", "gray"]) {
		assert.match(COLORS_SOURCE, new RegExp(`token: "color\\.icon\\.accent\\.${accent}"`));
	}
	assert.doesNotMatch(COLORS_SOURCE, /token: "color\.(?:background|chart)\./);
	assert.match(GRAPH_SOURCE, /colorConcept: ROVO_GRAPH_COLORS\.orange/);
	assert.match(GRAPH_SOURCE, /colorEntity: ROVO_GRAPH_COLORS\.lime/);
	assert.match(GRAPH_SOURCE, /colorRaw: ROVO_GRAPH_COLORS\.gray/);
	assert.match(GRAPH_SOURCE, /colorSource: ROVO_GRAPH_COLORS\.blue/);
	assert.match(GRAPH_SOURCE, /colorSynthesis: ROVO_GRAPH_COLORS\.purple/);
	assert.match(GRAPH_SOURCE, /nodeColor: ROVO_GRAPH_COLORS\.default/);
	assert.match(GRAPH_SOURCE, /edgeColor: ROVO_GRAPH_COLORS\.gray/);
	assert.match(GRAPH_SOURCE, /frontmatter: \{ graphColor: node\.color, visual: "graph" \}/);
	assert.doesNotMatch(RENDERER_SOURCE, /options\.params\.nodeHoverColor/);
	assert.doesNotMatch(RENDERER_SOURCE, /options\.params\.nodeSelectedColor/);
	assert.doesNotMatch(GRAPH_SOURCE, /colorConcept: "#292A2E"/);
	assert.doesNotMatch(GRAPH_SOURCE, /edgeColor: "#4B4D51"/);
});

test("Graph controls expose origin node visual fields", () => {
	for (const expected of [
		/{ kind: "boolean", key: "showOriginMarker", label: "Show origin node"/,
		/{ kind: "number", key: "originMarkerSize", label: "Origin size"/,
		/{ kind: "color", key: "originMarkerColor", label: "Origin color"/,
		/NEURAL_GRAPH_ORIGIN_COLOR_PARAM_KEYS/,
	]) {
		assert.match(PARAMS_SOURCE, expected);
	}
	assert.match(GRAPH_SOURCE, /originMarkerSize: 12/);
	assert.match(GRAPH_SOURCE, /originMarkerColor: ROVO_GRAPH_COLORS\.default/);
	assert.match(GRAPH_SOURCE, /nodeRadius: 0/);
	assert.doesNotMatch(PARAMS_SOURCE, /originMarkerBorderColor/);
	assert.doesNotMatch(PARAMS_SOURCE, /Origin border/);
});

test("Graph controls expose signal streak parameters", () => {
	for (const expected of [
		/{ kind: "boolean", key: "showSignals", label: "Show signals"/,
		/{ kind: "boolean", key: "signalGlowEnabled", label: "Glow"/,
		/{ kind: "color", key: "signalColor", label: "Color"/,
		/{ kind: "number", key: "signalOpacity", label: "Opacity"/,
		/{ kind: "number", key: "signalWidth", label: "Width"/,
		/{ kind: "number", key: "signalFrequency", label: "Frequency"/,
		/{ kind: "number", key: "signalLength", label: "Length"/,
		/NEURAL_GRAPH_SIGNAL_COLOR_PARAM_KEYS/,
	]) {
		assert.match(PARAMS_SOURCE, expected);
	}
	assert.match(GRAPH_SOURCE, /showSignals: true/);
	assert.match(GRAPH_SOURCE, /signalColor: ROVO_GRAPH_COLORS\.default/);
	assert.match(GRAPH_SOURCE, /signalFrequency: 0\.5/);
	assert.match(GRAPH_SOURCE, /signalGlowEnabled: false/);
	assert.match(GRAPH_SOURCE, /signalLength: 0\.5/);
	assert.match(GRAPH_SOURCE, /signalOpacity: 1/);
	assert.match(GRAPH_SOURCE, /signalWidth: 1/);
	assert.match(RENDERER_SOURCE, /options\.params\.signalColor/);
	assert.match(RENDERER_SOURCE, /options\.params\.signalFrequency/);
	assert.match(RENDERER_SOURCE, /options\.params\.signalGlowEnabled/);
	assert.match(RENDERER_SOURCE, /options\.params\.signalLength/);
	assert.match(RENDERER_SOURCE, /options\.params\.signalOpacity/);
	assert.match(RENDERER_SOURCE, /options\.params\.signalWidth/);
	assert.match(RENDERER_SOURCE, /shouldRevealNodeTypeColors/);
	assert.match(DETAILS_SOURCE, /signal streaks/);
});

test("Graph controls render booleans as toggles", () => {
	assert.match(GRAPH_SOURCE, /GUI\.Toggle/);
	assert.match(GRAPH_SOURCE, /definition\.kind === "boolean"/);
});

test("Graph normalizes runtime params before rendering controls", () => {
	assert.match(GRAPH_SOURCE, /const rawParams = controlledParams \?\? uncontrolledParams;/);
	assert.match(GRAPH_SOURCE, /const params = useMemo\(\(\) => clampNeuralGraphParams\(rawParams\), \[rawParams\]\);/);
	assert.match(GRAPH_SOURCE, /<GraphControls/);
	assert.match(GRAPH_SOURCE, /defaultParams=\{defaultParams\}/);
	assert.match(GRAPH_SOURCE, /onChange=\{handleParamsChange\}/);
	assert.match(GRAPH_SOURCE, /params=\{params\}/);
});
