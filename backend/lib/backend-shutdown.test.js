"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createBackendProcess,
	createHttpServerShutdownSteps,
	createRuntimeShutdownSteps,
	refuseRequestsWhileDraining,
} = require("./backend-shutdown");

function createDeferred() {
	let resolve;
	const promise = new Promise((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

// A timer the test fires by hand.
function createManualTimer() {
	const timers = [];
	return {
		clearTimer: (handle) => {
			handle.cleared = true;
		},
		fire: () => {
			for (const handle of timers.filter((entry) => !entry.cleared)) {
				handle.cleared = true;
				handle.callback();
			}
		},
		setTimer: (callback, ms) => {
			const handle = { callback, cleared: false, ms };
			timers.push(handle);
			return handle;
		},
		timers,
	};
}

function createHarness({ steps, timeoutMs = 5000 } = {}) {
	const events = [];
	const exits = [];
	const timer = createManualTimer();
	const exited = createDeferred();
	const backendProcess = createBackendProcess({
		clearTimer: timer.clearTimer,
		exit: (code) => {
			exits.push(code);
			exited.resolve(code);
		},
		getSteps: () => steps(events),
		logger: {
			error: (message) => events.push(["error", message]),
			log: (message) => events.push(["log", message]),
		},
		setTimer: timer.setTimer,
		timeoutMs,
	});
	return { backendProcess, events, exited: exited.promise, exits, timer };
}

const step = (name, run = () => undefined) => ({ name, run });
const recordingStep = (name) => (events) => step(name, () => {
	events.push(["run", name]);
});
const logs = (events) => events.filter(([kind]) => kind !== "run").map(([, message]) => message);

test("a signal runs every step once, in order, then exits 0", async () => {
	const { backendProcess, events, exited, exits, timer } = createHarness({
		steps: (events) => ["stop-accepting", "abort-runs", "close-browser-workspaces", "shutdown-rovo-pool", "close-connections"]
			.map((name) => recordingStep(name)(events)),
	});
	assert.equal(backendProcess.markListening(), true);
	backendProcess.handleSignal("SIGTERM");
	assert.equal(backendProcess.getStatus(), "draining");

	assert.equal(await exited, 0);
	assert.deepEqual(events.filter(([kind]) => kind === "run").map(([, name]) => name), [
		"stop-accepting",
		"abort-runs",
		"close-browser-workspaces",
		"shutdown-rovo-pool",
		"close-connections",
	]);
	assert.equal(logs(events).at(-1), "[SHUTDOWN] complete; exiting 0");
	assert.deepEqual(exits, [0]);
	assert.equal(backendProcess.getStatus(), "stopped");
	assert.equal(timer.timers.length, 1);
	assert.equal(timer.timers[0].ms, 5000);
	assert.equal(timer.timers[0].cleared, true, "the overall timer is cleared on a clean exit");
});

test("a second signal while draining does not restart the sequence; a third forces exit 1", async () => {
	const blocked = createDeferred();
	let abortRuns = 0;
	const { backendProcess, events, exits } = createHarness({
		steps: () => [
			step("stop-accepting"),
			step("abort-runs", () => {
				abortRuns += 1;
				return blocked.promise;
			}),
			step("shutdown-rovo-pool"),
		],
	});
	backendProcess.handleSignal("SIGTERM");
	await Promise.resolve();
	backendProcess.handleSignal("SIGTERM");
	assert.equal(abortRuns, 1);
	assert.deepEqual(exits, []);
	assert.match(logs(events).at(-1), /SIGTERM again: already draining/u);

	backendProcess.handleSignal("SIGINT");
	assert.deepEqual(exits, [1]);
	assert.equal(logs(events).at(-1), "[SHUTDOWN] SIGINT received 3 times; still open: abort-runs, shutdown-rovo-pool; exiting 1");

	// The step that was blocked finishing later changes nothing.
	blocked.resolve();
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(exits, [1]);
	assert.equal(abortRuns, 1);
});

test("the overall timeout exits 1 and names what was still open", async () => {
	const never = new Promise(() => {});
	const { backendProcess, events, exits, timer } = createHarness({
		steps: () => [step("stop-accepting"), step("close-browser-workspaces", () => never), step("close-connections")],
		timeoutMs: 1234,
	});
	backendProcess.handleSignal("SIGTERM");
	await Promise.resolve();
	timer.fire();
	assert.deepEqual(exits, [1]);
	assert.equal(
		logs(events).at(-1),
		"[SHUTDOWN] timed out after 1234ms; still open: close-browser-workspaces, close-connections; exiting 1",
	);
	backendProcess.handleSignal("SIGTERM");
	assert.deepEqual(exits, [1], "a signal after stop does nothing");
});

test("a failing step is logged and the next step still runs", async () => {
	const ran = [];
	const { backendProcess, events, exited } = createHarness({
		steps: () => [
			step("abort-runs", () => {
				throw new Error("boom");
			}),
			step("shutdown-rovo-pool", () => {
				ran.push("shutdown-rovo-pool");
			}),
		],
	});
	backendProcess.handleSignal("SIGTERM");
	assert.equal(await exited, 0);
	assert.deepEqual(ran, ["shutdown-rovo-pool"]);
	assert.ok(events.some(([kind, message]) => kind === "error" && message === "[SHUTDOWN] abort-runs: failed: boom"));
});

test("a signal during startup drains, and listen completing afterwards must not serve", async () => {
	const { backendProcess, exited } = createHarness({ steps: () => [step("stop-accepting")] });
	assert.equal(backendProcess.isStarting(), true);
	backendProcess.handleSignal("SIGTERM");
	assert.equal(backendProcess.isStarting(), false);
	assert.equal(backendProcess.markListening(), false);
	assert.equal(await exited, 0);
});

test("runtime steps abort runs, close workspaces, mirrors and the preview in order, then shut the pool", async () => {
	const calls = [];
	const live = new AbortController();
	const alreadyAborted = new AbortController();
	alreadyAborted.abort();
	const activeRequests = new Map([
		["thread-1", { port: 4100, abortController: live }],
		["thread-2", { port: 4101, abortController: alreadyAborted }],
		["thread-3", { port: 4102 }],
	]);
	// Fakes that, like the real owners, find nothing left on a second call.
	let workspaces = ["ws-1", "ws-2"];
	let mirrors = 1;
	let previewOpen = true;
	const steps = createRuntimeShutdownSteps({
		activeRequests,
		browserWorkspaceManager: {
			closeAllWorkspaces: async () => {
				calls.push(["closeAllWorkspaces"]);
				const closed = workspaces.length;
				workspaces = [];
				return closed;
			},
		},
		chromiumPreviewManager: {
			close: async () => {
				calls.push(["closeChromiumPreview"]);
				const wasOpen = previewOpen;
				previewOpen = false;
				return wasOpen;
			},
		},
		closeAllMirrorBrowsers: async () => {
			calls.push(["closeAllMirrorBrowsers"]);
			const closed = mirrors;
			mirrors = 0;
			return closed;
		},
		shutdownRovoPool: () => calls.push(["shutdownRovoPool"]),
	});

	assert.deepEqual(steps.map(({ name }) => name), [
		"abort-runs",
		"close-browser-workspaces",
		"close-mirror-browsers",
		"close-chromium-preview",
		"shutdown-rovo-pool",
	]);
	const details = [];
	for (const step of steps) details.push(await step.run());
	assert.deepEqual(details, ["1 aborted", "2 closed", "1 closed", "closed", undefined]);
	assert.equal(live.signal.aborted, true);
	assert.deepEqual(calls, [
		["closeAllWorkspaces"],
		["closeAllMirrorBrowsers"],
		["closeChromiumPreview"],
		["shutdownRovoPool"],
	]);

	// Run again: every step is a no-op.
	const again = [];
	for (const step of steps.slice(0, 4)) again.push(await step.run());
	assert.deepEqual(again, ["0 aborted", "0 closed", "0 closed", "none open"]);
	assert.throws(() => createRuntimeShutdownSteps({}), /activeRequests/u);
	assert.throws(
		() => createRuntimeShutdownSteps({ activeRequests, browserWorkspaceManager: { closeAllWorkspaces() {} }, shutdownRovoPool() {} }),
		/closeAllMirrorBrowsers/u,
	);
});

test("refuseRequestsWhileDraining passes requests through until the drain begins", () => {
	let draining = false;
	const handled = [];
	const handler = refuseRequestsWhileDraining((req) => handled.push(req.url), { isDraining: () => draining });
	const response = () => {
		const res = { head: null, body: null };
		res.writeHead = (status, headers) => {
			res.head = { status, headers };
		};
		res.end = (body) => {
			res.body = body;
		};
		return res;
	};

	const before = response();
	handler({ url: "/before" }, before);
	draining = true;
	const during = response();
	handler({ url: "/during" }, during);

	assert.deepEqual(handled, ["/before"]);
	assert.equal(before.head, null);
	assert.equal(during.head.status, 503);
	assert.equal(during.head.headers.Connection, "close");
	assert.deepEqual(JSON.parse(during.body), { error: "The backend is shutting down." });
});

test("server steps close the listener first and the remaining sockets last", async () => {
	const calls = [];
	let closeCallback = null;
	const server = {
		close: (callback) => {
			calls.push("close");
			closeCallback = callback;
		},
		closeAllConnections: () => {
			calls.push("closeAllConnections");
			closeCallback();
		},
		closeIdleConnections: () => calls.push("closeIdleConnections"),
		listening: true,
	};
	const client = { terminate: () => calls.push("terminate") };
	const { stopAccepting, closeConnections } = createHttpServerShutdownSteps({
		getServer: () => server,
		getWebSocketServers: () => [{ clients: new Set([client]) }, { clients: new Set() }],
	});

	assert.equal(stopAccepting.run(), "listener closed");
	assert.deepEqual(calls, ["close", "closeIdleConnections"]);
	assert.equal(await closeConnections.run(), "1 websocket(s) closed");
	assert.deepEqual(calls, ["close", "closeIdleConnections", "terminate", "closeAllConnections"]);

	const idle = createHttpServerShutdownSteps({ getServer: () => null });
	assert.equal(idle.stopAccepting.run(), "not listening");
	assert.equal(await idle.closeConnections.run(), "0 websocket(s) closed");
});

test("closing connections stops the WebSocket heartbeat first", async () => {
	const order = [];
	const steps = createHttpServerShutdownSteps({
		getServer: () => null,
		getWebSocketServers: () => [{ clients: new Set([{ terminate: () => order.push("terminate") }]) }],
		getStopHeartbeat: () => () => order.push("stop-heartbeat"),
	});
	assert.equal(await steps.closeConnections.run(), "1 websocket(s) closed");
	assert.deepEqual(order, ["stop-heartbeat", "terminate"]);
});
