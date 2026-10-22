const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const PAGE_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const LAYOUT_SOURCE = fs.readFileSync(path.join(__dirname, "layout.tsx"), "utf8");
const ROOT_LAYOUT_SOURCE = fs.readFileSync(path.join(__dirname, "../../layout.tsx"), "utf8");
const TAILWIND_THEME_SOURCE = fs.readFileSync(path.join(__dirname, "../../tailwind-theme.css"), "utf8");
const COMPONENTS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../data/components.ts"),
	"utf8",
);
const MANIFEST_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../data/component-manifest.ts"),
	"utf8",
);
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const DEMO_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/website/demos/arts/personal-graph-demo.tsx",
	),
	"utf8",
);
const SURFACE_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/personal-graph-surface.tsx",
	),
	"utf8",
);
const SURFACE_HELPERS_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/personal-graph-surface-data.ts",
	),
	"utf8",
);
const TITLE_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/personal-graph-title-scramble.tsx",
	),
	"utf8",
);
const BACKDROP_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/personal-graph-backdrop.tsx",
	),
	"utf8",
);
const SEARCH_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/personal-graph-search.tsx",
	),
	"utf8",
);
const SUMMARY_PANEL_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/personal-graph-summary-panel.tsx",
	),
	"utf8",
);
const SUMMARY_HOOK_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/hooks/use-personal-graph-summary.ts",
	),
	"utf8",
);
const VAULT_EXPLORER_HOOK_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/hooks/use-vault-explorer.ts",
	),
	"utf8",
);
const PERSONAL_GRAPH_API_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/lib/personal-graph-api.ts",
	),
	"utf8",
);
const EXPLORER_MERGE_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/lib/personal-graph-explorer-merge.ts",
	),
	"utf8",
);
const GLASS_PANEL_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/personal-graph-glass-panel.tsx",
	),
	"utf8",
);
const CONTROL_FLYOUT_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/personal-graph-control-flyout.tsx",
	),
	"utf8",
);
const SOURCE_PICKER_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/personal-graph-source-picker.tsx",
	),
	"utf8",
);
const GRAPH_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/website/demos/visual/graph.tsx",
	),
	"utf8",
);
const GRAPH_DEFAULTS_SOURCE = fs.readFileSync(path.join(__dirname, "../../../components/website/demos/visual/graph-defaults.ts"), "utf8");
const NEURAL_CANVAS_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/personal-graph-neural-canvas.tsx",
	),
	"utf8",
);
const NEURAL_PARAMS_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/lib/neural-graph/params.ts",
	),
	"utf8",
);
const RESPONSIVE_PARAMS_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/lib/neural-graph/responsive-params.ts",
	),
	"utf8",
);
const NEURAL_STORE_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/lib/neural-graph/store.ts",
	),
	"utf8",
);
const NEURAL_LAYOUT_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/lib/neural-graph/layout.ts",
	),
	"utf8",
);
const NEURAL_RENDERER_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/lib/neural-graph/renderer.ts",
	),
	"utf8",
);
const NEURAL_CAMERA_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/lib/neural-graph/camera.ts",
	),
	"utf8",
);
const NEURAL_INTERACTION_SOURCE = fs.readFileSync(
	path.join(
		__dirname,
		"../../../components/arts/personal-graph/lib/neural-graph/interaction.ts",
	),
	"utf8",
);

test("Personal Graph route renders the app directly while the registry keeps the catalog demo", () => {
	assert.match(
		PAGE_SOURCE,
		/import PersonalGraph from "@\/components\/arts\/personal-graph";/,
	);
	assert.match(PAGE_SOURCE, /<PersonalGraph className="min-h-svh" \/>/);
	assert.doesNotMatch(PAGE_SOURCE, /loadDemoComponent/);
	assert.match(LAYOUT_SOURCE, /getArtPageTitle\("personal-graph"\)/);
});

test("Personal Graph is registered as an arts project", () => {
	assert.match(
		COMPONENTS_SOURCE,
		/artComponent\("personal-graph", "Personal Graph"\)/,
	);
	assert.match(
		MANIFEST_SOURCE,
		/artComponent\("personal-graph", "Personal Graph"\)/,
	);
	assert.match(
		REGISTRY_SOURCE,
		/import\("\.\/demos\/arts\/personal-graph-demo"\)/,
	);
	assert.match(
		DEMO_SOURCE,
		/import PersonalGraph from "@\/components\/arts\/personal-graph";/,
	);
});

test("Personal Graph control flyout exposes the app theme toggle", () => {
	assert.match(
		SURFACE_SOURCE,
		/import \{ useTheme \} from "@\/components\/utils\/theme-wrapper";/,
	);
	assert.match(SURFACE_SOURCE, /const \{ actualTheme, setTheme, theme \} = useTheme\(\);/);
	assert.match(SURFACE_SOURCE, /const handleToggleTheme = useCallback/);
	assert.match(SURFACE_SOURCE, /const themeLabel = theme === "system" \? "System theme" : theme === "dark" \? "Dark theme" : "Light theme";/);
	assert.match(SURFACE_SOURCE, /key: "theme"/);
	assert.match(SURFACE_SOURCE, /label: themeLabel/);
	assert.match(SURFACE_SOURCE, /aria-label=\{themeLabel\}/);
	assert.match(SURFACE_SOURCE, /onClick=\{handleToggleTheme\}/);
});

test("Personal Graph header keeps controls centered below the title", () => {
	assert.match(SURFACE_SOURCE, /className=\{cn\("relative flex flex-col items-center"/);
	assert.match(SEARCH_SOURCE, /<PersonalGraphControlFlyoutTrigger/);
	assert.match(SEARCH_SOURCE, /<PersonalGraphControlFlyoutActions/);
	assert.doesNotMatch(SURFACE_SOURCE, /xl:absolute xl:right-0 xl:top-0 xl:justify-end/);
	assert.doesNotMatch(SURFACE_SOURCE, /personal-graph-vault-picker/);
});

test("Personal Graph exposes the capture queue inside the control flyout", () => {
	assert.match(
		SURFACE_SOURCE,
		/import \{ Popover, PopoverContent, PopoverTrigger \} from "@\/components\/ui\/popover";/,
	);
	assert.match(
		SURFACE_SOURCE,
		/PixelIngestIcon/,
	);
	assert.match(SURFACE_SOURCE, /const \[isCaptureQueueOpen, setIsCaptureQueueOpen\] = useState\(false\);/);
	assert.match(SURFACE_SOURCE, /key: "capture"/);
	assert.match(SURFACE_SOURCE, /label: "Add data"/);
	assert.match(SURFACE_SOURCE, /<Popover open=\{isCaptureQueueOpen\} onOpenChange=\{handleCaptureQueueOpenChange\}>/);
	assert.match(SURFACE_SOURCE, /aria-label="Add data"/);
	assert.match(SURFACE_SOURCE, /<PixelIngestIcon \/>/);
	assert.match(SURFACE_SOURCE, /<PersonalGraphCaptureQueue onRawAdded=\{handleRefreshAll\} refreshKey=\{refreshKey\} \/>/);
	assert.doesNotMatch(SURFACE_SOURCE, /bottom-6 left-6 z-20 hidden/);
	assert.doesNotMatch(SURFACE_SOURCE, /Collapse capture queue/);
});

test("Personal Graph header uses the display font lockup", () => {
	assert.match(ROOT_LAYOUT_SOURCE, /Affigere-Regular\.woff2/);
	assert.match(ROOT_LAYOUT_SOURCE, /DepartureMono-Regular\.woff2/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_TITLE_FONT_STYLE/);
	assert.match(SURFACE_SOURCE, /var\(--font-affigere\)/);
	assert.match(SURFACE_SOURCE, /var\(--font-departure-mono\)/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_SETTLED_TITLE_SCRAMBLE_LINE_CHAR_COUNT = 8/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_TITLE_LINE_COUNT = 2/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_TITLE_LINE_HEIGHT = 0\.8/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_HEADER_INITIAL_Y = "35svh"/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_HEADER_SETTLED_Y = "0px"/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_TITLE_INK_TOP_PADDING = "0px"/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_SETTLED_TITLE_SIZE/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_INITIAL_TITLE_SCALE = 2\.4/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_SETTLED_TITLE_RESERVED_HEIGHT/);
	assert.match(SURFACE_SOURCE, /PERSONAL_GRAPH_INITIAL_TITLE_RESERVED_HEIGHT/);
	assert.match(SURFACE_SOURCE, /min\(3rem, calc\(\(100cqw - 1rem\) \/ \$\{PERSONAL_GRAPH_SETTLED_TITLE_SCRAMBLE_LINE_CHAR_COUNT\}\)\)/);
	assert.match(
		SURFACE_SOURCE,
		/className="mx-auto w-full min-w-0 max-w-full text-center text-text \[container-type:inline-size\]"/,
	);
	assert.match(SURFACE_SOURCE, /className="flex justify-center"/);
	assert.match(
		SURFACE_SOURCE,
		/minHeight: isPostSettle\s+\? PERSONAL_GRAPH_SETTLED_TITLE_RESERVED_HEIGHT\s+: PERSONAL_GRAPH_INITIAL_TITLE_RESERVED_HEIGHT/,
	);
	assert.match(SURFACE_SOURCE, /className="text-text"/);
	assert.match(SURFACE_SOURCE, /fontSize: PERSONAL_GRAPH_SETTLED_TITLE_SIZE/);
	assert.match(SURFACE_SOURCE, /lineHeight: PERSONAL_GRAPH_TITLE_LINE_HEIGHT/);
	assert.match(SURFACE_SOURCE, /transformOrigin: "center top"/);
	assert.match(SURFACE_SOURCE, /initial=\{\{ scale: PERSONAL_GRAPH_INITIAL_TITLE_SCALE \}\}/);
	assert.match(SURFACE_SOURCE, /scale: isPostSettle \? 1 : PERSONAL_GRAPH_INITIAL_TITLE_SCALE/);
	assert.match(SURFACE_SOURCE, /const isIntroSettled = phase === "settle"/);
	assert.match(SURFACE_SOURCE, /const isReady = isTwgMode \? isTwgReady : isVaultReady;/);
	assert.match(SURFACE_SOURCE, /const isVaultReadyForLayout = isReady \|\| isResetFlyoutCollapsing;/);
	assert.match(SURFACE_SOURCE, /const isPostSettle = isVaultReadyForLayout && isIntroSettled;/);
	assert.match(SURFACE_SOURCE, /const PERSONAL_GRAPH_UNCONFIGURED_BYLINE = "Select a folder to get started\.";/);
	assert.match(SURFACE_SOURCE, /shouldShowSourcePicker\s+\? PERSONAL_GRAPH_UNCONFIGURED_BYLINE/);
	assert.match(SURFACE_SOURCE, /key=\{`personal-graph-title-\$\{introReplayKey\}`\}/);
	assert.match(SURFACE_SOURCE, /paddingTop: PERSONAL_GRAPH_TITLE_INK_TOP_PADDING/);
	assert.doesNotMatch(SURFACE_SOURCE, /uppercase leading-\[0\.8\]/);
	assert.doesNotMatch(SURFACE_SOURCE, /className="[^"]*tracking-normal[^"]*"\s+style=\{PERSONAL_GRAPH_TITLE_FONT_STYLE\}/);
	assert.match(TITLE_SOURCE, /<ScrambleText/);
	assert.match(TITLE_SOURCE, />\s*PERSONAL\s*<\/ScrambleText>/);
	assert.match(TITLE_SOURCE, />\s*GRAPH\s*<\/ScrambleText>/);
	assert.match(TITLE_SOURCE, /className="block whitespace-nowrap"/);
	assert.match(TITLE_SOURCE, /aria-label="Personal Graph"/);
	assert.match(TITLE_SOURCE, /aria-hidden className="block whitespace-nowrap"/);
	assert.doesNotMatch(SURFACE_SOURCE, /BranchIcon/);
});

test("Personal Graph omits the standalone zoom control rail", () => {
	assert.doesNotMatch(SURFACE_SOURCE, /function PersonalGraphZoomControls/);
	assert.doesNotMatch(SURFACE_SOURCE, /absolute bottom-6 left-6 z-30 hidden text-text lg:block/);
	assert.doesNotMatch(SURFACE_SOURCE, /contentClassName="flex h-full flex-col items-center gap-1 py-1"/);
	assert.doesNotMatch(SURFACE_SOURCE, /aria-label="Zoom in"/);
	assert.doesNotMatch(SURFACE_SOURCE, /aria-label="Zoom out"/);
	assert.doesNotMatch(SURFACE_SOURCE, /Math\.round\(zoom \* 100\)/);
	assert.doesNotMatch(SURFACE_SOURCE, /Reset graph view/);
	assert.doesNotMatch(SURFACE_SOURCE, /TargetIcon/);
});

test("Personal Graph keeps the search and chat composer separate from the centered graph origin", () => {
	assert.match(SURFACE_SOURCE, /aria-label="Personal Graph search and chat"/);
	assert.match(SURFACE_SOURCE, /aria-hidden=\{!isSearchRevealed\}/);
	assert.match(SURFACE_SOURCE, /inert=\{!isSearchRevealed\}/);
	assert.match(SURFACE_SOURCE, /left-4 right-4 z-40 flex justify-center/);
	assert.match(SURFACE_SOURCE, /max-w-\[560px\]/);
	assert.doesNotMatch(SURFACE_SOURCE, /max-w-\[760px\]/);
	assert.match(SURFACE_SOURCE, /initial=\{\{ y: 144 \}\}/);
	assert.match(SURFACE_SOURCE, /const isSearchRevealed = isVaultReadyForLayout && \(phase === "search"/);
	assert.match(SURFACE_SOURCE, /y: isSearchRevealed \? 0 : 144/);
	assert.match(SURFACE_SOURCE, /style=\{\{ bottom: 24, willChange: "transform" \}\}/);
	assert.match(SURFACE_SOURCE, /const PERSONAL_GRAPH_PROMPT_INPUT_BOTTOM_PX = 24;/);
	assert.match(SURFACE_SOURCE, /const PERSONAL_GRAPH_PROMPT_INPUT_HEIGHT_PX = 64;/);
	assert.match(SURFACE_SOURCE, /const PERSONAL_GRAPH_TAIL_PROMPT_GAP_PX = 8;/);
	assert.match(SURFACE_SOURCE, /const PERSONAL_GRAPH_TAIL_MARKER_SIZE_PX = ROVO_GRAPH_DEFAULT_PARAMS\.originMarkerSize;/);
	assert.match(SURFACE_SOURCE, /const PERSONAL_GRAPH_STAGE_TRANSLATE_Y_PX = -10;/);
	assert.match(
		SURFACE_SOURCE,
		/PERSONAL_GRAPH_PROMPT_INPUT_BOTTOM_PX \+\s+PERSONAL_GRAPH_PROMPT_INPUT_HEIGHT_PX \+\s+PERSONAL_GRAPH_TAIL_PROMPT_GAP_PX \+\s+PERSONAL_GRAPH_TAIL_MARKER_SIZE_PX \/ 2 \+\s+PERSONAL_GRAPH_STAGE_TRANSLATE_Y_PX;/,
	);
	assert.match(SURFACE_SOURCE, /transform: `translateY\(\$\{PERSONAL_GRAPH_STAGE_TRANSLATE_Y_PX\}px\)`/);
	assert.match(SURFACE_SOURCE, /rayOriginBottomOffset=\{PERSONAL_GRAPH_RAY_TAIL_BOTTOM_OFFSET_PX\}/);
	assert.doesNotMatch(SURFACE_SOURCE, /opacity: isSearchRevealed \? 1 : 0/);
	assert.doesNotMatch(SURFACE_SOURCE, /border-border-inverse bg-bg-neutral-bold/);
	assert.match(NEURAL_CANVAS_SOURCE, /left: viewport\.width \/ 2 \+ params\.originOffset/);
	assert.match(NEURAL_CANVAS_SOURCE, /top: rayOriginY/);
	assert.match(NEURAL_CANVAS_SOURCE, /const layoutWidth = container\.clientWidth \|\| rect\.width;/);
	assert.match(NEURAL_CANVAS_SOURCE, /const layoutHeight = container\.clientHeight \|\| rect\.height;/);
	assert.match(NEURAL_CANVAS_SOURCE, /const hasMeasuredViewport = viewport\.width > 0 && viewport\.height > 0;/);
	assert.match(NEURAL_CANVAS_SOURCE, /params\.showRays && params\.showOriginMarker && hasMeasuredViewport/);
	assert.match(NEURAL_CANVAS_SOURCE, /style=\{getOriginMarkerStyleForViewport\(params, viewport, rayOriginY\)\}/);
	assert.doesNotMatch(NEURAL_CANVAS_SOURCE, /top: `calc\(100% - \$\{rayOriginBottomOffset\}px\)`/);
	assert.match(NEURAL_CANVAS_SOURCE, /backgroundColor: params\.originMarkerColor/);
	assert.match(NEURAL_CANVAS_SOURCE, /height: params\.originMarkerSize/);
	assert.match(NEURAL_CANVAS_SOURCE, /borderRadius: params\.nodeShape === "square" \? params\.nodeRadius : 9999/);
	assert.doesNotMatch(NEURAL_CANVAS_SOURCE, /originMarkerBorderColor/);
	assert.doesNotMatch(NEURAL_CANVAS_SOURCE, /border-2/);
	assert.match(SURFACE_SOURCE, /<PersonalGraphSearch/);
	assert.doesNotMatch(SURFACE_SOURCE, /grid-cols-\[1fr_auto_1fr\]/);
	assert.match(SEARCH_SOURCE, /Ask or search your graph\.\.\./);
	assert.match(
		SEARCH_SOURCE,
		/<PersonalGraphGlassPanel[\s\S]*className="relative z-10"[\s\S]*contentClassName="flex h-16 items-center gap-2 p-4 pl-6"[\s\S]*radius=\{30\}/,
	);
	assert.match(SEARCH_SOURCE, /glassProps=\{\{\s+backgroundOpacity: 0\.08,\s+\}\}/);
	assert.doesNotMatch(SEARCH_SOURCE, /PERSONAL_GRAPH_CHROMATIC_RGB_GLASS_PROPS/);
	assert.doesNotMatch(SEARCH_SOURCE, /searchStageRef/);
	assert.doesNotMatch(SEARCH_SOURCE, /mouseContainer: searchStageRef/);
	assert.doesNotMatch(SEARCH_SOURCE, /chromaticEdge/);
	assert.match(SEARCH_SOURCE, /contentClassName="flex h-16 items-center gap-2 p-4 pl-6"/);
	assert.match(GLASS_PANEL_SOURCE, /\[&>div\]:p-0/);
	assert.match(GLASS_PANEL_SOURCE, /export function PersonalGraphLiquidGlassIconButton/);
	assert.match(GLASS_PANEL_SOURCE, /<Button/);
	assert.match(GLASS_PANEL_SOURCE, /variant="ghost"/);
	assert.match(GLASS_PANEL_SOURCE, /size="icon"/);
	assert.match(GLASS_PANEL_SOURCE, /PERSONAL_GRAPH_LIQUID_GLASS_ICON_BUTTON_PROPS/);
	assert.match(GLASS_PANEL_SOURCE, /PERSONAL_GRAPH_DEMO_GLASS_PROPS/);
	assert.match(GLASS_PANEL_SOURCE, /PERSONAL_GRAPH_CHROMATIC_RGB_GLASS_PROPS/);
	assert.match(GLASS_PANEL_SOURCE, /LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS/);
	assert.match(GLASS_PANEL_SOURCE, /pointerLayers: true/);
	assert.match(GLASS_PANEL_SOURCE, /pointerActivationRadius: PERSONAL_GRAPH_LIQUID_GLASS_POINTER_ACTIVATION_RADIUS/);
	assert.match(GLASS_PANEL_SOURCE, /--liquid-glass-button-strength/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /<LiquidGlassButton/);
	assert.doesNotMatch(GLASS_PANEL_SOURCE, /magnetDistance=\{8\}/);
	assert.doesNotMatch(SEARCH_SOURCE, /SearchIcon/);
	assert.match(SEARCH_SOURCE, /import \{ Button \} from "@\/components\/ui\/button";/);
	assert.match(SEARCH_SOURCE, /import \{ token \} from "@\/lib\/tokens";/);
	assert.match(SEARCH_SOURCE, /className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-subtlest"/);
	assert.match(SEARCH_SOURCE, /style=\{\{ font: token\("font\.body"\) \}\}/);
	assert.doesNotMatch(SEARCH_SOURCE, /text-base text-text/);
	assert.doesNotMatch(SEARCH_SOURCE, /sm:text-lg/);
	assert.match(SEARCH_SOURCE, /bottom-\[calc\(100%\+0\.75rem\)\]/);
	assert.match(SEARCH_SOURCE, /PixelArrowRightIcon/);
	assert.match(SEARCH_SOURCE, /PersonalGraphControlFlyoutTrigger/);
	assert.match(SEARCH_SOURCE, /PersonalGraphControlFlyoutActions/);
	assert.match(SEARCH_SOURCE, /collapseFlyoutKey\?: number/);
	assert.match(SEARCH_SOURCE, /isFlyoutDisabled\?: boolean/);
	assert.match(SEARCH_SOURCE, /setIsFlyoutOpen\(false\);/);
	assert.match(SURFACE_SOURCE, /collapseFlyoutKey=\{flyoutCollapseKey\}/);
	assert.match(SURFACE_SOURCE, /isFlyoutDisabled=\{isResetFlyoutCollapsing\}/);
	assert.match(SEARCH_SOURCE, /disabled=\{isFlyoutDisabled\}/);
	assert.match(SEARCH_SOURCE, /aria-label=\{isTwgMode \? "Ask or search Team Work Graph" : "Ask or search Personal Graph"\}/);
	assert.match(SEARCH_SOURCE, /useVaultSearch\(isTwgMode \? "" : query\)/);
	assert.match(SEARCH_SOURCE, /const canAskTwg = isTwgMode && Boolean\(onAskChat\) && Boolean\(trimmedQuery\);/);
	assert.match(SEARCH_SOURCE, /onAskChat\(trimmedQuery\);/);
	assert.match(SEARCH_SOURCE, /aria-label=\{isTwgMode \? "Submit TWG prompt" : "Open top search result"\}/);
	assert.match(SEARCH_SOURCE, /disabled=\{isSubmitDisabled\}/);
	assert.match(
		SEARCH_SOURCE,
		/<Button[\s\S]*aria-label=\{isTwgMode \? "Submit TWG prompt" : "Open top search result"\}[\s\S]*className="rounded-full"[\s\S]*size="icon"[\s\S]*variant="ghost"/,
	);
	assert.doesNotMatch(SEARCH_SOURCE, /PersonalGraphLiquidGlassIconButton/);
	assert.doesNotMatch(SEARCH_SOURCE, /PERSONAL_GRAPH_SEARCH_ICON_BUTTON_CLASS_NAME/);
	assert.doesNotMatch(SEARCH_SOURCE, /PERSONAL_GRAPH_SEARCH_ICON_BUTTON_GLASS_PROPS/);
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/<Button[\s\S]*aria-expanded=\{isOpen\}[\s\S]*size="icon"[\s\S]*variant="ghost"/,
	);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /PersonalGraphLiquidGlassIconButton/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /PERSONAL_GRAPH_SEARCH_ICON_BUTTON_CLASS_NAME/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /PERSONAL_GRAPH_SEARCH_ICON_BUTTON_GLASS_PROPS/);
	assert.match(SURFACE_SOURCE, /render:\s*\(\s*<PersonalGraphLiquidGlassIconButton[\s\S]*aria-label="Refresh"/);
	assert.match(SURFACE_SOURCE, /render:\s*\(\s*<PersonalGraphLiquidGlassIconButton[\s\S]*aria-label=\{themeLabel\}/);
	assert.match(SURFACE_SOURCE, /render:\s*\(\s*<PersonalGraphLiquidGlassIconButton[\s\S]*aria-label="Reset"/);
	assert.match(SURFACE_SOURCE, /<PopoverTrigger[\s\S]*render=\{[\s\S]*<PersonalGraphLiquidGlassIconButton[\s\S]*aria-label="Add data"/);
	assert.doesNotMatch(SEARCH_SOURCE, /aria-label="Open graph parameters"/);
	assert.match(SEARCH_SOURCE, /actions=\{flyoutActions\}/);
});

test("Personal Graph exposes selected-node summarize controls above the composer", () => {
	assert.match(SURFACE_SOURCE, /import \{ PersonalGraphSummaryPanel \} from "\.\/personal-graph-summary-panel";/);
	assert.match(SURFACE_SOURCE, /<PersonalGraphSummaryPanel[\s\S]*explorer=\{explorer\}[\s\S]*node=\{isInspectorOpen \? displayedNode : null\}/);
	assert.match(SURFACE_SOURCE, /onSelectNode=\{handleSelectRelatedNode\}/);
	assert.match(SURFACE_SOURCE, /workWindow=\{twgWorkWindow\}/);
	assert.match(SUMMARY_PANEL_SOURCE, /Selected node summary/);
	assert.match(SUMMARY_PANEL_SOURCE, /Short/);
	assert.match(SUMMARY_PANEL_SOURCE, /Medium/);
	assert.match(SUMMARY_PANEL_SOURCE, /Long/);
	assert.match(SUMMARY_PANEL_SOURCE, /aria-pressed=\{summary\.length === option\.value\}/);
	assert.match(SUMMARY_PANEL_SOURCE, /Regenerate/);
	assert.match(SUMMARY_PANEL_SOURCE, /Export HTML/);
	assert.match(SUMMARY_PANEL_SOURCE, /sandbox="allow-popups allow-scripts"/);
	assert.match(SUMMARY_PANEL_SOURCE, /srcDoc=\{summary\.summaryHtml\}/);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, /allow-same-origin/);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, /Markdown summary/);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, />\s*Confirm\s*</);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, /Generate slides/);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, /Download \.md/);
	assert.match(SUMMARY_HOOK_SOURCE, /abortRef\.current\?\.abort\(\);/);
	assert.match(SUMMARY_HOOK_SOURCE, /clientIdRef = useRef\(""\)/);
	assert.match(SUMMARY_HOOK_SOURCE, /action: "summary"/);
	assert.match(SUMMARY_HOOK_SOURCE, /event\.type === "article"/);
	assert.match(SUMMARY_HOOK_SOURCE, /buildPersonalGraphSummaryHtmlDocument/);
	assert.match(SUMMARY_HOOK_SOURCE, /bypassCache: options\.bypassCache/);
	assert.doesNotMatch(SUMMARY_HOOK_SOURCE, /action: "deck"/);
	assert.doesNotMatch(SUMMARY_HOOK_SOURCE, /summaryOverride: \{ summary, takeaways \}/);
	assert.match(PERSONAL_GRAPH_API_SOURCE, /\/api\/personal-graph\/summarize/);
});

test("Personal Graph lazily expands selected TWG nodes without blocking selection", () => {
	assert.match(PERSONAL_GRAPH_API_SOURCE, /export function expandTwgNode\(nodeId: string/);
	assert.match(PERSONAL_GRAPH_API_SOURCE, /\/api\/personal-graph\/twg\/expand/);
	assert.match(PERSONAL_GRAPH_API_SOURCE, /body: JSON\.stringify\(\{ nodeId \}\)/);
	assert.match(SURFACE_SOURCE, /import \{ expandTwgNode \} from "\.\/lib\/personal-graph-api";/);
	assert.match(SURFACE_SOURCE, /import \{ mergeSelectedNodeExpansion \} from "\.\/lib\/personal-graph-explorer-merge";/);
	assert.match(SURFACE_SOURCE, /const \[expandedExplorer, setExpandedExplorer\] = useState<VaultExplorer \| null>\(null\);/);
	assert.match(SURFACE_SOURCE, /const explorer = isTwgMode \? \(chatExplorer \?\? expandedExplorer \?\? rawExplorer\) : rawExplorer;/);
	assert.match(SURFACE_SOURCE, /expandedTwgNodeIdsRef = useLazyRef<Set<string>>\(\(\) => new Set\(\)\);/);
	assert.match(SURFACE_SOURCE, /expandingTwgNodeIdsRef = useLazyRef<Set<string>>\(\(\) => new Set\(\)\);/);
	assert.match(SURFACE_SOURCE, /if \(!isTwgMode \|\| !selectedNodeId \|\| isLoading\)/);
	assert.match(SURFACE_SOURCE, /selectedNode\.provider !== "twg"/);
	assert.match(SURFACE_SOURCE, /expandTwgNode\(selectedNodeId, \{ signal: controller\.signal \}\)/);
	assert.match(SURFACE_SOURCE, /setChatExplorer\(\(current\) =>[\s\S]*mergeSelectedNodeExpansion\(current, result\.explorer, selectedNodeId\)/);
	assert.match(SURFACE_SOURCE, /setExpandedExplorer\(result\.explorer\);/);
	assert.match(SURFACE_SOURCE, /expandedTwgNodeIdsRef\.current\.add\(selectedNodeId\);/);
	assert.match(SURFACE_SOURCE, /console\.warn\("TWG node expansion failed", nextError\);/);
	assert.match(EXPLORER_MERGE_SOURCE, /export function mergeSelectedNodeExpansion/);
	assert.match(EXPLORER_MERGE_SOURCE, /edge\.source === selectedNodeId/);
	assert.match(EXPLORER_MERGE_SOURCE, /edge\.target === selectedNodeId/);
});

test("Personal Graph surfaces a per-node loading indicator while a TWG expansion is pending", () => {
	assert.match(
		SURFACE_SOURCE,
		/import \{ Spinner \} from "@\/components\/ui\/spinner";/,
	);
	assert.match(
		SURFACE_SOURCE,
		/const \[expandingTwgNodeIds, setExpandingTwgNodeIds\] = useState<ReadonlySet<string>>\(\(\) => new Set\(\)\);/,
	);
	assert.match(
		SURFACE_SOURCE,
		/setExpandingTwgNodeIds\(\(current\) => \{[\s\S]*if \(current\.has\(selectedNodeId\)\) return current;[\s\S]*next\.add\(selectedNodeId\);/,
	);
	assert.match(
		SURFACE_SOURCE,
		/setExpandingTwgNodeIds\(\(current\) => \{[\s\S]*if \(!current\.has\(selectedNodeId\)\) return current;[\s\S]*next\.delete\(selectedNodeId\);/,
	);
	assert.match(SURFACE_SOURCE, /setExpandingTwgNodeIds\(new Set\(\)\);/);
	assert.match(
		SURFACE_SOURCE,
		/const isExpandingDisplayedNode =\s+isTwgMode && displayedNode\?\.provider === "twg" && expandingTwgNodeIds\.has\(displayedNode\.id\);/,
	);
	assert.match(SURFACE_SOURCE, /isExpanding=\{isExpandingDisplayedNode\}/);
	assert.match(SURFACE_SOURCE, /isExpanding\?: boolean;/);
	assert.match(SURFACE_SOURCE, /const showRelatedSection = isExpanding \|\| relatedNodes\.length > 0;/);
	assert.match(SURFACE_SOURCE, /showRelatedSection \? \(/);
	assert.match(SURFACE_SOURCE, /<Spinner label="Expanding related pages" size="xs" \/>/);
	assert.match(SURFACE_SOURCE, /data-personal-graph-related-loading="true"/);
	assert.match(SURFACE_SOURCE, /<span>Expanding…<\/span>/);
});

test("Personal Graph dedupes related neighbor ids before slicing", () => {
	assert.match(SURFACE_HELPERS_SOURCE, /const seenRelatedIds = new Set<string>\(\);/);
	assert.match(SURFACE_HELPERS_SOURCE, /seenRelatedIds\.has\(neighborId\)/);
	assert.match(SURFACE_HELPERS_SOURCE, /seenRelatedIds\.add\(neighborId\);/);
	assert.doesNotMatch(
		SURFACE_HELPERS_SOURCE,
		/const relatedIds = explorer\.edges\.flatMap\(\(edge\) => \{[\s\S]*if \(edge\.source === node\.id\) return \[edge\.target\];[\s\S]*if \(edge\.target === node\.id\) return \[edge\.source\];/,
	);
});

test("Personal Graph clears TWG expansion state on graph resets and filter changes", () => {
	assert.match(SURFACE_SOURCE, /const clearTwgExpansionState = useCallback/);
	assert.match(SURFACE_SOURCE, /twgExpansionGenerationRef\.current \+= 1;/);
	assert.match(SURFACE_SOURCE, /expandedTwgNodeIdsRef\.current\.clear\(\);/);
	assert.match(SURFACE_SOURCE, /expandingTwgNodeIdsRef\.current\.clear\(\);/);
	assert.match(SURFACE_SOURCE, /setExpandedExplorer\(null\);/);
	assert.match(SURFACE_SOURCE, /const handleClearChatFilter = useCallback\(\(\) => \{[\s\S]*clearTwgExpansionState\(\);[\s\S]*void refresh\(\);/);
	assert.match(SURFACE_SOURCE, /const handleResetVault = useCallback\(async \(\) => \{[\s\S]*clearTwgExpansionState\(\);[\s\S]*twgChat\.stop\(\);/);
	assert.match(SURFACE_SOURCE, /if \(previousSourceRef\.current === source\)/);
	assert.match(SURFACE_SOURCE, /previousSourceRef\.current = source;[\s\S]*setChatExplorer\(null\);[\s\S]*clearTwgExpansionState\(\);/);
});

test("Personal Graph does not fetch the vault explorer before a vault is ready", () => {
	assert.match(SURFACE_SOURCE, /const explorerEnabled = isTwgMode \|\| vaultSettings\?\.status === "ready";/);
	assert.match(SURFACE_SOURCE, /useVaultExplorer\(\{ enabled: explorerEnabled \}\)/);
	assert.match(VAULT_EXPLORER_HOOK_SOURCE, /interface UseVaultExplorerOptions \{[\s\S]*enabled\?: boolean;[\s\S]*\}/);
	assert.match(VAULT_EXPLORER_HOOK_SOURCE, /const enabledRef = useRef\(enabled\);/);
	assert.match(VAULT_EXPLORER_HOOK_SOURCE, /enabledRef\.current = enabled;/);
	assert.match(
		VAULT_EXPLORER_HOOK_SOURCE,
		/if \(!enabledRef\.current\) \{[\s\S]*dispatch\(\{ type: "disabled" \}\);[\s\S]*return;[\s\S]*\}/,
	);
	assert.match(
		VAULT_EXPLORER_HOOK_SOURCE,
		/useEffect\(\(\) => \{[\s\S]*if \(!enabled\) \{[\s\S]*dispatch\(\{ type: "disabled" \}\);[\s\S]*return;[\s\S]*\}[\s\S]*void refresh\(\);[\s\S]*\}, \[enabled, refresh\]\);/,
	);
});

test("Personal Graph enables liquid glass stage tracking for route glass UI", () => {
	assert.match(
		SURFACE_SOURCE,
		/import \{[\s\S]*PersonalGraphLiquidGlassStageProvider,[\s\S]*\} from "\.\/personal-graph-glass-panel";/,
	);
	assert.match(SURFACE_SOURCE, /const liquidGlassStageRef = useRef<HTMLElement \| null>\(null\);/);
	assert.match(SURFACE_SOURCE, /ref=\{liquidGlassStageRef\}/);
	assert.match(
		SURFACE_SOURCE,
		/<PersonalGraphLiquidGlassStageProvider stageRef=\{liquidGlassStageRef\}>/,
	);
	assert.match(
		GLASS_PANEL_SOURCE,
		/const PERSONAL_GRAPH_LIQUID_GLASS_POINTER_ACTIVATION_RADIUS = Number\.POSITIVE_INFINITY;/,
	);
	assert.match(GLASS_PANEL_SOURCE, /const PersonalGraphLiquidGlassStageContext = createContext/);
	assert.match(GLASS_PANEL_SOURCE, /mouseContainer: stageRef/);
	assert.match(GLASS_PANEL_SOURCE, /pointerLayers: true/);
	assert.match(GLASS_PANEL_SOURCE, /pointerSmoothing: PERSONAL_GRAPH_LIQUID_GLASS_POINTER_SMOOTHING/);
	assert.match(GLASS_PANEL_SOURCE, /<LiquidGlass[\s\S]*\{\.\.\.getPersonalGraphStageTrackingGlassProps\(stageRef\)\}/);
	assert.match(
		GLASS_PANEL_SOURCE,
		/const resolvedGlassProps = \{[\s\S]*\.\.\.stageTrackingGlassProps,[\s\S]*\.\.\.glassProps,[\s\S]*\} satisfies PersonalGraphGlassTuningProps;/,
	);
	assert.match(GLASS_PANEL_SOURCE, /target\.addEventListener\("pointermove", handlePointerMove, \{ passive: true \}\);/);
});

test("Personal Graph lets the graph renderer fill the route viewport behind the chrome", () => {
	assert.match(SURFACE_SOURCE, /<motion\.section\s+className="absolute inset-0 z-10"\s+aria-label="Vault graph"/);
	assert.match(SURFACE_SOURCE, /const isGraphIntroPhase = phase === "graph" \|\| phase === "done";/);
	assert.match(SURFACE_SOURCE, /const isGraphRevealed = isVaultReadyForLayout && isGraphIntroPhase;/);
	assert.doesNotMatch(SURFACE_SOURCE, /bottom-\[6\.5rem\] top-\[250px\]/);
	assert.doesNotMatch(SURFACE_SOURCE, /sm:top-\[320px\] lg:top-\[360px\] xl:top-\[400px\]/);
	assert.match(GRAPH_SOURCE, /isFillVariant \? "flex h-full w-full flex-col"/);
	assert.match(NEURAL_CANVAS_SOURCE, /"relative h-full min-h-0 overflow-hidden"/);
	assert.doesNotMatch(NEURAL_CANVAS_SOURCE, /min-h-\[620px\]/);
});

test("Personal Graph reveals the radial graph with Motion blur and scale", () => {
	assert.match(
		SURFACE_SOURCE,
		/initial=\{shouldReduceMotion \? false : \{ opacity: 0, transform: "translateY\(72px\) scale\(0\.94\)", filter: "blur\(24px\)" \}\}/,
	);
	assert.match(SURFACE_SOURCE, /transform: isGraphRevealed \|\| shouldReduceMotion \? "translateY\(0px\) scale\(1\)" : "translateY\(72px\) scale\(0\.94\)"/);
	assert.match(SURFACE_SOURCE, /filter: isGraphRevealed \|\| shouldReduceMotion \? "blur\(0px\)" : "blur\(24px\)"/);
	assert.match(SURFACE_SOURCE, /style=\{\{ transformOrigin: "50% 92%", willChange: "transform, opacity, filter" \}\}/);
	assert.match(
		SURFACE_SOURCE,
		/const incomingGraphInitial = outgoingGraphSnapshot && !shouldReduceMotion[\s\S]*clipPath: visualMode === "automation-workflow-radial" \? "circle\(12% at 50% 50%\)" : "circle\(150% at 50% 50%\)"/,
	);
	assert.match(
		SURFACE_SOURCE,
		/animate=\{\{ clipPath: "circle\(150% at 50% 50%\)", filter: "blur\(0px\)", opacity: 1, scale: 1 \}\}/,
	);
	assert.match(SURFACE_SOURCE, /const incomingGraphTransition = shouldReduceMotion\s+\? \{ duration: 0\.18, ease: easeOut \}/);
});

test("Personal Graph uses theme-aware editor-style surrounding chrome", () => {
	assert.match(SURFACE_SOURCE, /aria-label="Add data"/);
	assert.match(SURFACE_SOURCE, /aria-label="Knowledge Graph details"/);
	assert.doesNotMatch(SURFACE_SOURCE, /PersonalGraphZoomControls/);
	assert.doesNotMatch(SURFACE_SOURCE, /themeMode="light"/);
	assert.match(SURFACE_SOURCE, /showSelectionOverlay=\{false\}/);
	assert.doesNotMatch(SURFACE_SOURCE, /PERSONAL_GRAPH_EDITOR_COLOR_LOCK_STYLE/);
	assert.doesNotMatch(SURFACE_SOURCE, /dark:bg-white/);
	assert.doesNotMatch(SURFACE_SOURCE, /dark:text-neutral-950/);
	assert.match(SURFACE_SOURCE, /bg-surface text-text/);
	assert.match(SURFACE_SOURCE, /style=\{style\}/);
	assert.match(SURFACE_SOURCE, /PersonalGraphGlassPanel/);
	assert.match(SURFACE_SOURCE, /border-border bg-bg-neutral-subtle/);
	assert.match(SEARCH_SOURCE, /bg-transparent text-text/);
	assert.match(SEARCH_SOURCE, /rounded-2xl/);
	assert.match(SURFACE_SOURCE, /CopyIcon/);
});

test("Personal Graph leaves the page header transparent over the backdrop grid", () => {
	assert.match(SURFACE_SOURCE, /<header className="absolute inset-x-4 top-6 z-30 sm:inset-x-6 lg:inset-x-8">/);
	assert.match(SURFACE_SOURCE, /<header className="absolute inset-x-4 top-6 z-30 sm:inset-x-6 lg:inset-x-8">\s*<motion\.div\s+className=\{cn\("relative flex flex-col items-center"/);
	assert.match(SURFACE_SOURCE, /isPostSettle \? "gap-4" : "gap-6"/);
	assert.match(SURFACE_SOURCE, /initial=\{\{ y: PERSONAL_GRAPH_HEADER_INITIAL_Y \}\}/);
	assert.match(SURFACE_SOURCE, /y: isPostSettle \? PERSONAL_GRAPH_HEADER_SETTLED_Y : PERSONAL_GRAPH_HEADER_INITIAL_Y/);
	assert.match(SURFACE_SOURCE, /\s+layout\s+transition=\{\{/);
	assert.match(SURFACE_SOURCE, /const PERSONAL_GRAPH_HEADER_SETTLE_DURATION_SECONDS = 0\.7;/);
	assert.match(SURFACE_SOURCE, /y: \{ duration: PERSONAL_GRAPH_HEADER_SETTLE_DURATION_SECONDS, ease: easeOut \}/);
	assert.match(SURFACE_SOURCE, /layout: \{ duration: 0\.45, ease: easeOut \}/);
	assert.match(SURFACE_SOURCE, /minHeight: \{\s+duration: PERSONAL_GRAPH_HEADER_SETTLE_DURATION_SECONDS,\s+ease: easeOut,/);
	assert.match(SURFACE_SOURCE, /scale: isPostSettle \? 1 : PERSONAL_GRAPH_INITIAL_TITLE_SCALE,\s+\}\}\s+transition=\{\{\s+duration: PERSONAL_GRAPH_HEADER_SETTLE_DURATION_SECONDS,/);
	assert.doesNotMatch(SURFACE_SOURCE, /PERSONAL_GRAPH_TITLE_SETTLE_DELAY_SECONDS/);
	assert.doesNotMatch(SURFACE_SOURCE, /delay: isPostSettle \?/);
	assert.match(SURFACE_SOURCE, /const PERSONAL_GRAPH_BYLINE_REVEAL_DELAY_SECONDS = 0\.4;/);
	assert.match(SURFACE_SOURCE, /const isBylineRevealed = isPostSettle;/);
	assert.match(SURFACE_SOURCE, /delay: isBylineRevealed \? PERSONAL_GRAPH_BYLINE_REVEAL_DELAY_SECONDS : 0/);
	assert.doesNotMatch(SURFACE_SOURCE, /fontSize: isPostSettle \? "0\.75rem" : "1\.4rem"/);
	assert.doesNotMatch(SURFACE_SOURCE, /marginTop: isPostSettle \? "0\.5rem" : "1rem"/);
	assert.doesNotMatch(
		SURFACE_SOURCE,
		/<header className="absolute inset-x-4 top-6 z-30 sm:inset-x-6 lg:inset-x-8">\s*<PersonalGraphGlassPanel contentClassName="relative flex flex-col items-center gap-4/,
	);
	assert.doesNotMatch(SURFACE_SOURCE, /contentClassName="relative flex flex-col items-center gap-4"/);
});

test("Personal Graph keeps the idle radial graph unselected until explicit node selection", () => {
	assert.doesNotMatch(SURFACE_SOURCE, /const defaultSelectedNodeId = getDefaultNeuralGraphSelectedNodeId\(accessibleGraph\);/);
	assert.match(SURFACE_SOURCE, /if \(selectedNodeId && !accessibleGraph\.nodesById\.has\(selectedNodeId\)\) \{/);
	assert.match(SURFACE_SOURCE, /setSelectedNodeId\(null\);/);
	assert.match(SURFACE_SOURCE, /setIsInspectorOpen\(false\);/);
	assert.match(SURFACE_SOURCE, /allowEmptySelection/);
	assert.match(SURFACE_HELPERS_SOURCE, /function getSelectedNode\(explorer: VaultExplorer \| null, selectedNodeId: string \| null\)/);
	assert.match(SURFACE_HELPERS_SOURCE, /if \(!explorer \|\| !selectedNodeId\) return null;/);
	assert.match(NEURAL_STORE_SOURCE, /function getDefaultNeuralGraphSelectedNodeId/);
	assert.match(NEURAL_STORE_SOURCE, /store\.rankedNodes\[0\]\?\.id \?\? null/);
	assert.doesNotMatch(SURFACE_SOURCE, /right\.connectionCount - left\.connectionCount/);
});

test("Personal Graph keeps the owned canvas renderer accessible", () => {
	assert.match(SURFACE_SOURCE, /<section className="sr-only" aria-label="Personal Graph text fallback">/);
	assert.doesNotMatch(SURFACE_SOURCE, /<summary>/);
	assert.match(
		SURFACE_SOURCE,
		/import \{ createNeuralGraphStore \} from "\.\/lib\/neural-graph\/store";/,
	);
	assert.match(
		SURFACE_SOURCE,
		/const accessibleGraph = useMemo\(\(\) => createNeuralGraphStore\(explorer\), \[explorer\]\);/,
	);
	assert.match(SURFACE_SOURCE, /accessibleGraph\.edges\.map/);
	assert.match(SURFACE_SOURCE, /store=\{accessibleGraph\}/);
	assert.doesNotMatch(SURFACE_SOURCE, /\(explorer\?\.edges \?\? \[\]\)\.map/);
	assert.match(
		SURFACE_SOURCE,
		/import Graph from "@\/components\/website\/demos\/visual\/graph";[\s\S]*import \{ ROVO_GRAPH_DEFAULT_PARAMS \} from "@\/components\/website\/demos\/visual\/graph-defaults";/,
	);
	assert.match(SURFACE_SOURCE, /<Graph/);
	assert.match(SURFACE_SOURCE, /variant="fill"/);
	assert.match(SURFACE_SOURCE, /showControls=\{false\}/);
	assert.match(SURFACE_SOURCE, /background="transparent"/);
	assert.match(SURFACE_SOURCE, /const responsiveGraphParams = useResponsivePersonalGraphParams\(graphStageRef\);/);
	assert.match(SURFACE_SOURCE, /const graphParams = useMemo\(/);
	assert.match(SURFACE_SOURCE, /getPersonalGraphParamsForVisualMode\(responsiveGraphParams, visualMode, explorer\)/);
	assert.doesNotMatch(SURFACE_SOURCE, /showOriginMarker: false/);
	assert.match(SURFACE_SOURCE, /params=\{graphParams\}/);
	assert.match(SURFACE_SOURCE, /rayOriginBottomOffset=\{PERSONAL_GRAPH_RAY_TAIL_BOTTOM_OFFSET_PX\}/);
	assert.match(SURFACE_SOURCE, /DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS/);
	assert.match(SURFACE_SOURCE, /interactionSettings=\{DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS\}/);
	assert.match(SURFACE_SOURCE, /DEFAULT_NEURAL_RAY_SOUND_SETTINGS/);
	assert.match(SURFACE_SOURCE, /raySoundSettings=\{DEFAULT_NEURAL_RAY_SOUND_SETTINGS\}/);
	assert.match(SURFACE_SOURCE, /allowEmptySelection/);
	assert.match(GRAPH_SOURCE, /allowEmptySelection\?: boolean;/);
	assert.match(GRAPH_SOURCE, /allowEmptySelection = false/);
	assert.match(GRAPH_SOURCE, /function resolveGraphSelectedNodeId\(/);
	assert.match(GRAPH_SOURCE, /if \(allowEmptySelection\) return null;/);
	assert.match(GRAPH_SOURCE, /rayOriginBottomOffset\?: number;/);
	assert.match(GRAPH_SOURCE, /interactionSettings\?: Partial<NeuralGraphInteractionSettings>;/);
	assert.match(GRAPH_SOURCE, /raySoundSettings\?: Partial<NeuralRaySoundSettings>;/);
	assert.match(GRAPH_SOURCE, /rayOriginBottomOffset=\{rayOriginBottomOffset\}/);
	assert.match(GRAPH_SOURCE, /const canvasInteractionSettings = showControls \? demoInteractionSettings : controlledInteractionSettings;/);
	assert.match(GRAPH_SOURCE, /const canvasRaySoundSettings = showControls \? demoRaySoundSettings : controlledRaySoundSettings;/);
	assert.match(GRAPH_SOURCE, /store\?: NeuralGraphStore;/);
	assert.match(GRAPH_SOURCE, /const graphStore = useMemo\(\(\) => providedStore \?\? createNeuralGraphStore\(explorer\), \[explorer, providedStore\]\);/);
	assert.match(GRAPH_SOURCE, /interactionSettings=\{canvasInteractionSettings\}/);
	assert.match(GRAPH_SOURCE, /raySoundSettings=\{canvasRaySoundSettings\}/);
	assert.match(GRAPH_SOURCE, /store=\{graphStore\}/);
	assert.match(NEURAL_CANVAS_SOURCE, /rayOriginBottomOffset\?: number;/);
	assert.match(NEURAL_CANVAS_SOURCE, /interactionSettings\?: NeuralGraphInteractionSettings/);
	assert.match(NEURAL_CANVAS_SOURCE, /raySoundSettings\?: NeuralRaySoundSettings/);
	assert.match(NEURAL_CANVAS_SOURCE, /store\?: NeuralGraphStore;/);
	assert.match(NEURAL_CANVAS_SOURCE, /store: providedStore/);
	assert.match(NEURAL_CANVAS_SOURCE, /const store = useMemo\(\(\) => providedStore \?\? createNeuralGraphStore\(explorer\), \[explorer, providedStore\]\);/);
	assert.match(NEURAL_CANVAS_SOURCE, /function getRayOriginY/);
	assert.match(NEURAL_CANVAS_SOURCE, /viewport\.height - rayOriginBottomOffset/);
	assert.match(NEURAL_CANVAS_SOURCE, /style=\{getOriginMarkerStyleForViewport\(params, viewport, rayOriginY\)\}/);
	assert.match(NEURAL_RENDERER_SOURCE, /rayOriginY\?: number;/);
	assert.match(NEURAL_RENDERER_SOURCE, /rayOriginY \?\? viewport\.height \* params\.rayOriginY/);
	assert.match(NEURAL_RENDERER_SOURCE, /function drawRadialRayTails/);
	assert.match(NEURAL_RENDERER_SOURCE, /const origin = getNeuralOrigin\(options\.viewport, options\.params\);/);
	assert.doesNotMatch(SURFACE_SOURCE, /PERSONAL_GRAPH_NEURAL_PARAMS_STORAGE_KEY/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /nodeShape: "square"/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /layoutShape: "radialCluster"/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /radialArcAngle: 360/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /radialDepthCurve: 0\.8/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /nodeSize: 4/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /originMarkerSize: 12/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /originY: 0\.52/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /rayOriginY: 0\.52/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /signalColor: ROVO_GRAPH_COLORS\.default/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /signalFrequency: 0\.5/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /signalGlowEnabled: false/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /signalLength: 0\.5/);
	assert.match(GRAPH_DEFAULTS_SOURCE, /signalWidth: 1/);
	assert.doesNotMatch(SURFACE_SOURCE, /PersonalGraphPromptTailConnector/);
	assert.doesNotMatch(SURFACE_SOURCE, /data-personal-graph-tail-connector/);
	assert.match(SURFACE_SOURCE, /selectedNodeId=\{selectedNodeId\}/);
	assert.match(SURFACE_SOURCE, /onSelectedNodeIdChange=\{handleSelectedNodeIdChange\}/);
	assert.doesNotMatch(SURFACE_SOURCE, /<PersonalGraphNeuralCanvas/);
	assert.doesNotMatch(SURFACE_SOURCE, /PersonalGraphSigma/);
	assert.match(GRAPH_SOURCE, /<PersonalGraphNeuralCanvas/);
	assert.match(NEURAL_CANVAS_SOURCE, /data-neural-graph-renderer="owned-canvas"/);
	assert.match(NEURAL_CANVAS_SOURCE, /data-neural-graph-origin-node="true"/);
	assert.match(NEURAL_CANVAS_SOURCE, /params\.showRays && params\.showOriginMarker && hasMeasuredViewport \? \(/);
	assert.match(NEURAL_CANVAS_SOURCE, /backgroundClass = background === "transparent" \? "bg-transparent" : "bg-surface"/);
	assert.match(NEURAL_CANVAS_SOURCE, /<canvas aria-hidden="true"/);
	assert.match(NEURAL_CANVAS_SOURCE, /<SelectedNodeOverlay/);
});

test("Personal Graph reuses the settled focused layout when fitting the selected-node camera", () => {
	assert.match(NEURAL_CANVAS_SOURCE, /const FOCUS_PROGRESS_SETTLED_EPSILON = 0\.001;/);
	assert.match(NEURAL_CANVAS_SOURCE, /fullyFocusedLayout\?: NeuralGraphLayout \| null;/);
	assert.match(
		NEURAL_CANVAS_SOURCE,
		/const fitLayout = fullyFocusedLayout \?\? computeNeuralGraphLayout\(\{[\s\S]*?focusProgress: 1,/,
	);
	assert.match(
		NEURAL_CANVAS_SOURCE,
		/focusProgressRef\.current >= 1 - FOCUS_PROGRESS_SETTLED_EPSILON &&[\s\S]*?layoutFocusNodeId === selectedNodeId[\s\S]*?\? lockedTargetLayout[\s\S]*?: null;/,
	);
	assert.match(
		NEURAL_CANVAS_SOURCE,
		/focusProgressRef\.current = settledHidden \? 0 : settledShown \? 1 : nextFocusProgress;/,
	);
});

test("Personal Graph derives responsive graph params from the route stage", () => {
	assert.match(SURFACE_SOURCE, /function useResponsivePersonalGraphParams/);
	assert.match(SURFACE_SOURCE, /new ResizeObserver\(updateViewport\)/);
	assert.match(SURFACE_SOURCE, /const responsiveGraphParams = useResponsivePersonalGraphParams\(graphStageRef\);/);
	assert.match(SURFACE_SOURCE, /ref=\{graphStageRef\}/);
	assert.match(SURFACE_SOURCE, /setResponsiveParamsForViewport\(viewport\)/);
	assert.match(SURFACE_SOURCE, /shouldAnimateResponsivePersonalGraphParams/);
	assert.match(SURFACE_SOURCE, /const targetWidthMV = useMotionValue<number>/);
	assert.match(SURFACE_SOURCE, /const smoothWidthMV = useSpring/);
	assert.match(SURFACE_SOURCE, /useMotionValueEvent\(smoothWidthMV, "change"/);
	assert.match(SURFACE_SOURCE, /setParams\(\(currentParams\) => \{/);
	assert.match(SURFACE_SOURCE, /areResponsivePersonalGraphParamsEqual\(currentParams, nextParams\)/);
	assert.match(SURFACE_SOURCE, /targetWidthMV\.jump\(viewport\.width\)/);
	assert.match(SURFACE_SOURCE, /smoothWidthMV\.jump\(viewport\.width\)/);
	assert.match(SURFACE_SOURCE, /targetWidthMV\.set\(viewport\.width\)/);
	assert.match(SURFACE_SOURCE, /useReducedMotion/);
	assert.doesNotMatch(SURFACE_SOURCE, /onUpdate: \(width\)/);
	assert.match(RESPONSIVE_PARAMS_SOURCE, /RESPONSIVE_PERSONAL_GRAPH_WIDTHS/);
	assert.match(RESPONSIVE_PARAMS_SOURCE, /export function getResponsivePersonalGraphParams/);
	assert.match(RESPONSIVE_PARAMS_SOURCE, /showLabels: width >= 700/);
	assert.doesNotMatch(SURFACE_SOURCE, /params=\{ROVO_GRAPH_DEFAULT_PARAMS\}/);
});

test("Personal Graph uses a theme-aware editor canvas backdrop", () => {
	assert.match(
		SURFACE_SOURCE,
		/import \{ PersonalGraphBackdrop \} from "\.\/personal-graph-backdrop";/,
	);
	assert.match(SURFACE_SOURCE, /<PersonalGraphBackdrop className="z-0" \/>/);
	assert.doesNotMatch(SURFACE_SOURCE, /PersonalGraphAsciiOverlay/);
	assert.match(
		BACKDROP_SOURCE,
		/import Ascii from "@\/components\/website\/demos\/visual\/shaders\/ascii";/,
	);
	assert.match(BACKDROP_SOURCE, /data-personal-graph-editor-backdrop="light-grid"/);
	assert.match(BACKDROP_SOURCE, /data-personal-graph-editor-backdrop="ascii-shader"/);
	assert.doesNotMatch(BACKDROP_SOURCE, /data-personal-graph-editor-backdrop="ascii-grid-overlay"/);
	assert.match(BACKDROP_SOURCE, /overflow-hidden bg-surface/);
	assert.match(BACKDROP_SOURCE, /#000 42%, #000 100%/);
	assert.doesNotMatch(BACKDROP_SOURCE, /bg-gradient-to-t from-white/);
	assert.match(
		BACKDROP_SOURCE,
		/import PatternTile, \{ type PatternStrokeOptions \} from "@\/components\/website\/demos\/visual\/pattern-tile";/,
	);
	assert.match(
		BACKDROP_SOURCE,
		/import WaveGradient from "@\/components\/website\/demos\/visual\/shaders\/wave-gradient";/,
	);
	assert.match(
		BACKDROP_SOURCE,
		/import \{ useTheme \} from "@\/components\/utils\/theme-wrapper";/,
	);
	assert.match(BACKDROP_SOURCE, /patternType="grid"/);
	assert.match(BACKDROP_SOURCE, /className="text-border"/);
	assert.match(BACKDROP_SOURCE, /front="currentColor"/);
	assert.match(BACKDROP_SOURCE, /back="transparent"/);
	assert.match(TAILWIND_THEME_SOURCE, /--color-neutral-400: var\(--ds-chart-gray-bold\);/);
	assert.doesNotMatch(BACKDROP_SOURCE, /blendMode="multiply"/);
	assert.doesNotMatch(BACKDROP_SOURCE, /PERSONAL_GRAPH_GRID_COLORS/);
	assert.doesNotMatch(BACKDROP_SOURCE, /PERSONAL_GRAPH_GRID_OVERLAY_COLORS/);
	assert.doesNotMatch(BACKDROP_SOURCE, /front=\{gridColor\}/);
	assert.doesNotMatch(BACKDROP_SOURCE, /front=\{gridOverlayColor\}/);
	assert.doesNotMatch(BACKDROP_SOURCE, /color-mix\(in srgb, var\(--ds-surface\)/);
	assert.doesNotMatch(BACKDROP_SOURCE, /const PERSONAL_GRAPH_GRID_COLOR = "var\(--ds-border\)";/);
	assert.doesNotMatch(BACKDROP_SOURCE, /className="text-text-subtlest"/);
	assert.doesNotMatch(BACKDROP_SOURCE, /className="text-blanket"/);
	assert.match(BACKDROP_SOURCE, /const PERSONAL_GRAPH_GRID_MASK = /);
	assert.match(BACKDROP_SOURCE, /WebkitMaskImage: PERSONAL_GRAPH_GRID_MASK/);
	assert.doesNotMatch(BACKDROP_SOURCE, /PERSONAL_GRAPH_GRID_FADE_STYLE/);
	assert.doesNotMatch(BACKDROP_SOURCE, /PERSONAL_GRAPH_SHADER_GRID_FADE_STYLE/);
	assert.match(BACKDROP_SOURCE, /transparent 76%/);
	assert.doesNotMatch(BACKDROP_SOURCE, /transparent 62%/);
	assert.match(BACKDROP_SOURCE, /back="transparent"/);
	assert.match(BACKDROP_SOURCE, /scale=\{48\}/);
	assert.match(BACKDROP_SOURCE, /style: "dashed"/);
	assert.doesNotMatch(BACKDROP_SOURCE, /width: 0\.5/);
	assert.match(BACKDROP_SOURCE, /dash: 3/);
	assert.match(BACKDROP_SOURCE, /gap: 6/);
	assert.match(BACKDROP_SOURCE, /<WaveGradient/);
	assert.match(BACKDROP_SOURCE, /const PERSONAL_GRAPH_SHADER_SURFACE_COLORS = \{/);
	assert.match(BACKDROP_SOURCE, /dark: "#1D2125"/);
	assert.match(BACKDROP_SOURCE, /light: "#FFFFFF"/);
	assert.match(BACKDROP_SOURCE, /function getPersonalGraphShaderSurfaceColors\(theme: "light" \| "dark"\): \[string, string, string, string\]/);
	assert.match(BACKDROP_SOURCE, /colors=\{surfaceColors\}/);
	assert.match(BACKDROP_SOURCE, /key=\{`personal-graph-wave-\$\{actualTheme\}`\}/);
	assert.doesNotMatch(BACKDROP_SOURCE, /absolute inset-x-0 top-0 h-32/);
	assert.doesNotMatch(BACKDROP_SOURCE, /bg-gradient-to-b from-surface via-surface\/90 to-transparent/);
	assert.doesNotMatch(BACKDROP_SOURCE, /radial-gradient\(ellipse at/);
	assert.match(BACKDROP_SOURCE, /"#1868DB"/);
	assert.match(BACKDROP_SOURCE, /"#FCA700"/);
	assert.match(BACKDROP_SOURCE, /"#AF59E1"/);
	assert.match(BACKDROP_SOURCE, /"#6A9A23"/);
	assert.doesNotMatch(BACKDROP_SOURCE, /sourceMode="field"/);
	assert.match(BACKDROP_SOURCE, /charset="custom"/);
	assert.doesNotMatch(BACKDROP_SOURCE, /characterMode="sequence"/);
	assert.match(BACKDROP_SOURCE, /customChars=" \.:-=\+\*#%@ROVO"/);
	assert.doesNotMatch(BACKDROP_SOURCE, /colorMode="monochrome"/);
	assert.match(BACKDROP_SOURCE, /const PERSONAL_GRAPH_ASCII_COLOR = "var\(--ds-text-subtle\)";/);
	assert.match(BACKDROP_SOURCE, /monoColor=\{PERSONAL_GRAPH_ASCII_COLOR\}/);
	assert.match(BACKDROP_SOURCE, /backgroundColor=\{surfaceColor\}/);
	assert.match(BACKDROP_SOURCE, /key=\{`personal-graph-ascii-\$\{actualTheme\}`\}/);
	assert.doesNotMatch(BACKDROP_SOURCE, /colorMode="source"/);
	assert.match(BACKDROP_SOURCE, /compositeMode="mask"/);
	assert.doesNotMatch(BACKDROP_SOURCE, /speed=\{1\}/);
	assert.match(BACKDROP_SOURCE, /sourceColors=\{PERSONAL_GRAPH_SHADER_COLORS\}/);
	assert.match(BACKDROP_SOURCE, /signalBlackPoint=\{0\.1\}/);
	assert.match(BACKDROP_SOURCE, /signalWhitePoint=\{0\.88\}/);
	assert.match(BACKDROP_SOURCE, /signalGamma=\{0\.92\}/);
	assert.match(BACKDROP_SOURCE, /presenceThreshold=\{0\.56\}/);
	assert.match(BACKDROP_SOURCE, /presenceSoftness=\{0\.34\}/);
	assert.match(BACKDROP_SOURCE, /transparentBackground/);
	assert.doesNotMatch(BACKDROP_SOURCE, /LiquidGradient/);
	assert.match(GRAPH_SOURCE, /background\?: "default" \| "transparent"/);
	assert.match(NEURAL_CANVAS_SOURCE, /background\?: "default" \| "transparent"/);
});

test("Personal Graph decomposes graphology, ForceAtlas2, and Sigma concepts without runtime Sigma", () => {
	assert.match(NEURAL_STORE_SOURCE, /nodesById = new Map/);
	assert.match(NEURAL_STORE_SOURCE, /adjacency = new Map/);
	assert.match(NEURAL_LAYOUT_SOURCE, /RELAXATION_ITERATIONS/);
	assert.match(NEURAL_LAYOUT_SOURCE, /repulsion/);
	assert.match(NEURAL_CAMERA_SOURCE, /worldToViewport/);
	assert.match(NEURAL_CAMERA_SOURCE, /viewportToWorld/);
	assert.match(NEURAL_INTERACTION_SOURCE, /hitTestNeuralNode/);
	assert.doesNotMatch(NEURAL_CANVAS_SOURCE, /from "sigma"/);
	assert.doesNotMatch(NEURAL_CANVAS_SOURCE, /from "graphology"/);
});

test("Personal Graph exposes primary graph actions through a curved control flyout", () => {
	assert.match(SURFACE_SOURCE, /const flyoutActions = useMemo<ReadonlyArray<PersonalGraphControlFlyoutAction>>/);
	assert.doesNotMatch(SURFACE_SOURCE, /label: "Choose data"/);
	assert.doesNotMatch(SURFACE_SOURCE, /aria-label="Choose data"/);
	assert.match(SURFACE_SOURCE, /<PersonalGraphSourcePicker/);
	assert.match(SOURCE_PICKER_SOURCE, /aria-label="Choose Personal Graph vault folder"/);
	assert.match(SURFACE_SOURCE, /shouldShowVaultOnboarding/);
	assert.match(SURFACE_SOURCE, /const \[isTwgConnecting, setIsTwgConnecting\] = useState\(false\);/);
	assert.match(SURFACE_SOURCE, /const isTwgReady = isTwgMode && Boolean\(twgGeneratedAt\) && !isTwgConnecting && !isTwgAuthError;/);
	assert.match(SURFACE_SOURCE, /isTwgMode && \(!twgGeneratedAt \|\| isTwgConnecting\)/);
	assert.match(
		SURFACE_SOURCE,
		/setIsTwgConnecting\(true\);[\s\S]*const next = await setSource\("twg"\);[\s\S]*await refreshTwg\(\{ since: twgWorkWindow \}\);[\s\S]*await handleRefreshAll\(\);[\s\S]*setIsTwgConnecting\(false\);/,
	);
	assert.match(SURFACE_SOURCE, /isBusy=\{isVaultSelecting \|\| isSourceSwitching \|\| isTwgConnecting\}/);
	assert.match(SURFACE_SOURCE, /isTwgConnecting[\s\S]*\? "Connecting to Team Work Graph…"/);
	assert.match(SURFACE_SOURCE, /key: "refresh"/);
	assert.match(SURFACE_SOURCE, /label: "Refresh"/);
	assert.match(SURFACE_SOURCE, /aria-label="Refresh"/);
	assert.match(SURFACE_SOURCE, /key: "clear-vault"/);
	assert.match(SURFACE_SOURCE, /label: "Reset"/);
	assert.match(SURFACE_SOURCE, /aria-label="Reset"/);
	assert.match(SURFACE_SOURCE, /disabled=\{isVaultResetting\}/);
	assert.match(SURFACE_SOURCE, /onClick=\{handleResetVault\}/);
	assert.match(SURFACE_SOURCE, /const PERSONAL_GRAPH_RESET_FLYOUT_COLLAPSE_DELAY_MS = 420;/);
	assert.match(
		SURFACE_SOURCE,
		/setFlyoutCollapseKey\(\(current\) => current \+ 1\);\s+setIsResetFlyoutCollapsing\(true\);/,
	);
	assert.match(SURFACE_SOURCE, /const collapseDelay = shouldReduceMotion \? 0 : PERSONAL_GRAPH_RESET_FLYOUT_COLLAPSE_DELAY_MS;/);
	assert.match(
		SURFACE_SOURCE,
		/setTimeout\(\(\) => \{[\s\S]*setIsResetFlyoutCollapsing\(false\);[\s\S]*setIntroReplayKey\(\(current\) => current \+ 1\);[\s\S]*\}, collapseDelay\);/,
	);
	assert.doesNotMatch(
		SURFACE_SOURCE,
		/setTimeout\(\(\) => \{[\s\S]*handleRefreshAll\(\);[\s\S]*\}, collapseDelay\);/,
	);
	assert.match(SURFACE_SOURCE, /setSelectedNodeId\(null\);/);
	assert.match(SURFACE_SOURCE, /setIsCaptureQueueOpen\(false\);/);
	assert.match(SURFACE_SOURCE, /setIntroReplayKey\(\(current\) => current \+ 1\);/);
	assert.match(SURFACE_SOURCE, /if \(isVaultReady\) \{/);
	assert.match(CONTROL_FLYOUT_SOURCE, /offsetPath: `path\("\$\{ARC_PATH\}"\)`/);
	assert.match(CONTROL_FLYOUT_SOURCE, /offsetDistance: `\$\{distance\}%`/);
	assert.doesNotMatch(SURFACE_SOURCE, /PersonalGraphNeuralControls/);
	assert.doesNotMatch(SURFACE_SOURCE, /aria-label="Graph parameters"/);
	assert.match(NEURAL_PARAMS_SOURCE, /speed: 0\.8/);
	assert.match(NEURAL_PARAMS_SOURCE, /amplitude: 0\.15/);
	assert.match(NEURAL_PARAMS_SOURCE, /coneAngle: 75/);
	assert.match(NEURAL_PARAMS_SOURCE, /nodeColor: "var\(--ds-icon\)"/);
});

test("Personal Graph focuses and clears selection through the owned interaction layer", () => {
	assert.doesNotMatch(NEURAL_CANVAS_SOURCE, /focusNeuralCameraOnPoint/);
	assert.match(NEURAL_CANVAS_SOURCE, /getSelectedCameraFitNodes/);
	assert.match(NEURAL_CANVAS_SOURCE, /getNodeNeighbors/);
	assert.match(NEURAL_CANVAS_SOURCE, /fitNodes/);
	assert.match(NEURAL_CANVAS_SOURCE, /focusProgress: 1/);
	assert.match(NEURAL_CANVAS_SOURCE, /const selectedNodeIdRef = useRef<string \| null>\(selectedNodeId\);/);
	assert.match(NEURAL_CANVAS_SOURCE, /const layoutFocusNodeIdRef = useRef<string \| null>\(selectedNodeId\);/);
	assert.match(NEURAL_CANVAS_SOURCE, /const layoutFocusNodeId = layoutFocusNodeIdRef\.current;/);
	assert.match(NEURAL_CANVAS_SOURCE, /focusProgressRef/);
	assert.match(NEURAL_CANVAS_SOURCE, /focusProgress: focusProgressRef\.current/);
	assert.match(NEURAL_CANVAS_SOURCE, /focusNodeId: layoutFocusNodeId/);
	assert.match(NEURAL_LAYOUT_SOURCE, /focusNodeId\?: string \| null;/);
	assert.match(NEURAL_LAYOUT_SOURCE, /selectedNodeId: focusNodeId \?\? selectedNodeId/);
	assert.match(NEURAL_CANVAS_SOURCE, /selectedNodeIdRef\.current = selectedNodeId;/);
	assert.match(NEURAL_CANVAS_SOURCE, /if \(selectedNodeId\) \{\s+layoutFocusNodeIdRef\.current = selectedNodeId;/);
	assert.match(NEURAL_CANVAS_SOURCE, /if \(settledHidden && !selectedNodeIdRef\.current\) \{/);
	assert.doesNotMatch(NEURAL_CANVAS_SOURCE, /cameraRef\.current = createNeuralCamera\(\{ zoom: cameraRef\.current\.zoom \}\);/);
	assert.match(NEURAL_CANVAS_SOURCE, /const shouldFreezeHoveredNode = Boolean\(hoveredNodeId && hoveredNodePosition\);/);
	assert.match(NEURAL_CANVAS_SOURCE, /hoveredNodeIdRef\.current = null;/);
	assert.match(NEURAL_CANVAS_SOURCE, /setHoveredNodeId\(null\);/);
	assert.match(NEURAL_CANVAS_SOURCE, /targetLabelRevealMV\.set\(0\);/);
	assert.match(NEURAL_CANVAS_SOURCE, /targetRayElasticProgressMV\.set\(0\);/);
	assert.match(NEURAL_CANVAS_SOURCE, /resetInteractionTarget\(\);/);
	assert.match(NEURAL_LAYOUT_SOURCE, /applySelectionFocusLayout/);
	assert.match(NEURAL_LAYOUT_SOURCE, /getSelectedNeighborhood/);
	assert.match(NEURAL_RENDERER_SOURCE, /getSelectedRelationshipIds/);
	assert.match(NEURAL_RENDERER_SOURCE, /focusProgress > 0/);
	assert.match(NEURAL_RENDERER_SOURCE, /drawOrganicRayPath/);
	assert.match(NEURAL_RENDERER_SOURCE, /drawStraightEdgePath/);
	assert.match(NEURAL_INTERACTION_SOURCE, /getEdgeTerminalDirection/);
	assert.match(NEURAL_RENDERER_SOURCE, /getOrganicRayCurve/);
	assert.match(NEURAL_RENDERER_SOURCE, /bezierCurveTo/);
	assert.match(NEURAL_RENDERER_SOURCE, /lineTo/);
	assert.doesNotMatch(NEURAL_RENDERER_SOURCE, /drawOrganicEdgePath/);
	assert.match(NEURAL_CANVAS_SOURCE, /hitTestNeuralNode/);
	assert.match(NEURAL_CANVAS_SOURCE, /selectedNodeId,\s+viewport,/);
	assert.match(NEURAL_CANVAS_SOURCE, /onClearSelection\(\)/);
	assert.match(GRAPH_SOURCE, /onClearSelection=\{handleClearSelection\}/);
	assert.match(GRAPH_SOURCE, /const nextSelectedNodeId = allowEmptySelection \? null : fallbackSelectedNodeId;/);
	assert.match(SURFACE_SOURCE, /onClose=\{handleCloseInspector\}/);
	assert.match(SURFACE_SOURCE, /onSelectedNodeIdChange=\{handleSelectedNodeIdChange\}/);
});

test("Personal Graph owned renderer supports pan and zoom without Sigma events", () => {
	assert.match(NEURAL_CANVAS_SOURCE, /panNeuralCamera/);
	assert.match(NEURAL_CANVAS_SOURCE, /zoomNeuralCameraAtPoint/);
	assert.match(NEURAL_CANVAS_SOURCE, /onPointerMove/);
	assert.match(NEURAL_CANVAS_SOURCE, /addEventListener\("wheel", handleWheel, \{ passive: false \}\)/);
	assert.doesNotMatch(NEURAL_CANVAS_SOURCE, /sigma\.on/);
});
