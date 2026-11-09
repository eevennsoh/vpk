const assert = require("node:assert/strict");
const test = require("node:test");

const {
	getSmartWidthClass,
	inferSmartWidthClass,
	isSmartGenerationEnabled,
	mapUiMessagesToRoleContent,
	normalizeSmartGenerationOptions,
} = require("./smart-generation-options");

test("getSmartWidthClass accepts supported width classes case-insensitively", () => {
	assert.equal(getSmartWidthClass(" Compact "), "compact");
	assert.equal(getSmartWidthClass("REGULAR"), "regular");
	assert.equal(getSmartWidthClass("wide"), "wide");
	assert.equal(getSmartWidthClass("extra-wide"), null);
	assert.equal(getSmartWidthClass(null), null);
});

test("inferSmartWidthClass derives width from measured container or viewport", () => {
	assert.equal(inferSmartWidthClass({ containerWidthPx: 520, viewportWidthPx: 1200 }), "compact");
	assert.equal(inferSmartWidthClass({ containerWidthPx: 900, viewportWidthPx: 1200 }), "regular");
	assert.equal(inferSmartWidthClass({ containerWidthPx: 901, viewportWidthPx: 1200 }), "wide");
	assert.equal(inferSmartWidthClass({ viewportWidthPx: 500 }), "compact");
	assert.equal(inferSmartWidthClass({ viewportWidthPx: 901 }), "wide");
});

test("inferSmartWidthClass falls back to surface defaults", () => {
	assert.equal(inferSmartWidthClass({ surface: "sidebar" }), "compact");
	assert.equal(inferSmartWidthClass({ surface: "multiport" }), "compact");
	assert.equal(inferSmartWidthClass({ surface: "fullscreen" }), "wide");
	assert.equal(inferSmartWidthClass({ surface: "studio" }), null);
});

test("normalizeSmartGenerationOptions preserves explicit width class over inferred width", () => {
	assert.deepEqual(normalizeSmartGenerationOptions({
		enabled: true,
		surface: " rovo ",
		containerWidthPx: "480",
		viewportWidthPx: "1000",
		widthClass: "wide",
	}), {
		enabled: true,
		surface: "rovo",
		containerWidthPx: 480,
		viewportWidthPx: 1000,
		widthClass: "wide",
	});
	assert.deepEqual(normalizeSmartGenerationOptions(null), {
		enabled: false,
		surface: null,
		containerWidthPx: null,
		viewportWidthPx: null,
		widthClass: null,
	});
});

test("isSmartGenerationEnabled requires enabled state and a supported surface", () => {
	assert.equal(isSmartGenerationEnabled({ enabled: true, surface: "rovo" }), true);
	assert.equal(isSmartGenerationEnabled({ enabled: true, surface: "sidebar" }), true);
	assert.equal(isSmartGenerationEnabled({ enabled: true, surface: "unknown" }), false);
	assert.equal(isSmartGenerationEnabled({ enabled: false, surface: "rovo" }), false);
});

test("mapUiMessagesToRoleContent returns visible assistant and user text content", () => {
	assert.deepEqual(mapUiMessagesToRoleContent([
		{
			role: "system",
			parts: [{ type: "text", text: "ignore" }],
		},
		{
			role: "user",
			parts: [{ type: "text", text: " hello " }],
		},
		{
			role: "assistant",
			parts: [
				{ type: "text", text: "hi" },
				{ type: "data-widget", data: {} },
				{ type: "text", text: " there" },
			],
		},
		{
			role: "user",
			parts: [{ type: "text", text: "   " }],
		},
	]), [
		{ role: "user", content: "hello" },
		{ role: "assistant", content: "hi there" },
	]);
	assert.deepEqual(mapUiMessagesToRoleContent(null), []);
});
