const assert = require("node:assert/strict");
const test = require("node:test");

const {
	resolveDevTmuxSessionName,
	sanitizeToken,
	sessionNameForWorktreeName,
} = require("./dev-tmux-session");

test("resolveDevTmuxSessionName honors explicit ROVO_TMUX_SESSION", () => {
	assert.equal(
		resolveDevTmuxSessionName({
			env: { ROVO_TMUX_SESSION: "custom-session" },
			getWorktreeNameImpl: () => "ignored",
		}),
		"custom-session",
	);
});

test("resolveDevTmuxSessionName applies prefix and worktree sanitization", () => {
	assert.equal(
		resolveDevTmuxSessionName({
			env: { ROVO_TMUX_SESSION_PREFIX: "VPK Dev!" },
			getWorktreeNameImpl: () => "HTML Selector Block Plan",
		}),
		"vpk-dev-html-selector-block-plan",
	);
});

test("resolveDevTmuxSessionName falls back to main when worktree name is empty", () => {
	assert.equal(
		resolveDevTmuxSessionName({
			env: {},
			getWorktreeNameImpl: () => "",
		}),
		"vpk-dev-main",
	);
});

test("sanitizeToken keeps lowercase alphanumeric underscore and dash tokens", () => {
	assert.equal(sanitizeToken(" Foo__Bar--Baz! ", "fallback"), "foo__bar-baz");
	assert.equal(sanitizeToken(" !!! ", "fallback"), "fallback");
});

test("the plain stack reads its own override variables, not Rovo's", () => {
	const name = (env) => resolveDevTmuxSessionName({ env, getWorktreeNameImpl: () => "feature-x", stack: "plain" });
	assert.equal(name({}), "vpk-dev-feature-x");
	assert.equal(name({ VPK_DEV_TMUX_SESSION: " pinned " }), "pinned");
	assert.equal(name({ VPK_DEV_TMUX_SESSION_PREFIX: "Mine" }), "mine-feature-x");
	assert.equal(name({ ROVO_TMUX_SESSION: "rovo-only", ROVO_TMUX_SESSION_PREFIX: "rovo" }), "vpk-dev-feature-x");
	assert.throws(() => resolveDevTmuxSessionName({ env: {}, stack: "other" }), /Unknown dev stack: other/);
});

test("the launchers, `pnpm ports` and the module derive one name for a worktree", () => {
	const { spawnSync } = require("node:child_process");
	const path = require("node:path");
	const { sessionNameForWorktree } = require("./worktree-kill");
	const { getWorktreeName } = require("./worktree-ports");

	assert.equal(sessionNameForWorktreeName(null), "vpk-dev-main");
	assert.equal(sessionNameForWorktreeName("HTML Selector"), "vpk-dev-html-selector");
	assert.equal(sessionNameForWorktree({ worktreeName: "HTML Selector" }), sessionNameForWorktreeName("HTML Selector"));

	const repoRoot = path.resolve(__dirname, "../..");
	const env = { ...process.env };
	for (const variable of ["VPK_DEV_TMUX_SESSION", "VPK_DEV_TMUX_SESSION_PREFIX", "ROVO_TMUX_SESSION", "ROVO_TMUX_SESSION_PREFIX"]) {
		delete env[variable];
	}
	const expected = sessionNameForWorktreeName(getWorktreeName());
	for (const stack of ["plain", "rovo"]) {
		const result = spawnSync(process.execPath, [path.join(__dirname, "dev-tmux-session.js"), stack], { cwd: repoRoot, env, encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
		assert.equal(result.stdout, expected, stack);
	}
	for (const script of ["scripts/dev-tmux-plain.sh", "scripts/dev-tmux.sh"]) {
		const source = require("node:fs").readFileSync(path.join(repoRoot, script), "utf8");
		assert.match(source, /node scripts\/lib\/dev-tmux-session\.js (plain|rovo)/, script);
		assert.doesNotMatch(source, /sanitizeToken/, `${script} derives the name itself`);
	}
});

test("an explicit session name that tmux cannot target is refused", () => {
	for (const name of ["demo:1", "demo.2", "=demo"]) {
		assert.throws(() => resolveDevTmuxSessionName({ env: { VPK_DEV_TMUX_SESSION: name }, stack: "plain" }), /cannot contain/, name);
	}
	assert.equal(sanitizeToken("feat.2:x", "fallback"), "feat-2-x", "derived names never contain them");
});
