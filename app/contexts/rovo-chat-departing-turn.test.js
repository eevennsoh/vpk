// Unit tests for endDepartingTurn, the sequence every thread change runs before
// it replaces the transcript. Provider-level behaviour: the
// context-rovo-chat-turn-*.behavior.test.js suites.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const { endDepartingTurn } = loadCjsModuleFromText(esbuild.buildSync({
	entryPoints: [path.join(process.cwd(), "app/contexts/rovo-chat-departing-turn.ts")],
	bundle: true,
	format: "cjs",
	logLevel: "silent",
	platform: "node",
	write: false,
}).outputFiles[0].text, "rovo-chat-departing-turn.cjs");

function createOwner({ threadId = "t1", inFlight }) {
	const calls = [];
	let turnInFlight = inFlight;
	return {
		calls,
		owner: {
			threadId,
			isSendInFlight: () => {
				calls.push(`inFlight:${turnInFlight}`);
				return turnInFlight;
			},
			// The reset clears the turn state isSendInFlight reads.
			resetTurn: () => {
				calls.push("reset");
				turnInFlight = false;
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

// Regression: a request whose streaming status had not committed was not
// stopped, because only the committed flag was read (and after the reset).
test("a send in flight is read before the reset clears it, then stopped before the run detaches", async () => {
	const { owner, calls } = createOwner({ inFlight: true });
	await endDepartingTurn(owner);
	assert.deepEqual(calls, ["inFlight:true", "reset", "stop", "waitForStop", "detach:t1"]);
});

test("with nothing in flight the turn resets and the run detaches without a stop", async () => {
	const { owner, calls } = createOwner({ inFlight: false });
	await endDepartingTurn(owner);
	assert.deepEqual(calls, ["inFlight:false", "reset", "detach:t1"]);
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
	await endDepartingTurn(owner);
	assert.deepEqual(calls, ["inFlight:true", "reset", "stop", "waitForStop"]);
});
