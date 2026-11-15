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

// A repo map with one app page and one component entry, for object-route validation.
const TARGET_REPO_MAP = {
	appPages: { pages: [{ routePath: "/jira-team-eu26" }] },
	components: {
		categories: [{
			category: "visual",
			entries: [{ category: "visual", slug: "peel" }],
		}],
	},
};

module.exports = { TARGET_REPO_MAP, withTempDir };
