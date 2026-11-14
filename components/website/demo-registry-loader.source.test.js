// The loader imports one category's table at a time, and it is the only map from a category to
// its tables: catalog tooling (scripts/lib/component-registry.js) reads the same map, so a demo
// cannot resolve in the catalog and render nothing on its route (or the reverse).
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { collectRegistryData } = require("../../scripts/lib/component-registry");

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");
const CATEGORIES = ["arts", "blocks", "projects", "ui", "ui-charts", "ui-custom", "utility", "visual"];

function loaderMapping() {
	const source = read("components/website/demo-registry-loader.ts");
	const demos = {};
	const variants = {};
	for (const match of source.matchAll(/["']?([\w-]+)["']?: \(\) => import\("@\/components\/website\/registry\/([^"]+)"\)\.then\(\(module\) => \(\{ demos: module\.(\w+)(?:, variants: module\.(\w+))? \}\)\)/gu)) {
		const [, category, file, demoName, variantName] = match;
		demos[category] = { file, name: demoName };
		if (variantName) variants[category] = { file, name: variantName };
	}
	return { demos, variants };
}

test("the per-category loader covers every catalog category with tables its files export", () => {
	const { demos, variants } = loaderMapping();
	assert.deepEqual(Object.keys(demos).sort(), CATEGORIES);
	for (const { file, name } of [...Object.values(demos), ...Object.values(variants)]) {
		assert.match(read(`components/website/registry/${file}.ts`), new RegExp(`export const ${name}\\b`, "u"), `${file}.ts exports ${name}`);
	}
});

test("catalog tooling reads the loader's map: the same categories with and without variants", () => {
	const { demos, variants } = loaderMapping();
	const data = collectRegistryData();
	assert.deepEqual(Object.keys(data.primary).sort(), Object.keys(demos).sort());
	assert.deepEqual(Object.keys(data.variants).sort(), Object.keys(variants).sort());
	assert.ok(Object.keys(data.primary.blocks).length > 100);
});

test("the loader imports only per-category registry files", () => {
	const source = read("components/website/demo-registry-loader.ts");
	for (const match of source.matchAll(/import\("(@\/components\/website\/registry[^"]*)"\)/gu)) {
		assert.match(match[1], /^@\/components\/website\/registry\/[\w-]+$/u, match[1]);
	}
});
