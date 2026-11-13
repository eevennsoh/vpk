"use strict";

// BE-F1: a real BrowserWorkspace over a real AgentBrowserRuntime whose agent-browser
// commands go to a fake execFile (no binary, no Chromium) and whose timers are injected.

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

// The runtime reads child_process.execFile when it is loaded, so the fake goes in first.
const fakeAgentBrowser = {
	calls: [],
	hang: new Set(),
	kills: [],
	waiters: [],
	// Resolves once a command starting with `prefix` has been sent.
	sent(prefix) {
		if (this.calls.some((call) => call.startsWith(prefix))) return Promise.resolve();
		return new Promise((resolve) => this.waiters.push({ prefix, resolve }));
	},
	reset() {
		this.calls.length = 0;
		this.kills.length = 0;
		this.hang.clear();
	},
};
childProcess.execFile = (file, args, options, callback) => {
	const command = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--session").join(" ");
	fakeAgentBrowser.calls.push(command);
	for (const waiter of fakeAgentBrowser.waiters.filter(({ prefix }) => command.startsWith(prefix))) {
		fakeAgentBrowser.waiters.splice(fakeAgentBrowser.waiters.indexOf(waiter), 1);
		waiter.resolve();
	}
	const child = {
		kill: (signal) => {
			fakeAgentBrowser.kills.push({ command, signal });
			return true;
		},
	};
	const done = typeof options === "function" ? options : callback;
	if (![...fakeAgentBrowser.hang].some((prefix) => command.startsWith(prefix))) {
		const stdout = JSON.stringify({ success: true, data: { tabs: [{ index: 0, active: true, title: "", url: "about:blank" }] } });
		setImmediate(() => done(null, stdout, ""));
	}
	return child;
};

const agentBrowserHome = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-be-f1-agent-browser-"));
process.env.AGENT_BROWSER_HOME = path.join(agentBrowserHome, ".agent-browser");
process.env.AGENT_BROWSER_EXECUTABLE_PATH = "/nonexistent/fake-browser-for-tests";

const {
	AGENT_BROWSER_CALL_TIMEOUT_MS,
	AGENT_BROWSER_CLI_READ_TIMEOUT_MS,
	AGENT_BROWSER_DAEMON_OPERATION_TIMEOUT_MS,
	isAgentBrowserCallTimeoutError,
	resolveAgentBrowserCallTimeoutMs,
} = require("./agent-browser-call");
const { AgentBrowserRuntime } = require("./browser-workspace-runtime");
const { BrowserWorkspaceManager } = require("./browser-workspace-manager");
const { BrowserWorkspace } = require("./browser-workspace-manager");

test.after(() => fs.rmSync(agentBrowserHome, { recursive: true, force: true }));

function createFakeTimers() {
	const pending = new Map();
	let nextId = 1;
	return {
		pending,
		setTimeout(callback, ms) {
			const id = nextId++;
			pending.set(id, { callback, ms });
			return id;
		},
		clearTimeout(id) {
			pending.delete(id);
		},
		// Fires every pending timer whose delay is `ms`.
		fire(ms) {
			for (const [id, timer] of [...pending]) {
				if (timer.ms === ms) {
					pending.delete(id);
					timer.callback();
				}
			}
		},
	};
}

// Waits on a condition, turn by turn; the test's own timeout ends a wait that never comes
// true (on main a hung command never settles), so the test fails instead of hanging.
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function until(predicate) {
	while (!predicate()) await flush();
}

const outcomeOf = (promise) =>
	promise.then((value) => ({ settled: true, error: null, value }), (error) => ({ settled: true, error, value: undefined }));
const TEST_TIMEOUT = { timeout: 10_000 };

function createManager(timers) {
	return new BrowserWorkspaceManager({
		workspaceFactory: ({ workspaceId, sessionId, nowFn }) =>
			new BrowserWorkspace({
				workspaceId,
				sessionId,
				nowFn,
				delayFn: async () => {},
				runtimeFactory: ({ onCrash, viewport, deviceScaleFactor }) =>
					new AgentBrowserRuntime({ sessionId, viewport, deviceScaleFactor, onCrash, timers }),
			}),
	});
}

test("each agent-browser command class has a bound above agent-browser's own limits", () => {
	const { navigation, readOnly } = AGENT_BROWSER_CALL_TIMEOUT_MS;
	const cases = [
		[["open", "https://example.com"], navigation],
		[["tab", "new", "https://example.com"], navigation],
		[["reload"], navigation],
		[["back"], navigation],
		[["forward"], navigation],
		[["tab"], readOnly],
		[["snapshot", "-i"], readOnly],
		[["get", "text", "@e1"], readOnly],
		[["screenshot", "/tmp/x.png"], readOnly],
		[["stream", "status"], readOnly],
		[["tab", "close", 1], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
		[["close"], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
		[["click", "@e1"], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
		[["fill", "@e1", "x"], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
		[["stream", "enable"], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
		[[], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
	];
	for (const [args, expected] of cases) {
		assert.equal(resolveAgentBrowserCallTimeoutMs(args), expected, args.join(" "));
	}
	// The tool's own error path must win whenever the CLI answers.
	for (const [name, bound] of Object.entries(AGENT_BROWSER_CALL_TIMEOUT_MS)) {
		assert.ok(bound > AGENT_BROWSER_CLI_READ_TIMEOUT_MS, `${name} (${bound}) must exceed the CLI read timeout`);
		assert.ok(bound > AGENT_BROWSER_DAEMON_OPERATION_TIMEOUT_MS, `${name} must exceed the daemon operation timeout`);
	}
	assert.ok(navigation >= AGENT_BROWSER_CALL_TIMEOUT_MS.default);
	assert.ok(readOnly >= 2 * AGENT_BROWSER_CLI_READ_TIMEOUT_MS, "read-only commands are retried by the CLI");
});

test("a close queued behind a command that never answers completes once the command's bound passes", TEST_TIMEOUT, async () => {
	fakeAgentBrowser.reset();
	const timers = createFakeTimers();
	const manager = createManager(timers);
	const { workspaceId } = await manager.createWorkspace({ defaultUrl: "https://example.com" });
	const workspace = manager._workspaces.get(workspaceId);

	fakeAgentBrowser.hang.add("click");
	const click = manager.clickWorkspaceRef(workspaceId, "@e1");
	await fakeAgentBrowser.sent("click @e1");
	const closing = manager.deleteWorkspace(workspaceId);
	assert.equal(workspace.getLifecycle().status, "closing");

	timers.fire(AGENT_BROWSER_CALL_TIMEOUT_MS.default);
	const clickOutcome = await outcomeOf(click);
	assert.equal(clickOutcome.settled, true, "the hung click is given up");
	assert.equal(isAgentBrowserCallTimeoutError(clickOutcome.error), true);
	assert.equal(clickOutcome.error.code, "AGENT_BROWSER_CALL_TIMEOUT");
	assert.equal(clickOutcome.error.command, "click");
	assert.deepEqual(fakeAgentBrowser.kills, [{ command: "click @e1", signal: "SIGKILL" }]);

	const closeOutcome = await outcomeOf(closing);
	assert.equal(closeOutcome.settled, true, "the queued close completes");
	assert.equal(workspace.getLifecycle().status, "closed");
	assert.ok(fakeAgentBrowser.calls.includes("close"), "the release still sends close");
	assert.equal(manager._workspaces.has(workspaceId), false);
});

test("a ready workspace whose command never answers crashes and releases its slot", TEST_TIMEOUT, async () => {
	fakeAgentBrowser.reset();
	const timers = createFakeTimers();
	const manager = createManager(timers);
	const { workspaceId } = await manager.createWorkspace({ defaultUrl: "https://example.com" });
	const workspace = manager._workspaces.get(workspaceId);

	fakeAgentBrowser.hang.add("click");
	fakeAgentBrowser.hang.add("close");
	const click = manager.clickWorkspaceRef(workspaceId, "@e1");
	await fakeAgentBrowser.sent("click @e1");
	timers.fire(AGENT_BROWSER_CALL_TIMEOUT_MS.default);
	const clickOutcome = await outcomeOf(click);
	assert.equal(isAgentBrowserCallTimeoutError(clickOutcome.error), true);
	assert.equal(workspace.getLifecycle().status, "crashed");
	assert.equal(workspace.getUsage().status, "crashed", "a crashed workspace holds no slot");

	// The release sends close, which hangs too, and is bounded as well.
	await fakeAgentBrowser.sent("close");
	timers.fire(AGENT_BROWSER_CALL_TIMEOUT_MS.default);
	await until(() => timers.pending.size === 0);

	const later = await outcomeOf(manager.clickWorkspaceRef(workspaceId, "@e2"));
	assert.equal(later.error?.code, "BROWSER_WORKSPACE_CRASHED");
	assert.equal(fakeAgentBrowser.calls.includes("click @e2"), false, "no command reaches the crashed browser");
	assert.deepEqual(manager.listWorkspaces(), []);
});

test("a workspace whose first open never answers still sends close when it is released", TEST_TIMEOUT, async () => {
	fakeAgentBrowser.reset();
	const timers = createFakeTimers();
	const manager = createManager(timers);

	fakeAgentBrowser.hang.add("open");
	const create = manager.createWorkspace({ defaultUrl: "https://example.com" });
	await fakeAgentBrowser.sent("open https://example.com");
	timers.fire(AGENT_BROWSER_CALL_TIMEOUT_MS.navigation);

	const outcome = await outcomeOf(create);
	assert.equal(isAgentBrowserCallTimeoutError(outcome.error), true);
	assert.deepEqual(fakeAgentBrowser.kills, [{ command: "open https://example.com", signal: "SIGKILL" }]);
	// open started a browser in the daemon before it stopped answering; the release closes it.
	await fakeAgentBrowser.sent("close");
	assert.deepEqual(manager.listWorkspaces(), []);
});
