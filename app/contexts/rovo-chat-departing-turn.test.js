// Unit tests for stopDepartingRequest, the stop phase every thread change runs
// before it replaces the transcript. Provider-level behaviour: the
// context-rovo-chat-turn-*.behavior.test.js suites.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const { stopDepartingRequest } = loadCjsModuleFromText(esbuild.buildSync({
	entryPoints: [path.join(process.cwd(), "app/contexts/rovo-chat-departing-turn.ts")],
	bundle: true,
	format: "cjs",
	logLevel: "silent",
	platform: "node",
	write: false,
}).outputFiles[0].text, "rovo-chat-departing-turn.cjs");

function createOwner({ threadId = "t1", inFlight, live = inFlight }) {
	const calls = [];
	return {
		calls,
		owner: {
			threadId,
			isSendInFlight: () => {
				calls.push(`inFlight:${inFlight}`);
				return inFlight;
			},
			isRequestLive: () => {
				calls.push(`live:${live}`);
				return live;
			},
			endStoppedTurn: () => {
				calls.push("endStoppedTurn");
			},
			stopRequest: async () => {
				calls.push("stop");
			},
			waitForStreamStop: async () => {
				calls.push("waitForStop");
			},
			detachRun: async (id) => {
				calls.push(`detach:${id}`);
			},
		},
	};
}

// Regression: the stop phase reset the turn first, so a superseded change left
// the old transcript shown with its turn already gone.
test("a live request ends as a Stop ends it and is stopped before the run detaches; nothing resets the turn", async () => {
	const { owner, calls } = createOwner({ inFlight: true });
	await stopDepartingRequest(owner);
	assert.deepEqual(calls, ["inFlight:true", "live:true", "endStoppedTurn", "stop", "waitForStop", "detach:t1"]);
});

test("a turn waiting with no live request (a cut-short wait, a retry countdown) is stopped but not ended", async () => {
	const { owner, calls } = createOwner({ inFlight: true, live: false });
	await stopDepartingRequest(owner);
	assert.deepEqual(calls, ["inFlight:true", "live:false", "stop", "waitForStop", "detach:t1"]);
});

test("what is in flight is read when called, before the first await, so a reset right after cannot hide it", () => {
	const { owner, calls } = createOwner({ inFlight: true });
	void stopDepartingRequest(owner);
	assert.deepEqual(calls, ["inFlight:true", "live:true", "endStoppedTurn", "stop"]);
});

test("with nothing in flight the run detaches without a stop", async () => {
	const { owner, calls } = createOwner({ inFlight: false });
	await stopDepartingRequest(owner);
	assert.deepEqual(calls, ["inFlight:false", "detach:t1"]);
});

test("a failed stop still waits for the stream and detaches; no thread means no detach", async (t) => {
	t.mock.method(console, "warn", () => {});
	const { owner, calls } = createOwner({ threadId: null, inFlight: true });
	owner.stopRequest = async () => {
		calls.push("stop");
		throw new Error("stop failed");
	};
	owner.detachRun = async () => {
		throw new Error("detach must not run");
	};
	await stopDepartingRequest(owner);
	assert.deepEqual(calls, ["inFlight:true", "live:true", "endStoppedTurn", "stop", "waitForStop"]);
});
