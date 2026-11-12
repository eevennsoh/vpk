const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SIDEBAR_CHAT_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const RETIRED_COMPATIBILITY_MODULE = join(
	__dirname,
	"components",
	"streaming-thinking-indicator.tsx",
);

test("sidebar chat imports StreamingThinkingIndicator from its shared owner", () => {
	assert.match(
		SIDEBAR_CHAT_SOURCE,
		/import \{ StreamingThinkingIndicator \} from "@\/components\/projects\/shared\/components\/streaming-thinking-indicator";/u,
	);
});

test("sidebar chat has no retired thinking indicator compatibility module", () => {
	assert.equal(existsSync(RETIRED_COMPATIBILITY_MODULE), false);
});
