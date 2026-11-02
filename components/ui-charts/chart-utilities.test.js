const assert = require("node:assert/strict");
const test = require("node:test");
const { withBollingerBands } = require("./bollinger.ts");
const { computeWeekendRanges, toValidDate } = require("./date-ranges.ts");
const { computeLinearRegression, computeTrendSegment } = require("./trend-line-utils.ts");
const { buildProjectionPath } = require("./projection-utils.ts");
const { computeReferenceAreaRect } = require("./reference-area-geometry.ts");
const { barDepthAndRise, barDepthMaxDepth } = require("./bar-depth-geometry.ts");
const { beginBrushDrag, createBrushState, dragBrush, endBrush, resizeBrushByKeyboard } = require("./chart-brush-state.ts");

test("Bollinger bands preserve rows, warm up with gaps and use population variance", () => {
	const rows = [2, 4, 4, 4, 5, 5, 7, 9].map((value, index) => ({ value, index }));
	const result = withBollingerBands(rows, { dataKey: "value", period: 8 });
	assert.equal(result[0].valueUpper, null);
	assert.deepEqual(result.at(-1), { value: 9, index: 7, valueUpper: 9, valueLower: 1, valueSma: 5 });
	assert.equal("valueUpper" in rows[0], false);
	assert.equal(withBollingerBands(rows, { dataKey: "value", period: 8, minPeriods: 1 })[0].valueSma, 2);
});

test("weekend spans clip to the visible UTC range and reject invalid dates", () => {
	const result = computeWeekendRanges(new Date("2026-10-03T12:00:00Z"), new Date("2026-10-06T00:00:00Z"), { utc: true });
	assert.deepEqual(result.map(({ start, end }) => [start.toISOString(), end.toISOString()]), [["2026-10-03T12:00:00.000Z", "2026-10-05T00:00:00.000Z"]]);
	assert.equal(toValidDate("not a date"), null);
});

test("trend regression skips missing samples and spans finite observations", () => {
	const points = [{ x: 0, y: 1 }, { x: 1, y: NaN }, { x: 2, y: 5 }];
	assert.deepEqual(computeLinearRegression(points), { slope: 2, intercept: 1 });
	assert.deepEqual(computeTrendSegment(points), { x1: 0, y1: 1, x2: 2, y2: 5 });
	assert.equal(computeLinearRegression([{ x: 1, y: 2 }]), null);
});

test("projection preserves its source anchor and reaches the target on the source cadence", () => {
	const data = [10, 20, 30].map((value, index) => ({ date: new Date(Date.UTC(2026, 9, index + 1)), value }));
	const result = buildProjectionPath({ sourceData: data, seriesKey: "value", mode: "target", horizonPoints: 3, endValue: 60 });
	assert.equal(result[0].date.getTime(), data[2].date.getTime());
	assert.equal(result[0].value, 30);
	assert.equal(result.at(-1).value, 60);
	assert.equal(result.at(-1).date.toISOString(), "2026-10-06T00:00:00.000Z");
});

test("automatic projections retain short-cadence trends at modern epoch timestamps", () => {
	for (const interval of [1_000, 60_000]) {
		const data = [100, 101, 102].map((value, index) => ({ date: new Date(Date.UTC(2026, 0, 1) + index * interval), value }));
		const result = buildProjectionPath({ sourceData: data, seriesKey: "value", mode: "auto", autoMethod: "linearRegression", horizonPoints: 2 });
		assert.equal(result.at(-1).value, 104);
	}
});

test("reference ranges clip overflowing geometry without changing data coordinates", () => {
	const options = { innerWidth: 100, innerHeight: 100, y1: -20, y2: 60, xScale: (date) => date.getTime(), yScale: (value) => 100 - value };
	assert.deepEqual(computeReferenceAreaRect(options), { x: 0, y: 40, width: 100, height: 60 });
	assert.equal(computeReferenceAreaRect({ ...options, ifOverflow: "discard" }), null);
});

test("bar depth stays inside the gap and short bars retain a bounded lid", () => {
	assert.equal(barDepthMaxDepth(20, 20), 0);
	assert.equal(barDepthMaxDepth(40, 20), 4.4);
	assert.deepEqual(barDepthAndRise(1, 2, 7), { depth: 2, perspectiveRise: 0.9 });
});

test("brush keyboard handles resize independently, stay ordered and support native range keys", () => {
	const stage = { width: 100, height: 40, direction: "horizontal" };
	const initial = createBrushState(stage, { start: { x: 20, y: 0 }, end: { x: 80, y: 40 } });
	const moved = resizeBrushByKeyboard(initial, "left", "ArrowRight", stage);
	assert.equal(moved.extent.x0, 21);
	assert.equal(moved.extent.x1, 80);
	assert.equal(resizeBrushByKeyboard(initial, "right", "PageDown", stage).extent.x1, 70);
	assert.equal(resizeBrushByKeyboard(initial, "left", "End", stage).extent.x0, 79);
	assert.equal(resizeBrushByKeyboard(initial, "right", "Home", stage).extent.x1, 21);
	assert.equal(resizeBrushByKeyboard(initial, "left", "Escape", stage), null);
});

test("pointer selection movement commits a bounded range after resizing", () => {
	const stage = { width: 100, height: 40, direction: "horizontal" };
	const initial = createBrushState(stage, { start: { x: 20, y: 0 }, end: { x: 80, y: 40 } });
	const dragged = dragBrush(beginBrushDrag(initial, "move"), { x: 50, y: 0 }, stage, "window");
	const committed = endBrush(dragged, "window");
	assert.equal(committed.state.extent.x1, 100);
	assert.equal(committed.state.extent.x0, 40);
	assert.equal(committed.state.isBrushing, false);
});
