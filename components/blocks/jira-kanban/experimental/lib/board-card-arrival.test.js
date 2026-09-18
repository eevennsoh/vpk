const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

async function loadArrivalHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export { resolveBoardCardArrival } from "./components/blocks/jira-kanban/experimental/lib/board-card-arrival";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "board-card-arrival-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text, "board-card-arrival-harness.cjs");
}

function arrival(overrides = {}) {
	return {
		id: 7,
		columnTitle: "In progress",
		cardCodes: ["PAY-1"],
		appended: true,
		...overrides,
	};
}

test("a card outside the live arrival stays at rest", async () => {
	const { resolveBoardCardArrival } = await loadArrivalHarness();

	assert.deepEqual(resolveBoardCardArrival(undefined, "PAY-1"), {
		arrivalId: undefined,
		entering: false,
		deferred: false,
		final: false,
	});
	assert.deepEqual(resolveBoardCardArrival(arrival(), "PAY-9"), {
		arrivalId: undefined,
		entering: false,
		deferred: false,
		final: false,
	});
});

test("a gap drop plays the same create entrance as a create-well drop", async () => {
	const { resolveBoardCardArrival } = await loadArrivalHarness();

	const createWell = resolveBoardCardArrival(arrival({ appended: true }), "PAY-1");
	const gapDrop = resolveBoardCardArrival(arrival({ appended: false }), "PAY-1");

	assert.equal(createWell.entering, true);
	assert.equal(gapDrop.entering, true);
	assert.equal(gapDrop.arrivalId, 7);
});

test("gap and create-well drops resolve to the same backdrop-free arrival", async () => {
	const { resolveBoardCardArrival } = await loadArrivalHarness();

	assert.deepEqual(
		resolveBoardCardArrival(arrival({ appended: false }), "PAY-1"),
		resolveBoardCardArrival(arrival({ appended: true }), "PAY-1"),
	);
	assert.equal("highlighted" in resolveBoardCardArrival(arrival({ appended: false }), "PAY-1"), false);
});

test("the last card of an arrival owns the completion handshake", async () => {
	const { resolveBoardCardArrival } = await loadArrivalHarness();
	const batch = arrival({ cardCodes: ["PAY-1", "PAY-2"] });

	assert.equal(resolveBoardCardArrival(batch, "PAY-1").final, false);
	assert.equal(resolveBoardCardArrival(batch, "PAY-1").entering, true);
	assert.equal(resolveBoardCardArrival(batch, "PAY-2").final, true);
});

test("a receipt defers only its arriving cards and preserves their completion ownership", async () => {
	const { resolveBoardCardArrival } = await loadArrivalHarness();
	const pending = arrival({ deferred: true });
	assert.equal(resolveBoardCardArrival(pending, "PAY-1").deferred, true);
	assert.equal(resolveBoardCardArrival(pending, "PAY-1").final, true);
	assert.equal(resolveBoardCardArrival(pending, "PAY-9").deferred, false);
	assert.equal(resolveBoardCardArrival({ ...pending, deferred: false }, "PAY-1").deferred, false);
});
