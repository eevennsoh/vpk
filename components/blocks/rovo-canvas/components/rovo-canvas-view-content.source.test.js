const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const CANVAS_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-canvas.tsx"),
	"utf8",
);

test("Rovo Canvas does not retain tabpanel semantics for the Toggle Group view control", () => {
	assert.doesNotMatch(CANVAS_SOURCE, /import \{ Tabs, TabsContent \} from "@\/components\/ui\/tabs";/u);
	assert.doesNotMatch(CANVAS_SOURCE, /<Tabs(?:\s|>)/u);
	assert.doesNotMatch(CANVAS_SOURCE, /<TabsContent(?:\s|>)/u);
});

test("Rovo Canvas does not render a bottom footer", () => {
	assert.doesNotMatch(CANVAS_SOURCE, /ui-custom\/footer/u);
	assert.doesNotMatch(CANVAS_SOURCE, /footer\?: ReactNode/u);
});

test("Rovo Canvas keeps an even viewport inset on every side", () => {
	assert.match(CANVAS_SOURCE, /"inset-4 flex h-auto w-auto !max-w-none/u);
	assert.doesNotMatch(CANVAS_SOURCE, /top-16 right-4 bottom-4 left-4/u);
});
