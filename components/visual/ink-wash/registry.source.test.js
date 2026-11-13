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

test("Ink Wash is registered in the visual catalog and manifest", () => {
	const componentsSource = readProjectFile("app/data/components.ts");
	const manifestSource = readProjectFile("app/data/component-manifest.ts");

	assert.match(
		componentsSource,
		/visualComponent\("ink-wash", "Ink Wash", "@\/components\/visual\/ink-wash"\)/u,
	);
	assert.match(
		manifestSource,
		/visualComponent\("ink-wash", "Ink Wash", "@\/components\/visual\/ink-wash"\)/u,
	);
});

test("Ink Wash docs register the main preview and visual example demos", () => {
	const detailsSource = readProjectFile("app/data/details/visual/ink-wash.ts");
	const registrySource = readWebsiteRegistrySource();

	assert.match(registrySource, /"ink-wash": dynamic\(\(\) => import\("\.\/demos\/visual\/ink-wash-demo"\)/u);
	for (const demoSlug of [
		"ink-wash-demo-landscape",
		"ink-wash-demo-flow-comparison",
		"ink-wash-demo-drying-window",
		"ink-wash-demo-bleed-chroma",
		"ink-wash-demo-layered-white",
		"ink-wash-demo-gallery",
	]) {
		assert.match(detailsSource, new RegExp(`demoSlug: "${demoSlug}"`, "u"));
		assert.match(registrySource, new RegExp(`"${demoSlug}"`, "u"));
	}
	assert.match(registrySource, /visual: VISUAL_VARIANT_DEMOS/u);
});
