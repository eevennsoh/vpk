// Fixture helpers shared by the control-vpk test suites (control-vpk*.test.js).

const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
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

// A fake agent-browser for capture runs: records forwarded calls and answers with canned JSON.
const ACTIVE_SESSION = JSON.stringify({
	data: { active: true, runtime: { browserLaunched: true, pageCount: 1 } },
	success: true,
});

function fakeCaptureBrowser({ overrides = {} } = {}) {
	const calls = [];
	const runCommand = (args) => {
		const forwarded = args.slice(2);
		if (forwarded.join(" ") === "session info --json") return { status: 0, stderr: "", stdout: ACTIVE_SESSION };
		calls.push(forwarded);
		const override = overrides[forwarded[0]];
		if (override) return override(forwarded);
		if (forwarded[0] === "screenshot") writeFileSync(forwarded[1], "png");
		const stdout = {
			a11y: JSON.stringify({ data: { counts: { violations: 2, incomplete: 1 }, violations: [] }, success: true }),
			console: JSON.stringify({
				data: { messages: [{ type: "log", text: "ready" }, { type: "error", text: "Hydration failed" }] },
				success: true,
			}),
			errors: JSON.stringify({ data: { errors: [] }, success: true }),
			eval: "\"light\"",
			get: "https://fixture.localhost/jira-team-eu26\n",
			snapshot: "- heading \"Jira Design\" [level=1]\n",
		}[forwarded[0]] ?? "";
		return { status: 0, stderr: "", stdout };
	};
	return { calls, runCommand };
}

module.exports = { TARGET_REPO_MAP, fakeCaptureBrowser, withTempDir };
