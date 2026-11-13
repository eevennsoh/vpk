import assert from "node:assert/strict";
import test from "node:test";

import {
	buildLiquidGlassChannelScales,
	buildLiquidGlassDisplacementImageHref,
	getLiquidGlassDisplacementMetrics,
} from "./liquid-glass-utils.ts";

test("displacement metrics use rendered pixel dimensions (Framer approach)", () => {
	const metrics = getLiquidGlassDisplacementMetrics(200, 400, 50, 0.05, 8);

	// Inner SVG is rendered at the same dimensions as the glass element so that
	// `borderRadius`, `edgeSize`, and the inner-rect `blur` all map 1:1 to raw px.
	assert.deepEqual(
		metrics,
		{
			innerW: 200,
			innerH: 400,
			scaledRadius: 50,
			edgeSize: 5,
			scaledBlur: 8,
		},
	);
});

test("dispersion adds a uniform boost to every channel scale (Framer behavior)", () => {
	// Framer's Dispersion is an additive boost to displacement scale that applies
	// equally to all three channels — it does NOT split per channel. (Per-channel
	// chromatic offsets are exposed separately via the `offsets` argument.)
	assert.deepEqual(
		buildLiquidGlassChannelScales(-90, 6),
		{
			red: -84,
			green: -84,
			blue: -84,
		},
	);
});

test("channel offsets match ReactBits GlassSurface scale math when dispersion is zero", () => {
	assert.deepEqual(
		buildLiquidGlassChannelScales(-180, 0, { red: 50, green: -1, blue: -19 }),
		{
			red: -130,
			green: -181,
			blue: -199,
		},
	);
});

test("per-channel chromatic offsets shift each channel scale independently", () => {
	assert.deepEqual(
		buildLiquidGlassChannelScales(-90, 6, { red: -10, green: 0, blue: 10 }),
		{
			red: -94,
			green: -84,
			blue: -74,
		},
	);

	// Missing offsets default to 0.
	assert.deepEqual(
		buildLiquidGlassChannelScales(0, 0, { red: 5 }),
		{
			red: 5,
			green: 0,
			blue: 0,
		},
	);
});

test("embedded displacement SVG uses css filter:blur only when blur is non-zero", () => {
	const hrefWithBlur = buildLiquidGlassDisplacementImageHref({
		width: 200,
		height: 400,
		borderRadius: 50,
		borderWidth: 0.05,
		brightness: 50,
		blur: 8,
		opacity: 0.93,
		redGradId: "red",
		blueGradId: "blue",
	});
	const svgWithBlur = decodeURIComponent(hrefWithBlur.slice("data:image/svg+xml,".length));
	// Inner-rect blur is now applied as a raw CSS filter so the visual radius is
	// in raw px, matching the Framer reference.
	assert.match(svgWithBlur, /filter:blur\(8px\)/);
	assert.equal(svgWithBlur.includes("feGaussianBlur"), false);

	const hrefWithoutBlur = buildLiquidGlassDisplacementImageHref({
		width: 200,
		height: 400,
		borderRadius: 50,
		borderWidth: 0.05,
		brightness: 50,
		blur: 0,
		opacity: 0.93,
		redGradId: "red",
		blueGradId: "blue",
	});
	const svgWithoutBlur = decodeURIComponent(hrefWithoutBlur.slice("data:image/svg+xml,".length));
	assert.equal(svgWithoutBlur.includes("filter:blur"), false);
	assert.equal(svgWithoutBlur.includes("feGaussianBlur"), false);
});
