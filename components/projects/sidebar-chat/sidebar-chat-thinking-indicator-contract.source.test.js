const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { readChatPanelSource } = require("./chat-panel-source-harness");

const SIDEBAR_CHAT_SOURCE = readChatPanelSource();
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
