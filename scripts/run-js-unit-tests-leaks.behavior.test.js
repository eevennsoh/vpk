// Seeds a suite that leaks a child process and checks that the unit runner fails its batch, names
// the child's command line, and kills it. Every process here is started by this file and is gone
// when it ends.

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { findMarkedProcesses } = require("./lib/test-process.js");

const runnerModule = import("./run-js-unit-tests.mjs");

// The leak check reads the process table, which agent sandboxes deny.
const processTableReadable = findMarkedProcesses("probe") !== null;
const SKIP = processTableReadable ? false : "needs a readable process table (blocked in agent sandboxes)";

function seedSuites(t) {
	const dir = mkdtempSync(path.join(tmpdir(), "unit-leak-test-"));
	const tag = `seeded-leak-${randomUUID()}`;
	const leaky = path.join(dir, "leaky.test.js");
	writeFileSync(leaky, `const { spawn } = require("node:child_process");
const test = require("node:test");
test("leaves a detached child running", () => {
	spawn(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)", ${JSON.stringify(tag)}], { detached: true, stdio: "ignore" }).unref();
});
`);
	const clean = path.join(dir, "clean", "clean.test.js");
	require("node:fs").mkdirSync(path.dirname(clean));
	writeFileSync(clean, `const { spawnSync } = require("node:child_process");
const test = require("node:test");
test("runs a child to completion", () => {
	spawnSync(process.execPath, ["-e", "0"]);
});
`);
	// Inside a node:test file NODE_TEST_CONTEXT is set, and a nested `node --test` that inherits it
	// runs nothing. The runner's batches must behave as they do from the command line.
	const testContext = process.env.NODE_TEST_CONTEXT;
	delete process.env.NODE_TEST_CONTEXT;
	t.after(() => {
		if (testContext !== undefined) process.env.NODE_TEST_CONTEXT = testContext;
		rmSync(dir, { recursive: true, force: true });
	});
	return { clean, leaky, tag };
}

function tagStillRunning(tag) {
	const { spawnSync } = require("node:child_process");
	return spawnSync("pgrep", ["-f", tag], { encoding: "utf8" }).stdout.trim() !== "";
}

test("a batch that leaves a child running fails, names the command, and the child is killed", { skip: SKIP }, async (t) => {
	const { runTestFiles } = await runnerModule;
	const { clean, leaky, tag } = seedSuites(t);
	const lines = [];
	const { status, timings } = runTestFiles([clean, leaky], { keepGoing: true, log: (line) => lines.push(line) });

	assert.equal(status, 1);
	const byId = Object.fromEntries(timings.map((timing) => [timing.id, timing.status]));
	assert.equal(byId[path.dirname(clean)], 0, "the clean batch passes with the check on");
	assert.equal(byId[path.dirname(leaky)], 1, "the leaking batch fails");
	const report = lines.find((line) => line.includes("left 1 process(es) running"));
	assert.ok(report, lines.join("\n"));
	assert.ok(report.includes(tag), report);
	assert.equal(tagStillRunning(tag), false);
});

test("parallel batches report the leak in the batch's own output", { skip: SKIP }, async (t) => {
	const { runTestFilesParallel } = await runnerModule;
	const { clean, leaky, tag } = seedSuites(t);
	let output = "";
	const { status } = await runTestFilesParallel([clean, leaky], {
		cpus: 2,
		keepGoing: true,
		log: () => {},
		parallel: 2,
		write: (text) => { output += text; },
	});

	assert.equal(status, 1);
	assert.match(output, new RegExp(`left 1 process\\(es\\) running[\\s\\S]*${tag}`, "u"));
	assert.equal(tagStillRunning(tag), false);
});
