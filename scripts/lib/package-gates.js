"use strict";

// Gates compose checks through nested `pnpm run` calls (ci:pr → verify:fast → verify:*),
// so "does this gate run that check?" must follow the chain instead of grepping one script.
function scriptsReachableFrom(scripts, gate, seen = new Set()) {
	if (seen.has(gate) || typeof scripts[gate] !== "string") return seen;
	seen.add(gate);
	for (const match of scripts[gate].matchAll(/pnpm run ([\w:.-]+)/gu)) {
		scriptsReachableFrom(scripts, match[1], seen);
	}
	return seen;
}

function gateRunsScript(scripts, gate, script) {
	return scriptsReachableFrom(scripts, gate).has(script);
}

module.exports = {
	gateRunsScript,
	scriptsReachableFrom,
};
