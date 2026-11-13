const assert = require("node:assert/strict");
const test = require("node:test");

const { createDebouncedWriter } = require("./debounced-writer.ts");

test("schedule writes once after the delay, restarting on each call", (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	let writes = 0;
	const writer = createDebouncedWriter(() => writes++, 900);
	writer.schedule();
	context.mock.timers.tick(600);
	writer.schedule();
	context.mock.timers.tick(600);
	assert.equal(writes, 0);
	context.mock.timers.tick(300);
	assert.equal(writes, 1);
	context.mock.timers.tick(10_000);
	assert.equal(writes, 1);
});

test("flush writes a waiting write now and leaves no timer; with nothing waiting it does nothing", (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	let writes = 0;
	const writer = createDebouncedWriter(() => writes++, 900);
	writer.flush();
	assert.equal(writes, 0);
	writer.schedule();
	writer.flush();
	assert.equal(writes, 1);
	writer.flush();
	context.mock.timers.tick(10_000);
	assert.equal(writes, 1);
});

test("cancel drops a waiting write", (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	let writes = 0;
	const writer = createDebouncedWriter(() => writes++, 900);
	writer.schedule();
	writer.cancel();
	writer.flush();
	context.mock.timers.tick(10_000);
	assert.equal(writes, 0);
});
