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

test("Liquid Metal is registered in the visual catalog and manifest", () => {
	const componentsSource = readProjectFile("app/data/components.ts");
	const manifestSource = readProjectFile("app/data/component-manifest.ts");

	assert.match(
		componentsSource,
		/visualComponent\("liquid-metal", "Liquid Metal", "@\/components\/visual\/liquid-metal"\)/u,
	);
	assert.match(
		manifestSource,
		/visualComponent\("liquid-metal", "Liquid Metal", "@\/components\/visual\/liquid-metal"\)/u,
	);
});

test("Liquid Metal docs register the main preview and visual example demos", () => {
	const detailsSource = readProjectFile("app/data/details/visual/liquid-metal.ts");
	const registrySource = readWebsiteRegistrySource();

	assert.match(registrySource, /"liquid-metal": dynamic\(\(\) => import\("\.\/demos\/visual\/liquid-metal-demo"\)/u);
	for (const demoSlug of [
		"liquid-metal-demo-chromatic-pill",
		"liquid-metal-demo-silver-pill",
		"liquid-metal-demo-gold-send",
		"liquid-metal-demo-chat-reflection",
	]) {
		assert.match(detailsSource, new RegExp(`demoSlug: "${demoSlug}"`, "u"));
		assert.match(registrySource, new RegExp(`"${demoSlug}"`, "u"));
	}
	assert.match(registrySource, /visual: VISUAL_VARIANT_DEMOS/u);
});
