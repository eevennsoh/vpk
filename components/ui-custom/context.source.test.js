const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(join(__dirname, "context.tsx"), "utf8");

function sourceAfter(start) {
	const startIndex = SOURCE.indexOf(start);

	assert.notEqual(startIndex, -1, `${start} should exist`);

	return SOURCE.slice(startIndex);
}

test("Context number formatters are reused across render helpers", () => {
	assert.equal((SOURCE.match(/new Intl\.NumberFormat/g) ?? []).length, 3);
	assert.match(SOURCE, /const PERCENT_FORMATTER = new Intl\.NumberFormat/);
	assert.match(SOURCE, /const COMPACT_NUMBER_FORMATTER = new Intl\.NumberFormat/);
	assert.match(SOURCE, /const USD_FORMATTER = new Intl\.NumberFormat/);

	const renderHelpers = sourceAfter("export function ContextTrigger");

	assert.doesNotMatch(renderHelpers, /new Intl\.NumberFormat/);
	assert.match(renderHelpers, /PERCENT_FORMATTER\.format\(usedPercent\)/);
	assert.match(renderHelpers, /COMPACT_NUMBER_FORMATTER\.format\(usedTokens\)/);
	assert.match(renderHelpers, /USD_FORMATTER\.format\(costUSD \?\? 0\)/);
});

test("Context reads AI SDK v7 reasoning and cache token detail fields", () => {
	assert.match(SOURCE, /usage\?\.outputTokenDetails\.reasoningTokens \?\? 0/u);
	assert.match(SOURCE, /usage\?\.inputTokenDetails\.cacheReadTokens \?\? 0/u);
	assert.doesNotMatch(SOURCE, /usage\?\.(?:reasoningTokens|cachedInputTokens)/u);
});
