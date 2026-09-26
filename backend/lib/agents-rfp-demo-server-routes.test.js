const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const DEMOS_ROUTE_SOURCE = fs.readFileSync(path.join(__dirname, "..", "routes", "demos.js"), "utf8");

test("RFP routes preserve persisted state, apply, event and reset contracts", () => {
	for (const [method, suffix] of [["get", "state"], ["post", "state"], ["post", "agent/apply"], ["post", "events/ticket-entered-column"], ["post", "reset"]]) {
		assert.ok(DEMOS_ROUTE_SOURCE.includes(`router.${method}("/agents/rfp-demo/${suffix}"`));
	}
	assert.match(DEMOS_ROUTE_SOURCE, /await resetAgentsRfpDemo\(\)/u);
	assert.match(DEMOS_ROUTE_SOURCE, /await handleAgentsRfpDemoTicketEvent\(/u);
	assert.match(DEMOS_ROUTE_SOURCE, /await saveAgentsRfpDemoState\(/u);
});
