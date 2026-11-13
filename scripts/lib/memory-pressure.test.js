const assert = require("node:assert/strict");
const test = require("node:test");

const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const SWEEP_SCRIPT = join(__dirname, "../../.agents/skills/vpk-system-clean/scripts/vpk-system-clean.sh");

const { PRESSURE_LEVEL_MIN, PRESSURE_SWAP_USED_GB, parseMeminfoAvailableGb, parseSwapUsedGb, parseVmStatAvailableGb, pressureReasons, readSweepLimits } = require("./memory-pressure.js");

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
	assert.deepEqual(pressureReasons({ swapUsedGb: PRESSURE_SWAP_USED_GB - 1, pressureLevel: PRESSURE_LEVEL_MIN - 1 }), []);
	assert.deepEqual(pressureReasons({ swapUsedGb: PRESSURE_SWAP_USED_GB, pressureLevel: 1 }), [`swap in use is ${PRESSURE_SWAP_USED_GB} GB >= ${PRESSURE_SWAP_USED_GB} GB`]);
	assert.deepEqual(pressureReasons({ swapUsedGb: null, pressureLevel: PRESSURE_LEVEL_MIN }), [`memory-pressure level is ${PRESSURE_LEVEL_MIN} >= ${PRESSURE_LEVEL_MIN}`]);
	assert.deepEqual(pressureReasons({ swapUsedGb: null, pressureLevel: null }), []);
});

test("the pressure limits are read from the vpk-system-clean sweep, their one owner", () => {
	// The exported limits are the sweep's own lines, not the fallbacks: both lines exist there.
	const sweepSource = readFileSync(SWEEP_SCRIPT, "utf8");
	assert.match(sweepSource, /^PRESSURE_SWAP_USED_GB=\d+\b/mu);
	assert.match(sweepSource, /^PRESSURE_LEVEL_MIN=\d+\b/mu);
	assert.deepEqual({ levelMin: PRESSURE_LEVEL_MIN, swapGb: PRESSURE_SWAP_USED_GB }, readSweepLimits(SWEEP_SCRIPT));
	const dir = mkdtempSync(join(tmpdir(), "sweep-limits-"));
	try {
		const sweep = join(dir, "vpk-system-clean.sh");
		writeFileSync(sweep, "PRESSURE_SWAP_USED_GB=24          # comment\nPRESSURE_LEVEL_MIN=2\n");
		assert.deepEqual(readSweepLimits(sweep), { levelMin: 2, swapGb: 24 });
		assert.deepEqual(readSweepLimits(join(dir, "missing.sh")), { levelMin: 4, swapGb: 16 }, "fallbacks only when the sweep cannot be read");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
