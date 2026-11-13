const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("HTML Selector is registered as a website block in both catalog files", () => {
	assert.match(
		readProjectFile("app/data/components.ts"),
		/blockComponent\(\s*"html-selector",\s*"HTML Selector"\s*\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\(\s*"html-selector",\s*"HTML Selector"\s*\)/u,
	);
});

test("HTML Selector detail is imported and mapped in the blocks details barrel", () => {
	const source = readDetailCategorySource("blocks");
	assert.match(
		source,
		/import\s*\{\s*HTML_SELECTOR_DETAIL\s*\}\s*from\s*"\.\/blocks\/html-selector";/u,
	);
	assert.match(source, /"html-selector"\s*:\s*HTML_SELECTOR_DETAIL\s*,/u);
});

test("HTML Selector demo is registered as an ssr:false dynamic import", () => {
	assert.match(
		readWebsiteRegistrySource(),
		/(?:"html-selector")\s*:\s*dynamic\(\s*\(\)\s*=>\s*import\(\s*"\.\/demos\/blocks\/html-selector-demo"\s*\)\s*,\s*\{\s*ssr\s*:\s*false\s*,?\s*\}\s*\)/u,
	);
});

test("HTML Selector block files exist", () => {
	assert.ok(fs.existsSync(path.join(process.cwd(), "components/blocks/html-selector/index.ts")));
	assert.ok(fs.existsSync(path.join(process.cwd(), "components/blocks/html-selector/page.tsx")));
	assert.ok(fs.existsSync(path.join(process.cwd(), "components/website/demos/blocks/html-selector-demo.tsx")));
	assert.ok(fs.existsSync(path.join(process.cwd(), "app/data/details/blocks/html-selector.ts")));
	assert.ok(fs.existsSync(path.join(process.cwd(), "components/blocks/html-selector/components/artifact-action-bar.tsx")));
	assert.ok(fs.existsSync(path.join(process.cwd(), "components/blocks/html-selector/components/artifact-notes-popover.tsx")));
	assert.ok(fs.existsSync(path.join(process.cwd(), "components/blocks/html-selector/components/artifact-video-dialog.tsx")));
	assert.ok(fs.existsSync(path.join(process.cwd(), "components/blocks/html-selector/components/artifact-publish-dialog.tsx")));
});

test("HTML Selector uses the vanilla overlay UI instead of parent panels", () => {
	const rootSource = readProjectFile("components/blocks/html-selector/components/html-selector.tsx");
	const bridgeSource = readProjectFile("components/blocks/html-selector/lib/bridge.ts");

	assert.ok(fs.existsSync(path.join(process.cwd(), ".agents/skills/vpk-html/assets/selector/core-ui.js")));
	assert.doesNotMatch(rootSource, /SelectorToolbar|CommentListPanel|CommentPopover|StylesPanel|DispatchStatus/u);
	assert.match(bridgeSource, /HTML_SELECTOR_UI_SCRIPT_ID/u);
	assert.match(bridgeSource, /\/api\/vpk-html\/assets\/selector\/core\.css/u);
	assert.match(bridgeSource, /\/api\/vpk-html\/assets\/selector\/core-utils\.js/u);
	assert.match(
		bridgeSource,
		/HTML_SELECTOR_UTILS_SCRIPT_ID[\s\S]*HTML_SELECTOR_UI_SCRIPT_ID[\s\S]*HTML_SELECTOR_SCRIPT_ID/u,
	);
	for (const fileName of [
		"selector-toolbar.tsx",
		"comment-list-panel.tsx",
		"comment-popover.tsx",
		"styles-panel.tsx",
		"dispatch-status.tsx",
	]) {
		assert.equal(
			fs.existsSync(path.join(process.cwd(), "components/blocks/html-selector/components", fileName)),
			false,
		);
	}
});

test("HTML Selector renders the artifact action bar in the React host", () => {
	const rootSource = readProjectFile("components/blocks/html-selector/components/html-selector.tsx");
	const actionBarSource = readProjectFile("components/blocks/html-selector/components/artifact-action-bar.tsx");
	const artifactThemeHookSource = readProjectFile("components/blocks/html-selector/hooks/use-artifact-theme.ts");
	const htmlDemoSource = readProjectFile("components/website/demos/projects/html-demo.tsx");
	const notesSource = readProjectFile("components/blocks/html-selector/components/artifact-notes-popover.tsx");
	const themeWrapperSource = readProjectFile("components/utils/theme-wrapper.tsx");
	const videoSource = readProjectFile("components/blocks/html-selector/components/artifact-video-dialog.tsx");
	const publishSource = readProjectFile("components/blocks/html-selector/components/artifact-publish-dialog.tsx");
	const globalSource = readProjectFile("app/globals.css");

	assert.match(rootSource, /import \{ ArtifactActionBar \} from "\.\/artifact-action-bar";/u);
	assert.match(rootSource, /process\.env\.NODE_ENV === "production"[\s\S]*HTML Selector is a dev-only tool/u);
	assert.match(rootSource, /enabled: process\.env\.NODE_ENV === "development"/u);
	assert.doesNotMatch(htmlDemoSource, /selectorEnabled=\{false\}/u);
	assert.match(rootSource, /<div className=\{cn\("relative h-dvh min-h-\[560px\] bg-surface", className\)\}>[\s\S]*<iframe[\s\S]*<ArtifactActionBar/u);
	assert.match(actionBarSource, /top-3 right-3/u);
	assert.doesNotMatch(actionBarSource, /bg-surface-raised p-1 shadow-lg/u);
	assert.match(actionBarSource, /size="icon-compact"[\s\S]*aria-label="Print or save as PDF"/u);
	assert.match(actionBarSource, /size="icon-compact"[\s\S]*aria-label="Download current HTML"/u);
	assert.match(actionBarSource, /<TooltipProvider>[\s\S]*<ToolbarTooltip content="Print or save as PDF">/u);
	assert.match(actionBarSource, /useArtifactTheme\(\{[\s\S]*iframeRef,[\s\S]*onNotify,[\s\S]*pagePath,/u);
	// Control chrome follows the artifact's own theme, scoped — it must NOT flip the whole VPK app.
	assert.doesNotMatch(actionBarSource, /useTheme|setHostTheme|onThemeChange/u);
	assert.match(actionBarSource, /themeMode: artifactThemeMode/u);
	assert.match(actionBarSource, /data-artifact-color-mode=\{artifactThemeMode\}/u);
	assert.match(globalSource, /\[data-artifact-control-bar\]\[data-artifact-control-bar\] button\s*\{[\s\S]*color: var\(--vpk-control-text\);/u);
	assert.match(globalSource, /\[data-artifact-control-bar\]\[data-artifact-control-bar\] button svg\s*\{[\s\S]*color: currentColor;/u);
	assert.match(artifactThemeHookSource, /dataset\.theme === "dark" \? "dark" : "light"/u);
	assert.match(artifactThemeHookSource, /VPK_HTML_THEME_STORAGE_KEY = "vpk-html-theme"/u);
	assert.match(artifactThemeHookSource, /dark: "Dark mode"/u);
	assert.match(artifactThemeHookSource, /light: "Light mode"/u);
	assert.match(artifactThemeHookSource, /system: "System"/u);
	assert.match(artifactThemeHookSource, /hideFrameThemeToggle/u);
	assert.match(artifactThemeHookSource, /frameToggle\.hidden = true/u);
	assert.match(artifactThemeHookSource, /frameToggle\.style\.setProperty\("display", "none", "important"\)/u);
	assert.match(artifactThemeHookSource, /MutationObserver/u);
	assert.match(themeWrapperSource, /root\.setAttribute\("data-color-mode", newActualTheme\)/u);
	assert.match(actionBarSource, /<ToolbarTooltip content=\{artifactThemeLabel\}>/u);
	assert.doesNotMatch(actionBarSource, /aria-pressed/u);
	assert.doesNotMatch(actionBarSource, /title=\{artifactThemeLabel\}/u);
	assert.doesNotMatch(actionBarSource, /<span>Print \/ PDF<\/span>|<span>Download HTML<\/span>/u);
	assert.match(notesSource, /<TooltipContent side="bottom">\{triggerTitle\}<\/TooltipContent>/u);
	assert.doesNotMatch(notesSource, /<span>Speaker notes<\/span>/u);
	assert.match(videoSource, /<TooltipContent side="bottom">\{triggerTitle\}<\/TooltipContent>/u);
	assert.doesNotMatch(videoSource, /<span>Convert to video<\/span>/u);
	assert.match(publishSource, /<TooltipContent side="bottom">\{triggerTitle\}<\/TooltipContent>/u);
	assert.doesNotMatch(publishSource, /<span>Publish<\/span>/u);
	assert.match(actionBarSource, /getVpkHtmlArtifactApiPath\(pagePath\)/u);
	assert.match(videoSource, /\/api\/html-selector\/dispatch/u);
	assert.match(videoSource, /composeVpkHtmlVideoPrompt/u);
	assert.match(publishSource, /This uploads the HTML to a secret Gist on your GitHub account\./u);
	assert.doesNotMatch(readProjectFile(".agents/skills/vpk-html/assets/selector/core-ui.js"), /Publish to GitHub Gist|Convert to video|Speaker notes/u);
});

test("HTML Selector rail styling is isolated from vpk-html page button rules", () => {
	const cssSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core.css");
	const utilsSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core-utils.js");
	const uiSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core-ui.js");

	assert.match(cssSource, /\.vpkhs-root button\s*\{[\s\S]*appearance: none;/u);
	assert.match(cssSource, /\.vpkhs-root button:active\s*\{[\s\S]*transform: none;/u);
	assert.match(cssSource, /\.vpkhs-tool-button\s*\{[\s\S]*border: 0 !important;[\s\S]*padding: 0 !important;/u);
	assert.match(cssSource, /\.vpkhs-tool-button\s*\{[\s\S]*border-radius: 999px;/u);
	assert.match(cssSource, /\.vpkhs-tool-button svg\s*\{[\s\S]*width: 12px;[\s\S]*height: 12px;[\s\S]*fill: currentColor;/u);
	assert.doesNotMatch(cssSource, /stroke: currentColor !important/u);
	assert.match(utilsSource, /\/\/ SELECTOR_ICONS:start[\s\S]*chevronUp:[\s\S]*chevronDown:[\s\S]*fill=\\"currentColor\\"[\s\S]*\/\/ SELECTOR_ICONS:end/u);
	assert.doesNotMatch(utilsSource.match(/\/\/ SELECTOR_ICONS:start[\s\S]*\/\/ SELECTOR_ICONS:end/u)?.[0] ?? "", /stroke-width/u);
	assert.match(uiSource, /icons\.chevronUp/u);
	assert.match(uiSource, /icons\.chevronDown/u);
	assert.match(uiSource, /dataset\.vpkhsBar = "true"/u);
	assert.match(cssSource, /html\[data-vpkhs-bar="true"\]\s*\{[\s\S]*--vpk-pager-right: 68px;/u);
	assert.match(cssSource, /\.vpkhs-bar\s*\{[\s\S]*right: 24px;[\s\S]*bottom: 24px;/u);
	assert.match(cssSource, /html\[data-theme="dark"\]\s*\{[\s\S]*--vpkhs-control-text: var\(--vpk-control-text, #e9e3e2\);/u);
	assert.doesNotMatch(cssSource, /prefers-color-scheme: dark/u);
});

test("HTML Selector overlay exposes the current agent on send controls", () => {
	const uiSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core-ui.js");

	assert.match(uiSource, /agent: "codex"/u);
	assert.match(uiSource, /function getAgentLabel\(agentId\)/u);
	assert.match(
		uiSource,
		/getSendLabel\(lastBarData\.agent\) \+ " \(right-click to switch agent\)"/u,
	);
	assert.match(uiSource, /vpkhs-secondary-button vpkhs-agent-button/u);
	assert.match(uiSource, /showAgentPopover\(agentButton\.getBoundingClientRect\(\)\)/u);
	assert.match(uiSource, /send\.textContent = "Send to " \+ agentLabel/u);
});

test("HTML Selector popovers contain wheel scrolling inside overlay layers", () => {
	const cssSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core.css");
	const uiSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core-ui.js");

	assert.match(
		cssSource,
		/\.vpkhs-comment-popover,\s*\.vpkhs-style-popover\s*\{[\s\S]*max-height: min\(520px, calc\(100vh - 32px\)\);/u,
	);
	assert.match(
		cssSource,
		/\.vpkhs-style-list\s*\{[\s\S]*overflow: auto;[\s\S]*overscroll-behavior: contain;/u,
	);
	assert.match(
		cssSource,
		/\.vpkhs-comments-list\s*\{[\s\S]*overflow: auto;[\s\S]*overscroll-behavior: contain;/u,
	);
	assert.match(
		cssSource,
		/\.vpkhs-tree\s*\{[\s\S]*overflow: auto;[\s\S]*overscroll-behavior: contain;/u,
	);
	assert.match(uiSource, /function handlePopoverWheel\(event\) \{[\s\S]*event\.preventDefault\(\);/u);
	assert.match(
		uiSource,
		/document\.addEventListener\("wheel", handlePopoverWheel, \{ capture: true, passive: false \}\);/u,
	);
});

test("HTML Selector Escape handling peels back one overlay layer at a time", () => {
	const coreSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core.js");
	const uiSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core-ui.js");
	const ladder = coreSource.slice(coreSource.indexOf("function handleEscapeKey(event)"));
	const orderedLayers = [
		"layers.agentPopover",
		"layers.tree",
		"layers.stylePopover",
		"layers.commentPopover",
		"layers.contextMenu",
		"layers.commentsList",
		"state.active",
	];
	let previousIndex = -1;

	assert.match(uiSource, /function getOpenLayers\(\) \{[\s\S]*agentPopover:[\s\S]*commentPopover:[\s\S]*commentsList:[\s\S]*contextMenu:[\s\S]*stylePopover:[\s\S]*tree:/u);
	assert.match(coreSource, /function blurEditableLayerTarget\(target\) \{[\s\S]*focusLayer\(layer\);[\s\S]*return true;/u);
	for (const layer of orderedLayers) {
		const index = ladder.indexOf(layer);
		assert.notEqual(index, -1, `${layer} missing from Escape ladder`);
		assert.ok(index > previousIndex, `${layer} is out of Escape priority order`);
		previousIndex = index;
	}
	assert.match(coreSource, /openStyleForActionElement\("context"\);/u);
	assert.match(coreSource, /openCommentForActionElement\("context"\);/u);
	assert.match(coreSource, /openStyleForActionElement\(state\.mode === "context" \? "context" : "shortcut"\);/u);
	assert.match(coreSource, /if \(handleEscapeKey\(event\)\) \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*\}[\s\S]*return;/u);
});

test("HTML Selector style rows render token provenance next to origin badges", () => {
	const coreSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core.js");
	const inspectSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core-inspect.js");
	const uiSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core-ui.js");

	assert.match(inspectSource, /function setSemanticTokens\(tokens\) \{/u);
	assert.match(inspectSource, /function buildStyleProvenance\(report, declaration\) \{/u);
	assert.match(inspectSource, /label: "Custom style"/u);
	assert.match(inspectSource, /provenanceLabel: provenance\.label/u);
	assert.match(inspectSource, /provenanceTitle: provenance\.title/u);
	assert.match(uiSource, /tokenBadge\.className = "vpkhs-token-badge"/u);
	assert.match(uiSource, /tokenBadge\.title = rowData\.provenanceTitle \|\| tokenBadge\.textContent/u);
	assert.match(coreSource, /fetch\("\/api\/html-selector\/tokens", \{ cache: "no-store" \}\)/u);
	assert.match(coreSource, /inspectApi\.setSemanticTokens\(tokens\);[\s\S]*refreshStylePopover\(\);/u);
});

test("HTML Selector bridge keeps the host agent preference as the overlay default", () => {
	const coreSource = readProjectFile(".agents/skills/vpk-html/assets/selector/core.js");
	const preferenceSource = readProjectFile("components/blocks/html-selector/hooks/use-agent-preference.ts");
	const bridgeSource = readProjectFile("components/blocks/html-selector/hooks/use-selector-bridge.ts");

	assert.match(preferenceSource, /defaultAgent: AgentId = "codex"/u);
	assert.match(coreSource, /var DEFAULT_META = \{[\s\S]*agent: "codex"/u);
	assert.match(coreSource, /var state = \{[\s\S]*agent: "codex"/u);
	assert.match(coreSource, /state\.pinsMeta = Object\.assign\(\{\}, state\.pinsMeta, \{ agent: agent \}\);[\s\S]*renderAll\(\);/u);
	assert.match(
		bridgeSource,
		/bridge\.configure\(\{[\s\S]*agent: agentRef\.current,[\s\S]*\}\);/u,
	);
	assert.match(bridgeSource, /bridge\.setPins\(activePagePins, pinMeta\);/u);
});

test("HTML Selector bridge recomputes stale pins after page-specific pin sync", () => {
	const hookSource = readProjectFile("components/blocks/html-selector/hooks/use-selector-bridge.ts");

	assert.match(hookSource, /function getPinsForPage\(/u);
	assert.match(hookSource, /function getStaleSelectors\(/u);
	assert.match(
		hookSource,
		/const page = resolveIframePage\(iframe\);[\s\S]*const activePagePins = getPinsForPage\(pagePins, page\.pagePath\);[\s\S]*bridge\.setPins\(activePagePins, pinMeta\);[\s\S]*onStaleSelectorsChange\([\s\S]*page\.pagePath,[\s\S]*getStaleSelectors\(bridge, activePagePins\)/u,
	);
});
