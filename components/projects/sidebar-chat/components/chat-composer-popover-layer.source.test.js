const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
	path.join(__dirname, "chat-composer.tsx"),
	"utf8",
);

test("compact chat customize popover is layered above chat surfaces", () => {
	assert.match(
		source,
		/<PopoverContent[^>]*positionerClassName="z-\[600\]"[^>]*>/u,
	);
});

test("compact chat add menu is layered above chat surfaces", () => {
	assert.match(
		source,
		/<PromptInputActionMenuContent[\s\S]*positionerClassName="z-\[600\]"[\s\S]*side="top"[\s\S]*sideOffset=\{8\}[\s\S]*>/u,
	);
});
