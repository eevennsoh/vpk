// Fixture helpers shared by the control-vpk test suites (control-vpk*.test.js).

const { mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function withTempDir(prefix, run) {
	const root = mkdtempSync(path.join(os.tmpdir(), prefix));
	try {
		return run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

module.exports = { withTempDir };
