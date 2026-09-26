const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const source = readFileSync("scripts/build-static-export.mjs", "utf8");

test("static export hides and restores runtime-only API routes", () => {
	assert.ok(source.includes('source: join(rootDir, "app", "api")'));
	assert.ok(source.includes('backup: join(rootDir, ".api-routes-backup")'));
	assert.ok(source.includes("restoreMovedPaths();"));
});
