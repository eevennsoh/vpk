// Stylesheet contract for the expanded agent card's ticket: happy-dom applies no CSS, so the
// rendered suite proves the ticket's seam and shadow elements exist but not how they paint. A
// browser check of the expanded card's notched seam and drop shadow would replace this file.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const themeCss = fs.readFileSync(path.join(process.cwd(), "app/tailwind-theme.css"), "utf8");

function utilityBlock(name) {
	const start = themeCss.search(new RegExp(`@utility\\s+${name}\\s*\\{`, "u"));
	assert.notEqual(start, -1, `@utility ${name} exists`);
	const open = themeCss.indexOf("{", start);
	let depth = 0;
	for (let index = open; index < themeCss.length; index += 1) {
		if (themeCss[index] === "{") depth += 1;
		if (themeCss[index] === "}") depth -= 1;
		if (depth === 0) return themeCss.slice(open, index + 1);
	}
	throw new Error(`@utility ${name} is not closed`);
}

test("the ticket shadow is a drop shadow that follows the ticket's notched outline", () => {
	assert.match(utilityBlock("agent-card-ticket-shadow"), /filter:\s*drop-shadow\(\s*0\s+8px\s+12px\s+rgb\(30 31 33 \/ 0\.15\)\s*\)/u);
});

test("the ticket seam draws transparent, bordered 8x16 notches on both edges", () => {
	const seam = utilityBlock("agent-card-ticket-seam");
	assert.match(seam, /&::before,\s*&::after\s*\{[^}]*width:\s*8px;[^}]*height:\s*16px;[^}]*background:\s*transparent;[^}]*border:\s*1px solid var\(--color-border\)/u);
	assert.doesNotMatch(seam, /background:\s*var\(--color-surface\)/u);
	assert.doesNotMatch(seam, /filter:\s*drop-shadow/u);
});
