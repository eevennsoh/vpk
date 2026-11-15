const test = require("node:test");
const assert = require("node:assert/strict");

const {
	inferRovoAppArtifactKindFromContent,
	inferRovoAppArtifactKindFromRequest,
} = require("./rovo-app-artifact-kind");

test("inferRovoAppArtifactKindFromRequest treats page requests as code artifacts", () => {
	assert.equal(
		inferRovoAppArtifactKindFromRequest("Create me a page about Apple"),
		"code",
	);
	assert.equal(
		inferRovoAppArtifactKindFromRequest("Build a website landing page for oranges"),
		"code",
	);
});

test("inferRovoAppArtifactKindFromRequest keeps table requests as sheets", () => {
	assert.equal(
		inferRovoAppArtifactKindFromRequest("Create a comparison table of apple varieties"),
		"sheet",
	);
});

test("inferRovoAppArtifactKindFromRequest keeps diagram requests out of artifact kinds", () => {
	assert.equal(
		inferRovoAppArtifactKindFromRequest("Draw me a system architecture diagram"),
		"text",
	);
	assert.equal(
		inferRovoAppArtifactKindFromRequest("Create an Excalidraw flowchart"),
		"text",
	);
});

test("inferRovoAppArtifactKindFromContent upgrades HTML output to code", () => {
	assert.equal(
		inferRovoAppArtifactKindFromContent("<!DOCTYPE html><html><head><title>Apple</title></head><body></body></html>", "text"),
		"code",
	);
});

test("inferRovoAppArtifactKindFromRequest treats HTML reports as html artifacts", () => {
	assert.equal(
		inferRovoAppArtifactKindFromRequest("Make an HTML report for this work item"),
		"html",
	);
});

test("inferRovoAppArtifactKindFromContent preserves HTML report artifacts", () => {
	assert.equal(
		inferRovoAppArtifactKindFromContent("<!DOCTYPE html><html><head><title>Report</title></head><body></body></html>", "html"),
		"html",
	);
});

test("inferRovoAppArtifactKindFromContent keeps markdown tables as sheets", () => {
	assert.equal(
		inferRovoAppArtifactKindFromContent("| Fruit | Color |\n| --- | --- |\n| Apple | Red |", "text"),
		"sheet",
	);
});

test("inferRovoAppArtifactKindFromContent keeps a captioned table-only sheet as a sheet", () => {
	assert.equal(
		inferRovoAppArtifactKindFromContent("## Fruit colors\n\n| Fruit | Color |\n|:---|---:|\n| Apple | Red |\n", "sheet"),
		"sheet",
	);
});

test("inferRovoAppArtifactKindFromContent keeps a document that contains a table as text", () => {
	const onePageDocument = [
		"# Q3 Launch Brief",
		"",
		"This one-page brief summarizes the launch plan and owners.",
		"",
		"## Timeline",
		"",
		"| Milestone | Date |",
		"| --- | --- |",
		"| Beta | Sep 1 |",
		"| GA | Oct 15 |",
		"",
		"## Risks",
		"",
		"- Vendor delays could push GA by two weeks.",
	].join("\n");
	assert.equal(inferRovoAppArtifactKindFromContent(onePageDocument, "text"), "text");
});

const ONE_PAGE_DOCUMENT_WITH_TABLE = [
	"# Q3 Launch Brief",
	"",
	"This one-page brief summarizes the launch plan and owners.",
	"",
	"## Timeline",
	"",
	"| Milestone | Date |",
	"| --- | --- |",
	"| Beta | Sep 1 |",
	"",
	"## Risks",
	"",
	"- Vendor delays could push GA by two weeks.",
].join("\n");

test("inferRovoAppArtifactKindFromContent corrects a document decided or saved as a sheet", () => {
	assert.equal(inferRovoAppArtifactKindFromContent(ONE_PAGE_DOCUMENT_WITH_TABLE, "sheet"), "text");
});

test("inferRovoAppArtifactKindFromContent keeps a sheet with a one-line intro as a sheet", () => {
	assert.equal(
		inferRovoAppArtifactKindFromContent("Here are the fruits:\n\n| Fruit | Color |\n| --- | --- |\n| Apple | Red |", "sheet"),
		"sheet",
	);
	assert.equal(inferRovoAppArtifactKindFromContent("- Apple\n- Pear", "sheet"), "sheet");
});

test("inferRovoAppArtifactKindFromContent accepts GFM table variants as sheets", () => {
	const variants = [
		"| a | b\n|---|---\n| 1 | 2",
		"a | b\n--- | ---\n1 | 2",
		"**Fruit**\n\n| a | b |\n|---|---|\n| 1 | 2 |",
		"```markdown\n| a | b |\n|---|---|\n| 1 | 2 |\n```",
	];
	for (const content of variants) {
		assert.equal(inferRovoAppArtifactKindFromContent(content, "text"), "sheet", content);
	}
});

test("inferRovoAppArtifactKindFromRequest keeps documents that mention a table as text", () => {
	assert.equal(
		inferRovoAppArtifactKindFromRequest(
			"Write a one-page document: Q3 launch brief with a short timeline table and a risks section",
		),
		"text",
	);
	assert.equal(inferRovoAppArtifactKindFromRequest("Put the results in a spreadsheet for the report"), "sheet");
});

test("inferRovoAppArtifactKindFromContent keeps excalidraw JSON as excalidraw", () => {
	assert.equal(
		inferRovoAppArtifactKindFromContent("{\"type\":\"excalidraw\",\"version\":2,\"elements\":[]}", "text"),
		"excalidraw",
	);
});

test("inferRovoAppArtifactKindFromRequest reads a page count as length, not a web page", () => {
	assert.equal(inferRovoAppArtifactKindFromRequest("Write a one-page memo about the offsite"), "text");
	assert.equal(inferRovoAppArtifactKindFromRequest("Build a landing page for the offsite"), "code");
});
