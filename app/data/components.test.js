const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("./components.ts");
const manifest = require("./component-manifest.ts");
const { ART_DETAILS } = require("./details/arts.ts");
const { BLOCK_DETAILS } = require("./details/blocks.ts");
const { PROJECT_DETAILS } = require("./details/projects.ts");
const { UI_DETAILS } = require("./details/ui.ts");
const { UI_CHART_DETAILS } = require("./details/ui-charts.ts");
const { UI_CUSTOM_DETAILS } = require("./details/ui-custom.ts");
const { UTILITY_DETAILS } = require("./details/utility.ts");
const { VISUAL_DETAILS } = require("./details/visual.ts");

// Each list and the detail records it reads; ALL order is getAllComponents' order.
const LISTS = [
	["UI_CHART_COMPONENTS", UI_CHART_DETAILS],
	["CUSTOM_COMPONENTS", UI_CUSTOM_DETAILS],
	["UI_COMPONENTS", UI_DETAILS],
	["BLOCK_COMPONENTS", BLOCK_DETAILS],
	["PROJECT_COMPONENTS", PROJECT_DETAILS],
	["ART_COMPONENTS", ART_DETAILS],
	["UTILITY_COMPONENTS", UTILITY_DETAILS],
	["VISUAL_COMPONENTS", VISUAL_DETAILS],
];

test("every catalog entry is its manifest entry plus its detail record, in manifest order", () => {
	const all = [];
	for (const [list, details] of LISTS) {
		const expected = manifest[list].map(({ category, importPath, name, slug }) => ({ category, detail: details[slug], importPath, name, slug }));
		assert.deepEqual(catalog[list], expected, list);
		catalog[list].forEach((entry, index) => assert.equal(entry.detail, details[manifest[list][index].slug], `${list} ${entry.slug} detail`));
		all.push(...catalog[list]);
	}
	// 448 on 14 Nov 2026 when the hand-written copy was retired; grows with the manifest.
	assert.equal(all.length, manifest.getAllComponents().length);
	assert.deepEqual(catalog.getAllComponents(), all);
});

test("catalog entries carry no lifecycle fields; the pages never read them", () => {
	for (const entry of catalog.getAllComponents()) {
		assert.deepEqual(Object.keys(entry).sort(), ["category", "detail", "importPath", "name", "slug"]);
	}
	const frozen = manifest.getAllComponents().find((entry) => entry.status === "frozen");
	assert.ok(frozen, "the manifest has a frozen entry to check against");
	assert.equal(catalog.findComponent(frozen.category, frozen.slug).status, undefined);
});

test("findComponent finds every entry and nothing else", () => {
	for (const entry of catalog.getAllComponents()) {
		assert.equal(catalog.findComponent(entry.category, entry.slug), entry);
	}
	assert.equal(catalog.findComponent("ui", "no-such-entry"), undefined);
	assert.equal(catalog.findComponent("no-such-category", "button"), undefined);
});
