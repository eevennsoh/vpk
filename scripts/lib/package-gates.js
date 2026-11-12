"use strict";

const { CHECK_COMMAND, GUARD_SCRIPTS } = require("./guard-scripts");

// Gates compose checks through nested `pnpm run` calls (ci:pr → verify:fast → verify:*),
// so "does this gate run that check?" must follow the chain instead of grepping one script.
// `node scripts/check.mjs` (verify:fast, check) runs every guard script.
function scriptsReachableFrom(scripts, gate, seen = new Set()) {
	if (seen.has(gate) || typeof scripts[gate] !== "string") return seen;
	seen.add(gate);
	const children = [...scripts[gate].matchAll(/pnpm run ([\w:.-]+)/gu)].map((match) => match[1]);
	if (CHECK_COMMAND.test(scripts[gate])) children.push(...GUARD_SCRIPTS);
	for (const child of children) scriptsReachableFrom(scripts, child, seen);
	return seen;
}

function gateRunsScript(scripts, gate, script) {
	return scriptsReachableFrom(scripts, gate).has(script);
}

module.exports = {
	gateRunsScript,
	scriptsReachableFrom,
};
