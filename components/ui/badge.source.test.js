const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const BADGE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "ui", "badge.tsx"),
	"utf8",
);

test("Badge mirrors ADS visual-uplift semantic and bold token mapping", () => {
	assert.match(BADGE_SOURCE, /neutral:\s*`bg-bg-accent-gray-subtler text-text/u);
	assert.match(BADGE_SOURCE, /informationBold:\s*`bg-bg-information-subtle text-text-information-bolder/u);
	assert.match(BADGE_SOURCE, /successBold:\s*`bg-bg-success-subtle text-text-success-bolder/u);
	assert.match(BADGE_SOURCE, /dangerBold:\s*`bg-bg-danger-subtle text-text-danger-bolder/u);
	assert.match(BADGE_SOURCE, /warningBold:\s*`bg-warning text-text-warning-bolder/u);
	assert.match(BADGE_SOURCE, /discoveryBold:\s*`bg-bg-discovery-subtle text-text-discovery-bolder/u);
	assert.doesNotMatch(BADGE_SOURCE, /dangerBold:[\s\S]*bg-destructive/u);
	assert.doesNotMatch(BADGE_SOURCE, /informationBold:[\s\S]*text-info-foreground/u);
});
