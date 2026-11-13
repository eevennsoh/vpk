"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { formatMachineLine, parseFootprintGb, readCache, summarizeStacks, writeCache } = require("./machine-state");
const { main } = require("../machine-state");

const limits = { swapLimitGb: 16, levelMin: 4 };
const stack = (name, footprintGb, overrides = {}) => ({ worktree: `/w/${name}`, name, footprintGb, idle: true, inUse: null, stop: `pnpm ports kill vpk-dev-${name}`, ...overrides });

test("below the pressure threshold the line reports and advises nothing", () => {
	const { pressure, line } = formatMachineLine({ memory: { swapUsedGb: 9, pressureLevel: 2 }, stacks: [stack("a", 3.2), stack("b", 8.4)], limits });
	assert.equal(pressure, false);
	assert.equal(line, "machine: normal: swap 9.0 GB used, pressure level 2, 2 dev stacks, largest b 8.4 GB");
});

test("under pressure the line names the largest idle stack to stop, never one in use", () => {
	const stacks = [stack("busy", 15.8, { idle: false, inUse: "claude pid 1 has its cwd here" }), stack("small", 2.1), stack("big", 8.4)];
	const swap = formatMachineLine({ memory: { swapUsedGb: 20, pressureLevel: 2 }, stacks, limits });
	assert.equal(swap.pressure, true);
	assert.equal(swap.line, "machine: MEMORY PRESSURE (swap in use is 20 GB >= 16 GB): swap 20 GB used, pressure level 2, 3 dev stacks, largest busy 16 GB; stop the largest idle stack: pnpm ports kill vpk-dev-big");
	const level = formatMachineLine({ memory: { swapUsedGb: 2, pressureLevel: 4 }, stacks, limits });
	assert.match(level.line, /^machine: MEMORY PRESSURE \(memory-pressure level is 4 >= 4\)/u);
});

test("under pressure with nothing idle, or no stacks, or no inventory, it says so", () => {
	const memory = { swapUsedGb: 20, pressureLevel: 2 };
	assert.match(formatMachineLine({ memory, stacks: [stack("a", 4, { idle: false })], limits }).line, /; no idle stack to stop: every stack shows a live task$/u);
	assert.match(formatMachineLine({ memory, stacks: [], limits }).line, /0 dev stacks; no dev stack runs; look at other processes$/u);
	assert.match(formatMachineLine({ memory, stacks: null, limits }).line, /dev stacks unknown \(run pnpm run mem --brief\)$/u);
	assert.match(formatMachineLine({ memory, stacks: [stack("a", 4)], stacksAgeMs: 7 * 60_000, limits }).line, /largest a 4\.0 GB, as of 7 min ago;/u);
});

test("unreadable memory never reads as pressure", () => {
	assert.equal(formatMachineLine({ memory: { swapUsedGb: null, pressureLevel: null }, stacks: [], limits }).pressure, false);
});

test("vmmap's physical footprint parses in G, M and K", () => {
	assert.equal(parseFootprintGb("Physical footprint:         8.4G\n"), 8.4);
	assert.equal(parseFootprintGb("Physical footprint:         512M\n"), 0.5);
	assert.equal(parseFootprintGb("Physical footprint (peak):  1G\n"), null);
	assert.equal(parseFootprintGb(""), null);
});

test("stacks get the pnpm ports kill command for their worktree and sum their servers", () => {
	const killCommand = (worktree) => `pnpm ports kill vpk-dev-${worktree.worktreeName}`;
	const [summary] = summarizeStacks(
		[{ worktree: "/w/x", servers: [{ pid: 1 }, { pid: 2 }], quiet: true, inUse: null }],
		{ worktrees: [{ path: "/w/x", worktreeName: "x-name" }], killCommand, footprints: new Map([[1, 2], [2, 3.5]]) },
	);
	assert.deepEqual(summary, { worktree: "/w/x", name: "x-name", footprintGb: 5.5, idle: true, inUse: null, stop: "pnpm ports kill vpk-dev-x-name" });
	const [unmeasured] = summarizeStacks([{ worktree: "/w/y", servers: [{ pid: 3 }], quiet: false, inUse: null }], { killCommand, footprints: new Map() });
	assert.deepEqual([unmeasured.footprintGb, unmeasured.idle, unmeasured.stop], [null, false, "(cd /w/y && pnpm run dev:tmux:stop)"]);
});

test("--hook prints the line from the cache under faked pressure and nothing below it", async (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "machine-state-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const env = { VPK_MACHINE_STATE_CACHE: path.join(dir, "cache.json") };
	assert.equal(writeCache([stack("big", 8.4)], { env, now: 1_000 }), true);
	assert.equal(readCache({ env }).writtenAt, 1_000);

	const run = async (memory) => {
		const out = [];
		await main(["--hook"], { env: { ...env, VPK_MEMORY_STATE_FIXTURE: JSON.stringify(memory) }, now: 1_000 + 3 * 60_000, write: (text) => out.push(text) });
		return out.join("");
	};
	assert.equal(await run({ swapUsedGb: 20, pressureLevel: 2 }), "machine: MEMORY PRESSURE (swap in use is 20 GB >= 16 GB): swap 20 GB used, pressure level 2, 1 dev stack, largest big 8.4 GB, as of 3 min ago; stop the largest idle stack: pnpm ports kill vpk-dev-big\n");
	assert.equal(await run({ swapUsedGb: 9, pressureLevel: 2 }), "");
});

test("--brief measures live, refreshes the cache and always prints", async (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "machine-state-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const env = { VPK_MACHINE_STATE_CACHE: path.join(dir, "cache.json"), VPK_MEMORY_STATE_FIXTURE: JSON.stringify({ swapUsedGb: 3, pressureLevel: 1 }) };
	const out = [];
	await main(["--brief"], { env, now: 5_000, write: (text) => out.push(text), collect: async () => [stack("a", 1.5)] });
	assert.deepEqual(out, ["machine: normal: swap 3.0 GB used, pressure level 1, 1 dev stack, largest a 1.5 GB\n"]);
	assert.deepEqual(readCache({ env }), { writtenAt: 5_000, stacks: [stack("a", 1.5)] });
});
