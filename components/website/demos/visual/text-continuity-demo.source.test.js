const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "text-continuity-demo.tsx"), "utf8");

test("Text Continuity offers every example from one demo selector", () => {
	assert.match(DEMO_SOURCE, /const EXAMPLE_SELECT_OPTIONS = EXAMPLES\.map/);
	assert.match(DEMO_SOURCE, /id="text-continuity-example"/);
	assert.match(DEMO_SOURCE, /label="Demo"/);
	assert.match(DEMO_SOURCE, /options=\{EXAMPLE_SELECT_OPTIONS\}/);
});

test("Text Continuity mounts only the selected example", () => {
	assert.match(DEMO_SOURCE, /const \[selectedExampleId, setSelectedExampleId\] = useState<ExampleId>/);
	assert.match(DEMO_SOURCE, /const ActiveExample = EXAMPLE_COMPONENTS\[selectedExample\.id\]/);
	assert.match(DEMO_SOURCE, /<ActiveExample key=\{selectedExample\.id\} \/>/);
	assert.doesNotMatch(DEMO_SOURCE, /\{EXAMPLES\.map\(\(example\) => \{/);
});
