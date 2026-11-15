// Object-route entry: exact mapped targets, the landing-page guard and its --entry-point opt-in.

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const CONTROL_VPK = path.join(__dirname, "control-vpk");
const {
	executeBrowserCommand,
	parseCaptureArgs,
	runCapture,
	targetBrowserArguments,
} = require(CONTROL_VPK);
const { TARGET_REPO_MAP } = require("./lib/test-fixtures.js");

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
			"--session", "vpk-verify-target", "open", "--enable", "react-devtools", "--headed", `https://fixture.localhost${route}`,
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

test("--entry-point opens catalog landing pages but still rejects guessed and external routes", () => {
	for (const route of ["/", "/components", "/visual", "/?tab=projects"]) {
		assert.deepEqual(targetBrowserArguments(route, {
			entryPoint: true,
			origin: "https://fixture.localhost",
			repoMap: TARGET_REPO_MAP,
		}), ["open", "--enable", "react-devtools", `https://fixture.localhost${route}`], route);
	}
	for (const route of ["/missing-project", "//other.localhost/", "/%2e%2e/visual"]) {
		assert.throws(() => targetBrowserArguments(route, {
			entryPoint: true,
			origin: "https://fixture.localhost",
			repoMap: TARGET_REPO_MAP,
		}), /Unknown target|Target route/iu, route);
	}
});

test("landing-page refusal names the --entry-point opt-in", () => {
	assert.throws(() => targetBrowserArguments("/", {
		origin: "https://fixture.localhost",
		repoMap: TARGET_REPO_MAP,
	}), /catalog landing page\. Pass --entry-point/u);
});

test("capture parses --entry-point and runs a landing-page capture with it", () => {
	assert.equal(parseCaptureArgs(["/"]).entryPoint, false);
	const options = parseCaptureArgs(["/", "--entry-point"]);
	assert.equal(options.entryPoint, true);
	assert.equal(options.id, "root");
	assert.throws(() => runCapture(parseCaptureArgs(["/"]), {
		origin: "https://fixture.localhost",
		repoMap: TARGET_REPO_MAP,
		runCommand: () => { throw new Error("browser must not start"); },
	}), /--entry-point/u);
});

test("open-target CLI accepts --entry-point past the landing guard", () => {
	const result = spawnSync(process.execPath, [CONTROL_VPK, "open-target", "/", "--entry-point", "--bogus"], { encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /open-target <route> \[--headed\] \[--entry-point\]/u);
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
