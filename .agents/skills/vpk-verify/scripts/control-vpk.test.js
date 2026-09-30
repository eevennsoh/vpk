const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const CONTROL_VPK = path.join(__dirname, "control-vpk");
const {
	applyLocalhostProxyBypass,
	buildCaptureManifest,
	captureCli,
	classifyAgentBrowserFailure,
	executeBrowserCommand,
	formatBrowserFailure,
	formatCaptureSummary,
	isBrowserSessionStarter,
	manualVerificationRequested,
	parseBrowserTimeoutMs,
	parseCaptureArgs,
	parseLaunchReadyTimeoutMs,
	resolveAgentBrowserBin,
	runAgentBrowser,
	runCapture,
	targetBrowserArguments,
	waitForDoctorReady,
} = require(CONTROL_VPK);
const { readDesignVariantIds, routeWithDesignVariants } = require("./lib/capture.js");
const { withTempDir } = require("./lib/test-fixtures.js");

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
	// Left behind when a previous capture timed out; open must auto-recover instead of failing.
	assert.equal(
		classifyAgentBrowserFailure({ status: 1, stderr: "✗ Could not configure browser: Failed to connect: No such file or directory (os error 2)", stdout: "" }),
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

test("capture parses defaults to the light theme, a desktop viewport and a route-derived id", () => {
	assert.deepEqual(parseCaptureArgs(["/components/ui/accordion?example=1#top"]), {
		headed: false,
		id: "components-ui-accordion",
		media: "light",
		route: "/components/ui/accordion?example=1#top",
		strictA11y: false,
		variants: [],
		viewport: { width: 1280, height: 720 },
		waitText: null,
	});
	assert.deepEqual(parseCaptureArgs([
		"/jira-team-eu26", "--id", "eu26-narrow", "--viewport=390x844", "--media", "dark",
		"--wait-text", "Jira Design", "--headed", "--strict-a11y",
	]), {
		headed: true,
		id: "eu26-narrow",
		media: "dark",
		route: "/jira-team-eu26",
		strictA11y: true,
		variants: [],
		viewport: { width: 390, height: 844 },
		waitText: "Jira Design",
	});
});

test("capture --variant is repeatable and maps on/off to ?variants= tokens", () => {
	const options = parseCaptureArgs([
		"/jira-team-eu26", "--variant", "autoArrange", "--variant=sessionPeel=off", "--id", "eu26-arrange",
		"--variant", "simple-views=on", "--variant", "manualLink=off", "--variant", "manualLink",
	]);
	assert.equal(options.route, "/jira-team-eu26");
	assert.equal(options.id, "eu26-arrange");
	// A repeated id keeps its last value and moves to the end.
	assert.deepEqual(options.variants, ["autoArrange", "-sessionPeel", "simple-views", "manualLink"]);

	for (const [args, message] of [
		[["/a", "--variant"], /--variant requires a value/u],
		[["/a", "--variant", "--headed"], /--variant requires a value/u],
		[["/a", "--variant="], /--variant requires a value/u],
		[["/a", "--variant", "autoArrange=maybe"], /--variant must be <id>, <id>=on or <id>=off/u],
		[["/a", "--variant", "-autoArrange"], /--variant must be/u],
		[["/a", "--variant", "a,b"], /--variant must be/u],
		[["/a", "--variant", "autoarrange"], /Unknown design variant "autoarrange"\. Known ids: .*autoArrange/u],
	]) {
		assert.throws(() => parseCaptureArgs(args), message, args.join(" "));
	}
	// The known ids come from the store's source, so drift in its format fails here.
	const ids = readDesignVariantIds();
	for (const id of ["autoArrange", "sessionPeel", "simple-views", "moveVisual"]) assert.ok(ids.includes(id), id);
	assert.deepEqual(parseCaptureArgs(["/a", "--variant", "anything"], { designVariantIds: ["anything"] }).variants, ["anything"]);
});

test("capture merges variant tokens into the route query without disturbing it", () => {
	assert.equal(routeWithDesignVariants("/jira-team-eu26", []), "/jira-team-eu26");
	assert.equal(routeWithDesignVariants("/jira-team-eu26", ["autoArrange"]), "/jira-team-eu26?variants=autoArrange");
	assert.equal(
		routeWithDesignVariants("/preview/projects/jira-team-eu26?embedded=1#board", ["autoArrange", "-sessionPeel"]),
		"/preview/projects/jira-team-eu26?embedded=1&variants=autoArrange,-sessionPeel#board",
	);
	// Existing tokens stay, flags win for the same id, and other pairs keep their encoding.
	assert.equal(
		routeWithDesignVariants("/jira-team-eu26?q=a+b%20c&variants=-autoArrange,%20panel&x", ["autoArrange"]),
		"/jira-team-eu26?q=a+b%20c&x&variants=panel,autoArrange",
	);
	assert.equal(routeWithDesignVariants("/jira-team-eu26?", ["-moveVisual"]), "/jira-team-eu26?variants=-moveVisual");
});

test("capture opens the route with ?variants= and records the variants in the manifest", () => {
	withTempDir("control-vpk-capture-variants-", (root) => {
		const { calls, runCommand } = fakeCaptureBrowser();
		const options = parseCaptureArgs(["/jira-team-eu26?embedded=1", "--variant", "autoArrange", "--variant", "sessionPeel=off"]);
		const { manifest, manifestPath } = runCapture(options, {
			evidenceRoot: path.join(root, "evidence"),
			origin: "https://fixture.localhost",
			repoMap: TARGET_REPO_MAP,
			repoRoot: root,
			resolveSession: () => "vpk-verify-capture",
			runCommand,
		});
		assert.deepEqual(calls[0], ["open", "https://fixture.localhost/jira-team-eu26?embedded=1&variants=autoArrange,-sessionPeel"]);
		assert.equal(manifest.id, "jira-team-eu26");
		assert.equal(manifest.route, "/jira-team-eu26?embedded=1");
		assert.equal(manifest.requestedUrl, "https://fixture.localhost/jira-team-eu26?embedded=1&variants=autoArrange,-sessionPeel");
		assert.deepEqual(manifest.variants, ["autoArrange", "-sessionPeel"]);
		assert.match(formatCaptureSummary(manifest, manifestPath), /state {4}light 1280x720, data-color-mode=light, variants=autoArrange,-sessionPeel\n/u);
	});

	let written = "";
	captureCli(["/jira-team-eu26", "--variant", "autoArrange"], {
		capture: () => assert.fail("capture must not run under VPK_VERIFY=manual"),
		env: { VPK_VERIFY: "manual" },
		stdout: { write: (text) => { written += text; } },
	});
	assert.match(written, /check \/jira-team-eu26\?variants=autoArrange on/u);
});

test("capture rejects malformed arguments before any browser work", () => {
	for (const [args, message] of [
		[[], /exactly one route/u],
		[["/a", "/b"], /exactly one route/u],
		[["/a", "--viewport", "wide"], /--viewport/u],
		[["/a", "--viewport", "99999x10"], /--viewport/u],
		[["/a", "--media", "sepia"], /--media/u],
		[["/a", "--id", "../escape"], /--id/u],
		[["/a", "--wait-text"], /--wait-text requires a value/u],
		[["/a", "--wait-text", "--headed"], /--wait-text requires a value/u],
		[["/a", "--full-page"], /Unknown option/u],
	]) {
		assert.throws(() => parseCaptureArgs(args), message, args.join(" "));
	}
});

test("manual verification opt-out skips the browser and exits 0", () => {
	assert.equal(manualVerificationRequested({ VPK_VERIFY: "manual" }), true);
	assert.equal(manualVerificationRequested({ VPK_VERIFY: " Manual " }), true);
	assert.equal(manualVerificationRequested({}), false);
	let written = "";
	const code = captureCli(["/jira-team-eu26"], {
		capture: () => assert.fail("capture must not run under VPK_VERIFY=manual"),
		env: { VPK_VERIFY: "manual" },
		stdout: { write: (text) => { written += text; } },
	});
	assert.equal(code, 0);
	assert.match(written, /opted into manual verification/u);
	assert.match(written, /\/jira-team-eu26/u);

	const result = spawnSync(process.execPath, [CONTROL_VPK, "capture", "/jira-team-eu26"], {
		encoding: "utf8",
		env: { ...process.env, VPK_VERIFY: "manual" },
	});
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /opted into manual verification/u);
	assert.doesNotMatch(`${result.stdout}${result.stderr}`, /agent-browser|manifest/u);
});

test("a11y findings inside dev-only react-grab tooling are excluded, product findings are kept", () => {
	const manifest = buildCaptureManifest({
		a11y: { data: { counts: { violations: 2 } }, success: true, violations: undefined },
		options: { ...parseCaptureArgs(["/jira-team-eu26"]), strictA11y: true },
		consoleLog: { data: { messages: [] } },
		pageErrorLog: { data: { errors: [] } },
		timestamp: "2026-09-30T00:00:00.000Z",
		url: "https://fixture.localhost/jira-team-eu26",
	});
	assert.equal(manifest.counts.a11yViolations, 2, "counts-only payloads cannot be filtered and stay as reported");

	const filtered = buildCaptureManifest({
		a11y: { data: { counts: { violations: 2 }, violations: [
			{ id: "region", nodes: [{ target: [[".ph-no-capture", "canvas"]] }] },
			{ id: "color-contrast", nodes: [{ target: ["#save"] }] },
		] } },
		options: { ...parseCaptureArgs(["/jira-team-eu26"]), strictA11y: true },
		consoleLog: { data: { messages: [] } },
		pageErrorLog: { data: { errors: [] } },
		timestamp: "2026-09-30T00:00:00.000Z",
		url: "https://fixture.localhost/jira-team-eu26",
	});
	assert.equal(filtered.counts.a11yViolations, 1);
	assert.equal(filtered.ok, false, "the real product violation still fails --strict-a11y");
	assert.match(filtered.warnings.join("\n"), /1 a11y finding\(s\) inside dev-only tooling \(react-grab\) excluded/u);
});

test("capture manifest counts console/page errors and keeps a11y violations non-fatal unless strict", () => {
	const options = parseCaptureArgs(["/jira-team-eu26"]);
	const base = {
		a11y: { data: { counts: { violations: 3 } } },
		colorMode: "light",
		consoleLog: { data: { messages: [{ type: "warning", text: "slow" }] } },
		files: { screenshot: "output/x/capture.png" },
		options,
		pageErrorLog: { data: { errors: [] } },
		timestamp: "2026-09-30T00:00:00.000Z",
		url: "https://fixture.localhost/jira-team-eu26",
	};
	const clean = buildCaptureManifest(base);
	assert.equal(clean.ok, true);
	assert.deepEqual(clean.counts, { consoleErrors: 0, pageErrors: 0, a11yViolations: 3 });
	assert.deepEqual(clean.viewport, { width: 1280, height: 720 });
	assert.equal(clean.media, "light");
	assert.match(clean.warnings.join("\n"), /3 a11y violation\(s\).*non-fatal/u);
	for (const key of ["route", "url", "viewport", "media", "timestamp", "files", "counts", "ok"]) {
		assert.ok(key in clean, key);
	}

	assert.equal(buildCaptureManifest({ ...base, options: { ...options, strictA11y: true } }).ok, false);
	assert.equal(buildCaptureManifest({ ...base, a11y: undefined, options: { ...options, strictA11y: true } }).ok, false);
	assert.equal(buildCaptureManifest({ ...base, a11y: undefined }).ok, true);

	// Accept both agent-browser's { data: { messages } } and bare/stream-shaped arrays.
	const noisy = buildCaptureManifest({
		...base,
		consoleLog: [{ type: "console", level: "error", text: "Uncaught TypeError" }, { level: "log", text: "ok" }],
		pageErrorLog: { data: [{ text: "boom", line: 3 }] },
	});
	assert.equal(noisy.ok, false);
	assert.deepEqual(noisy.counts, { consoleErrors: 1, pageErrors: 1, a11yViolations: 3 });
	assert.deepEqual(noisy.samples, { consoleErrors: ["Uncaught TypeError"], pageErrors: ["boom"] });

	const unproven = buildCaptureManifest({ ...base, consoleLog: undefined });
	assert.equal(unproven.ok, false);
	assert.equal(unproven.counts.consoleErrors, null);

	const dark = buildCaptureManifest({ ...base, colorMode: "dark" });
	assert.equal(dark.ok, true);
	assert.match(dark.warnings.join("\n"), /data-color-mode is "dark", not the requested light/u);
});

test("capture drives the exact scoped route and writes proof plus manifest to the evidence dir", () => {
	withTempDir("control-vpk-capture-", (root) => {
		const { calls, runCommand } = fakeCaptureBrowser();
		const options = parseCaptureArgs(["/jira-team-eu26", "--wait-text", "Jira Design", "--headed"]);
		const { manifest, manifestPath } = runCapture(options, {
			evidenceRoot: path.join(root, "evidence"),
			now: () => new Date("2026-09-30T01:02:03.000Z"),
			origin: "https://fixture.localhost",
			repoMap: TARGET_REPO_MAP,
			repoRoot: root,
			resolveSession: () => "vpk-verify-capture",
			runCommand,
		});

		const screenshot = path.join(root, "evidence/jira-team-eu26/capture.png");
		assert.deepEqual(calls, [
			["open", "--headed", "https://fixture.localhost/jira-team-eu26"],
			["set", "viewport", "1280", "720"],
			["set", "media", "light"],
			["console", "--clear"],
			["errors", "--clear"],
			["reload"],
			["wait", "--load", "networkidle"],
			["wait", "--text", "Jira Design"],
			["wait", "--fn", calls.find((args) => args[1] === "--fn")?.[2]],
			["get", "url"],
			["eval", "document.documentElement.getAttribute('data-color-mode')"],
			["screenshot", screenshot],
			["snapshot", "--compact"],
			["console", "--json"],
			["errors", "--json"],
			["a11y", "--json"],
		]);
		assert.equal(manifestPath, path.join(root, "evidence/jira-team-eu26/manifest.json"));
		assert.deepEqual(JSON.parse(readFileSync(manifestPath, "utf8")), manifest);
		assert.equal(manifest.ok, false, "a console error fails the capture");
		assert.deepEqual(manifest.counts, { consoleErrors: 1, pageErrors: 0, a11yViolations: 2 });
		assert.equal(manifest.colorMode, "light");
		assert.equal(manifest.timestamp, "2026-09-30T01:02:03.000Z");
		assert.deepEqual(manifest.files, {
			screenshot: "evidence/jira-team-eu26/capture.png",
			snapshot: "evidence/jira-team-eu26/capture.aria.txt",
			console: "evidence/jira-team-eu26/capture.console.json",
			errors: "evidence/jira-team-eu26/capture.errors.json",
			a11y: "evidence/jira-team-eu26/capture.a11y.json",
			manifest: "evidence/jira-team-eu26/manifest.json",
		});
		assert.match(readFileSync(path.join(root, "evidence/jira-team-eu26/capture.aria.txt"), "utf8"), /Jira Design/u);
		const summary = formatCaptureSummary(manifest, manifestPath);
		assert.match(summary, /capture jira-team-eu26: FAIL/u);
		assert.match(summary, /console  1 error\n/u);
		assert.match(summary, /Hydration failed/u);
		assert.match(summary, new RegExp(`manifest: ${manifestPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "u"));
	});
});

test("capture rejects unmapped routes before resolving a session or launching a browser", () => {
	withTempDir("control-vpk-capture-reject-", (root) => {
		for (const route of ["/", "/visual", "/missing-project", "https://other.localhost/jira-team-eu26"]) {
			assert.throws(() => runCapture(parseCaptureArgs([route]), {
				evidenceRoot: root,
				origin: "https://fixture.localhost",
				repoMap: TARGET_REPO_MAP,
				resolveSession: () => assert.fail("session must not be resolved"),
				runCommand: () => assert.fail("browser must not launch"),
			}), /Object target|Unknown target|Target route/iu, route);
		}
	});
});

test("capture stops after a failed open and records a failing manifest", () => {
	withTempDir("control-vpk-capture-open-", (root) => {
		const { calls, runCommand } = fakeCaptureBrowser({
			overrides: { open: () => ({ status: 1, stderr: "net::ERR_CONNECTION_REFUSED", stdout: "" }) },
		});
		const { manifest } = runCapture(parseCaptureArgs(["/jira-team-eu26"]), {
			evidenceRoot: root,
			origin: "https://fixture.localhost",
			repoMap: TARGET_REPO_MAP,
			repoRoot: root,
			resolveSession: () => "vpk-verify-capture",
			runCommand,
		});
		assert.deepEqual(calls, [["open", "https://fixture.localhost/jira-team-eu26"]]);
		assert.equal(manifest.ok, false);
		assert.equal(manifest.failures[0].step, "open");
		assert.match(manifest.failures[0].detail, /ERR_CONNECTION_REFUSED/u);
		assert.deepEqual(manifest.counts, { consoleErrors: null, pageErrors: null, a11yViolations: null });
		assert.deepEqual(Object.keys(manifest.files), ["manifest"]);
	});
});

test("an open timeout explains the cold-compile case and how to proceed", () => {
	withTempDir("control-vpk-capture-cold-", (root) => {
		const { runCommand } = fakeCaptureBrowser({
			overrides: { open: () => ({ error: Object.assign(new Error("spawnSync agent-browser ETIMEDOUT"), { code: "ETIMEDOUT" }), status: null, stderr: "", stdout: "" }) },
		});
		const { manifest } = runCapture(parseCaptureArgs(["/jira-team-eu26"]), {
			evidenceRoot: root,
			origin: "https://fixture.localhost",
			repoMap: TARGET_REPO_MAP,
			repoRoot: root,
			resolveSession: () => "vpk-verify-capture",
			runCommand,
		});
		assert.equal(manifest.failures[0].step, "open");
		assert.equal(manifest.failures[0].classification, "timeout");
		assert.match(manifest.failures[0].detail, /still be compiling this route/u);
		assert.match(manifest.failures[0].detail, /VPK_VERIFY_BROWSER_TIMEOUT_MS/u);
	});
});

test("the non-Portless fallback origin is one the Next dev server serves chunks to", () => {
	const { resolveOrigin } = require("./lib/origin.js");
	const fallback = new URL(resolveOrigin("39999"));
	const nextConfig = readFileSync(path.join(__dirname, "../../../../next.config.ts"), "utf8");
	const allowed = nextConfig.match(/allowedDevOrigins:\s*\[([\s\S]*?)\]/u)?.[1] ?? "";
	// Next 16 blocks /_next dev resources for other origins, leaving an unhydrated shell.
	assert.ok(["localhost", ...allowed.match(/"[^"]+"/gu).map((entry) => entry.slice(1, -1))].includes(fallback.hostname), fallback.hostname);
});

test("capture fails instead of passing on a blank shell after the network settles", () => {
	withTempDir("control-vpk-capture-blank-", (root) => {
		const { calls, runCommand } = fakeCaptureBrowser({
			overrides: {
				console: () => ({ status: 0, stderr: "", stdout: JSON.stringify({ data: { messages: [] } }) }),
				wait: (args) => (args[1] === "--fn"
					? { status: 1, stderr: "Timeout waiting for function", stdout: "" }
					: { status: 0, stderr: "", stdout: "" }),
			},
		});
		const { manifest } = runCapture(parseCaptureArgs(["/jira-team-eu26"]), {
			evidenceRoot: root,
			origin: "https://fixture.localhost",
			repoMap: TARGET_REPO_MAP,
			repoRoot: root,
			resolveSession: () => "vpk-verify-capture",
			runCommand,
		});
		const contentWait = calls.find((args) => args[1] === "--fn");
		assert.match(contentWait[2], /innerText/u);
		assert.match(contentWait[2], /Skip to content/u);
		assert.equal(manifest.ok, false, "a page with only the shell must not pass");
		assert.deepEqual(manifest.failures.map((failure) => failure.step), ["content"]);
		assert.match(manifest.failures[0].detail, /only the app shell/u);
		assert.ok(manifest.files.screenshot, "evidence is still collected for debugging");
	});
});

test("capture keeps collecting evidence when the wait text is missing, then fails", () => {
	withTempDir("control-vpk-capture-wait-", (root) => {
		const { calls, runCommand } = fakeCaptureBrowser({
			overrides: {
				console: () => ({ status: 0, stderr: "", stdout: JSON.stringify({ data: { messages: [] } }) }),
				wait: (args) => (args[1] === "--text"
					? { status: 1, stderr: "Timeout waiting for text: Jira Design", stdout: "" }
					: { status: 0, stderr: "", stdout: "" }),
			},
		});
		const { manifest } = runCapture(parseCaptureArgs(["/jira-team-eu26", "--wait-text", "Jira Design"]), {
			evidenceRoot: root,
			origin: "https://fixture.localhost",
			repoMap: TARGET_REPO_MAP,
			repoRoot: root,
			resolveSession: () => "vpk-verify-capture",
			runCommand,
		});
		assert.equal(manifest.ok, false);
		assert.deepEqual(manifest.failures.map((failure) => failure.step), ["wait-text"]);
		assert.ok(calls.some((args) => args[0] === "screenshot"));
		assert.ok(manifest.files.screenshot);
		assert.equal(manifest.counts.consoleErrors, 0);
	});
});
