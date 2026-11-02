const assert = require("node:assert/strict");
const test = require("node:test");

const { isVersionId, versionId, versionsIn } = require("./studio-versions.ts");

test("a version is named by when it was saved, safe as a file name, and read back newest first", () => {
	const id = versionId(new Date("2026-10-06T14:32:10.512Z"));
	assert.equal(id, "2026-10-06T14-32-10-512Z");
	assert.equal(isVersionId(id), true);
	assert.deepEqual(versionsIn(["2026-10-06T09-00-00-000Z.json", `${id}.json`, "notes.md", "../escape.json", "2026-10-06T09-00-00-000Z.txt"]), [
		{ id, savedAt: "2026-10-06T14:32:10.512Z" },
		{ id: "2026-10-06T09-00-00-000Z", savedAt: "2026-10-06T09:00:00.000Z" },
	]);
});

test("only a version's own name is ever read from disk", () => {
	for (const id of ["../finale-studio", "2026-10-06T14-32-10-512Z/../x", "", "latest"]) assert.equal(isVersionId(id), false);
});
