const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const DATE_LABEL_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "ui", "date-label.tsx"),
	"utf8",
);

test("DateLabel mirrors package appearance tokens and compatibility aliases", () => {
	assert.match(DATE_LABEL_SOURCE, /neutral: "border-border-accent-gray-subtle text-text"/u);
	assert.match(DATE_LABEL_SOURCE, /warning: "border-border-warning-subtle text-text-warning"/u);
	assert.match(DATE_LABEL_SOURCE, /danger: "border-border-danger-subtle text-text-danger"/u);
	assert.match(DATE_LABEL_SOURCE, /appearance\?: DateLabelVariant/u);
	assert.match(DATE_LABEL_SOURCE, /hasIconBefore\?: boolean/u);
	assert.match(DATE_LABEL_SOURCE, /isSpacious\?: boolean/u);
	assert.match(DATE_LABEL_SOURCE, /const resolvedVariant = appearance \?\? variant \?\? "neutral"/u);
	assert.match(DATE_LABEL_SOURCE, /const resolvedSize = isSpacious \? "spacious" : size \?\? "default"/u);
});
