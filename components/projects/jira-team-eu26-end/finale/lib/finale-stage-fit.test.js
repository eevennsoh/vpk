const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

let loaded;
function load() {
	loaded ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: 'export * from "./finale-stage-fit";', resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-stage-fit-harness.cjs");
	return loaded;
}

test("the card field draws at the display's ratio up to a 4K frame, then eases just enough to stay inside it", () => {
	const { FINALE_FIELD_PIXEL_BUDGET: budget, finaleFieldPixelRatio: ratio } = load();
	const pixels = (width, height, dpr) => width * height * ratio(width, height, dpr) ** 2;
	// A 16" MacBook at its default size, and a 4K stage display: untouched.
	assert.equal(ratio(1728, 1117, 2), 2);
	assert.equal(ratio(1920, 1080, 2), 2);
	assert.equal(ratio(2560, 1440, 1), 1);
	assert.equal(ratio(1440, 900, 3), 2, "never past 2×, as before");
	// Past the budget ("More Space", a 5K display) the ratio eases down to exactly fill it.
	for (const [width, height] of [[2056, 1329], [2560, 1440], [3008, 1692]]) {
		const eased = ratio(width, height, 2);
		assert.ok(eased < 2 && eased > 1.25, `${width}×${height} keeps most of its sharpness (${eased.toFixed(2)}×)`);
		assert.ok(Math.abs(pixels(width, height, 2) - budget) < 1, `${width}×${height} draws one 4K frame`);
	}
	assert.equal(ratio(0, 0, 2), 2, "a collapsed viewport cannot divide by zero");
});
