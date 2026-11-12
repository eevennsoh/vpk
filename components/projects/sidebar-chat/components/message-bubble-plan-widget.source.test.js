const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MESSAGE_BUBBLE_FILE = path.join(__dirname, "message-bubble.tsx");
const MESSAGE_BUBBLE_SOURCE = fs.readFileSync(MESSAGE_BUBBLE_FILE, "utf8");

test("compact chat renders deferred plan widgets through the shared plan card", () => {
	assert.match(
		MESSAGE_BUBBLE_SOURCE,
		/import \{ PlanWidgetInlineCard \} from "@\/components\/projects\/shared\/components\/plan-widget-inline-card";/,
	);
	assert.match(
		MESSAGE_BUBBLE_SOURCE,
		/parsePlanWidgetPayload\(widget\.data\)/,
	);
	assert.match(
		MESSAGE_BUBBLE_SOURCE,
		/<PlanWidgetInlineCard/,
	);
	assert.match(
		MESSAGE_BUBBLE_SOURCE,
		/onBuild=\{\s*onBuildPlan && hasDeferredToolCall/s,
	);
});

test("compact chat keeps non-plan widget rendering behind enableSmartWidgets", () => {
	assert.match(
		MESSAGE_BUBBLE_SOURCE,
		/enableSmartWidgets \|\| hasPlanWidget/,
	);
	assert.match(
		MESSAGE_BUBBLE_SOURCE,
		/if \(!enableSmartWidgets\) \{\s*return null;\s*\}/s,
	);
});
