const assert = require("node:assert/strict");
const test = require("node:test");

const helpers = import("./pattern-tile-core.ts");

function decodeMaskImage(maskImage) {
	const match = maskImage.match(/^url\("data:image\/svg\+xml,(.*)"\)$/);
	assert.ok(match, "mask image should be an encoded SVG data URL");
	return decodeURIComponent(match[1]);
}

test("solid grid strokes do not emit a dash array", async () => {
	const { resolvePatternStrokeDashArray } = await helpers;

	assert.equal(resolvePatternStrokeDashArray({ style: "solid", dash: 8, gap: 4 }), undefined);
});

test("dashed grid strokes derive stroke-dasharray from dash and gap controls", async () => {
	const { resolvePatternStrokeDashArray } = await helpers;

	assert.equal(resolvePatternStrokeDashArray({ style: "dashed", dash: 8, gap: 4 }), "8 4");
});

test("custom grid stroke dash arrays override dash and gap controls", async () => {
	const { resolvePatternStrokeDashArray } = await helpers;

	assert.equal(
		resolvePatternStrokeDashArray({
			style: "dashed",
			dash: 8,
			gap: 4,
			dashArray: "12px 4px 2px 4px",
		}),
		"12px 4px 2px 4px",
	);
});

test("custom grid stroke dash arrays are escaped in the mask SVG", async () => {
	const { buildGridStrokeMaskImage } = await helpers;
	const svg = decodeMaskImage(
		buildGridStrokeMaskImage(24, {
			style: "dashed",
			dashArray: "4 & 2",
		}),
	);

	assert.match(svg, /stroke-dasharray="4 &amp; 2"/);
});

test("grid stroke mask includes dashed stroke parameters", async () => {
	const { buildGridStrokeMaskImage } = await helpers;
	const svg = decodeMaskImage(
		buildGridStrokeMaskImage(24, {
			style: "dashed",
			width: 2,
			dash: 8,
			gap: 4,
			dashOffset: 3,
			lineCap: "round",
			lineJoin: "bevel",
			miterLimit: 6,
		}),
	);

	assert.match(svg, /width="24" height="24"/);
	assert.match(svg, /preserveAspectRatio="none"/);
	assert.match(svg, /stroke-width="2"/);
	assert.match(svg, /stroke-linecap="round"/);
	assert.match(svg, /stroke-linejoin="bevel"/);
	assert.match(svg, /stroke-miterlimit="6"/);
	assert.match(svg, /stroke-dasharray="8 4"/);
	assert.match(svg, /stroke-dashoffset="3"/);
});

test("balanced grid lines sit at cell centers while existing grids retain their edge strokes", async () => {
	const { buildGridStrokeMaskImage } = await helpers;
	assert.match(decodeMaskImage(buildGridStrokeMaskImage(32, { width: 1 }, true)), /d="M 0 16 H 32 M 16 0 V 32"/);
	assert.match(decodeMaskImage(buildGridStrokeMaskImage(32, { width: 1 })), /d="M 0 0\.5 H 32 M 0\.5 0 V 32"/);
});
