import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const requireRegistrySource = createRequire(import.meta.url);
const { readWebsiteRegistrySource } = requireRegistrySource(process.cwd() + "/components/website/registry/test-source.cjs");
const ROOT = process.cwd();

function readProjectFile(filePath) {
	return readFileSync(path.join(ROOT, filePath), "utf8");
}

test("Border Beam is registered in the visual catalog and manifest", () => {
	const componentsSource = readProjectFile("app/data/components.ts");
	const manifestSource = readProjectFile("app/data/component-manifest.ts");

	assert.match(
		componentsSource,
		/visualComponent\("border-beam", "Border Beam", "@\/components\/visual\/border-beam"\)/u,
	);
	assert.match(
		manifestSource,
		/visualComponent\("border-beam", "Border Beam", "@\/components\/visual\/border-beam"\)/u,
	);
});

test("Border Beam docs register the main preview and visual example demos", () => {
	const detailsSource = readProjectFile("app/data/details/visual/border-beam.ts");
	const registrySource = readWebsiteRegistrySource();

	assert.match(registrySource, /"border-beam": dynamic\(\(\) => import\("\.\/demos\/visual\/border-beam-demo"\)/u);
	for (const demoSlug of [
		"border-beam-demo-rotate-large",
		"border-beam-demo-rotate-small",
		"border-beam-demo-line-search",
		"border-beam-demo-pulse-inner-working",
		"border-beam-demo-pulse-pill",
		"border-beam-demo-pulse-outside",
		"border-beam-demo-mono-pulse-search",
		"border-beam-demo-compact-gallery",
	]) {
		assert.match(detailsSource, new RegExp(`demoSlug: "${demoSlug}"`, "u"));
		assert.match(registrySource, new RegExp(`"${demoSlug}"`, "u"));
	}

	assert.match(detailsSource, /adapted from Jakubantalik\/border-beam/u);
	assert.match(registrySource, /visual: VISUAL_VARIANT_DEMOS/u);
});
