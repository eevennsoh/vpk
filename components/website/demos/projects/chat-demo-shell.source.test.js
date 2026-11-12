const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const DEMO_DIR = __dirname;

function readDemoSource(fileName) {
	return fs.readFileSync(path.join(DEMO_DIR, fileName), "utf8");
}

test("chat demo shells cap the fixed panel height to the padded viewport", () => {
	for (const fileName of ["skills-demo.tsx", "sidebar-chat-demo.tsx"]) {
		const source = readDemoSource(fileName);

		assert.match(
			source,
			/flex h-dvh min-h-0 w-full items-center justify-center overflow-hidden p-6/u,
			`${fileName} should keep the demo shell pinned to the viewport`,
		);
		assert.match(
			source,
			/h-full max-h-\[800px\] min-h-0 w-\[400px\]/u,
			`${fileName} should cap the panel without creating document overflow`,
		);
	}
});
