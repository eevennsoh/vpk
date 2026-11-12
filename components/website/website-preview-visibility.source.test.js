const assert = require("node:assert/strict");
const path = require("node:path");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));
const test = require("node:test");
const esbuild = require("esbuild");

async function loadWebsitePreviewVisibilityHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import {
					PREVIEW_LOAD_ROOT_MARGIN_PX,
					isPreviewWithinLoadRange,
				} from "./components/website/website-preview-visibility.ts";

				export function getPreviewVisibilityCases() {
					const viewportHeight = 803;

					return {
						rootMarginPx: PREVIEW_LOAD_ROOT_MARGIN_PX,
						aboveFold: isPreviewWithinLoadRange({ top: 120, bottom: 420 }, viewportHeight),
						nearFold: isPreviewWithinLoadRange({ top: 980, bottom: 1280 }, viewportHeight),
						farBelowFold: isPreviewWithinLoadRange({ top: 1500, bottom: 1820 }, viewportHeight),
						farAboveFold: isPreviewWithinLoadRange({ top: -620, bottom: -480 }, viewportHeight),
					};
				}
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "website-preview-visibility-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("website preview visibility keeps far offscreen cards deferred", async () => {
	const harness = await loadWebsitePreviewVisibilityHarness();
	const cases = harness.getPreviewVisibilityCases();

	assert.equal(cases.rootMarginPx, 400);
	assert.equal(cases.aboveFold, true);
	assert.equal(cases.nearFold, true);
	assert.equal(cases.farBelowFold, false);
	assert.equal(cases.farAboveFold, false);
});
