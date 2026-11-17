const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { NO_GRANT, buildGrant, forbiddenPaths, isSafeBranch, isSerialisablePath, parseArgs, serialiseGrant, tomlString } = require("./vpk-remote-git-grant.js");

const SCRIPT = path.join(__dirname, "vpk-remote-git-grant.js");
const BRANCH = "vpk/test-grant";

function git(cwd, ...args) {
	const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))), GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@example.com" };
	const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env });
	assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
	return result.stdout.trim();
}

// A repository with a linked worktree on BRANCH, under a directory whose name is `name`.
function fixture(t, name = "grant fixture") {
	const root = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "git-grant-"))), name);
	t.after(() => fs.rmSync(path.dirname(root), { recursive: true, force: true }));
	const repo = path.join(root, "repo");
	fs.mkdirSync(repo, { recursive: true });
	git(repo, "init", "-q", "-b", "main");
	fs.writeFileSync(path.join(repo, "a.txt"), "a\n");
	git(repo, "add", "a.txt");
	git(repo, "commit", "-qm", "init");
	const worktree = path.join(root, "wt one");
	git(repo, "worktree", "add", "-q", "-b", BRANCH, worktree, "main");
	return { repo, worktree, common: path.join(repo, ".git"), gitDir: path.join(repo, ".git", "worktrees", "wt-one") };
}

// Parses the inline tables serialiseGrant writes: `{"<basic string>" = "write", …}`.
function parseInlineTable(text) {
	let index = 0;
	const expect = (literal) => {
		assert.equal(text.slice(index, index + literal.length), literal, `expected ${literal} at ${index} in ${text}`);
		index += literal.length;
	};
	const basicString = () => {
		expect("\"");
		let value = "";
		for (;;) {
			const char = text[index++];
			assert.ok(char !== undefined, "unterminated string");
			if (char === "\"") return value;
			if (char !== "\\") {
				assert.ok(char.charCodeAt(0) >= 0x20 && char !== "\u007f", "raw control character");
				value += char;
				continue;
			}
			const escape = text[index++];
			if (escape === "u") {
				value += String.fromCharCode(Number.parseInt(text.slice(index, index + 4), 16));
				index += 4;
			} else {
				value += { "\\": "\\", "\"": "\"", n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" }[escape];
			}
		}
	};
	const table = {};
	expect("{");
	if (text[index] === "}") return table;
	for (;;) {
		const key = basicString();
		assert.ok(!(key in table), `duplicate key ${key}`);
		expect(" = ");
		table[key] = basicString();
		if (text[index] === "}") break;
		expect(", ");
	}
	expect("}");
	assert.equal(index, text.length, "trailing text");
	return table;
}

function expectedPaths({ gitDir, common }) {
	return [
		`${gitDir}/index`, `${gitDir}/index.lock`, `${gitDir}/HEAD.lock`, `${gitDir}/AUTO_MERGE.lock`, `${gitDir}/COMMIT_EDITMSG`, `${gitDir}/logs/HEAD`,
		`${common}/objects`, `${common}/refs/heads/${BRANCH}`, `${common}/refs/heads/${BRANCH}.lock`, `${common}/logs/refs/heads/${BRANCH}`, `${common}/packed-refs.lock`,
	];
}

function assertNoForbidden(grant, { common, gitDir }) {
	const keys = Object.keys(parseInlineTable(grant));
	for (const banned of [common, `${common}/logs`, `${common}/refs`, `${common}/refs/heads`, `${common}/config`, `${common}/hooks`, gitDir, `${gitDir}/HEAD`]) {
		assert.ok(!keys.includes(banned), `grant names ${banned}`);
	}
	for (const key of keys) assert.ok(!key.startsWith(`${common}/hooks`) && !key.startsWith(`${common}/config`), `grant reaches into ${key}`);
}

test("parseArgs takes a worktree and an expected branch, or --no-worktree alone", () => {
	assert.deepEqual(parseArgs(["--worktree", "w", "--branch", "vpk/a-b"]), { worktree: path.resolve("w"), branch: "vpk/a-b" });
	assert.deepEqual(parseArgs(["--worktree", "w", "--branch", "vpk/a-b", "--repo", "r"]), { worktree: path.resolve("w"), branch: "vpk/a-b", repo: path.resolve("r") });
	assert.deepEqual(parseArgs(["--no-worktree"]), { noWorktree: true });
	assert.throws(() => parseArgs(["--no-worktree", "--repo", "r"]), /unknown option --no-worktree/u);
	assert.throws(() => parseArgs([]), /both required/u);
	assert.throws(() => parseArgs(["--worktree", "w"]), /both required/u);
	assert.throws(() => parseArgs(["--no-worktree", "--worktree", "w"]), /unknown option --no-worktree/u);
	assert.throws(() => parseArgs(["--worktree", "w", "--branch"]), /--branch needs a value/u);
	assert.throws(() => parseArgs(["--worktree", "w", "--branch", ""]), /--branch needs a value/u);
	assert.throws(() => parseArgs(["--worktree", "w", "--worktree", "x", "--branch", "b"]), /given twice/u);
});

test("branch names must stay inside the conservative character set", () => {
	for (const name of ["vpk/fix-gpt-browser-tests", "vpk/feat-ui-generation-2", "main", "a.b_c-d/e"]) assert.ok(isSafeBranch(name), name);
	for (const name of ["", "vpk/x\" = \"write\", \"/etc", "vpk/a b", "vpk/a\"b", "vpk/a'b", "vpk/../x", "refs/heads/x", "HEAD", "vpk/x.lock", "vpk/x.", "-x", "vpk//x", "vpk/", "/x", "vpk/é", "vpk/x\n", "vpk/*", "a".repeat(201)]) {
		assert.ok(!isSafeBranch(name), JSON.stringify(name));
	}
});

test("tomlString escapes quotes, backslashes and control characters", () => {
	assert.equal(tomlString("a\"b\\c\nd\u007f"), "\"a\\\"b\\\\c\\u000ad\\u007f\"");
	assert.throws(() => tomlString("\ud800"), /well-formed/u);
	const nasty = "/x/a\" = \"write\", \"/etc/passwd";
	assert.deepEqual(parseInlineTable(serialiseGrant([nasty, "/y z"])), { [nasty]: "write", "/y z": "write" });
	assert.equal(serialiseGrant([]), NO_GRANT);
});

test("paths that cannot be serialised safely are refused", () => {
	assert.ok(isSerialisablePath("/a b/c\"d"));
	for (const value of ["relative", "/a/../b", "/a//b", "/a/", "/a\nb", "/a\u0000b", "/a*b", "/a?b", "/a[b]", "/a{b}", "/a\\b", "/a\ud800"]) {
		assert.ok(!isSerialisablePath(value), JSON.stringify(value));
	}
});

test("a linked worktree on the expected branch gets exactly the commit paths", (t) => {
	const tree = fixture(t);
	const result = buildGrant({ worktree: tree.worktree, branch: BRANCH });
	assert.equal(result.reason, null);
	assert.deepEqual(Object.keys(parseInlineTable(result.grant)), expectedPaths(tree));
	assert.ok(Object.values(parseInlineTable(result.grant)).every((mode) => mode === "write"));
	assertNoForbidden(result.grant, tree);
});

test("a worktree path with a quote is escaped, not injected", (t) => {
	const tree = fixture(t, "odd \" name");
	const result = buildGrant({ worktree: tree.worktree, branch: BRANCH });
	assert.equal(result.reason, null);
	assert.deepEqual(Object.keys(parseInlineTable(result.grant)), expectedPaths(tree));
});

test("a worktree path with glob characters gets no grant", (t) => {
	const tree = fixture(t, "star*dir");
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }).reason, /cannot serialise/u);
});

test("a detached HEAD gets no grant", (t) => {
	const tree = fixture(t);
	git(tree.worktree, "checkout", "-q", "--detach");
	const result = buildGrant({ worktree: tree.worktree, branch: BRANCH });
	assert.equal(result.grant, NO_GRANT);
	assert.match(result.reason, /HEAD is detached/u);
});

test("HEAD on another branch than the task record's gets no grant", (t) => {
	const tree = fixture(t);
	git(tree.worktree, "checkout", "-q", "-b", "vpk/other");
	const result = buildGrant({ worktree: tree.worktree, branch: BRANCH });
	assert.equal(result.grant, NO_GRANT);
	assert.match(result.reason, /HEAD is on refs\/heads\/vpk\/other, expected refs\/heads\/vpk\/test-grant/u);
});

test("an injected branch name gets no grant even when HEAD matches nothing", (t) => {
	const tree = fixture(t);
	const result = buildGrant({ worktree: tree.worktree, branch: `${BRANCH}" = "write", "${tree.common}` });
	assert.equal(result.grant, NO_GRANT);
	assert.match(result.reason, /outside the allowed character set/u);
});

test("the main checkout, a subdirectory, and a non-repository get no grant", (t) => {
	const tree = fixture(t);
	assert.match(buildGrant({ worktree: tree.repo, branch: "main" }).reason, /not a linked worktree/u);
	fs.mkdirSync(path.join(tree.worktree, "sub"));
	assert.match(buildGrant({ worktree: path.join(tree.worktree, "sub"), branch: BRANCH }).reason, /not the top of its worktree/u);
	const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "git-grant-plain-")));
	t.after(() => fs.rmSync(plain, { recursive: true, force: true }));
	assert.match(buildGrant({ worktree: plain, branch: BRANCH }).reason, /git rev-parse failed/u);
	assert.match(buildGrant({ worktree: path.join(plain, "missing"), branch: BRANCH }).reason, /does not exist/u);
});

test("a failing git query gets no grant", (t) => {
	const tree = fixture(t);
	const failing = () => ({ status: 128, stdout: "", stderr: "fatal: boom" });
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }, { git: failing }).reason, /rev-parse failed.*boom/u);
	let calls = 0;
	const headFails = () => (++calls === 1 ? { status: 0, stdout: `${tree.worktree}\n${tree.gitDir}\n${tree.common}\n`, stderr: "" } : { status: null, stdout: "", stderr: "timed out" });
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }, { git: headFails }).reason, /symbolic-ref failed: timed out/u);
});

test("a branch whose ref directory is missing gets no grant", (t) => {
	const tree = fixture(t);
	git(tree.repo, "pack-refs", "--all");
	fs.rmSync(path.join(tree.common, "refs", "heads", "vpk"), { recursive: true, force: true });
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }).reason, /refs\/heads\/vpk does not exist/u);
});

test("a symlinked objects directory gets no grant", (t) => {
	const tree = fixture(t);
	fs.renameSync(path.join(tree.common, "objects"), path.join(tree.common, "objects-real"));
	fs.symlinkSync(path.join(tree.common, "objects-real"), path.join(tree.common, "objects"));
	const result = buildGrant({ worktree: tree.worktree, branch: BRANCH });
	assert.equal(result.grant, NO_GRANT);
	assert.match(result.reason, /\/objects is a symlink/u);
});

test("a symlinked parent of the branch's ref gets no grant", (t) => {
	const tree = fixture(t);
	const heads = path.join(tree.common, "refs", "heads");
	fs.renameSync(path.join(heads, "vpk"), path.join(heads, "vpk-real"));
	fs.symlinkSync(path.join(heads, "vpk-real"), path.join(heads, "vpk"));
	assert.equal(git(tree.worktree, "symbolic-ref", "HEAD"), `refs/heads/${BRANCH}`);
	const result = buildGrant({ worktree: tree.worktree, branch: BRANCH });
	assert.equal(result.grant, NO_GRANT);
	assert.match(result.reason, /refs\/heads\/vpk is a symlink/u);
});

test("granted files of the wrong type, or symlinked, get no grant", (t) => {
	const tree = fixture(t);
	const index = fs.readFileSync(path.join(tree.gitDir, "index"));
	fs.rmSync(path.join(tree.gitDir, "index"));
	fs.mkdirSync(path.join(tree.gitDir, "index"));
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }).reason, /\/index is not a regular file/u);
	fs.rmSync(path.join(tree.gitDir, "index"), { recursive: true });
	fs.writeFileSync(path.join(tree.gitDir, "index"), index);
	fs.symlinkSync(path.join(tree.common, "config"), path.join(tree.gitDir, "COMMIT_EDITMSG"));
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }).reason, /COMMIT_EDITMSG is a symlink/u);
	fs.rmSync(path.join(tree.gitDir, "COMMIT_EDITMSG"));
	fs.mkdirSync(path.join(tree.common, "packed-refs.lock"));
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }).reason, /packed-refs\.lock is not a regular file/u);
	fs.rmSync(path.join(tree.common, "packed-refs.lock"), { recursive: true });
	assert.equal(buildGrant({ worktree: tree.worktree, branch: BRANCH }).reason, null, "a missing COMMIT_EDITMSG or lock is allowed");
});

test("a missing index, reflog or loose branch ref gets no grant, since a missing entry opens as a directory", (t) => {
	const tree = fixture(t);
	const missing = [
		[path.join(tree.gitDir, "index"), /\/index does not exist \(a missing entry would open as a directory\)/u],
		[path.join(tree.gitDir, "logs", "HEAD"), /logs\/HEAD does not exist/u],
		[path.join(tree.common, "logs", "refs", "heads", "vpk", "test-grant"), /logs\/refs\/heads\/vpk\/test-grant does not exist/u],
	];
	for (const [file, reason] of missing) {
		const saved = fs.readFileSync(file);
		fs.rmSync(file);
		assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }).reason, reason);
		fs.writeFileSync(file, saved);
	}
	git(tree.repo, "pack-refs", "--all");
	assert.equal(fs.existsSync(path.join(tree.common, "refs", "heads", "vpk", "test-grant")), false);
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }).reason, /refs\/heads\/vpk(\/test-grant)? does not exist/u, "a packed branch ref gets no grant");
});

test("worktree back-links that disagree get no grant", (t) => {
	const tree = fixture(t);
	const other = path.join(path.dirname(tree.worktree), "wt two");
	git(tree.repo, "worktree", "add", "-q", "-b", "vpk/other", other, "main");
	const otherGitDir = path.join(tree.common, "worktrees", "wt-two");
	const gitdirFile = path.join(tree.gitDir, "gitdir");
	const original = fs.readFileSync(gitdirFile, "utf8");

	// This git directory's gitdir names another worktree's .git file.
	fs.writeFileSync(gitdirFile, `${other}/.git\n`);
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }).reason, /gitdir names .*wt two\/\.git, not .*wt one\/\.git/u);
	fs.writeFileSync(gitdirFile, original);

	// The worktree's .git file names another valid worktree's git directory, whose HEAD was edited onto the task branch.
	fs.writeFileSync(path.join(otherGitDir, "HEAD"), `ref: refs/heads/${BRANCH}\n`);
	fs.writeFileSync(path.join(tree.worktree, ".git"), `gitdir: ${otherGitDir}\n`);
	const swapped = buildGrant({ worktree: tree.worktree, branch: BRANCH });
	assert.equal(swapped.grant, NO_GRANT);
	assert.match(swapped.reason, /wt-two\/gitdir names .*wt two\/\.git, not .*wt one\/\.git/u);
	fs.writeFileSync(path.join(tree.worktree, ".git"), `gitdir: ${tree.gitDir}\n`);

	// commondir names a copy of the common directory.
	const copy = path.join(path.dirname(tree.repo), "copy.git");
	fs.cpSync(tree.common, copy, { recursive: true });
	fs.writeFileSync(path.join(tree.gitDir, "commondir"), `${copy}\n`);
	assert.equal(buildGrant({ worktree: tree.worktree, branch: BRANCH }).grant, NO_GRANT);
	fs.writeFileSync(path.join(tree.gitDir, "commondir"), "../..\n");

	// A .git that is a symlink to the real link file.
	fs.renameSync(path.join(tree.worktree, ".git"), path.join(tree.worktree, "git-link"));
	fs.symlinkSync(path.join(tree.worktree, "git-link"), path.join(tree.worktree, ".git"));
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH }).reason, /\.git is not a regular file/u);
});

test("a pinned repository other than the worktree's gets no grant", (t) => {
	const tree = fixture(t);
	assert.equal(buildGrant({ worktree: tree.worktree, branch: BRANCH, repo: tree.repo }).reason, null);
	assert.equal(buildGrant({ worktree: tree.worktree, branch: BRANCH, repo: tree.common }).reason, null);
	const elsewhere = fixture(t, "another repo");
	const result = buildGrant({ worktree: tree.worktree, branch: BRANCH, repo: elsewhere.repo });
	assert.equal(result.grant, NO_GRANT);
	assert.match(result.reason, /not the pinned repository/u);
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH, repo: tree.worktree }).reason, /not the pinned repository/u);
	assert.match(buildGrant({ worktree: tree.worktree, branch: BRANCH, repo: path.join(tree.repo, "missing") }).reason, /does not exist/u);
});

test("--no-worktree always yields no grant", () => {
	assert.deepEqual(buildGrant({ noWorktree: true }), { grant: NO_GRANT, reason: "--no-worktree: the checkout's own .git stays protected" });
});

test("no grant ever names the common directory, logs, refs, config or hooks", (t) => {
	const tree = fixture(t);
	const forbidden = forbiddenPaths(tree.common);
	for (const banned of [tree.common, `${tree.common}/logs`, `${tree.common}/refs`, `${tree.common}/refs/heads`, `${tree.common}/config`, `${tree.common}/hooks`]) assert.ok(forbidden.has(banned));
	assertNoForbidden(buildGrant({ worktree: tree.worktree, branch: BRANCH }).grant, tree);
});

test("the CLI prints only the grant on stdout, with the reason on stderr", (t) => {
	const tree = fixture(t);
	const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
	const granted = run("--worktree", tree.worktree, "--branch", BRANCH, "--repo", tree.repo);
	assert.equal(granted.status, 0);
	assert.deepEqual(Object.keys(parseInlineTable(granted.stdout.trimEnd())), expectedPaths(tree));
	assert.match(granted.stderr, /commits to refs\/heads\/vpk\/test-grant/u);
	const pinnedElsewhere = run("--worktree", tree.worktree, "--branch", BRANCH, "--repo", tree.worktree);
	assert.deepEqual([pinnedElsewhere.status, pinnedElsewhere.stdout], [0, "{}\n"]);
	const wrong = run("--worktree", tree.worktree, "--branch", "vpk/other");
	assert.deepEqual([wrong.status, wrong.stdout], [0, "{}\n"]);
	assert.match(wrong.stderr, /no git writes: HEAD is on/u);
	const noWorktree = run("--no-worktree");
	assert.deepEqual([noWorktree.status, noWorktree.stdout], [0, "{}\n"]);
	const usage = run("--worktree", tree.worktree);
	assert.deepEqual([usage.status, usage.stdout], [2, "{}\n"]);
	assert.match(usage.stderr, /usage:/u);
});
