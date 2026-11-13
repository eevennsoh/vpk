const assert = require("node:assert/strict");
const test = require("node:test");

const { parseMeminfoAvailableGb, parseSwapUsedGb, parseVmStatAvailableGb, pressureReasons } = require("./memory-pressure.js");

test("parses swap in use from sysctl vm.swapusage", () => {
	assert.equal(parseSwapUsedGb("total = 38912.00M  used = 37580.80M  free = 1331.20M  (encrypted)"), 36);
	assert.equal(parseSwapUsedGb("total = 6144.00M  used = 0.00M  free = 6144.00M"), 0);
	assert.equal(parseSwapUsedGb("vm.swapusage: unknown"), null);
});

test("available memory counts free, inactive, speculative and purgeable pages", () => {
	const vmStat = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                    22222.
Pages active:                                1026084.
Pages inactive:                              1019137.
Pages speculative:                              5560.
Pages throttled:                                   0.
Pages wired down:                             393709.
Pages purgeable:                                2557.`;
	assert.equal(parseVmStatAvailableGb(vmStat).toFixed(2), "16.01");
	assert.equal(parseVmStatAvailableGb(""), null);
	assert.equal(parseMeminfoAvailableGb("MemTotal:       16000000 kB\nMemAvailable:    8388608 kB\n"), 8);
	assert.equal(parseMeminfoAvailableGb(""), null);
});

test("pressure comes from swap in use or a critical pressure level; unknown readings are not pressure", () => {
	assert.deepEqual(pressureReasons({ swapUsedGb: 4, pressureLevel: 2 }), []);
	assert.deepEqual(pressureReasons({ swapUsedGb: 16, pressureLevel: 1 }), ["swap in use is 16 GB >= 16 GB"]);
	assert.deepEqual(pressureReasons({ swapUsedGb: null, pressureLevel: 4 }), ["memory-pressure level is 4 >= 4"]);
	assert.deepEqual(pressureReasons({ swapUsedGb: null, pressureLevel: null }), []);
});
