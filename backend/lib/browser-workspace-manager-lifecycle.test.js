"use strict";

// Lifecycle behaviour of real BrowserWorkspace and BrowserWorkspaceManager
// instances over a fake browser launcher (no Chromium). The pure transition
// table is in browser-workspace-lifecycle.test.js.

const test = require("node:test");
const assert = require("node:assert/strict");

const { BrowserWorkspace, BrowserWorkspaceManager } = require("./browser-workspace-manager");

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

// A fake launcher: each runtime records the commands it ran, can hold close
// open until released, can fail a command, and hands the workspace's crash
// callback back to the test.
function createFakeLauncher() {
	const runtimes = [];
	const launcher = {
		runtimes,
		events: [],
		closeGate: null,
		failInitialize: null,
		failClick: null,
		factory({ workspaceId, onCrash }) {
			const runtime = {
				workspaceId,
				calls: [],
				closeCount: 0,
				crash: (reason) => onCrash?.(reason),
				async initialize(url) {
					runtime.calls.push(["initialize", url]);
					launcher.events.push(`initialize ${workspaceId}`);
					if (launcher.failInitialize) {
						throw launcher.failInitialize;
					}
				},
				async getState() {
					return {
						activeTabIndex: 0,
						tabs: [{ index: 0, title: "", url: "about:blank", active: true }],
					};
				},
				async navigate(url) {
					runtime.calls.push(["navigate", url]);
				},
				async click(x, y) {
					runtime.calls.push(["click", x, y]);
					if (launcher.failClick) {
						throw launcher.failClick;
					}
				},
				isScreencasting: () => false,
				async startScreencast() {},
				async stopScreencast() {},
				async close() {
					runtime.closeCount += 1;
					runtime.calls.push(["close"]);
					launcher.events.push(`close ${workspaceId}`);
					if (launcher.closeGate) {
						await launcher.closeGate.promise;
					}
				},
			};
			runtimes.push(runtime);
			return runtime;
		},
	};
	return launcher;
}

function createManager(launcher, options = {}) {
	const manager = new BrowserWorkspaceManager({
		cleanupIntervalMs: 1_000_000,
		...options,
		workspaceFactory: ({ workspaceId, sessionId }) =>
			new BrowserWorkspace({
				workspaceId,
				sessionId,
				delayFn: async () => {},
				nowFn: options.nowFn,
				runtimeFactory: (args) => launcher.factory(args),
			}),
	});
	return manager;
}

async function rejectionCode(promiseOrFn) {
	try {
		await (typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn);
	} catch (error) {
		return error?.code ?? `untyped: ${error?.message}`;
	}
	return "resolved";
}

test("concurrent deletes share one close and both resolve after it finishes", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher);
	t.after(() => clearInterval(manager._cleanupTimer));
	const { workspaceId } = await manager.createWorkspace();

	launcher.closeGate = deferred();
	let closeFinished = false;
	const first = manager.deleteWorkspace(workspaceId).then((result) => ({ result, closeFinished }));
	const second = manager.deleteWorkspace(workspaceId).then((result) => ({ result, closeFinished }));
	// Let both calls reach the close before releasing it.
	await new Promise(setImmediate);
	closeFinished = true;
	launcher.closeGate.resolve();

	const [a, b] = await Promise.all([first, second]);
	assert.deepEqual(a, { result: { workspaceId, closed: true }, closeFinished: true });
	assert.deepEqual(b, { result: { workspaceId, closed: true }, closeFinished: true });
	assert.equal(launcher.runtimes[0].closeCount, 1);
	assert.deepEqual(manager.listWorkspaces(), []);
});

test("closing every workspace waits for a close another caller already started", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher);
	t.after(() => clearInterval(manager._cleanupTimer));
	const { workspaceId } = await manager.createWorkspace();

	launcher.closeGate = deferred();
	let closeFinished = false;
	const userDelete = manager.deleteWorkspace(workspaceId);
	const shutdown = manager.closeAllWorkspaces().then((count) => ({ count, closeFinished }));
	await new Promise(setImmediate);
	closeFinished = true;
	launcher.closeGate.resolve();

	assert.deepEqual(await shutdown, { count: 1, closeFinished: true });
	await userDelete;
	assert.equal(launcher.runtimes[0].closeCount, 1);
});

test("calls on a closing workspace get a typed rejection and never reach the browser", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher);
	t.after(() => clearInterval(manager._cleanupTimer));
	const { workspaceId } = await manager.createWorkspace();

	launcher.closeGate = deferred();
	const closing = manager.deleteWorkspace(workspaceId);
	assert.equal(await rejectionCode(() => manager.navigateWorkspace(workspaceId, "https://example.com")), "BROWSER_WORKSPACE_CLOSING");
	assert.equal(await rejectionCode(() => manager.getWorkspaceStream(workspaceId)), "BROWSER_WORKSPACE_CLOSING");
	launcher.closeGate.resolve();
	await closing;

	assert.equal(await rejectionCode(() => manager.navigateWorkspace(workspaceId, "https://example.com")), "BROWSER_WORKSPACE_NOT_FOUND");
	assert.equal(launcher.runtimes[0].calls.some(([name]) => name === "navigate"), false);
});

test("a call that was queued before a close is rejected instead of running on the closed browser", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher);
	t.after(() => clearInterval(manager._cleanupTimer));
	const { workspaceId } = await manager.createWorkspace();
	const runtime = launcher.runtimes[0];

	const started = deferred();
	const gate = deferred();
	const slowNavigate = runtime.navigate;
	runtime.navigate = async (url) => {
		started.resolve();
		await gate.promise;
		return slowNavigate(url);
	};
	const inFlight = manager.navigateWorkspace(workspaceId, "https://first.example");
	const queued = manager.navigateWorkspace(workspaceId, "https://second.example");
	await started.promise;
	const closing = manager.deleteWorkspace(workspaceId);
	gate.resolve();

	assert.equal(await rejectionCode(inFlight), "resolved");
	assert.equal(await rejectionCode(queued), "BROWSER_WORKSPACE_CLOSING");
	await closing;
	assert.deepEqual(
		runtime.calls.map(([name, arg]) => (arg ? `${name} ${arg}` : name)),
		["initialize about:blank", "navigate https://first.example/", "close"],
	);
});

test("a held workspace reference cannot relaunch a browser after close", async () => {
	const launcher = createFakeLauncher();
	const workspace = new BrowserWorkspace({
		workspaceId: "held",
		sessionId: "held",
		delayFn: async () => {},
		runtimeFactory: (args) => launcher.factory(args),
	});
	await workspace.initialize();
	await workspace.close();

	assert.equal(await rejectionCode(workspace.navigate("https://example.com")), "BROWSER_WORKSPACE_CLOSED");
	assert.equal(await rejectionCode(workspace.screenshot()), "BROWSER_WORKSPACE_CLOSED");
	assert.deepEqual(launcher.runtimes[0].calls.map(([name]) => name), ["initialize", "close"]);
});

test("a crash moves the workspace to crashed once and releases what it held", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher);
	t.after(() => clearInterval(manager._cleanupTimer));
	const { workspaceId } = await manager.createWorkspace();
	const runtime = launcher.runtimes[0];

	runtime.crash("browser process exited");
	runtime.crash("browser process exited again");
	assert.equal(await rejectionCode(() => manager.getWorkspaceState(workspaceId)), "BROWSER_WORKSPACE_CRASHED");
	assert.deepEqual(manager.listWorkspaces(), []);

	// Release runs once; a delete afterwards removes the entry without a second close.
	assert.deepEqual(await manager.deleteWorkspace(workspaceId), { workspaceId, closed: true });
	assert.equal(runtime.closeCount, 1);
	assert.equal(await rejectionCode(() => manager.getWorkspaceState(workspaceId)), "BROWSER_WORKSPACE_NOT_FOUND");
});

test("concurrent close and crash release the browser once", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher);
	t.after(() => clearInterval(manager._cleanupTimer));
	const { workspaceId } = await manager.createWorkspace();
	const runtime = launcher.runtimes[0];

	const closing = manager.deleteWorkspace(workspaceId);
	runtime.crash("exited during close");
	await closing;
	assert.equal(runtime.closeCount, 1);
});

test("a launch failure is reported to the creator and leaves nothing behind", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher);
	t.after(() => clearInterval(manager._cleanupTimer));
	launcher.failInitialize = new Error("Chrome exited early");

	await assert.rejects(manager.createWorkspace(), /Chrome exited early/);
	assert.deepEqual(manager.listWorkspaces(), []);
	assert.equal(launcher.runtimes[0].closeCount, 1);
});

test("a failed preview control action does not become an unhandled rejection", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher);
	t.after(() => clearInterval(manager._cleanupTimer));
	const { workspaceId } = await manager.createWorkspace();

	const unhandled = [];
	const onUnhandled = (reason) => unhandled.push(reason);
	process.on("unhandledRejection", onUnhandled);
	t.after(() => process.off("unhandledRejection", onUnhandled));

	launcher.failClick = new Error("agent-browser click failed");
	manager.handleWorkspacePreviewControlMessage(workspaceId, { type: "preview-click", x: 10, y: 20 });
	// The click runs on the workspace queue; a later queued read waits for it.
	await manager.getWorkspaceState(workspaceId);
	await new Promise(setImmediate);

	assert.deepEqual(unhandled.map((reason) => reason?.message), []);
});

// A preview WebSocket client: the workspace has a watcher, so it is in use.
const fakeClient = () => ({ readyState: 1, send() {} });

async function createWatched(manager) {
	const state = await manager.createWorkspace();
	await manager.attachWorkspacePreviewClient(state.workspaceId, fakeClient());
	return state;
}

test("creating past the cap when every workspace is watched is a typed rejection that launches nothing", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher, { maxLiveWorkspaces: 2 });
	t.after(() => clearInterval(manager._cleanupTimer));
	const first = await createWatched(manager);
	await createWatched(manager);

	assert.equal(await rejectionCode(manager.createWorkspace()), "BROWSER_WORKSPACE_LIMIT");
	assert.equal(launcher.runtimes.length, 2);

	// A closing workspace still holds its browser, so it still counts.
	launcher.closeGate = deferred();
	const closing = manager.deleteWorkspace(first.workspaceId);
	assert.equal(await rejectionCode(manager.createWorkspace()), "BROWSER_WORKSPACE_LIMIT");
	launcher.closeGate.resolve();
	await closing;

	await manager.createWorkspace();
	assert.equal(launcher.runtimes.length, 3);
});

test("at the cap, the least recently used workspace nobody watches is closed and the create proceeds", async (t) => {
	let now = 1_000;
	const launcher = createFakeLauncher();
	const warnings = [];
	const manager = createManager(launcher, { maxLiveWorkspaces: 3, nowFn: () => now, logger: { warn: (line) => warnings.push(line) } });
	t.after(() => clearInterval(manager._cleanupTimer));
	const watched = await createWatched(manager); // oldest, but a page is watching it
	now += 10;
	const abandoned = await manager.createWorkspace(); // a reloaded page's leftover
	now += 10;
	const recent = await manager.createWorkspace();
	now += 10;

	const created = await manager.createWorkspace();
	const closedIds = launcher.runtimes.filter((runtime) => runtime.closeCount > 0).map((runtime) => runtime.workspaceId);
	assert.deepEqual(closedIds, [abandoned.workspaceId]);
	assert.deepEqual(
		manager.listWorkspaces().map(({ workspaceId }) => workspaceId).sort(),
		[watched.workspaceId, recent.workspaceId, created.workspaceId].sort(),
	);
	assert.equal(warnings.length, 1);
	// The reclaimed browser was released before its replacement launched.
	assert.deepEqual(launcher.events.slice(-2), [`close ${abandoned.workspaceId}`, `initialize ${created.workspaceId}`]);
	assert.equal(await rejectionCode(() => manager.getWorkspaceState(abandoned.workspaceId)), "BROWSER_WORKSPACE_NOT_FOUND");
});

test("a workspace with a call in flight is not reclaimed", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher, { maxLiveWorkspaces: 1 });
	t.after(() => clearInterval(manager._cleanupTimer));
	const { workspaceId } = await manager.createWorkspace();
	const runtime = launcher.runtimes[0];
	const started = deferred();
	const gate = deferred();
	runtime.navigate = async () => {
		started.resolve();
		await gate.promise;
	};
	const navigating = manager.navigateWorkspace(workspaceId, "https://example.com");
	await started.promise;

	assert.equal(await rejectionCode(manager.createWorkspace()), "BROWSER_WORKSPACE_LIMIT");
	gate.resolve();
	await navigating;
	assert.equal(runtime.closeCount, 0);
});

test("two concurrent creates at the cap reclaim two different workspaces, or one is refused", async (t) => {
	let now = 1_000;
	const launcher = createFakeLauncher();
	const manager = createManager(launcher, { maxLiveWorkspaces: 2, nowFn: () => now, logger: { warn() {} } });
	t.after(() => clearInterval(manager._cleanupTimer));
	const a = await manager.createWorkspace();
	now += 10;
	const b = await manager.createWorkspace();
	now += 10;

	const both = await Promise.all([rejectionCode(manager.createWorkspace()), rejectionCode(manager.createWorkspace())]);
	assert.deepEqual(both, ["resolved", "resolved"]);
	const closed = launcher.runtimes.filter((runtime) => runtime.closeCount > 0).map((runtime) => runtime.workspaceId).sort();
	assert.deepEqual(closed, [a.workspaceId, b.workspaceId].sort());
	assert.equal(launcher.runtimes.every((runtime) => runtime.closeCount <= 1), true);

	// Only one abandoned workspace left: one create reclaims it, the other is refused.
	const [watchedNew] = manager.listWorkspaces();
	await manager.attachWorkspacePreviewClient(watchedNew.workspaceId, fakeClient());
	const next = await Promise.all([rejectionCode(manager.createWorkspace()), rejectionCode(manager.createWorkspace())]);
	assert.deepEqual(next.sort(), ["BROWSER_WORKSPACE_LIMIT", "resolved"]);
});

test("concurrent creates cannot overshoot the cap", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher, { maxLiveWorkspaces: 2, logger: { warn() {} } });
	t.after(() => clearInterval(manager._cleanupTimer));

	// None exist yet, so nothing can be reclaimed: two launch, the third is refused.
	const results = await Promise.all([1, 2, 3].map(() => rejectionCode(manager.createWorkspace())));
	assert.deepEqual(results.sort(), ["BROWSER_WORKSPACE_LIMIT", "resolved", "resolved"]);
	assert.equal(launcher.runtimes.length, 2);
});

test("a crashed workspace does not count against the cap and is swept when idle", async (t) => {
	let now = 1_000;
	const launcher = createFakeLauncher();
	const manager = createManager(launcher, { maxLiveWorkspaces: 1, idleTimeoutMs: 10, nowFn: () => now });
	t.after(() => clearInterval(manager._cleanupTimer));
	const { workspaceId } = await manager.createWorkspace();
	launcher.runtimes[0].crash("exited");

	await manager.createWorkspace();
	now += 50;
	const swept = await manager.cleanupIdleWorkspaces();
	assert.equal(swept.includes(workspaceId), true);
	assert.equal(await rejectionCode(() => manager.getWorkspaceState(workspaceId)), "BROWSER_WORKSPACE_NOT_FOUND");
	assert.equal(launcher.runtimes[0].closeCount, 1);
});

test("a close during launch stops the launch before it starts a browser", async (t) => {
	const launcher = createFakeLauncher();
	const manager = createManager(launcher);
	t.after(() => clearInterval(manager._cleanupTimer));

	const creating = rejectionCode(manager.createWorkspace());
	assert.equal(await manager.closeAllWorkspaces(), 1);
	assert.equal(await creating, "BROWSER_WORKSPACE_CLOSING");
	assert.deepEqual(launcher.runtimes[0].calls.map(([name]) => name), ["close"]);
	assert.deepEqual(manager.listWorkspaces(), []);
});
