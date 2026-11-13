const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const PLAN_SOURCE = fs.readFileSync(path.join(__dirname, "plan.tsx"), "utf8");

test("Plan collapsed state removes the hidden content panel gap", () => {
	assert.match(PLAN_SOURCE, /"data-closed:gap-0"/u);
	assert.match(PLAN_SOURCE, /"data-closed:h-0 data-closed:overflow-hidden data-closed:py-0"/u);
	assert.match(PLAN_SOURCE, /className=\{cn\("data-closed:h-0 data-closed:overflow-hidden data-closed:py-0", className\)\}/u);
});
