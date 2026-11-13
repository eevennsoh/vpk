const test = require("node:test");
const assert = require("node:assert/strict");

const {
	DAILY_INSIGHTS_ROW_CLASSES,
	DAILY_INSIGHTS_ROW_FIXED_SEGMENTS,
	DAILY_INSIGHTS_ROW_SHRINKABLE_WRAPPERS,
} = require("./daily-insights-row-classes.ts");

// The longest chapter name in the real board fixture is "Ship readiness" (14
// characters), which fits on one line. This is roughly twice that, and once the
// meta line renders it as an uppercase tracked eyebrow it is far wider than the
// 295px card can show — so it is the case the contract below exists for.
const LONG_CHAPTER_LABEL = "Cross-region failover rehearsal";
const LONGEST_PRODUCTION_CHAPTER_LABEL = "Ship readiness";

function classesOf(key) {
	return DAILY_INSIGHTS_ROW_CLASSES[key].split(" ");
}

test("the fixture is materially longer than anything the real board ships", () => {
	// If the production data ever grows past the fixture this test is no longer
	// exercising an overflow case, and the fixture needs to grow with it.
	assert.ok(
		LONG_CHAPTER_LABEL.length >= LONGEST_PRODUCTION_CHAPTER_LABEL.length * 2,
		`fixture (${LONG_CHAPTER_LABEL.length}) must be at least twice the longest real label (${LONGEST_PRODUCTION_CHAPTER_LABEL.length})`,
	);
});

test("a long chapter label ellipsizes instead of pushing its siblings out", () => {
	const chapter = classesOf("chapterLabel");

	assert.ok(chapter.includes("truncate"), "the chapter label owns the ellipsis");
	assert.ok(chapter.includes("min-w-0"), "and can shrink below its content width to do so");
});

test("the time label and separator hold their width", () => {
	// The failure mode: without `shrink-0` the time gets compressed or pushed
	// out of the row entirely by a long chapter name.
	assert.ok(classesOf("timeLabel").includes("shrink-0"));
	assert.ok(classesOf("metaSeparator").includes("shrink-0"));
});

test("the chevron keeps its column", () => {
	// The other failure mode: the affordance cue drifts left, or off the row,
	// when the text beside it overflows.
	assert.ok(classesOf("chevron").includes("shrink-0"));
});

test("every wrapper between the row and the chapter label can shrink", () => {
	// A flex item defaults to `min-width: auto` and refuses to go below its
	// content. One missing `min-w-0` anywhere in this chain and the ellipsis
	// never happens, however correct the chapter label's own classes are.
	for (const key of DAILY_INSIGHTS_ROW_SHRINKABLE_WRAPPERS) {
		assert.ok(classesOf(key).includes("min-w-0"), `${key} must carry min-w-0`);
	}
});

test("the chapter label is the only segment that may shrink", () => {
	// Two shrinking segments means neither reliably owns the ellipsis.
	for (const key of DAILY_INSIGHTS_ROW_FIXED_SEGMENTS) {
		assert.ok(!classesOf(key).includes("truncate"), `${key} must not truncate`);
	}

	assert.ok(!classesOf("chapterLabel").includes("shrink-0"), "the chapter label must stay shrinkable");
});

test("the title clamps rather than truncating on one line", () => {
	// Titles are full sentences; a single-line ellipsis would make them
	// meaningless. Two lines is the deliberate trade.
	const title = classesOf("title");

	assert.ok(title.includes("line-clamp-2"));
	assert.ok(!title.includes("truncate"));
});
