const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

const SLASH_RENDERER_SOURCE = readProjectFile("components/ui-custom/rich-text-editor/suggestion-menu-slash-renderer.tsx");
const MENTION_RENDERER_SOURCE = readProjectFile("components/ui-custom/rich-text-editor/suggestion-menu-mention-renderer.tsx");
const VIEW_SOURCE = readProjectFile("components/ui-custom/rich-text-editor/suggestion-menu-view.tsx");
const ROWS_SOURCE = readProjectFile("components/ui-custom/rich-text-editor/suggestion-menu-rows.ts");
const OVERFLOW_SOURCE = readProjectFile("components/ui-custom/rich-text-editor/suggestion-menu-overflow.tsx");

test("suggestion rows default to compact and can show bylines", async () => {
	const view = await renderComponent({
		source: `import React, { useState } from "react";
			import { RichTextSuggestionMenu } from "@/components/ui-custom/rich-text-editor/suggestion-menu";
			export default function Menu() {
				const [withByline, setWithByline] = useState(false);
				const [choice, setChoice] = useState("");
				return <><button onClick={() => setWithByline(true)}>Show bylines</button><output>{choice}</output><RichTextSuggestionMenu emptyLabel="Empty" items={[{ id: "one", label: "First", description: "Helpful description", icon: null }]} onSelect={(item) => setChoice(item.label)} rowVariant={withByline ? "with-byline" : undefined} selectedIndex={0} title="Choices" /></>;
			}`,
	});
	assert.equal(view.getByRole("option", { name: "First" }).textContent, "First");
	await view.click(view.getByRole("option", { name: "First" }));
	assert.equal(document.querySelector("output")?.textContent, "First");
	await view.click(view.getByRole("button", { name: "Show bylines" }));
	assert.equal(view.getByRole("option", { name: /First/ }).textContent.includes("Helpful description"), true);
	await view.unmount();
});

let rankingModulePromise;
function loadRankingModule() {
	if (!rankingModulePromise) {
		rankingModulePromise = esbuild
			.build({
				entryPoints: [path.join(process.cwd(), "components/ui-custom/rich-text-editor/suggestion-ranking.ts")],
				bundle: true,
				format: "cjs",
				platform: "node",
				tsconfig: path.join(process.cwd(), "tsconfig.json"),
				write: false,
			})
			.then((result) => loadCjsModuleFromText(
				result.outputFiles[0].text,
				"rich-text-suggestion-ranking-harness.cjs",
			));
	}
	return rankingModulePromise;
}

function getSourceBetween(source, startMarker, endMarker) {
	const start = source.indexOf(startMarker);
	const end = source.indexOf(endMarker, start);
	assert.ok(start > -1, `expected to find start marker: ${startMarker}`);
	assert.ok(end > start, `expected to find end marker after: ${endMarker}`);
	return source.slice(start, end);
}

function assertPopupHidesBeforeRenderingEmptyState(source) {
	const displayAssignment = 'popupState.element.style.display = shouldHidePopup ? "none" : "";';
	const displayAssignmentIndex = source.indexOf(displayAssignment);
	const hideCheckIndex = source.indexOf("if (shouldHidePopup)");
	const updatePropsIndex = source.indexOf("popupState.component?.updateProps");

	assert.ok(displayAssignmentIndex > -1, "expected the popup display assignment");
	assert.ok(hideCheckIndex > -1, "expected an early shouldHidePopup guard");
	assert.ok(
		displayAssignmentIndex < hideCheckIndex,
		"expected the popup display assignment before the early hide guard",
	);
	assert.ok(updatePropsIndex > hideCheckIndex, "expected popup rendering after the hide guard");
	assert.match(
		source.slice(hideCheckIndex, updatePropsIndex),
		/if \(shouldHidePopup\) \{\s*return;\s*\}/u,
	);
}

test("slash suggestion filters hide the popup when no rows and no Ask Rovo header remain", () => {
	const slashUpdate = getSourceBetween(
		SLASH_RENDERER_SOURCE,
		"function update(props: SuggestionProps<RichTextSlashAction, RichTextSlashAction>)",
		"\t/** Clamp/snap the selection onto a selectable row (skips headings). */",
	);

	assert.match(
		slashUpdate,
		/const shouldShowAskRovoHeader = showAskRovoPrompt && \(isFlat \|\| !activeCategory\);/u,
	);
	assert.match(
		slashUpdate,
		/const shouldHidePopup = items\.length === 0 && !shouldShowAskRovoHeader;/u,
	);
	assertPopupHidesBeforeRenderingEmptyState(slashUpdate);
});

test("mention suggestion filters hide the popup instead of rendering a no-results box", () => {
	const mentionUpdate = getSourceBetween(
		MENTION_RENDERER_SOURCE,
		"function update(props: SuggestionProps<RichTextMentionItem, RichTextMentionItem>)",
		"\t/** Resolve a mention by id across both \"@\" parent categories. */",
	);

	assert.match(mentionUpdate, /const shouldHidePopup = items\.length === 0;/u);
	assertPopupHidesBeforeRenderingEmptyState(mentionUpdate);
});

test("mention suggestions prefer a label match over an earlier description-only match", async () => {
	const ranking = await loadRankingModule();
	const items = [
		{ label: "People and team", heading: true },
		{ label: "Engineering", description: "Maintains the core application codebase." },
		{ label: "Agents", heading: true },
		{ label: "Code Planner", description: "Designs the checkout architecture." },
	];

	assert.equal(
		ranking.getPreferredSuggestionIndex(items, "code", (item) => !item.heading),
		3,
	);
	assert.deepEqual(
		ranking.rankSuggestionsByMatch(items.filter((item) => !item.heading), "code")
			.map((item) => item.label),
		["Code Planner", "Engineering"],
	);
	assert.match(
		MENTION_RENDERER_SOURCE,
		/buildFlatSurfaceRows\(getFlatSections\(\), props\.query, expandedSections, true\)/u,
	);
});

test("generic suggestion rows use neutral gray IconTiles", () => {
	assert.match(
		VIEW_SOURCE,
		/function getSuggestionMenuIconTileVariant[\s\S]*return isOverflowFooterLabel\(item\.label\) \? "transparent" : "gray"/u,
	);
	assert.match(
		VIEW_SOURCE,
		/function RichTextSuggestionMenuItemVisual[\s\S]*<IconTile[\s\S]*variant=\{tileVariant\}/u,
	);
	assert.doesNotMatch(
		VIEW_SOURCE,
		/function RichTextSuggestionMenuItemVisual[\s\S]*<IconTile[\s\S]*variant="blue"/u,
	);
	assert.match(
		ROWS_SOURCE,
		/getSuggestionOverflowFooterItem\(\s*getFlatFooterId\(section\.key\),\s*section\.hasDirectory \? "browse-all" : \(expanded \? "view-less" : "view-more"\)/u,
	);
	assert.match(OVERFLOW_SOURCE, /iconTileVariant: "transparent"/u);
});
