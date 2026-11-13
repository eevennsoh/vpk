"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createBackendProcess,
	createHttpServerShutdownSteps,
	createRuntimeShutdownSteps,
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

test("runtime steps abort in-flight runs, close every browser workspace, then shut the pool", async () => {
	const calls = [];
	const live = new AbortController();
	const alreadyAborted = new AbortController();
	alreadyAborted.abort();
	const activeRequests = new Map([
		["thread-1", { port: 4100, abortController: live }],
		["thread-2", { port: 4101, abortController: alreadyAborted }],
		["thread-3", { port: 4102 }],
	]);
	const steps = createRuntimeShutdownSteps({
		activeRequests,
		browserWorkspaceManager: {
			deleteWorkspace: async (workspaceId) => calls.push(["deleteWorkspace", workspaceId]),
			listWorkspaces: () => [{ workspaceId: "ws-1" }, { workspaceId: "ws-2" }],
		},
		shutdownRovoPool: () => calls.push(["shutdownRovoPool"]),
	});

	assert.deepEqual(steps.map(({ name }) => name), ["abort-runs", "close-browser-workspaces", "shutdown-rovo-pool"]);
	assert.equal(await steps[0].run(), "1 aborted");
	assert.equal(live.signal.aborted, true);
	assert.equal(await steps[0].run(), "0 aborted", "aborting twice is a no-op");
	assert.equal(await steps[1].run(), "2 closed");
	await steps[2].run();
	assert.deepEqual(calls, [["deleteWorkspace", "ws-1"], ["deleteWorkspace", "ws-2"], ["shutdownRovoPool"]]);
	assert.throws(() => createRuntimeShutdownSteps({}), /activeRequests/u);
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
