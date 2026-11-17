"use strict";

/** Runs of characters that change nothing in a string, and outside one. */
const PLAIN_IN_STRING = /[^"\\]+/uy;
const PLAIN_OUTSIDE_STRING = /[^"{}[\]]+/uy;

/**
 * Continues reading a JSON object in `text` up to `limit`, from where `scan` stopped: one pass that
 * skips strings and their escapes and counts nesting. `scan` is `{ at, depth, end, inString }`, where
 * `at` is the next index to read and `end` is where the object ends (-1 until it does). It finds the
 * end only; JSON.parse checks it.
 */
function scanJsonObject(text, scan, limit = text.length) {
	let { at, depth, inString } = scan;
	while (at < limit) {
		const plain = inString ? PLAIN_IN_STRING : PLAIN_OUTSIDE_STRING;
		plain.lastIndex = at;
		if (plain.test(text)) {
			at = Math.min(plain.lastIndex, limit);
			continue;
		}
		const char = text[at];
		at += 1;
		if (inString) {
			if (char === "\\") {
				at += 1;
			} else {
				inString = false;
			}
		} else if (char === '"') {
			inString = true;
		} else if (char === "{" || char === "[") {
			depth += 1;
		} else if (--depth === 0) {
			scan.end = at;
			break;
		}
	}
	Object.assign(scan, { at, depth, inString });
	return scan;
}

/** Where the JSON object that opens `text` ends (-1 when it does not end), from its first "{". */
function jsonObjectEnd(text) {
	const at = text.indexOf("{");
	return at < 0 ? -1 : scanJsonObject(text, { at, depth: 0, end: -1, inString: false }).end;
}

module.exports = {
	jsonObjectEnd,
	scanJsonObject,
};
