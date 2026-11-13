"use strict";

// clean-candidates against real git: a throwaway main checkout with a bare "origin" and
// worktrees. Each test builds a branch that is landed (merged into main and pushed), then
// adds one way removing it would lose work, and asserts the report retains it. PR records
// are passed in as data (no gh).

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { collectCleanCandidates, formatCleanCandidates } = require("./clean-candidates");
const { collectShipStatus, formatShipStatus } = require("./ship-status");
const { REFLOG_LIMIT, createRunner } = require("./lib/branch-facts");
const { fetchPullRequests } = require("./vpk-remote-status");

function setup(t) {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "clean-candidates-")));
	t.after(() => {
		execFileSync("chmod", ["-R", "u+rwx", root]);
		fs.rmSync(root, { recursive: true, force: true });
	});
	const env = {
		PATH: process.env.PATH,
		HOME: root,
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_AUTHOR_NAME: "Test",
		GIT_AUTHOR_EMAIL: "test@example.com",
		GIT_COMMITTER_NAME: "Test",
		GIT_COMMITTER_EMAIL: "test@example.com",
	};
	const origin = path.join(root, "origin.git");
	const repo = path.join(root, "repo");
	const sh = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
	const write = (cwd, file, text) => {
		fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
		fs.writeFileSync(path.join(cwd, file), text);
	};
	const commit = (cwd, file, text, message = `${file}: ${text}`) => {
		write(cwd, file, text);
		sh(cwd, "add", file);
		sh(cwd, "commit", "--quiet", "-m", message);
		return sh(cwd, "rev-parse", "HEAD");
	};
	sh(root, "init", "--quiet", "--bare", "--initial-branch=main", origin);
	sh(root, "clone", "--quiet", origin, repo);
	commit(repo, ".gitignore", "node_modules/\nartifacts/\n.env*\n.next/\n");
	commit(repo, "README", "  base line\n");
	sh(repo, "push", "--quiet", "origin", "main");
	sh(repo, "remote", "set-head", "origin", "main");

	// A branch with one commit, merged into main with a merge commit and pushed: landed by
	// ancestry, synced, remote branch equal to the local one.
	const landed = (name, { worktree = true } = {}) => {
		const dir = path.join(root, `wt-${name}`);
		sh(repo, "worktree", "add", "--quiet", "-b", name, dir, "origin/main");
		commit(dir, `${name}.txt`, name);
		sh(dir, "push", "--quiet", "-u", "origin", name);
		sh(repo, "merge", "--quiet", "--no-ff", "-m", `merge ${name}`, name);
		sh(repo, "push", "--quiet", "origin", "main");
		sh(repo, "fetch", "--quiet", "origin");
		if (!worktree) sh(repo, "worktree", "remove", dir);
		return dir;
	};
	const runCommand = createRunner({ timeoutMs: 20_000, env });
	const report = (prs = new Map(), options = {}) => collectCleanCandidates({ cwd: repo, runCommand, readPrs: async () => prs, ...options });
	const entry = (result, predicate) => [...result.candidates, ...result.retained].find(predicate);
	return { root, origin, repo, env, sh, write, commit, landed, report, entry, runCommand };
}

const byWorktree = (dir) => (candidate) => candidate.worktree === dir;

test("baseline: a landed, clean worktree and its branch are cleanable", async (t) => {
	const { landed, report, entry } = setup(t);
	const dir = landed("feat");
	const result = await report(new Map(), { fetch: true });
	const found = entry(result, byWorktree(dir));
	assert.deepEqual([found.status, found.cleanable, found.blockers], ["main-synced", true, []]);
	assert.equal(found.evidence.remoteSafeToDelete, true);
});

test("1: ignored content under artifacts/ (or anything not regenerable) retains the worktree; node_modules and .env* do not", async (t) => {
	const { landed, report, entry, write } = setup(t);
	const dir = landed("feat");
	write(dir, "node_modules/pkg/index.js", "x");
	write(dir, ".env.local", "FIXTURE=1\n");
	write(dir, "artifacts/plans/report.html", "<p>durable</p>");
	let found = entry(await report(), byWorktree(dir));
	assert.equal(found.cleanable, false);
	assert.deepEqual(found.blockers, ["ignored content that is not regenerable: artifacts/"]);

	fs.rmSync(path.join(dir, "artifacts"), { recursive: true });
	found = entry(await report(), byWorktree(dir));
	assert.equal(found.cleanable, true, found.blockers.join("; "));
	assert.deepEqual(found.evidence.ignoredEnvFiles, [".env.local"]);
});

test("2: an edit hidden by skip-worktree or assume-unchanged retains the worktree", async (t) => {
	const { landed, report, entry, sh, write } = setup(t);
	const dir = landed("feat");
	sh(dir, "update-index", "--skip-worktree", "README");
	write(dir, "README", "  local edit\n");
	assert.equal(sh(dir, "status", "--porcelain"), "", "status does not show it");
	const found = entry(await report(), byWorktree(dir));
	assert.equal(found.cleanable, false);
	assert.equal(found.status, "dirty");

	sh(dir, "update-index", "--no-skip-worktree", "README");
	sh(dir, "checkout", "--", "README");
	sh(dir, "update-index", "--assume-unchanged", "feat.txt");
	assert.equal(entry(await report(), byWorktree(dir)).status, "dirty");
});

test("3: commits only a reflog reaches retain the worktree or branch", async (t) => {
	const { landed, report, entry, sh, commit } = setup(t);
	// A detached worktree that committed, then moved back to main.
	const detached = landed("feat");
	sh(detached, "checkout", "--quiet", "--detach", "origin/main");
	commit(detached, "scratch.txt", "only in the reflog");
	sh(detached, "checkout", "--quiet", "--detach", "origin/main");
	let found = entry(await report(), byWorktree(detached));
	assert.equal(found.cleanable, false);
	assert.ok(found.blockers.includes("1 commit(s) only the worktree's HEAD reflog or its own refs reach"), found.blockers.join("; "));

	// A branch reset after committing.
	const reset = landed("reset-me");
	commit(reset, "lost.txt", "work");
	sh(reset, "reset", "--quiet", "--hard", "HEAD~1");
	found = entry(await report(), byWorktree(reset));
	assert.equal(found.cleanable, false);
	assert.ok(found.blockers.includes("1 commit(s) only the branch reflog reaches"), found.blockers.join("; "));
});

test("4: a whitespace-only difference is not landed (content proof, not patch-ids)", async (t) => {
	const { repo, report, entry, sh, commit, root } = setup(t);
	const dir = path.join(root, "wt-indent");
	sh(repo, "worktree", "add", "--quiet", "-b", "indent", dir, "origin/main");
	commit(dir, "README", "\tbase line\n", "re-indent");
	sh(dir, "push", "--quiet", "-u", "origin", "indent");
	commit(repo, "README", "  base line  \n", "trailing whitespace");
	sh(repo, "push", "--quiet", "origin", "main");
	sh(repo, "fetch", "--quiet", "origin");
	assert.match(sh(dir, "cherry", "origin/main", "indent"), /^- /u, "git cherry calls it landed");

	const found = entry(await report(), byWorktree(dir));
	assert.equal(found.evidence.landed, false);
	assert.equal(found.cleanable, false);
});

test("5: commits someone pushed to origin/<branch> retain it and make the remote unsafe to delete", async (t) => {
	const { landed, report, entry, sh, commit, root, env } = setup(t);
	const dir = landed("feat");
	const other = path.join(root, "other-clone");
	execFileSync("git", ["clone", "--quiet", "--branch", "feat", path.join(root, "origin.git"), other], { env });
	commit(other, "theirs.txt", "pushed by someone else");
	sh(other, "push", "--quiet", "origin", "feat");
	sh(dir, "fetch", "--quiet", "origin");

	const found = entry(await report(new Map(), { fetch: true }), byWorktree(dir));
	assert.equal(found.cleanable, false);
	assert.ok(found.blockers.includes("origin/feat has 1 commit(s) this branch lacks"), found.blockers.join("; "));
	assert.equal(found.evidence.remoteSafeToDelete, false);
});

test("6 and 14: PRs are read newest first with their total; more than returned is unknown, forks do not count", async () => {
	let query = "";
	const node = (number, overrides = {}) => ({ number, state: "MERGED", createdAt: `2026-11-${String(number).padStart(2, "0")}T00:00:00Z`, headRefOid: "a".repeat(40), baseRefName: "main", isCrossRepository: false, ...overrides });
	const runCommand = async (_command, args) => {
		query = args.find((arg) => arg.startsWith("query="));
		return {
			ok: true,
			code: 0,
			stderr: "",
			stdout: JSON.stringify({ data: { repository: {
				b0: { totalCount: 12, nodes: Array.from({ length: 10 }, (_, index) => node(12 - index)) },
				b1: { totalCount: 2, nodes: [node(30, { state: "OPEN", isCrossRepository: true }), node(29)] },
			} } }),
		};
	};
	const prs = await fetchPullRequests(runCommand, "/repo", ["busy", "forked"]);
	assert.match(query, /orderBy:\{field:CREATED_AT,direction:DESC\}/u);
	assert.match(query, /totalCount/u);
	assert.equal(prs.get("busy").truncated, true);
	assert.equal(prs.get("forked").truncated, false);
	assert.deepEqual(prs.get("forked").map(({ number }) => number), [29], "the fork's open PR #30 is not this branch's");
});

test("6: a branch whose PR list is incomplete is retained", async (t) => {
	const { landed, report, entry } = setup(t);
	const dir = landed("feat");
	const prs = Object.defineProperty([], "truncated", { value: true });
	const found = entry(await report(new Map([["feat", prs]])), byWorktree(dir));
	assert.equal(found.cleanable, false);
	assert.ok(found.blockers.includes("pull requests could not be read in full"));
});

test("7: the report never writes another worktree's index (--no-optional-locks)", async (t) => {
	const { landed, report, sh } = setup(t);
	const dir = landed("feat");
	const index = path.join(sh(dir, "rev-parse", "--absolute-git-dir"), "index");
	// A tracked file whose stat changed but content did not: plain `git status` rewrites the index.
	const when = new Date(Date.now() + 60_000);
	fs.utimesSync(path.join(dir, "feat.txt"), when, when);
	const before = fs.statSync(index).mtimeMs;
	await report();
	assert.equal(fs.statSync(index).mtimeMs, before);
});

test("8: a git status that warns on stderr is unknown, not clean", { skip: process.getuid?.() === 0 ? "root reads every directory" : false }, async (t) => {
	const { landed, report, entry, write } = setup(t);
	const dir = landed("feat");
	write(dir, "locked-dir/file.txt", "x");
	fs.chmodSync(path.join(dir, "locked-dir"), 0o000);
	const found = entry(await report(), byWorktree(dir));
	assert.equal(found.cleanable, false);
	assert.equal(found.status, "unknown");
});

test("9: a worktree mid-rebase, and the branch it is rebasing, are retained", async (t) => {
	const { repo, landed, report, entry, sh, commit } = setup(t);
	const dir = landed("feat");
	// A second landed branch, rebased in feat's worktree onto a commit (from before it
	// landed) that conflicts with it.
	const beforeTopic = sh(repo, "rev-parse", "origin/main");
	landed("topic", { worktree: false });
	sh(dir, "checkout", "--quiet", "--detach", beforeTopic);
	commit(dir, "topic.txt", "conflicting", "conflict base");
	const conflictBase = sh(dir, "rev-parse", "HEAD");
	try {
		sh(dir, "rebase", "--quiet", conflictBase, "topic");
	} catch {
		// Stops on the conflict, as intended.
	}
	assert.ok(fs.existsSync(path.join(sh(dir, "rev-parse", "--absolute-git-dir"), "rebase-merge")));
	const result = await report();
	const topic = entry(result, (candidate) => candidate.branch === "topic");
	assert.equal(topic.cleanable, false);
	assert.ok(topic.blockers.includes(`being rebased in ${dir}`), topic.blockers.join("; "));
	const worktree = entry(result, byWorktree(dir));
	assert.equal(worktree.cleanable, false);
	assert.ok(worktree.blockers.includes("a rebase is in progress"), worktree.blockers.join("; "));
});

test("10: a branch checked out in two worktrees lists and retains both", async (t) => {
	const { repo, landed, report, sh, root } = setup(t);
	const first = landed("feat");
	const second = path.join(root, "wt-feat-again");
	sh(repo, "worktree", "add", "--quiet", "--force", second, "feat");
	const result = await report();
	const both = [...result.candidates, ...result.retained].filter((candidate) => candidate.branch === "feat");
	assert.deepEqual(both.map((candidate) => candidate.worktree).sort(), [first, second].sort());
	assert.equal(both.every((candidate) => !candidate.cleanable && candidate.blockers.includes("branch is checked out in 2 worktrees")), true);
});

test("11: a locked worktree whose directory is gone, or whose .git file is gone, retains its branch with the right label", async (t) => {
	const { repo, landed, report, entry, sh } = setup(t);
	const gone = landed("gone");
	sh(repo, "worktree", "lock", gone);
	fs.rmSync(gone, { recursive: true, force: true });
	const broken = landed("broken");
	fs.rmSync(path.join(broken, ".git"));

	const result = await report();
	const goneEntry = entry(result, (candidate) => candidate.branch === "gone");
	assert.equal(goneEntry.cleanable, false);
	assert.ok(goneEntry.blockers.includes("worktree is locked"));
	assert.ok(goneEntry.blockers.includes(`registered worktree ${gone} is missing (locked)`), goneEntry.blockers.join("; "));
	const brokenEntry = entry(result, (candidate) => candidate.branch === "broken");
	assert.equal(brokenEntry.cleanable, false);
	assert.match(brokenEntry.blockers.join("; "), new RegExp(`worktree ${broken} exists but git no longer recognises it`, "u"));
});

test("12: a branch named like a tag is read by its full ref", async (t) => {
	const { repo, landed, report, sh } = setup(t);
	landed("v1", { worktree: false });
	sh(repo, "tag", "v1", "origin/main~1");
	const result = await report();
	const branch = [...result.candidates, ...result.retained].find((candidate) => candidate.branch === "v1");
	assert.ok(branch, "listed as v1, not heads/v1");
	assert.equal(branch.status, "main-synced");
});

test("13: ship-status reads a failed branch lookup as unknown, never as deleted", async (t) => {
	const { repo, landed, runCommand, sh } = setup(t);
	landed("feat", { worktree: false });
	const merged = { number: 7, state: "MERGED", headRefOid: sh(repo, "rev-parse", "feat"), baseRefName: "main", createdAt: "2026-11-13T00:00:00Z", mergedAt: "2026-11-13T01:00:00Z", isCrossRepository: false, mergeCommit: { oid: sh(repo, "rev-parse", "main") } };
	const flaky = async (command, args, options) => {
		if (command === "gh") return { ok: true, code: 0, stderr: "", stdout: JSON.stringify({ data: { repository: { b0: { totalCount: 1, nodes: [merged] } } } }) };
		if (args.includes("show-ref") && args.includes("refs/heads/feat")) return { ok: false, code: null, stderr: "timed out", stdout: "" };
		return runCommand(command, args, options);
	};
	const status = await collectShipStatus({ cwd: repo, branch: "feat", runCommand: flaky, gateReader: async () => null });
	assert.equal(status.status, "unknown");
});

// Second adversarial review of #2154 (items A to F, and the suspected gaps).

const failing = (runCommand, matches) => async (command, args, options) => (matches(command, args)
	? { ok: false, code: null, stderr: "timed out", stdout: "" }
	: runCommand(command, args, options));

test("A: remoteSafeToDelete is true only after a fetch in this run, and the skill's lease refuses a newer push", async (t) => {
	const { repo, landed, report, entry, sh, commit, root, env } = setup(t);
	const dir = landed("feat");
	let found = entry(await report(), byWorktree(dir));
	assert.equal(found.cleanable, true, found.blockers.join("; "));
	assert.equal(found.evidence.remoteSafeToDelete, null, "never true without --fetch");
	assert.match(found.evidence.remoteUnknown, /run with --fetch/u);

	const fetched = await report(new Map(), { fetch: true });
	assert.equal(fetched.fetch, "ok");
	found = entry(fetched, byWorktree(dir));
	const seenTip = sh(repo, "rev-parse", "origin/feat");
	assert.deepEqual([found.evidence.remoteSafeToDelete, found.evidence.remoteTip], [true, seenTip]);
	assert.match(formatCleanCandidates(fetched), new RegExp(`origin/feat: safe to delete at ${seenTip}`, "u"));

	// Someone pushes to origin/feat, then origin becomes unreachable: the local origin/feat
	// is stale and still equals the branch.
	const other = path.join(root, "other-clone");
	execFileSync("git", ["clone", "--quiet", "--branch", "feat", path.join(root, "origin.git"), other], { env });
	commit(other, "theirs.txt", "pushed after the report");
	sh(other, "push", "--quiet", "origin", "feat");
	const originUrl = sh(repo, "remote", "get-url", "origin");
	sh(repo, "remote", "set-url", "origin", path.join(root, "unreachable.git"));
	const failed = await report(new Map(), { fetch: true });
	assert.equal(failed.fetch, "failed");
	found = entry(failed, byWorktree(dir));
	assert.equal(found.evidence.remoteSafeToDelete, null);
	assert.match(found.evidence.remoteUnknown, /fetch .*failed/u);
	assert.match(formatCleanCandidates(failed), /fetch failed: origin\/\* refs are from an earlier fetch; no remote branch is safe to delete/u);

	// The skill's delete leases the tip the report saw, so it refuses the newer push.
	sh(repo, "remote", "set-url", "origin", originUrl);
	assert.throws(() => sh(repo, "push", `--force-with-lease=refs/heads/feat:${seenTip}`, "origin", ":refs/heads/feat"), /stale info/u);
	assert.match(sh(repo, "ls-remote", "--heads", "origin", "feat"), /refs\/heads\/feat$/u);
});

test("B: ship-status reads a failed worktree list as unknown, and says it does not decide cleanup", async (t) => {
	const { repo, landed, runCommand, write } = setup(t);
	const dir = landed("feat");
	write(dir, "uncommitted.txt", "work in progress");
	const flaky = failing(runCommand, (command, args) => command === "git" && args.includes("worktree") && args.includes("list"));
	const prsAndGit = async (command, args, options) => (command === "gh"
		? { ok: true, code: 0, stderr: "", stdout: JSON.stringify({ data: { repository: { b0: { totalCount: 0, nodes: [] } } } }) }
		: flaky(command, args, options));
	const status = await collectShipStatus({ cwd: repo, branch: "feat", runCommand: prsAndGit, gateReader: async () => null });
	assert.equal(status.status, "unknown", status.nextAction);
	assert.match(status.cleanup, /^not decided here: pnpm run clean-candidates/u);
	assert.match(formatShipStatus(status), /cleanup: not decided here/u);

	const readable = await collectShipStatus({ cwd: repo, branch: "feat", runCommand: async (command, args, options) => (command === "gh" ? prsAndGit(command, args, options) : runCommand(command, args, options)), gateReader: async () => null });
	assert.equal(readable.status, "dirty");
});

test("C: a HEAD reflog longer than the scan limit is unknown, not 'none found'", async (t) => {
	const { landed, report, entry, sh, commit } = setup(t);
	const dir = landed("feat");
	sh(dir, "checkout", "--quiet", "--detach", "origin/main");
	commit(dir, "scratch.txt", "only in the reflog");
	sh(dir, "checkout", "--quiet", "--detach", "origin/main");
	// REFLOG_LIMIT + 1 later HEAD moves, written as git writes them.
	const tip = sh(dir, "rev-parse", "HEAD");
	const log = path.join(sh(dir, "rev-parse", "--absolute-git-dir"), "logs", "HEAD");
	fs.appendFileSync(log, `${tip} ${tip} Test <test@example.com> 1763000000 +0000\tcheckout: moving from ${tip} to ${tip}\n`.repeat(REFLOG_LIMIT + 1));
	const found = entry(await report(), byWorktree(dir));
	assert.equal(found.cleanable, false);
	assert.ok(found.blockers.includes(`the worktree's HEAD reflog or its own refs has more than ${REFLOG_LIMIT} entries, so it was not scanned in full`), found.blockers.join("; "));
});

test("D: no merge driver, attribute or merge.default setting makes an unmerged branch content-landed", async (t) => {
	const { repo, root, report, entry, sh, commit, write } = setup(t);
	commit(repo, "conf.txt", "base\n");
	sh(repo, "push", "--quiet", "origin", "main");
	sh(repo, "fetch", "--quiet", "origin");
	const dir = path.join(root, "wt-conf");
	sh(repo, "worktree", "add", "--quiet", "-b", "conf", dir, "origin/main");
	commit(dir, "conf.txt", "the branch's change\n");
	sh(dir, "push", "--quiet", "-u", "origin", "conf");
	commit(repo, "conf.txt", "main's change\n");
	sh(repo, "push", "--quiet", "origin", "main");
	sh(repo, "fetch", "--quiet", "origin");
	const conf = async () => entry(await report(), (candidate) => candidate.branch === "conf").evidence;

	assert.deepEqual([(await conf()).landed, (await conf()).proof], [false, null], "plain merge conflicts");
	sh(repo, "config", "merge.ours.driver", "true");
	write(repo, ".gitattributes", "conf.txt merge=ours\n");
	assert.deepEqual([(await conf()).landed, (await conf()).proof], [false, null], "this checkout's .gitattributes");
	fs.rmSync(path.join(repo, ".gitattributes"));
	write(root, "global-attributes", "conf.txt merge=ours\n");
	sh(repo, "config", "--global", "core.attributesFile", path.join(root, "global-attributes"));
	assert.equal((await conf()).landed, false, "core.attributesFile");
	sh(repo, "config", "--global", "--unset", "core.attributesFile");
	sh(repo, "config", "merge.default", "ours");
	assert.equal((await conf()).landed, false, "merge.default");
	sh(repo, "config", "--unset", "merge.default");
	commit(repo, ".gitattributes", "conf.txt merge=ours\n");
	sh(repo, "push", "--quiet", "origin", "main");
	sh(repo, "fetch", "--quiet", "origin");
	assert.equal((await conf()).landed, false, ".gitattributes committed on main");
	// info/attributes cannot be switched off for one command, so the proof is unknown.
	write(sh(repo, "rev-parse", "--absolute-git-dir"), "info/attributes", "conf.txt merge=ours\n");
	const evidence = await conf();
	assert.equal(evidence.landed, null);
	assert.ok(evidence.missing.includes("content"));
});

test("E: only regular env files the bootstrap seeds are exempt; .env* directories and links block", async (t) => {
	const { landed, report, entry, write } = setup(t);
	const dir = landed("feat");
	write(dir, ".env.local", "FIXTURE=1\n");
	write(dir, ".envs/prod/keys.txt", "x");
	write(dir, ".environment-notes/plan.md", "x");
	write(dir, ".env.d/extra", "x");
	fs.symlinkSync(path.join(dir, ".env.local"), path.join(dir, ".env.linked"));
	let found = entry(await report(), byWorktree(dir));
	assert.equal(found.cleanable, false);
	assert.deepEqual(found.blockers, ["ignored content that is not regenerable: .env.d/, .env.linked, .environment-notes/, .envs/"]);
	assert.deepEqual(found.evidence.ignoredEnvFiles, [".env.local"]);

	for (const name of [".envs", ".environment-notes", ".env.d", ".env.linked"]) fs.rmSync(path.join(dir, name), { recursive: true });
	const result = await report();
	found = entry(result, byWorktree(dir));
	assert.equal(found.cleanable, true, found.blockers.join("; "));
	assert.match(formatCleanCandidates(result), /env files removal deletes \(show the owner; not opened\): \.env\.local/u);
});

test("F: a failed read of the current worktree aborts the report", async (t) => {
	const { landed, runCommand } = setup(t);
	const dir = landed("feat");
	const flaky = failing(runCommand, (command, args) => command === "git" && args.includes("--show-toplevel"));
	await assert.rejects(collectCleanCandidates({ cwd: dir, runCommand: flaky, readPrs: async () => new Map() }), /could not tell which worktree this is/u);
});

test("suspected 1: a stale origin/<other> does not keep a reflog-only commit; a live one does, after a fetch", async (t) => {
	const { origin, landed, report, entry, sh, commit } = setup(t);
	const dir = landed("feat");
	sh(dir, "checkout", "--quiet", "--detach", "origin/main");
	commit(dir, "scratch.txt", "pushed as another branch");
	sh(dir, "push", "--quiet", "origin", "HEAD:refs/heads/other");
	sh(dir, "fetch", "--quiet", "origin");
	sh(dir, "checkout", "--quiet", "--detach", "origin/main");
	const reached = "1 commit(s) only the worktree's HEAD reflog or its own refs reach";

	assert.equal(entry(await report(new Map(), { fetch: true }), byWorktree(dir)).cleanable, true, "origin/other is live");
	assert.ok(entry(await report(), byWorktree(dir)).blockers.includes(reached), "without --fetch remote refs do not count");
	// origin deletes the branch; the local origin/other stays until a prune.
	sh(origin, "update-ref", "-d", "refs/heads/other");
	const found = entry(await report(new Map(), { fetch: true }), byWorktree(dir));
	assert.ok(sh(dir, "rev-parse", "--verify", "refs/remotes/origin/other"), "still there locally");
	assert.equal(found.cleanable, false);
	assert.ok(found.blockers.includes(reached), found.blockers.join("; "));
});

test("Codex: an origin/<other> whose tip differs from origin's (narrowed fetch refspec) does not keep a reflog-only commit", async (t) => {
	const { origin, landed, report, entry, sh, commit } = setup(t);
	const dir = landed("feat");
	sh(dir, "checkout", "--quiet", "--detach", "origin/main");
	const scratch = commit(dir, "scratch.txt", "pushed as another branch");
	sh(dir, "push", "--quiet", "origin", "HEAD:refs/heads/other");
	sh(dir, "fetch", "--quiet", "origin");
	sh(dir, "checkout", "--quiet", "--detach", "origin/main");
	assert.equal(entry(await report(new Map(), { fetch: true }), byWorktree(dir)).cleanable, true, "origin/other is live");

	// origin resets `other`; fetches now update only main, so origin/other keeps the old tip.
	sh(origin, "update-ref", "refs/heads/other", sh(dir, "rev-parse", "origin/main"));
	sh(dir, "config", "remote.origin.fetch", "+refs/heads/main:refs/remotes/origin/main");
	const result = await report(new Map(), { fetch: true });
	assert.equal(result.fetch, "ok");
	assert.equal(sh(dir, "rev-parse", "refs/remotes/origin/other"), scratch, "origin/other is stale");
	const found = entry(result, byWorktree(dir));
	assert.equal(found.cleanable, false);
	assert.ok(found.blockers.includes("1 commit(s) only the worktree's HEAD reflog or its own refs reach"), found.blockers.join("; "));
});

test("suspected 2: a cherry-pick sequence paused after a manual commit retains the worktree", async (t) => {
	const { landed, report, entry, sh, commit, write } = setup(t);
	const dir = landed("feat");
	const base = sh(dir, "rev-parse", "HEAD");
	sh(dir, "checkout", "--quiet", "-b", "picks");
	commit(dir, "feat.txt", "first pick");
	commit(dir, "second.txt", "second pick");
	sh(dir, "checkout", "--quiet", "feat");
	commit(dir, "feat.txt", "conflicting");
	assert.throws(() => sh(dir, "cherry-pick", `${base}..picks`));
	write(dir, "feat.txt", "first pick");
	sh(dir, "add", "feat.txt");
	sh(dir, "commit", "--quiet", "-m", "resolved by hand");
	const gitDir = sh(dir, "rev-parse", "--absolute-git-dir");
	assert.deepEqual([fs.existsSync(path.join(gitDir, "CHERRY_PICK_HEAD")), fs.existsSync(path.join(gitDir, "sequencer"))], [false, true]);
	const found = entry(await report(), byWorktree(dir));
	assert.ok(found.blockers.includes("a cherry-pick or revert sequence is in progress"), found.blockers.join("; "));
});

test("suspected 3: a commit only refs/worktree/* reaches retains the worktree", async (t) => {
	const { landed, report, entry, sh } = setup(t);
	const dir = landed("feat");
	const kept = sh(dir, "commit-tree", sh(dir, "write-tree"), "-p", "HEAD", "-m", "kept by a per-worktree ref");
	sh(dir, "update-ref", "refs/worktree/keep", kept);
	assert.equal(sh(dir, "log", "-g", "--format=%H", "HEAD").includes(kept), false, "not in the HEAD reflog");
	const found = entry(await report(), byWorktree(dir));
	assert.equal(found.cleanable, false);
	assert.ok(found.blockers.includes("1 commit(s) only the worktree's HEAD reflog or its own refs reach"), found.blockers.join("; "));
});
