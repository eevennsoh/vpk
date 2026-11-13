const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const USE_PROJECT_DEMO_EMBEDDED_SOURCE = fs.readFileSync(
	path.join(__dirname, "use-project-demo-embedded.ts"),
	"utf8",
);

test("project demo embedded detection avoids suspending Next navigation hooks", () => {
	assert.doesNotMatch(USE_PROJECT_DEMO_EMBEDDED_SOURCE, /next\/navigation/u);
	assert.match(USE_PROJECT_DEMO_EMBEDDED_SOURCE, /window\.location\.pathname/u);
	assert.match(USE_PROJECT_DEMO_EMBEDDED_SOURCE, /window\.location\.search/u);
	assert.match(USE_PROJECT_DEMO_EMBEDDED_SOURCE, /pathname\.startsWith\("\/components\/"\)/u);
	assert.match(USE_PROJECT_DEMO_EMBEDDED_SOURCE, /searchParams\.get\("embedded"\) === "1"/u);
});
