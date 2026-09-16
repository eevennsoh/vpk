const assert = require("node:assert/strict");
const test = require("node:test");
const { createLatestAnimationFrame } = require("./latest-animation-frame.ts");

test("pointer bursts resolve the latest input once, and release cancels pending work", () => {
	let callback;
	let cancelled = 0;
	const values = [];
	const scheduler = createLatestAnimationFrame({
		requestFrame: (next) => { assert.equal(callback, undefined); callback = next; return 0; },
		cancelFrame: (id) => { assert.equal(id, 0); cancelled++; callback = undefined; },
		onFrame: (value) => values.push(value),
	});
	scheduler.schedule({ x: 1 });
	scheduler.schedule({ x: 2 });
	const frame = callback;
	callback = undefined;
	frame();
	assert.deepEqual(values, [{ x: 2 }]);
	scheduler.schedule({ x: 3 });
	scheduler.cancel();
	assert.equal(cancelled, 1);
	assert.deepEqual(values, [{ x: 2 }]);
	scheduler.schedule({ x: 4 });
	const late = callback;
	scheduler.dispose();
	late();
	scheduler.schedule({ x: 5 });
	assert.deepEqual(values, [{ x: 2 }]);
	assert.equal(callback, undefined);
});
