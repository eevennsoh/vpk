#!/usr/bin/env node
"use strict";

// The machine-state line (scripts/lib/machine-state.js).
//
//   node scripts/machine-state.js --brief         live line, always printed; refreshes the cache
//   node scripts/machine-state.js --hook          SessionStart: prints the line only under memory
//                                                 pressure, from live memory and cached stacks
//   node scripts/machine-state.js --write-cache   refresh the cache quietly (the sweep runs this)
//   add --json for the facts instead of the line

const { collectStacks, formatMachineLine, readCache, readMemory, writeCache } = require("./lib/machine-state");

async function main(argv = process.argv.slice(2), { env = process.env, now = Date.now(), write = (text) => process.stdout.write(text), collect = collectStacks } = {}) {
	const mode = ["--brief", "--hook", "--write-cache"].find((flag) => argv.includes(flag));
	if (!mode) {
		process.stderr.write("usage: node scripts/machine-state.js --brief | --hook | --write-cache [--json]\n");
		return 2;
	}
	const memory = readMemory(env);
	let stacks = null;
	let stacksAgeMs = null;
	if (mode === "--hook") {
		const cache = readCache({ env });
		if (cache) {
			stacks = cache.stacks;
			stacksAgeMs = Math.max(0, now - cache.writtenAt);
		}
	} else {
		stacks = await collect({ env });
		writeCache(stacks, { env, now });
		if (mode === "--write-cache") return 0;
	}
	const { pressure, line } = formatMachineLine({ memory, stacks, stacksAgeMs });
	if (mode === "--hook" && !pressure) return 0;
	write(argv.includes("--json") ? `${JSON.stringify({ pressure, line, memory, stacks, stacksAgeMs })}\n` : `${line}\n`);
	return 0;
}

if (require.main === module) {
	main().then((code) => {
		process.exitCode = code;
	}, (error) => {
		// Best effort: a failed reading never breaks the hook or the check that shows it.
		process.stderr.write(`machine-state: ${error.message}\n`);
		process.exitCode = 0;
	});
}

module.exports = { main };
