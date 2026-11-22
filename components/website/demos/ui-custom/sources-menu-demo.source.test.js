const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const DEMO_SOURCE = readFileSync(join(__dirname, "sources-menu-demo.tsx"), "utf8");

test("preview-menu demo reuses the shared SourcesMenu owner", () => {
	assert.match(
		DEMO_SOURCE,
		/import \{\s*SOURCE_PREVIEW_PAGES,\s*SourcesMenu,\s*\} from "@\/components\/ui-custom\/sources-menu";/u,
	);
	assert.match(DEMO_SOURCE, /<SourcesMenu/u);
	assert.match(DEMO_SOURCE, /pages=\{SOURCE_PREVIEW_PAGES\}/u);
	assert.match(
		DEMO_SOURCE,
		/<p className="font-medium">Used \{SOURCE_PREVIEW_PAGES\.length\} sources<\/p>/u,
	);
	assert.doesNotMatch(DEMO_SOURCE, /function SourcePreviewCard/u);
	assert.doesNotMatch(DEMO_SOURCE, /Open preview modal/u);
});
