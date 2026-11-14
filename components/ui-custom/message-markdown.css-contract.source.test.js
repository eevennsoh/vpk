// Stylesheet contract for chat markdown links: happy-dom applies no CSS, so the rendered suite
// can prove the anchor's classes but not the stylesheet that colours it. Sibling `.typeset-chat a`
// selectors were once dropped from the built CSS, leaving links dark and underlined, so the link
// rules must stay nested inside `.typeset-chat`. A browser check of a rendered chat link's computed
// colour and hover underline would replace this file.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const GLOBALS_CSS = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

// The `.typeset-chat { … }` block, braces balanced, so nested rules are read in place.
function readTypesetChatBlock() {
	const start = GLOBALS_CSS.search(/(^|\n)\.typeset-chat\s*\{/u);
	assert.notEqual(start, -1, "globals.css has a .typeset-chat block");
	const open = GLOBALS_CSS.indexOf("{", start);
	let depth = 0;
	for (let index = open; index < GLOBALS_CSS.length; index += 1) {
		if (GLOBALS_CSS[index] === "{") depth += 1;
		if (GLOBALS_CSS[index] === "}") depth -= 1;
		if (depth === 0) return GLOBALS_CSS.slice(open, index + 1);
	}
	throw new Error(".typeset-chat block is not closed");
}

const TYPESET_CHAT_CSS_SOURCE = readTypesetChatBlock();

test("chat links take the link colour without an underline, nested inside .typeset-chat", () => {
	assert.match(TYPESET_CHAT_CSS_SOURCE, /&\s*a\s*,[^{]*\{[^}]*color:\s*var\(--color-link\)\s*;[^}]*text-decoration:\s*none\s*;/u);
});

test("chat links underline on hover, nested inside .typeset-chat", () => {
	assert.match(TYPESET_CHAT_CSS_SOURCE, /&\s*a:hover\s*,[^{]*\{[^}]*text-decoration:\s*underline\s*;/u);
});
