const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SURFACE_SOURCE = fs.readFileSync(
	path.join(__dirname, "personal-graph-surface.tsx"),
	"utf8",
);
const GRAPH_SOURCE_HOOK_SOURCE = fs.readFileSync(
	path.join(__dirname, "hooks", "use-graph-source.ts"),
	"utf8",
);
const VISUAL_MODE_SOURCE = fs.readFileSync(
	path.join(__dirname, "lib", "personal-graph-visual-mode.ts"),
	"utf8",
);
const VISUAL_GRAPH_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "website", "demos", "visual", "graph.tsx"),
	"utf8",
);
const NEURAL_CANVAS_SOURCE = fs.readFileSync(
	path.join(__dirname, "personal-graph-neural-canvas.tsx"),
	"utf8",
);
const NEURAL_RENDERER_SOURCE = fs.readFileSync(
	path.join(__dirname, "lib", "neural-graph", "renderer.ts"),
	"utf8",
);
const NEURAL_WORKFLOW_LABEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "lib", "neural-graph", "workflow-label-strategy.ts"),
	"utf8",
);
const SURFACE_HELPERS_SOURCE = fs.readFileSync(
	path.join(__dirname, "personal-graph-surface-data.ts"),
	"utf8",
);

test("Personal Graph keeps source actions visible when settings are unavailable", () => {
	assert.match(SURFACE_SOURCE, /error: vaultSettingsError,/);
	assert.match(SURFACE_SOURCE, /error: graphSourceError,/);
	assert.match(
		SURFACE_SOURCE,
		/vaultSettings === null \|\|\s+Boolean\(vaultSettingsError\) \|\|\s+vaultSettings\.status === "unconfigured"/,
	);
	assert.match(SURFACE_SOURCE, /const sourcePickerError = shouldShowSourcePicker \? \(vaultSettingsError \?\? graphSourceError\) : null;/);
	assert.match(SURFACE_SOURCE, /<PersonalGraphSourcePicker/);
	assert.match(SURFACE_SOURCE, /role="alert"/);
	assert.match(SURFACE_SOURCE, /\{sourcePickerError\.message\}/);
});

test("Personal Graph chat results replace the TWG graph until the filter is cleared", () => {
	assert.match(SURFACE_SOURCE, /const \[chatExplorer, setChatExplorer\] = useState<VaultExplorer \| null>\(null\);/);
	assert.match(
		SURFACE_SOURCE,
		/const explorer = isTwgMode \? \(chatExplorer \?\? expandedExplorer \?\? rawExplorer\) : rawExplorer;/,
	);
	assert.match(
		SURFACE_SOURCE,
		/onGraph: \(focusedExplorer\) => \{\s+if \(focusedExplorer\.nodes\.length > 0\) \{[\s\S]*setChatExplorer\(focusedExplorer\);/,
	);
	assert.match(
		SURFACE_SOURCE,
		/const handleClearChatFilter = useCallback\(\(\) => \{\s+setChatExplorer\(null\);\s+clearTwgExpansionState\(\);\s+void refresh\(\);/,
	);
	assert.match(SURFACE_SOURCE, /aria-label="Clear chat filter"/);
	assert.match(SURFACE_SOURCE, /onClick=\{handleClearChatFilter\}/);
	assert.match(SURFACE_SOURCE, />\s*Clear filter\s*<\/Button>/);
});

test("Personal Graph automation chat results use the radial workflow visual mode", () => {
	assert.match(VISUAL_MODE_SOURCE, /export type PersonalGraphVisualMode = "default" \| "automation-workflow-radial";/);
	assert.match(VISUAL_MODE_SOURCE, /node\.frontmatter\?\.slice === "automation-workflows"/);
	assert.match(VISUAL_MODE_SOURCE, /node\.frontmatter\?\.type === "AutomationWorkflowRoot"/);
	assert.match(VISUAL_MODE_SOURCE, /layoutShape: "radialCluster"/);
	assert.match(VISUAL_MODE_SOURCE, /showRays: false/);
	assert.match(VISUAL_MODE_SOURCE, /showSignals: false/);
	assert.match(VISUAL_MODE_SOURCE, /showLabels: true/);
	assert.match(VISUAL_MODE_SOURCE, /radialArcAngle: 360/);
	assert.match(VISUAL_MODE_SOURCE, /radialDepthCurve: 1/);
	assert.match(VISUAL_MODE_SOURCE, /Math\.min\(180, Math\.max\(baseParams\.maxVisibleNodes, explorer\?\.nodes\.length \?\? 0\)\)/);
	assert.match(SURFACE_SOURCE, /const visualMode = isTwgMode \? getPersonalGraphVisualMode\(chatExplorer\) : "default";/);
	assert.match(SURFACE_SOURCE, /getPersonalGraphParamsForVisualMode\(responsiveGraphParams, visualMode, explorer\)/);
	assert.match(SURFACE_SOURCE, /data-personal-graph-visual-mode=\{visualMode\}/);
	assert.match(SURFACE_SOURCE, /labelStrategy=\{graphLabelStrategy\}/);
	assert.match(SURFACE_SOURCE, /isAutomationWorkflowExplorer\(focusedExplorer\)/);
	assert.match(SURFACE_SOURCE, /setSelectedNodeId\(null\);[\s\S]*setIsInspectorOpen\(false\);/);
});

test("Personal Graph threads workflowTree label strategy through the graph renderer", () => {
	assert.match(VISUAL_GRAPH_SOURCE, /labelStrategy\?: NeuralGraphLabelStrategy;/);
	assert.match(VISUAL_GRAPH_SOURCE, /labelStrategy = "default"/);
	assert.match(VISUAL_GRAPH_SOURCE, /labelStrategy=\{labelStrategy\}/);
	assert.match(NEURAL_CANVAS_SOURCE, /labelStrategy\?: NeuralGraphLabelStrategy;/);
	assert.match(NEURAL_CANVAS_SOURCE, /labelStrategy = "default"/);
	assert.match(NEURAL_CANVAS_SOURCE, /labelStrategy,/);
	assert.match(NEURAL_RENDERER_SOURCE, /export type \{ NeuralGraphLabelStrategy \} from "\.\/workflow-label-strategy";/);
	assert.match(NEURAL_RENDERER_SOURCE, /options\.labelStrategy === "workflowTree"/);
	assert.match(NEURAL_RENDERER_SOURCE, /getRadialLabelNodes/);
	assert.match(NEURAL_RENDERER_SOURCE, /getRadialLeafNodeIds/);
	assert.match(NEURAL_WORKFLOW_LABEL_SOURCE, /function shouldLabelWorkflowTreeNode/);
	assert.match(NEURAL_WORKFLOW_LABEL_SOURCE, /function getRadialLabelNodes/);
	assert.match(NEURAL_WORKFLOW_LABEL_SOURCE, /AutomationWorkflowCandidate/);
	assert.match(NEURAL_WORKFLOW_LABEL_SOURCE, /AutomationDraftAction/);
	assert.match(NEURAL_RENDERER_SOURCE, /AutomationWorkflowEvidence/);
});

test("Personal Graph refresh surfaces TWG auth failures from source refreshes", () => {
	assert.match(GRAPH_SOURCE_HOOK_SOURCE, /twgRefreshError: Error \| null;/);
	assert.match(GRAPH_SOURCE_HOOK_SOURCE, /const \[twgRefreshError, setTwgRefreshError\] = useState<Error \| null>\(null\);/);
	assert.match(GRAPH_SOURCE_HOOK_SOURCE, /isRefreshingTwg: boolean;/);
	assert.match(GRAPH_SOURCE_HOOK_SOURCE, /const \[isRefreshingTwg, setIsRefreshingTwg\] = useState\(false\);/);
	assert.match(
		GRAPH_SOURCE_HOOK_SOURCE,
		/setIsRefreshingTwg\(true\);[\s\S]*const explorer = await refreshTwg\(\{ since: options\.since \}\);[\s\S]*finally \{[\s\S]*setIsRefreshingTwg\(false\);[\s\S]*\}/,
	);
	assert.match(GRAPH_SOURCE_HOOK_SOURCE, /setTwgRefreshError\(null\);/);
	assert.match(GRAPH_SOURCE_HOOK_SOURCE, /setTwgRefreshError\(nextError instanceof Error \? nextError : new Error\(String\(nextError\)\)\);/);
	assert.doesNotMatch(
		GRAPH_SOURCE_HOOK_SOURCE,
		/fetchActiveSource\(\{ signal: controller\.signal \}\);[\s\S]{0,160}setTwgRefreshError\(null\);/,
	);
	assert.match(SURFACE_HELPERS_SOURCE, /function isTwgAuthRequiredError\(error: Error \| null\): boolean/);
	assert.match(SURFACE_SOURCE, /isTwgAuthRequiredError,/);
	assert.match(SURFACE_SOURCE, /const isTwgAuthError = isTwgMode && isTwgAuthRequiredError\(error\);/);
	assert.match(SURFACE_SOURCE, /twgRefreshError,/);
	assert.match(SURFACE_SOURCE, /const isTwgRefreshAuthError = isTwgMode && isTwgAuthRequiredError\(twgRefreshError\);/);
	assert.match(SURFACE_SOURCE, /const shouldShowTwgAuthError = isTwgAuthError \|\| isTwgRefreshAuthError;/);
	assert.match(
		SURFACE_SOURCE,
		/const isTwgReady = isTwgMode && Boolean\(twgGeneratedAt\) && !isTwgConnecting && !isTwgAuthError;/,
	);
	assert.match(SURFACE_SOURCE, /!shouldShowTwgAuthError &&/);
	assert.match(
		SURFACE_SOURCE,
		/const visibleError = shouldShowVaultOnboarding \|\| shouldShowSourcePicker \|\| shouldShowTwgAuthError \? null : error;/,
	);
	assert.match(SURFACE_SOURCE, /\{shouldShowTwgAuthError \? \(/);
	assert.match(SURFACE_SOURCE, /<PersonalGraphTwgAuthError isRetrying=\{isLoading \|\| isRefreshingTwg\} onRetry=\{handleRetryTwg\} \/>/);
	assert.match(SURFACE_SOURCE, /disabled=\{isLoading \|\| isRefreshingTwg\}/);
	assert.match(SURFACE_SOURCE, /isLoading=\{isLoading \|\| isRefreshingTwg\}/);
});
