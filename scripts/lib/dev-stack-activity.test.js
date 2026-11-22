const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { EXIT_STOP_REFUSED, assessActivity, decideStop, gitIndexPath, main, worktreeOf } = require("./dev-stack-activity.js");

// A fake worktree: a directory with a linked-worktree `.git` file, its git dir, and a dev log.
function fakeWorktree(t, name = "wt-feature") {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dev-stack-activity-")));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const worktree = path.join(root, name);
	const gitDir = path.join(root, "main.git", "worktrees", name);
	fs.mkdirSync(gitDir, { recursive: true });
	fs.mkdirSync(path.join(worktree, "output", "logs", name), { recursive: true });
	fs.writeFileSync(path.join(worktree, ".git"), `gitdir: ${gitDir}\n`);
	const logFile = path.join(worktree, "output", "logs", name, "dev.log");
	const indexFile = path.join(gitDir, "index");
	const touch = (file, ageMs, now) => {
		fs.writeFileSync(file, "x");
		const at = new Date(now - ageMs);
		fs.utimesSync(file, at, at);
	};
	return { root, worktree, logFile, indexFile, touch };
}

const NOW = Date.parse("2026-11-16T10:00:00Z");
const HOUR = 3600_000;

test("the git index of a linked worktree is found through its .git file", (t) => {
	const { worktree, indexFile } = fakeWorktree(t);
	assert.equal(gitIndexPath(worktree), indexFile);
});

test("a stack is in use when an activity source was written inside the idle window", (t) => {
	const { worktree, logFile, indexFile, touch } = fakeWorktree(t);
	touch(logFile, 5 * HOUR, NOW);
	touch(indexFile, 10 * 60_000, NOW);
	const busy = assessActivity({ worktreePath: worktree, now: NOW, operators: [] });
	assert.equal(busy.inUse, true);
	assert.match(busy.evidence, /recent activity: git index written 10m ago \(idle after 30m\)/u);

	touch(indexFile, 2 * HOUR, NOW);
	const idle = assessActivity({ worktreePath: worktree, now: NOW, operators: [] });
	assert.equal(idle.inUse, false);
	assert.equal(idle.newest.source, "git index");
});

test("an agent process with its cwd in the worktree marks it in use, whatever the file ages", (t) => {
	const { worktree } = fakeWorktree(t);
	const result = assessActivity({ worktreePath: worktree, now: NOW, operators: [{ name: "claude", pid: 4242, cwd: path.join(worktree, "components") }, { name: "codex", pid: 1, cwd: `${worktree}-sibling` }] });
	assert.deepEqual([result.inUse, result.evidence], [true, "claude pid 4242 has its cwd here"]);
});

test("the deepest worktree root owns a path, so the main checkout does not own a nested worktree", () => {
	const roots = ["/repo", "/repo/.claude/worktrees/feature"];
	assert.equal(worktreeOf("/repo/.claude/worktrees/feature/app", roots), "/repo/.claude/worktrees/feature");
	assert.equal(worktreeOf("/repo/app", roots), "/repo");
	assert.equal(worktreeOf("/elsewhere", roots), null);
});

test("a stop is refused only when another worktree or automation asks while the stack is in use", (t) => {
	const { root, worktree, logFile, touch } = fakeWorktree(t);
	touch(logFile, 60_000, NOW);
	const other = path.join(root, "wt-other");
	fs.mkdirSync(other);
	const roots = [root, worktree, other];
	const decide = (env, extra = {}) => decideStop({ worktreePath: worktree, env, now: NOW, roots, operators: [], ...extra });

	assert.equal(decide({}).allowed, true, "a direct stop in the worktree");
	assert.equal(decide({ VPK_DEV_STOP_BY: "pnpm ports kill", VPK_DEV_STOP_FROM: path.join(worktree, "app") }).allowed, true, "requested from inside it");
	const refused = decide({ VPK_DEV_STOP_BY: "pnpm ports kill", VPK_DEV_STOP_FROM: other });
	assert.equal(refused.allowed, false);
	assert.match(refused.evidence, /dev log written 60s ago/u);
	assert.equal(decide({ VPK_DEV_STOP_BY: "vpk-system-clean idle sweep" }).allowed, false, "automation with no worktree of its own");
	assert.equal(decide({ VPK_DEV_STOP_BY: "pnpm ports kill", VPK_DEV_STOP_FROM: root }).allowed, false, "the main checkout asking about a nested worktree");
	assert.deepEqual(
		[decide({ VPK_DEV_STOP_BY: "pnpm ports kill", VPK_DEV_STOP_FROM: other }, { force: true }).allowed, decide({ VPK_DEV_STOP_BY: "x", VPK_DEV_STOP_FROM: other }, { force: true }).forced],
		[true, true],
	);

	touch(logFile, 2 * HOUR, NOW);
	assert.equal(decide({ VPK_DEV_STOP_BY: "pnpm ports kill", VPK_DEV_STOP_FROM: other }).allowed, true, "an idle stack may be stopped");
});

test("stop-guard logs who asked for every stop, refused or not", (t) => {
	const { worktree, logFile, touch } = fakeWorktree(t);
	touch(logFile, 60_000, Date.now());
	const logDir = path.dirname(logFile);
	const io = () => {
		const out = { stdout: "", stderr: "" };
		return { out, stdout: { write: (text) => (out.stdout += text) }, stderr: { write: (text) => (out.stderr += text) } };
	};
	const sweep = { VPK_DEV_STOP_BY: "vpk-system-clean idle sweep" };

	const refused = io();
	assert.equal(main(["stop-guard", "--worktree", worktree, "--session", "vpk-dev-feature", "--log-dir", logDir], { env: sweep, ...refused }), EXIT_STOP_REFUSED);
	assert.match(refused.out.stderr, /Not stopping .*: vpk-system-clean idle sweep asked, and this stack is in use \(recent activity: dev log/u);

	const forced = io();
	assert.equal(main(["stop-guard", "--worktree", worktree, "--log-dir", logDir, "--force"], { env: sweep, ...forced }), 0);
	assert.match(forced.out.stdout, /Stop requested by vpk-system-clean idle sweep \(forced; in use: recent activity/u);

	const direct = io();
	assert.equal(main(["stop-guard", "--worktree", worktree, "--log-dir", logDir], { env: {}, ...direct }), 0);

	const entries = fs.readFileSync(path.join(logDir, "dev-stops.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
	assert.deepEqual(entries.map((entry) => [entry.outcome, entry.by]), [
		["refused", "vpk-system-clean idle sweep"],
		["stopping (forced)", "vpk-system-clean idle sweep"],
		["stopping", "this worktree (direct stop)"],
	]);
	assert.equal(entries[0].session, "vpk-dev-feature");
	assert.equal(Array.isArray(entries[0].ancestry) && entries[0].ancestry.length > 0, true, "the caller's process ancestry is recorded");
});

test("check prints the verdict for the sweep to parse", (t) => {
	const { worktree, logFile, touch } = fakeWorktree(t);
	touch(logFile, 3 * HOUR, Date.now());
	let stdout = "";
	assert.equal(main(["check", "--worktree", worktree, "--idle-secs", "1800"], { env: {}, stdout: { write: (text) => (stdout += text) }, stderr: { write: () => {} } }), 0);
	assert.match(stdout, /^(idle\|dev log written 180m ago|in-use\|.+ has its cwd here)\n$/u);
	assert.equal(main(["check"], { env: {}, stdout: { write: () => {} }, stderr: { write: () => {} } }), 2);
});
