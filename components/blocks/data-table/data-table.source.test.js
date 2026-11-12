const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const DATA_TABLE_SOURCE = readFileSync(
	join(__dirname, "components", "data-table.tsx"),
	"utf8",
);
const DATA_TABLE_DEMO_SOURCE = readFileSync(
	join(__dirname, "..", "..", "website", "demos", "blocks", "data-table-demo.tsx"),
	"utf8",
);

test("data table demo preview is padded and centered", () => {
	assert.match(
		DATA_TABLE_DEMO_SOURCE,
		/className="flex h-full w-full items-center justify-center overflow-auto p-6"/u,
	);
	assert.match(DATA_TABLE_DEMO_SOURCE, /className="w-full max-w-\[1280px\]"/u);
});

test("data table section type column uses VPK Tag", () => {
	assert.match(
		DATA_TABLE_SOURCE,
		/import \{ Tag \} from "@\/components\/ui\/tag"/u,
	);
	assert.match(
		DATA_TABLE_SOURCE,
		/accessorKey: "type"[\s\S]*<Tag color="gray" maxWidth="100%">[\s\S]*\{row\.original\.type\}[\s\S]*<\/Tag>/u,
	);
	assert.doesNotMatch(
		DATA_TABLE_SOURCE,
		/accessorKey: "type"[\s\S]*<Badge variant="outline" className="text-muted-foreground px-1\.5">/u,
	);
});

test("data table pagination row aligns with the table content edge", () => {
	assert.match(
		DATA_TABLE_SOURCE,
		/<div className="flex items-center justify-between">[\s\S]*\{table\.getFilteredSelectedRowModel\(\)\.rows\.length\} of/u,
	);
	assert.doesNotMatch(
		DATA_TABLE_SOURCE,
		/<div className="flex items-center justify-between px-4">[\s\S]*\{table\.getFilteredSelectedRowModel\(\)\.rows\.length\} of/u,
	);
});

test("data table status column uses VPK Lozenge", () => {
	assert.match(
		DATA_TABLE_SOURCE,
		/import \{ Lozenge \} from "@\/components\/ui\/lozenge"/u,
	);
	assert.match(
		DATA_TABLE_SOURCE,
		/import \{ getWorkflowLozengeVariant \} from "@\/lib\/workflow-status"/u,
	);
	assert.match(
		DATA_TABLE_SOURCE,
		/<Lozenge variant=\{getWorkflowLozengeVariant\(row\.original\.status\)\}>[\s\S]*\{row\.original\.status\}[\s\S]*<\/Lozenge>/u,
	);
	assert.doesNotMatch(DATA_TABLE_SOURCE, /CircleCheckIcon/u);
	assert.doesNotMatch(DATA_TABLE_SOURCE, /fill-green-500/u);
});
