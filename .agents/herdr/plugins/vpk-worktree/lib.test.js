// Run: OPENSSL_CONF=/dev/null node --test .agents/herdr/plugins/vpk-worktree/lib.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
	parseWorktreeCreatedEvent,
	parseActionContext,
	isSameRepo,
	selectEnvFiles,
	parseWorktreeList,
	pickSourceCheckout,
	buildInstallCommand,
} = require("./lib.js");

// Captured from herdr 0.9.5 `herdr worktree create`.
const EVENT_JSON = JSON.stringify({
	event: "worktree_created",
	data: {
		type: "worktree_created",
		workspace: {
			workspace_id: "w8",
			label: "herdr-probe-wt-a",
			worktree: {
				repo_key: "/private/tmp/herdr-probe-repo/.git",
				repo_name: "herdr-probe-repo",
				repo_root: "/tmp/herdr-probe-repo",
				checkout_path: "/tmp/herdr-probe-wt-a",
				is_linked_worktree: true,
			},
		},
		worktree: { path: "/tmp/herdr-probe-wt-a", branch: "probe-a", open_workspace_id: "w8", is_linked_worktree: true },
	},
});

test("parses the worktree.created payload", () => {
	assert.deepEqual(parseWorktreeCreatedEvent(EVENT_JSON), {
		checkoutPath: "/tmp/herdr-probe-wt-a",
		workspaceId: "w8",
		repoRoot: "/tmp/herdr-probe-repo",
		branch: "probe-a",
	});
});

test("falls back to workspace provenance and open_workspace_id", () => {
	const raw = JSON.stringify({
		data: { workspace: { worktree: { checkout_path: "/x/wt" } }, worktree: { open_workspace_id: "w3" } },
	});
	assert.deepEqual(parseWorktreeCreatedEvent(raw), { checkoutPath: "/x/wt", workspaceId: "w3", repoRoot: null, branch: null });
});

test("rejects malformed or empty payloads", () => {
	for (const raw of [undefined, "", "not json", "null", "[]", JSON.stringify({ data: {} }), JSON.stringify({ data: { worktree: { path: "" } } })]) {
		assert.equal(parseWorktreeCreatedEvent(raw), null, String(raw));
	}
});

test("parses action context, preferring worktree provenance over cwd", () => {
	const raw = JSON.stringify({
		workspace_id: "w2",
		workspace_cwd: "/private/x/wt/sub",
		worktree: { repo_root: "/x/main", checkout_path: "/x/wt" },
	});
	assert.deepEqual(parseActionContext(raw), { checkoutPath: "/x/wt", workspaceId: "w2", repoRoot: "/x/main", branch: null });
	assert.equal(parseActionContext(JSON.stringify({ workspace_cwd: "/y" })).checkoutPath, "/y");
	assert.equal(parseActionContext(JSON.stringify({ focused_pane_cwd: "/z" })).checkoutPath, "/z");
	assert.equal(parseActionContext("{}"), null);
	assert.equal(parseActionContext(undefined), null);
});

test("repo match requires both common dirs and equality", () => {
	assert.equal(isSameRepo("/r/vpk/.git", "/r/vpk/.git"), true);
	assert.equal(isSameRepo("/r/vpk/.git", "/r/vpk/.git/"), true);
	assert.equal(isSameRepo("/r/vpk/.git", "/r/other/.git"), false);
	assert.equal(isSameRepo(null, "/r/vpk/.git"), false);
	assert.equal(isSameRepo("/r/vpk/.git", null), false);
});

test("selects ignored env files, skipping examples, provider worktrees, dirs, and existing targets", () => {
	const ignored = [
		".env",
		".env.local",
		".env.local.example",
		".envrc",
		"nested/.env.development",
		".claude/worktrees/stale/.env.local",
		".codex/worktrees/x/.env",
		"node_modules/",
		".next/",
		"tsconfig.tsbuildinfo",
		"",
	];
	assert.deepEqual(selectEnvFiles(ignored), [".env", ".env.local", "nested/.env.development"]);
	assert.deepEqual(selectEnvFiles(ignored, (rel) => rel === ".env.local"), [".env", "nested/.env.development"]);
});

test("parses worktree list and picks a source other than the target", () => {
	const porcelain = "worktree /r/vpk\nHEAD abc\nbranch refs/heads/main\n\nworktree /r/wt-a\nHEAD def\nbranch refs/heads/a\n";
	const paths = parseWorktreeList(porcelain);
	assert.deepEqual(paths, ["/r/vpk", "/r/wt-a"]);
	assert.equal(pickSourceCheckout({ targetPath: "/r/wt-a", repoRoot: null, worktreePaths: paths }), "/r/vpk");
	assert.equal(pickSourceCheckout({ targetPath: "/r/wt-a", repoRoot: "/r/vpk", worktreePaths: paths }), "/r/vpk");
	assert.equal(pickSourceCheckout({ targetPath: "/r/vpk", repoRoot: "/r/vpk", worktreePaths: ["/r/vpk"] }), null);
	assert.deepEqual(parseWorktreeList(""), []);
});

test("install command runs the offline install and reports status", () => {
	const command = buildInstallCommand();
	assert.ok(command.includes("CI=true pnpm install --prefer-offline"));
	assert.ok(command.includes("warmup done"));
	assert.ok(command.includes("warmup FAILED"));
});
