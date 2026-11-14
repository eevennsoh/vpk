const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const { getCssDurationTokenMs, parseCssDurationMs } = loadRovoCoreModule("lib/css-duration.ts");

function withRootTokenValue(value, callback) {
	const previous = { document: globalThis.document, window: globalThis.window };
	globalThis.document = { documentElement: {} };
	globalThis.window = { getComputedStyle: () => ({ getPropertyValue: () => value }) };
	try {
		return callback();
	} finally {
		globalThis.document = previous.document;
		globalThis.window = previous.window;
	}
}

test("parseCssDurationMs reads milliseconds, seconds and bare numbers", () => {
	assert.equal(parseCssDurationMs("200ms"), 200);
	assert.equal(parseCssDurationMs(" 350ms "), 350);
	assert.equal(parseCssDurationMs("0.35s"), 350);
	assert.equal(parseCssDurationMs("1.5s"), 1500);
	assert.equal(parseCssDurationMs("120"), 120);
});

test("parseCssDurationMs rejects empty and non-numeric values", () => {
	assert.equal(parseCssDurationMs(""), null);
	assert.equal(parseCssDurationMs("   "), null);
	assert.equal(parseCssDurationMs("fast"), null);
	assert.equal(parseCssDurationMs("ms"), null);
});

test("getCssDurationTokenMs converts a seconds token instead of reading its number as milliseconds", () => {
	// A plain parseFloat (the old surface-shell copy) read "0.35s" as 0.35 ms.
	assert.equal(withRootTokenValue(" 0.35s", () => getCssDurationTokenMs("--duration-medium", 200)), 350);
	assert.equal(withRootTokenValue("450ms", () => getCssDurationTokenMs("--duration-medium", 200)), 450);
});

test("getCssDurationTokenMs falls back when the token is missing or unreadable", () => {
	assert.equal(withRootTokenValue("", () => getCssDurationTokenMs("--duration-medium", 200)), 200);
	assert.equal(withRootTokenValue("auto", () => getCssDurationTokenMs("--duration-medium", 200)), 200);
	assert.equal(getCssDurationTokenMs("--duration-medium", 180), 180, "no window: server render uses the fallback");
});
