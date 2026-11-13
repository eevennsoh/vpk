const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const UTILS_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/twg-loader/utils.ts"),
	"utf8",
);
const COMPONENT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/twg-loader/twg-loader.tsx"),
	"utf8",
);
const DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/website/demos/ui-custom/twg-loader-demo.tsx"),
	"utf8",
);

test("TWG loader dot colors are stable SVG attributes during hydration", () => {
	assert.match(UTILS_SOURCE, /const DOT_COLORS = \[/u);
	assert.match(UTILS_SOURCE, /"var\(--ds-icon-accent-orange, #FCA700\)"/u);
	assert.match(UTILS_SOURCE, /"var\(--ds-icon-accent-lime, #6A9A23\)"/u);
	assert.match(UTILS_SOURCE, /"var\(--ds-icon-accent-blue, #1868DB\)"/u);
	assert.match(UTILS_SOURCE, /"var\(--ds-icon-accent-purple, #AF59E0\)"/u);
	assert.match(
		UTILS_SOURCE,
		/export function getDotColors\(\): readonly string\[\] \{\s+return DOT_COLORS;\s+\}/u,
	);
	assert.doesNotMatch(UTILS_SOURCE, /getComputedStyle|document\.documentElement|typeof window/u);
});

test("TWG loader rings stay unfilled and punch holes with an SVG mask", () => {
	assert.match(
		COMPONENT_SOURCE,
		/data-type="dot"[\s\S]*fill="none"[\s\S]*stroke=\{dotColors\[i\]\}/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/<mask[\s\S]*maskUnits="userSpaceOnUse"[\s\S]*data-type="mask"[\s\S]*fill="black"/u,
	);
	assert.match(COMPONENT_SOURCE, /mask=\{`url\(#\$\{holesMaskId\}\)`\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /fill="currentColor"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /text-surface/u);
	assert.doesNotMatch(DEMO_SOURCE, /className="text-\[#111213\]"/u);
});
