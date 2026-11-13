"use strict";

// One reading of how much memory this machine has to spare, shared by the dev-stack budget
// (scripts/lib/dev-stack-budget.js), the unit runner's `--parallel auto`, check and ci:pr. Every
// reading is null when it cannot be taken (another OS, a sandbox), and a null reading never counts
// as pressure.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// The pressure limits have one owner: the vpk-system-clean sweep, which also runs on its own
// from ~/.local/bin. They are read from its `NAME=<number>` lines; the fallbacks apply only if
// that file cannot be read.
const SWEEP_SCRIPT = path.resolve(__dirname, "../../.agents/skills/vpk-system-clean/scripts/vpk-system-clean.sh");

function readSweepLimits(file = SWEEP_SCRIPT) {
	let text = "";
	try {
		text = fs.readFileSync(file, "utf8");
	} catch {
		// Fallbacks below.
	}
	const value = (name, fallback) => {
		const match = new RegExp(`^${name}=(\\d+)\\b`, "mu").exec(text);
		return match ? Number(match[1]) : fallback;
	};
	return { levelMin: value("PRESSURE_LEVEL_MIN", 4), swapGb: value("PRESSURE_SWAP_USED_GB", 16) };
}

const SWEEP_LIMITS = readSweepLimits();
const PRESSURE_SWAP_USED_GB = SWEEP_LIMITS.swapGb; // swap in use that counts as memory pressure
const PRESSURE_LEVEL_MIN = SWEEP_LIMITS.levelMin; // kern.memorystatus_vm_pressure_level: 1 normal, 2 warn, 4 critical

function run(command, args) {
	const result = spawnSync(command, args, { encoding: "utf8" });
	return result.status === 0 ? result.stdout : "";
}

function parseSwapUsedGb(text) {
	const match = /used = ([\d.]+)([KMG])/u.exec(text);
	if (!match) return null;
	const value = Number(match[1]);
	return Math.floor(match[2] === "G" ? value : match[2] === "M" ? value / 1024 : 0);
}

// Free, inactive, speculative and purgeable pages: what macOS can hand out without swapping.
// os.freemem() counts only free pages (0.4 GB on a 48 GB Mac with 17 GB reclaimable).
function parseVmStatAvailableGb(text) {
	const pageSize = Number(/page size of (\d+) bytes/u.exec(text)?.[1]);
	if (!pageSize) return null;
	const pages = (label) => Number(new RegExp(`Pages ${label}:\\s+(\\d+)`, "u").exec(text)?.[1] ?? 0);
	return ((pages("free") + pages("inactive") + pages("speculative") + pages("purgeable")) * pageSize) / 2 ** 30;
}

function parseMeminfoAvailableGb(text) {
	const kib = Number(/^MemAvailable:\s+(\d+) kB/mu.exec(text)?.[1]);
	return kib ? kib / 2 ** 20 : null;
}

function readMemoryState({ platform = process.platform } = {}) {
	if (platform === "linux") {
		let meminfo = "";
		try {
			meminfo = fs.readFileSync("/proc/meminfo", "utf8");
		} catch {
			// Unreadable: no reading.
		}
		return { availableGb: parseMeminfoAvailableGb(meminfo), pressureLevel: null, swapUsedGb: null };
	}
	const level = Number(run("sysctl", ["-n", "kern.memorystatus_vm_pressure_level"]).trim());
	return {
		availableGb: parseVmStatAvailableGb(run("vm_stat", [])),
		pressureLevel: Number.isInteger(level) && level > 0 ? level : null,
		swapUsedGb: parseSwapUsedGb(run("sysctl", ["-n", "vm.swapusage"])),
	};
}

// The reasons the machine is under memory pressure; empty when it is not (or cannot tell).
function pressureReasons(state, { levelMin = PRESSURE_LEVEL_MIN, swapLimitGb = PRESSURE_SWAP_USED_GB } = {}) {
	const reasons = [];
	if (state.swapUsedGb !== null && state.swapUsedGb !== undefined && state.swapUsedGb >= swapLimitGb) {
		reasons.push(`swap in use is ${state.swapUsedGb} GB >= ${swapLimitGb} GB`);
	}
	if (state.pressureLevel !== null && state.pressureLevel !== undefined && state.pressureLevel >= levelMin) {
		reasons.push(`memory-pressure level is ${state.pressureLevel} >= ${levelMin}`);
	}
	return reasons;
}

module.exports = {
	PRESSURE_LEVEL_MIN,
	PRESSURE_SWAP_USED_GB,
	parseMeminfoAvailableGb,
	parseSwapUsedGb,
	parseVmStatAvailableGb,
	pressureReasons,
	readMemoryState,
	readSweepLimits,
};
