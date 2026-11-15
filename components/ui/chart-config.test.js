const assert = require("node:assert/strict");
const test = require("node:test");

const {
	getChartColorConfigEntries,
	hasRenderableChartSize,
} = require("./chart-config.ts");

test("getChartColorConfigEntries ignores nullish configs", () => {
	assert.deepEqual(getChartColorConfigEntries(null), []);
	assert.deepEqual(getChartColorConfigEntries(undefined), []);
});

test("getChartColorConfigEntries keeps only color-capable entries", () => {
	const result = getChartColorConfigEntries({
		broken: null,
		line: {
			label: "Line",
			color: "#1868db",
		},
		bar: {
			theme: {
				light: "#0055cc",
				dark: "#85b8ff",
			},
		},
		empty: {
			label: "Empty",
		},
	});

	assert.equal(result.length, 2);
	assert.equal(result[0][0], "line");
	assert.equal(result[0][1].color, "#1868db");
	assert.deepEqual(result[1][1].theme, {
		light: "#0055cc",
		dark: "#85b8ff",
	});
});

test("hasRenderableChartSize requires positive finite width and height", () => {
	// Zero size is the exact case that makes Recharts log the
	// "width(0) and height(0)" warning (e.g. a chart inside a hidden tab).
	assert.equal(hasRenderableChartSize(0, 0), false);
	assert.equal(hasRenderableChartSize(0, 320), false);
	assert.equal(hasRenderableChartSize(640, 0), false);
	assert.equal(hasRenderableChartSize(640, 320), true);
});

test("hasRenderableChartSize rejects negative, NaN, and nullish dimensions", () => {
	assert.equal(hasRenderableChartSize(-1, 320), false);
	assert.equal(hasRenderableChartSize(640, -1), false);
	assert.equal(hasRenderableChartSize(Number.NaN, 320), false);
	assert.equal(hasRenderableChartSize(640, Number.POSITIVE_INFINITY), false);
	assert.equal(hasRenderableChartSize(null, 320), false);
	assert.equal(hasRenderableChartSize(640, undefined), false);
});

test("getChartAccessibleLabel prefers an explicit label", () => {
	const { getChartAccessibleLabel } = require("./chart-config.ts");
	assert.equal(getChartAccessibleLabel({ desktop: { label: "Desktop" } }, "Visitors by month"), "Visitors by month");
});

test("getChartAccessibleLabel names the chart from its string series labels", () => {
	const { getChartAccessibleLabel } = require("./chart-config.ts");
	assert.equal(
		getChartAccessibleLabel({ visitors: { label: "Visitors" }, desktop: { label: "Desktop", color: "red" }, other: { color: "blue" } }),
		"Chart: Visitors and Desktop",
	);
	assert.equal(getChartAccessibleLabel({ other: { color: "blue" } }), "Chart");
	assert.equal(getChartAccessibleLabel(null), "Chart");
});
