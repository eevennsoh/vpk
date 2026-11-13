const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SOURCE = fs.readFileSync(path.join(__dirname, "slider.tsx"), "utf8");

test("Slider forwards accessible value text to each focusable thumb input", () => {
	assert.match(SOURCE, /"aria-valuetext": ariaValueText/u);
	assert.match(SOURCE, /getAriaValueText/u);
	assert.match(
		SOURCE,
		/<SliderPrimitive\.Thumb[\s\S]*aria-valuetext=\{ariaValueText\}[\s\S]*getAriaValueText=\{getAriaValueText\}/u,
	);
});
