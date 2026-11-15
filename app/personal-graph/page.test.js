const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { getRedirectTarget, loadPageComponent } = require("../../scripts/lib/next-page-test-harness.js");

test("PersonalGraphPage redirects the legacy route to /arts/personal-graph", () => {
	const PersonalGraphPage = loadPageComponent(path.join(__dirname, "page.tsx"));
	assert.equal(getRedirectTarget(PersonalGraphPage), "/arts/personal-graph");
});
