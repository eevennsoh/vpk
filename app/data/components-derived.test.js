const assert = require("node:assert/strict");
const test = require("node:test");

const handWritten = require("./components.ts");
const derived = require("./components-derived.ts");

const LISTS = ["UI_CHART_COMPONENTS", "CUSTOM_COMPONENTS", "UI_COMPONENTS", "BLOCK_COMPONENTS", "PROJECT_COMPONENTS", "ART_COMPONENTS", "UTILITY_COMPONENTS", "VISUAL_COMPONENTS"];

function shape(entry) {
	return { category: entry.category, importPath: entry.importPath, keys: Object.keys(entry).sort(), name: entry.name, slug: entry.slug };
}

test("the derived catalog entries equal the hand-written ones: slug, name, importPath, order and detail", () => {
	let total = 0;
	for (const list of LISTS) {
		const before = handWritten[list];
		const after = derived[list];
		assert.equal(after.length, before.length, list);
		before.forEach((entry, index) => {
			assert.deepEqual(shape(after[index]), shape(entry), `${list}[${index}]`);
			assert.equal(after[index].detail, entry.detail, `${list}[${index}] ${entry.slug} detail`);
		});
		total += before.length;
	}
	assert.equal(total, 448);
	assert.deepEqual(derived.getAllComponents().map(shape), handWritten.getAllComponents().map(shape));
	for (const entry of handWritten.getAllComponents()) {
		assert.equal(derived.findComponent(entry.category, entry.slug)?.slug, entry.slug);
		assert.equal(derived.findComponent(entry.category, entry.slug)?.detail, entry.detail);
	}
	assert.equal(derived.findComponent("ui", "no-such-entry"), undefined);
});
