const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { getRedirectTarget, loadPageComponent } = require("../../scripts/lib/next-page-test-harness.js");

test("WeatherPage preserves a compatibility redirect to the renamed Awake route", () => {
	const WeatherPage = loadPageComponent(path.join(__dirname, "page.tsx"));
	assert.equal(getRedirectTarget(WeatherPage), "/awake");
});
