"use strict";

/**
 * Where the JSON object that opens `text` ends, found in one scan that skips strings and their
 * escapes and counts nesting (-1 when it does not end). It finds the end only; JSON.parse checks it.
 */
function jsonObjectEnd(text) {
	let depth = 0;
	let inString = false;
	for (let at = text.indexOf("{"); at >= 0 && at < text.length; at += 1) {
		const char = text[at];
		if (inString) {
			if (char === "\\") {
				at += 1;
			} else if (char === '"') {
				inString = false;
			}
		} else if (char === '"') {
			inString = true;
		} else if (char === "{" || char === "[") {
			depth += 1;
		} else if ((char === "}" || char === "]") && --depth === 0) {
			return at + 1;
		}
	}
	return -1;
}

module.exports = {
	jsonObjectEnd,
};
