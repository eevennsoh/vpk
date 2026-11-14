const assert = require("node:assert/strict");
const test = require("node:test");
const { mergeRovoContextDescriptions } = require("./rovo-context.ts");

test("mergeRovoContextDescriptions trims and joins non-empty context blocks", () => {
	assert.equal(
		mergeRovoContextDescriptions("  First block  ", null, "Second block", undefined, "\nThird block\n"),
		"First block\n\nSecond block\n\nThird block",
	);
});

test("mergeRovoContextDescriptions returns undefined when all blocks are empty", () => {
	assert.equal(mergeRovoContextDescriptions(null, undefined, "", "   ", "\n\t"), undefined);
});
