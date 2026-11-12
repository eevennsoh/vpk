const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const TABLE_DEMO_SOURCE = readFileSync(join(__dirname, "table-demo.tsx"), "utf8");

test("default table demo centers the table-sized preview content", () => {
	assert.match(
		TABLE_DEMO_SOURCE,
		/export default function TableDemo\(\) \{[\s\S]*<div className="w-56">[\s\S]*<Table>[\s\S]*<\/Table>[\s\S]*<\/div>/u,
	);
	assert.doesNotMatch(
		TABLE_DEMO_SOURCE,
		/export default function TableDemo\(\) \{[\s\S]*<Table className="w-56">/u,
	);
});
