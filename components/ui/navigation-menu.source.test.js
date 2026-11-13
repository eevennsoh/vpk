const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "navigation-menu.tsx"), "utf8");
const popupClassName = source.match(
	/<NavigationMenuPrimitive\.Popup className="([^"]+)"/u,
)?.[1];

test("navigation menu popup does not animate dimensions during rapid trigger changes", () => {
	assert.ok(popupClassName, "expected the shared navigation menu popup classes");
	assert.match(
		popupClassName,
		/transition-\[opacity,transform,scale,translate\]/u,
	);
	assert.doesNotMatch(
		popupClassName,
		/transition-\[[^\]]*\b(?:width|height)\b/u,
	);
});

test("navigation menu popup disables its transition for reduced motion", () => {
	assert.match(popupClassName, /motion-reduce:transition-none/u);
});
