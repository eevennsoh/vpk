const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));
const test = require("node:test");
const esbuild = require("esbuild");

const CATEGORY_TABS_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/website/category-tabs.tsx"), "utf8");

async function loadWebsiteHeaderHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { renderToString } from "react-dom/server";
				import { ThemeWrapper } from "./components/utils/theme-wrapper.tsx";
				import { WebsiteHeader } from "./components/website/website-header.tsx";

				export function renderHeader() {
					return renderToString(
						React.createElement(
							ThemeWrapper,
							null,
							React.createElement(WebsiteHeader, {
								packageName: "@vpk",
								leftContent: React.createElement("div", null, "tabs"),
							}),
						),
					);
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "website-header-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		loader: {
			".css": "empty",
		},
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("WebsiteHeader keeps the sticky docs navigation above preview content", async () => {
	const harness = await loadWebsiteHeaderHarness();
	const markup = harness.renderHeader();

	assert.match(markup, /<header class="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-surface">/);
});

test("CategoryTabs masks tight horizontal overflow without fading the start edge", () => {
	assert.match(CATEGORY_TABS_SOURCE, /useHasHorizontalOverflow<HTMLDivElement>\(\)/);
	assert.match(CATEGORY_TABS_SOURCE, /data-slot="category-tabs-scroll-area"/);
	assert.match(
		CATEGORY_TABS_SOURCE,
		/canScrollLeft \? "transparent 0, #000 var\(--ds-space-300\)" : "#000 0"/,
	);
	assert.match(
		CATEGORY_TABS_SOURCE,
		/canScrollRight \? "#000 calc\(100% - var\(--ds-space-300\)\), transparent 100%" : "#000 100%"/,
	);
	assert.match(CATEGORY_TABS_SOURCE, /\[mask-image:var\(--category-tabs-edge-mask\)\]/);
	assert.match(CATEGORY_TABS_SOURCE, /\[-webkit-mask-image:var\(--category-tabs-edge-mask\)\]/);
	assert.match(CATEGORY_TABS_SOURCE, /maskRepeat: "no-repeat"/);
});
