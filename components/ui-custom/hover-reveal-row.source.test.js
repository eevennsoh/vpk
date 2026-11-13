const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");

const SOURCE = fs.readFileSync(
	path.join(__dirname, "hover-reveal-row.tsx"),
	"utf8",
);
const DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "../website/demos/ui-custom/hover-reveal-row-demo.tsx"),
	"utf8",
);
const DETAILS_SOURCE = readDetailCategorySource("ui-custom");

test("hover-reveal-row exposes the container class + label + actions primitives", () => {
	assert.match(SOURCE, /export const hoverRevealRowClassName = "group\/hover-reveal-row relative";/u);
	assert.match(SOURCE, /export function HoverRevealLabel\(/u);
	assert.match(SOURCE, /export function HoverRevealActions\(/u);
});

test("label reserves padding from a descendant so a self group-hover never misfires", () => {
	// The reserve is keyed off the row group and applied to the label (a
	// descendant) — the exact thing a self `group-hover` on the container cannot
	// do. Literal strings so Tailwind can statically extract them.
	// The label animates its reserve padding so the text reflows smoothly as the
	// controls reveal on hover/focus, instead of snapping.
	assert.match(SOURCE, /block w-full truncate transition-\[padding\]/u);
	assert.match(
		SOURCE,
		/group-hover\/hover-reveal-row:pr-8 group-has-\[:focus-visible\]\/hover-reveal-row:pr-8/u,
	);
	assert.match(
		SOURCE,
		/group-hover\/hover-reveal-row:pr-\[66px\] group-has-\[:focus-visible\]\/hover-reveal-row:pr-\[66px\]/u,
	);
	// Rest reserve is the static padding (no modifier) for parked controls.
	assert.match(SOURCE, /0: "",\s*1: "pr-8",\s*2: "pr-\[66px\]",/u);
});

test("actions overlay parks the toggle and slides controls in on reveal", () => {
	// Toggle reveals on hover/focus, parks at the far right, and slides left to
	// clear the action slot when an action is present.
	assert.match(SOURCE, /group-hover\/hover-reveal-row:opacity-100 group-has-\[:focus-visible\]\/hover-reveal-row:opacity-100/u);
	assert.match(SOURCE, /right-1\.5 group-hover\/hover-reveal-row:right-\[34px\] group-has-\[:focus-visible\]\/hover-reveal-row:right-\[34px\]/u);
	assert.match(SOURCE, /toggleParked \? "opacity-100" : "opacity-0"/u);
	// Action slides in from translate-x-2 → 0 and fades in on reveal.
	assert.match(SOURCE, /translate-x-2[\s\S]*group-hover\/hover-reveal-row:translate-x-0 group-hover\/hover-reveal-row:opacity-100/u);
});

test("demo rows leave activation on the revealed controls", () => {
	assert.match(DEMO_SOURCE, /activation stays on the switch and edit button/u);
	assert.match(DEMO_SOURCE, /group-hover\/hover-reveal-row:bg-bg-neutral-subtle-hovered/u);
	assert.doesNotMatch(DEMO_SOURCE, /<button\s+type="button"[\s\S]{0,260}<HoverRevealLabel/u);
	assert.match(DEMO_SOURCE, /<Switch[\s\S]*onCheckedChange=\{setEnabled\}/u);
	assert.match(DEMO_SOURCE, /aria-label=\{`Edit \$\{label\}`\}/u);
	assert.match(DETAILS_SOURCE, /keep activation on the switch\/action controls/u);
	assert.doesNotMatch(DETAILS_SOURCE, /<button className="flex h-9 w-full min-w-0 items-center rounded-lg px-2">/u);
});
