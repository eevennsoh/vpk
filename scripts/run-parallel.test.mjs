import assert from "node:assert/strict";
import test from "node:test";

import { runParallel } from "./run-parallel.mjs";

test("every command runs concurrently, a failure does not skip the others, and the summary names it", async () => {
	let active = 0;
	let peak = 0;
	const run = async (command) => {
		active += 1;
		peak = Math.max(peak, active);
		await new Promise((resolve) => setImmediate(resolve));
		active -= 1;
		return { seconds: 1.5, status: command.includes("lint") ? 1 : 0, stderr: "", stdout: `${command} output\n` };
	};
	let text = "";
	const result = await runParallel(["pnpm run verify:fast", "pnpm run lint", "pnpm run typecheck", "pnpm run test:unit:js"], {
		run, write: (chunk) => { text += chunk; },
	});
	assert.equal(peak, 4);
	assert.equal(result.status, 1);
	assert.deepEqual(result.results.map((entry) => entry.status), [0, 1, 0, 0]);
	for (const command of ["verify:fast", "lint", "typecheck", "test:unit:js"]) assert.match(text, new RegExp(`=== pnpm run ${command} \\(exit \\d, 1\\.5s\\) ===\\npnpm run ${command} output`, "u"));
	assert.match(text, /FAIL {4}1\.5s {2}pnpm run lint\n/u);
	assert.match(text, /1 failed in \d+\.\ds\n$/u);
});

test("all passing exits 0, and no commands is a usage error", async () => {
	const result = await runParallel(["true"], { run: async () => ({ seconds: 0, status: 0, stderr: "", stdout: "" }), write: () => {} });
	assert.equal(result.status, 0);
	await assert.rejects(runParallel([], { write: () => {} }), /Usage/u);
});

test("a real child's output and exit status are captured", async () => {
	let text = "";
	const result = await runParallel([`${JSON.stringify(process.execPath)} -e "console.log('hi'); process.exit(4)"`], { write: (chunk) => { text += chunk; } });
	assert.equal(result.results[0].status, 4);
	assert.match(text, /\nhi\n/u);
});
