import assert from "node:assert/strict";
import test from "node:test";

import { zeroWidthBorders } from "./capture.ts";

function withComputedStyle(styles, run) {
	const previous = globalThis.getComputedStyle;
	globalThis.getComputedStyle = () => ({ getPropertyValue: (name) => styles[name] ?? "" });
	try {
		return run();
	} finally {
		globalThis.getComputedStyle = previous;
	}
}

const PREFLIGHT = Object.fromEntries(["top", "right", "bottom", "left"].flatMap((side) => [
	[`border-${side}-width`, "0px"],
	[`border-${side}-style`, "solid"],
]));

test("writes back the zero width Tailwind preflight leaves behind a solid style", () => {
	const fixes = withComputedStyle(PREFLIGHT, () => zeroWidthBorders({}));
	assert.deepEqual(fixes, {
		"border-top-width": "0px",
		"border-right-width": "0px",
		"border-bottom-width": "0px",
		"border-left-width": "0px",
	});
});

test("leaves real borders and border-style none alone", () => {
	const styles = { ...PREFLIGHT, "border-top-width": "1px", "border-right-style": "none", "border-bottom-style": "none", "border-left-style": "none" };
	assert.equal(withComputedStyle(styles, () => zeroWidthBorders({})), undefined);
});
