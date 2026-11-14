// Stylesheet contract for the template build progress spinner: happy-dom applies no CSS, so the
// rendered suites can drive the build but cannot see the spinner turn. The utility and its two
// keyframes must exist and the spinner must run them. A browser check that the in-progress step's
// spinner has a running rotate and dash animation would replace this file.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const themeCss = fs.readFileSync(path.join(process.cwd(), "app/tailwind-theme.css"), "utf8");

test("the template build spinner utility and its keyframes exist", () => {
	assert.match(themeCss, /@utility\s+template-build-progress-spinner\s*\{/u);
	assert.match(themeCss, /@keyframes\s+template-build-progress-spinner-rotate\s*\{/u);
	assert.match(themeCss, /@keyframes\s+template-build-progress-spinner-dash\s*\{/u);
});

test("the spinner rotates and its circle dashes on a one-second loop", () => {
	assert.match(themeCss, /animation:\s*template-build-progress-spinner-rotate\s+1s\s+linear\s+infinite\s*;/u);
	assert.match(themeCss, /animation:\s*template-build-progress-spinner-dash\s+1s\s+ease-out\s+infinite\s*;/u);
});
