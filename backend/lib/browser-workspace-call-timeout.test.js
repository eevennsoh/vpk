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
};
childProcess.execFile = (file, args, options, callback) => {
	const command = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--session").join(" ");
	fakeAgentBrowser.calls.push(command);
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

const flush = () => new Promise((resolve) => setImmediate(resolve));
async function until(predicate, label) {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		if (predicate()) return;
		await flush();
	}
	assert.fail(`never happened: ${label}`);
}

// The outcome of a promise once pending work has run, without waiting on it forever (on
// main a hung command never settles, and the test must fail, not hang).
async function outcomeOf(promise) {
	const outcome = { settled: false, error: null, value: undefined };
	promise.then(
		(value) => Object.assign(outcome, { settled: true, value }),
		(error) => Object.assign(outcome, { settled: true, error }),
	);
	await until(() => outcome.settled, "the call settles").catch(() => {});
	return outcome;
}

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

test("each agent-browser command class has its own bound, longest for open", () => {
	const cases = [
		[["open", "https://example.com"], AGENT_BROWSER_CALL_TIMEOUT_MS.open],
		[["tab", "new", "https://example.com"], AGENT_BROWSER_CALL_TIMEOUT_MS.open],
		[["tab"], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
		[["tab", "close", 1], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
		[["close"], AGENT_BROWSER_CALL_TIMEOUT_MS.close],
		[["click", "@e1"], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
		[["screenshot", "/tmp/x.png"], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
		[[], AGENT_BROWSER_CALL_TIMEOUT_MS.default],
	];
	for (const [args, expected] of cases) {
		assert.equal(resolveAgentBrowserCallTimeoutMs(args), expected, args.join(" "));
	}
	assert.ok(AGENT_BROWSER_CALL_TIMEOUT_MS.open > AGENT_BROWSER_CALL_TIMEOUT_MS.default);
});

test("a close queued behind a command that never answers completes once the command's bound passes", async () => {
	fakeAgentBrowser.hang.clear();
	fakeAgentBrowser.calls.length = 0;
	const timers = createFakeTimers();
	const manager = createManager(timers);
	const { workspaceId } = await manager.createWorkspace({ defaultUrl: "https://example.com" });
	const workspace = manager._workspaces.get(workspaceId);

	fakeAgentBrowser.hang.add("click");
	const click = manager.clickWorkspaceRef(workspaceId, "@e1");
	await until(() => fakeAgentBrowser.calls.includes("click @e1"), "click sent");
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

test("a ready workspace whose command never answers crashes and releases its slot", async () => {
	fakeAgentBrowser.hang.clear();
	fakeAgentBrowser.calls.length = 0;
	fakeAgentBrowser.kills.length = 0;
	const timers = createFakeTimers();
	const manager = createManager(timers);
	const { workspaceId } = await manager.createWorkspace({ defaultUrl: "https://example.com" });
	const workspace = manager._workspaces.get(workspaceId);

	fakeAgentBrowser.hang.add("click");
	fakeAgentBrowser.hang.add("close");
	const click = manager.clickWorkspaceRef(workspaceId, "@e1");
	await until(() => fakeAgentBrowser.calls.includes("click @e1"), "click sent");
	timers.fire(AGENT_BROWSER_CALL_TIMEOUT_MS.default);
	const clickOutcome = await outcomeOf(click);
	assert.equal(isAgentBrowserCallTimeoutError(clickOutcome.error), true);
	assert.equal(workspace.getLifecycle().status, "crashed");
	assert.equal(workspace.getUsage().status, "crashed", "a crashed workspace holds no slot");

	// The release sends close, which hangs too, and is bounded as well.
	await until(() => fakeAgentBrowser.calls.includes("close"), "release sends close");
	timers.fire(AGENT_BROWSER_CALL_TIMEOUT_MS.close);
	await until(() => timers.pending.size === 0, "no timer left");

	const later = await outcomeOf(manager.clickWorkspaceRef(workspaceId, "@e2"));
	assert.equal(later.error?.code, "BROWSER_WORKSPACE_CRASHED");
	assert.equal(fakeAgentBrowser.calls.includes("click @e2"), false, "no command reaches the crashed browser");
	assert.deepEqual(manager.listWorkspaces(), []);
});

test("a workspace whose first open never answers still sends close when it is released", async () => {
	fakeAgentBrowser.hang.clear();
	fakeAgentBrowser.calls.length = 0;
	fakeAgentBrowser.kills.length = 0;
	const timers = createFakeTimers();
	const manager = createManager(timers);

	fakeAgentBrowser.hang.add("open");
	const create = manager.createWorkspace({ defaultUrl: "https://example.com" });
	await until(() => fakeAgentBrowser.calls.includes("open https://example.com"), "open sent");
	timers.fire(AGENT_BROWSER_CALL_TIMEOUT_MS.open);

	const outcome = await outcomeOf(create);
	assert.equal(isAgentBrowserCallTimeoutError(outcome.error), true);
	assert.deepEqual(fakeAgentBrowser.kills, [{ command: "open https://example.com", signal: "SIGKILL" }]);
	// open started a browser in the daemon before it stopped answering; the release closes it.
	await until(() => fakeAgentBrowser.calls.includes("close"), "release sends close");
	assert.deepEqual(manager.listWorkspaces(), []);
});
