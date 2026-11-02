const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

test("Responses tool guard preserves current schemas across forked history", () => {
	const result = spawnSync("python3", [path.join(__dirname, "test_vpk_remote_tools.py")], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
	assert.equal(result.status, 0, result.stderr);
});
