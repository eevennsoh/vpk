const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const CONTROL_VPK = path.join(__dirname, "control-vpk");
const {
	applyLocalhostProxyBypass,
	classifyAgentBrowserFailure,
	executeBrowserCommand,
	formatBrowserFailure,
	isBrowserSessionStarter,
	parseBrowserTimeoutMs,
	parseLaunchReadyTimeoutMs,
	resolveAgentBrowserBin,
	runAgentBrowser,
	targetBrowserArguments,
	waitForDoctorReady,
} = require(CONTROL_VPK);

const TARGET_REPO_MAP = {
	appPages: { pages: [{ routePath: "/jira-team-eu26" }] },
	components: {
		categories: [{
			category: "visual",
			entries: [{ category: "visual", slug: "peel" }],
		}],
	},
};

test("object proof first opens the exact mapped project or component on this worktree", () => {
	for (const route of ["/jira-team-eu26", "/components/visual/peel?example=card#drag"]) {
		const calls = [];
		const args = targetBrowserArguments(route, {
			headed: true,
			origin: "https://fixture.localhost",
			repoMap: TARGET_REPO_MAP,
		});
		const outcome = executeBrowserCommand(args, {
			runCommand: (forwarded) => {
				calls.push(forwarded);
				return { status: 0, stdout: "Target page", stderr: "" };
			},
			session: "vpk-verify-target",
		});
		assert.equal(outcome.classification, null);
		assert.deepEqual(calls, [[
			"--session", "vpk-verify-target", "open", "--headed", `https://fixture.localhost${route}`,
		]]);
	}
});

test("object entry rejects root, category detours, guessed routes and external targets before browser launch", () => {
	for (const route of [
		"/", "/visual", "/missing-project", "/components/visual/missing",
		"https://other.localhost/jira-team-eu26", "//other.localhost/jira-team-eu26",
		"/visual/../jira-team-eu26", "/%2e%2e/jira-team-eu26",
	]) {
		let invoked = false;
		assert.throws(() => {
			const args = targetBrowserArguments(route, {
				origin: "https://fixture.localhost",
				repoMap: TARGET_REPO_MAP,
			});
			executeBrowserCommand(args, {
				runCommand: () => { invoked = true; },
				session: "vpk-verify-target",
			});
		}, /Object target|Unknown target|Target route/iu);
		assert.equal(invoked, false, route);
	}
});

test("open-target CLI rejects a root detour before resolving or starting a browser session", () => {
	const result = spawnSync(process.execPath, [CONTROL_VPK, "open-target", "/"], { encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Object target must name a component or project/iu);
	assert.doesNotMatch(result.stderr, /agent-browser|session id failed/iu);
});

test("object entry requires a discovered origin and keeps explicit catalog opens available", () => {
	assert.throws(() => targetBrowserArguments("/jira-team-eu26", {
		origin: "",
		repoMap: TARGET_REPO_MAP,
	}), /origin/iu);
	const calls = [];
	executeBrowserCommand(["open", "https://fixture.localhost/"], {
		runCommand: (args) => {
			calls.push(args);
			return { status: 0, stdout: "Catalog", stderr: "" };
		},
		session: "vpk-verify-catalog",
	});
	assert.deepEqual(calls, [["--session", "vpk-verify-catalog", "open", "https://fixture.localhost/"]]);
});

test("health and browser commands bypass proxies for localhost origins", () => {
	const env = {
		NO_PROXY: "internal.example.com",
		no_proxy: "127.0.0.1",
	};

	applyLocalhostProxyBypass(env);

	for (const key of ["NO_PROXY", "no_proxy"]) {
		const entries = new Set(env[key].split(","));
		assert.equal(entries.has("internal.example.com") || key === "no_proxy", true);
		assert.equal(entries.has("localhost"), true);
		assert.equal(entries.has("127.0.0.1"), true);
		assert.equal(entries.has(".localhost"), true);
	}
});

test("resolves agent-browser from this worktree, not PATH", () => {
	const bin = resolveAgentBrowserBin();
	assert.equal(path.isAbsolute(bin), true);
	assert.ok(existsSync(bin), `missing worktree agent-browser bin: ${bin}`);
	assert.match(bin, /node_modules[/].*agent-browser[/]bin[/]agent-browser\.js$/u);
});

test("fails with pnpm install guidance when agent-browser is not in the worktree", () => {
	const repoRoot = mkdtempSync(path.join(os.tmpdir(), "control-vpk-no-agent-browser-"));
	try {
		assert.throws(
			() => resolveAgentBrowserBin(repoRoot),
			/pnpm install/u,
		);
	} finally {
		rmSync(repoRoot, { recursive: true, force: true });
	}
});

test("session does not invoke a PATH agent-browser when the worktree package exists", () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "control-vpk-path-"));
	const fakeBin = path.join(root, "bin");
	mkdirSync(fakeBin, { recursive: true });
	const fakeAgentBrowser = path.join(fakeBin, "agent-browser");
	writeFileSync(
		fakeAgentBrowser,
		"#!/bin/sh\nprintf 'PATH_HIT\\n' >&2\nexit 42\n",
	);
	chmodSync(fakeAgentBrowser, 0o755);

	try {
		const result = spawnSync(process.execPath, [CONTROL_VPK, "session"], {
			encoding: "utf8",
			env: {
				...process.env,
				PATH: `${fakeBin}${path.delimiter}${process.env.PATH || "/usr/bin:/bin"}`,
			},
		});
		assert.notEqual(result.status, 42);
		assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /PATH_HIT/u);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("browser subprocess timeout is configurable and classified distinctly", () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "control-vpk-timeout-"));
	const fakeAgentBrowser = path.join(root, "agent-browser");
	writeFileSync(
		fakeAgentBrowser,
		"#!/usr/bin/env node\nsetTimeout(() => {}, 60_000);\n",
	);
	chmodSync(fakeAgentBrowser, 0o755);

	try {
		const result = runAgentBrowser(["snapshot"], {
			binPath: fakeAgentBrowser,
			encoding: "utf8",
			timeoutMs: 25,
		});
		assert.equal(classifyAgentBrowserFailure(result), "timeout");
		assert.equal(parseBrowserTimeoutMs({ VPK_VERIFY_BROWSER_TIMEOUT_MS: "1250" }), 1250);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("non-navigation commands refuse an inactive session before they can restore the wrong page", () => {
	const calls = [];
	const outcome = executeBrowserCommand(["snapshot", "-i"], {
		runCommand: (args) => {
			calls.push(args);
			return {
				status: 0,
				stderr: "",
				stdout: JSON.stringify({
					data: {
						active: true,
						runtime: { browserLaunched: false, pageCount: 0 },
					},
					success: true,
				}),
			};
		},
		session: "vpk-verify-fixture",
		timeoutMs: 100,
	});

	assert.equal(outcome.classification, "stale_session");
	assert.equal(outcome.recoveredFromStaleSession, false);
	assert.match(formatBrowserFailure(outcome, ["snapshot", "-i"]), /reopen the scoped browser/u);
	assert.doesNotMatch(formatBrowserFailure(outcome, ["snapshot", "-i"]), /Playwright fallback/u);
	assert.deepEqual(calls, [
		["--session", "vpk-verify-fixture", "session", "info", "--json"],
	]);
});

test("an active session is inspected before a non-navigation browser command", () => {
	const calls = [];
	const outcome = executeBrowserCommand(["snapshot", "-i"], {
		runCommand: (args) => {
			calls.push(args);
			if (args.includes("info")) {
				return {
					status: 0,
					stderr: "",
					stdout: JSON.stringify({
						data: {
							active: true,
							runtime: { browserLaunched: true, pageCount: 1 },
						},
						success: true,
					}),
				};
			}
			return { status: 0, stderr: "", stdout: "Page: Jira" };
		},
		session: "vpk-verify-fixture",
		timeoutMs: 100,
	});

	assert.equal(outcome.classification, null);
	assert.deepEqual(calls, [
		["--session", "vpk-verify-fixture", "session", "info", "--json"],
		["--session", "vpk-verify-fixture", "snapshot", "-i"],
	]);
});

test("open can initialize a stale session and still retries a stale launch exactly once", () => {
	const calls = [];
	const results = [
		{ status: 1, stderr: "No browser session found", stdout: "" },
		{ status: 0, stderr: "", stdout: "Page: Jira" },
	];
	const outcome = executeBrowserCommand(["open", "https://jira.localhost/"], {
		runCommand: (args) => {
			calls.push(args);
			return args.at(-1) === "close"
				? { status: 0, stderr: "", stdout: "" }
				: results.shift();
		},
		session: "vpk-verify-fixture",
		timeoutMs: 100,
	});

	assert.equal(isBrowserSessionStarter(["open", "https://jira.localhost/"]), true);
	assert.equal(isBrowserSessionStarter(["snapshot", "-i"]), false);
	assert.equal(outcome.classification, null);
	assert.equal(outcome.recoveredFromStaleSession, true);
	assert.deepEqual(calls, [
		["--session", "vpk-verify-fixture", "open", "https://jira.localhost/"],
		["--session", "vpk-verify-fixture", "close"],
		["--session", "vpk-verify-fixture", "open", "https://jira.localhost/"],
	]);
});

test("open uses the Playwright handoff when its bounded stale retry also fails", () => {
	const results = [
		{ status: 1, stderr: "No browser session found", stdout: "" },
		{ status: 1, stderr: "No browser session found", stdout: "" },
	];
	const outcome = executeBrowserCommand(["open", "https://jira.localhost/"], {
		runCommand: (args) => args.at(-1) === "close"
			? { status: 0, stderr: "", stdout: "" }
			: results.shift(),
		session: "vpk-verify-fixture",
		timeoutMs: 100,
	});

	assert.equal(outcome.classification, "stale_session");
	assert.equal(outcome.sessionStarter, true);
	assert.match(formatBrowserFailure(outcome, ["open", "https://jira.localhost/"]), /Playwright fallback/u);
	assert.doesNotMatch(formatBrowserFailure(outcome, []), /reopen the scoped browser/u);
});

test("launch readiness polls until doctor is healthy within a bounded timeout", async () => {
	const reports = [
		{ ok: false, frontendStatus: 0 },
		{ ok: false, frontendStatus: 503 },
		{ ok: true, frontendStatus: 200 },
	];
	let now = 0;
	const report = await waitForDoctorReady({
		collect: async () => reports.shift(),
		delay: async (ms) => {
			now += ms;
		},
		intervalMs: 50,
		now: () => now,
		timeoutMs: 500,
	});

	assert.equal(report.ok, true);
	assert.equal(report.frontendStatus, 200);
	assert.equal(now, 100);
	assert.equal(parseLaunchReadyTimeoutMs({ VPK_VERIFY_LAUNCH_TIMEOUT_MS: "1250" }), 1250);
});

test("launch readiness returns the last doctor report when its bound expires", async () => {
	let now = 0;
	let calls = 0;
	const report = await waitForDoctorReady({
		collect: async () => {
			calls += 1;
			return { ok: false, frontendStatus: calls };
		},
		delay: async (ms) => {
			now += ms;
		},
		intervalMs: 50,
		now: () => now,
		timeoutMs: 100,
	});

	assert.equal(report.ok, false);
	assert.equal(report.frontendStatus, 3);
	assert.equal(calls, 3);
});

test("timeouts clean only the worktree-scoped session and retain exact fallback context", () => {
	const calls = [];
	const outcome = executeBrowserCommand(["find", "text", "Build", "click"], {
		runCommand: (args) => {
			calls.push(args);
			if (args.includes("info")) {
				return {
					status: 0,
					stderr: "",
					stdout: JSON.stringify({
						data: {
							active: true,
							runtime: { browserLaunched: true, pageCount: 1 },
						},
						success: true,
					}),
				};
			}
			return args.at(-1) === "close"
				? { status: 0, stderr: "", stdout: "" }
				: { error: { code: "ETIMEDOUT" }, status: null, stderr: "", stdout: "" };
		},
		session: "vpk-verify-timeout-fixture",
		timeoutMs: 100,
	});

	assert.equal(outcome.classification, "timeout");
	assert.deepEqual(calls.at(-1), ["--session", "vpk-verify-timeout-fixture", "close"]);
	assert.match(
		formatBrowserFailure(outcome, ["find", "text", "Build", "click"]),
		/failed command: agent-browser "find" "text" "Build" "click"/u,
	);
	assert.match(formatBrowserFailure(outcome, []), /Existing evidence retained at .*output\/agent-browser\/vpk-verify/u);
	assert.match(formatBrowserFailure(outcome, []), /Playwright fallback/u);
});

test("missing binary, stale session, and ordinary assertion failures stay distinct", () => {
	assert.equal(
		classifyAgentBrowserFailure(Object.assign(new Error("session id failed"), { classification: "timeout" })),
		"timeout",
	);
	assert.equal(
		classifyAgentBrowserFailure(new Error("agent-browser is not installed in this worktree")),
		"missing_binary",
	);
	assert.equal(
		classifyAgentBrowserFailure({ status: 1, stderr: "about:blank: no browser session", stdout: "" }),
		"stale_session",
	);
	assert.equal(
		classifyAgentBrowserFailure({
			status: 0,
			stderr: "",
			stdout: "Browser preview empty state: about:blank",
		}),
		null,
	);
	assert.equal(
		classifyAgentBrowserFailure({ status: 1, stderr: "Element not found: Build", stdout: "" }),
		"assertion_failure",
	);
});
