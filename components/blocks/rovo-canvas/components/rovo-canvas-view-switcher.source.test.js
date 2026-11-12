const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SWITCHER_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-canvas-view-switcher.tsx"),
	"utf8",
);

test("Rovo Canvas view switcher uses the shared controlled Outline Toggle Group", () => {
	assert.match(
		SWITCHER_SOURCE,
		/import \{ ToggleGroup, ToggleGroupItem \} from "@\/components\/ui\/toggle-group";/u,
	);
	assert.match(
		SWITCHER_SOURCE,
		/<ToggleGroup[\s\S]*variant="outline"[\s\S]*value=\{\[value\]\}[\s\S]*onValueChange=/u,
	);
	assert.match(SWITCHER_SOURCE, /<ToggleGroupItem[\s\S]*value=\{view\.id\}/u);
	assert.match(SWITCHER_SOURCE, /if \(nextValue === undefined\) \{[\s\S]*return;/u);
});
