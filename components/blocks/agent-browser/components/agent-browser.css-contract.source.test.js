// Stylesheet contract for the Agent Browser's scrolling columns: both columns add the
// `scroll-mask-top` utility once scrolled, and happy-dom applies no CSS, so only this file proves
// the utility exists. A browser check that a scrolled column fades its top edge would replace it.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const themeCss = fs.readFileSync(path.join(process.cwd(), "app/tailwind-theme.css"), "utf8");

test("the scroll-mask-top utility the scrolling columns add exists", () => {
	assert.match(themeCss, /@utility\s+scroll-mask-top\s*\{[^}]*mask-image:/u);
});
