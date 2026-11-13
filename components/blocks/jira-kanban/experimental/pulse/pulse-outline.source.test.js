/**
 * Pulse outline — the one model behind both the ruler and the article.
 *
 * Pulse is a single continuous document: every insight is on the page and the
 * reader scrolls through them. `buildPulseOutline` is what makes the ruler and
 * the prose incapable of disagreeing — the marks are generated from the same
 * entries the article is built from, and every mark is a real scroll anchor.
 *
 * All of it is pure, so all of it is executed rather than grepped. The suite
 * feeds deliberately lopsided clocks, because the property that matters is that
 * the clock cannot reach the geometry at all.
 */

const { test } = require("node:test");

const { assert, loadOutlineHarness, loadTimelineHarness } = require("./pulse-test-harness");

/** A snapshot with every part the outline reads, overridable per case. */
function snapshot(id, overrides = {}) {
	return {
		artifacts: [{ id: `${id}-a1` }],
		attention: [{ id: `${id}-s1` }],
		chapterLabel: id,
		id,
		nextActions: [{ id: `${id}-n1` }],
		...overrides,
	};
}

function timelineOf(snapshots) {
	return { looseWork: [], members: [], projectLabel: "PAY · test", snapshots, workItems: [] };
}

/* ------------------------------------------------------------------ */
/* buildPulseOutline                                                    */
/* ------------------------------------------------------------------ */

test("Pulse outline steps insights evenly however lopsided the clock", async () => {
	const { buildPulseOutline, toPulseInsightEntries } = await loadOutlineHarness();

	// One hour, then twenty-three. Under the retired time-proportional ruler the
	// middle mark sat at 1/24 of the rail, four pixels from its neighbour and
	// impossible to hit. Spacing counts insights now: a work item can run a
	// quarter or close in an afternoon, and an insight is captured whenever there
	// is something worth saying, so elapsed time clusters marks into a morning
	// and leaves a weekend of dead rail.
	const lopsided = buildPulseOutline(timelineOf([
		snapshot("a", { timestamp: "2026-08-17T08:00:00Z" }),
		snapshot("b", { timestamp: "2026-08-17T09:00:00Z" }),
		snapshot("c", { timestamp: "2026-08-18T08:00:00Z" }),
	]));
	const lopsidedOffsets = toPulseInsightEntries(lopsided).map((entry) => entry.offset);
	assert.deepEqual(lopsidedOffsets, [0, 1 / 3, 2 / 3]);
	assert.notEqual(lopsidedOffsets[1], 1 / 24, "elapsed time must no longer bunch the marks");

	// A second apart, then four months. Same count, same ruler — the timestamps
	// are not merely rescaled, they are not read.
	const clustered = buildPulseOutline(timelineOf([
		snapshot("a", { timestamp: "2026-08-17T08:00:00Z" }),
		snapshot("b", { timestamp: "2026-08-17T08:00:01Z" }),
		snapshot("c", { timestamp: "2026-12-31T23:59:59Z" }),
	]));
	assert.deepEqual(toPulseInsightEntries(clustered).map((entry) => entry.offset), lopsidedOffsets);

	// Unparseable and missing timestamps are simply irrelevant to the geometry.
	const undated = buildPulseOutline(timelineOf([
		snapshot("a", { timestamp: "nonsense" }),
		snapshot("b"),
		snapshot("c", { timestamp: "" }),
	]));
	assert.deepEqual(toPulseInsightEntries(undated).map((entry) => entry.offset), lopsidedOffsets);
});

test("Pulse outline survives degenerate input without collapsing the rail", async () => {
	const { buildPulseOutline, toPulseInsightEntries } = await loadOutlineHarness();

	assert.deepEqual(buildPulseOutline(timelineOf([])), []);

	// A lone insight has no gap to divide, so it sits at the top rather than
	// dividing by zero and taking the whole ruler with it.
	const single = buildPulseOutline(timelineOf([snapshot("only")]));
	assert.equal(toPulseInsightEntries(single).length, 1);
	assert.equal(single[0].offset, 0);
	for (const entry of single) {
		assert.ok(Number.isFinite(entry.offset), `${entry.id} left the rail: ${entry.offset}`);
		assert.ok(entry.offset >= 0 && entry.offset <= 1, `${entry.id} is outside 0..1`);
	}
});

test("Pulse outline spreads sections through the gap their insight owns", async () => {
	const { buildPulseOutline } = await loadOutlineHarness();
	const outline = buildPulseOutline(timelineOf([snapshot("a"), snapshot("b"), snapshot("c")]));
	const insights = outline.filter((entry) => entry.kind === "insight");
	const markOffsets = insights.map((entry) => entry.offset);

	assert.deepEqual(
		outline.map((entry) => entry.kind),
		["insight", "section", "section", "section", "insight", "section", "section", "section", "insight", "section", "section", "section"],
		"the outline is emitted in reading order, each insight followed by its own parts",
	);

	for (const section of outline.filter((entry) => entry.kind === "section")) {
		const own = insights[section.snapshotIndex];
		const next = insights[section.snapshotIndex + 1];
		assert.equal(section.snapshotIndex, own.snapshotIndex, "a section carries its parent's index");
		if (next === undefined) {
			// The last insight owns no gap; that case is characterised on its own
			// below rather than folded in here.
			continue;
		}
		assert.ok(section.offset > own.offset, `${section.id} sits on or above its own insight`);
		assert.ok(section.offset < next.offset, `${section.id} runs past the next insight`);
		// A section that lands on a major is a mark you cannot click: the two
		// buttons overlap and only the last one painted is reachable.
		for (const offset of markOffsets) {
			assert.notEqual(section.offset, offset, `${section.id} landed on an insight mark`);
		}
	}

	// Three sections in a gap sit at a quarter, a half and three quarters of it.
	const first = outline.filter((entry) => entry.snapshotIndex === 0 && entry.kind === "section");
	const step = insights[1].offset - insights[0].offset;
	assert.deepEqual(
		first.map((entry) => +((entry.offset - insights[0].offset) / step).toFixed(6)),
		[0.25, 0.5, 0.75],
	);
});

test("Pulse outline gives the last insight a real slice so its sections have somewhere to go", async () => {
	const { buildPulseOutline } = await loadOutlineHarness();
	const outline = buildPulseOutline(timelineOf([snapshot("a"), snapshot("b"), snapshot("c")]));
	const tail = outline.filter((entry) => entry.snapshotIndex === 2);

	// This replaces a characterisation test of a real defect. The step used to be
	// `1 / (count - 1)`, which pinned the last insight to exactly 1 and left its
	// sections nowhere to be clamped but the same pixel — insight and all three
	// sections stacked at the bottom of the rail, only the last-painted one
	// clickable. Dividing by the insight count instead gives every insight an
	// equal slice, the last one included.
	const offsets = tail.map((entry) => entry.offset);
	assert.equal(new Set(offsets).size, offsets.length, "no two marks may share a pixel");
	assert.deepEqual([...offsets].sort((a, b) => a - b), offsets, "sections follow their insight");
	for (const offset of offsets) {
		assert.ok(offset >= 0 && offset < 1, `mark outside the rail: ${offset}`);
	}
	// Strictly inside the slice: the insight owns its start, the sections sit
	// after it, and none of them reaches the end of the rail.
	assert.equal(offsets[0], 2 / 3);
	assert.ok(offsets[1] > offsets[0]);
});

test("Pulse outline gives an empty section no mark", async () => {
	const { buildPulseOutline, toPulseAnchorId } = await loadOutlineHarness();
	const outline = buildPulseOutline(timelineOf([
		snapshot("full"),
		snapshot("bare", { artifacts: [], attention: [], nextActions: [] }),
		snapshot("partial", { attention: [] }),
	]));
	const idsFor = (index) => outline.filter((entry) => entry.snapshotIndex === index).map((entry) => entry.id);

	assert.deepEqual(idsFor(0), [
		toPulseAnchorId("full"),
		toPulseAnchorId("full", "artifacts"),
		toPulseAnchorId("full", "attention"),
		toPulseAnchorId("full", "actions"),
	]);
	// An insight with nothing to jump to is still an insight; it just gets one
	// mark. A minor pointing at a heading the article never renders would scroll
	// the reader nowhere.
	assert.deepEqual(idsFor(1), [toPulseAnchorId("bare")]);
	assert.deepEqual(idsFor(2), [
		toPulseAnchorId("partial"),
		toPulseAnchorId("partial", "artifacts"),
		toPulseAnchorId("partial", "actions"),
	]);

	// Dropping a section must not shift the insight steps: they count insights.
	assert.deepEqual(
		outline.filter((entry) => entry.kind === "insight").map((entry) => entry.offset),
		[0, 1 / 3, 2 / 3],
	);
});

test("Pulse outline ids are unique and are the anchors the article renders", async () => {
	const { buildPulseOutline, toPulseAnchorId, toPulseSections } = await loadOutlineHarness();
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const outline = buildPulseOutline(PULSE_TIMELINE);

	assert.equal(new Set(outline.map((entry) => entry.id)).size, outline.length, "duplicate outline id");

	const expected = [];
	PULSE_TIMELINE.snapshots.forEach((entry) => {
		expected.push(toPulseAnchorId(entry.id));
		for (const section of toPulseSections(entry)) {
			expected.push(toPulseAnchorId(entry.id, section));
		}
	});
	// Every mark is an element the article puts on the page, by construction:
	// both sides call the same two functions.
	assert.deepEqual(outline.map((entry) => entry.id), expected);
	assert.equal(toPulseAnchorId("s1-kickoff"), "pulse-s1-kickoff");
	assert.equal(toPulseAnchorId("s1-kickoff", "actions"), "pulse-s1-kickoff-actions");

	for (const entry of outline) {
		assert.ok(entry.label.trim().length > 0, `${entry.id} has no spoken label`);
		assert.ok(entry.heading.trim().length > 0, `${entry.id} has no ruler heading`);
		assert.ok(entry.offset >= 0 && entry.offset <= 1, `${entry.id} is outside the rail`);
	}
});

test("Pulse outline headings are the insight name and the article's subsection titles", async () => {
	const { buildPulseOutline, toActiveInsightEntry, toRulerHeading } = await loadOutlineHarness();
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const outline = buildPulseOutline(PULSE_TIMELINE);
	const kickoff = outline.filter((entry) => entry.snapshotIndex === 0);

	assert.equal(PULSE_TIMELINE.snapshots[0].chapterLabel, "Adapter deleted");
	assert.deepEqual(kickoff.map((entry) => toRulerHeading(entry)), [
		"Adapter deleted",
		"Artifacts",
		"Needs input",
		"Next best actions",
	]);
	PULSE_TIMELINE.snapshots.forEach((snapshot, index) => {
		const insight = outline.find((entry) => entry.kind === "insight" && entry.snapshotIndex === index);
		assert.equal(toRulerHeading(insight), snapshot.chapterLabel, snapshot.id);
	});
	assert.equal(toActiveInsightEntry(outline, kickoff[0])?.id, kickoff[0].id);
	assert.equal(toActiveInsightEntry(outline, kickoff[2])?.id, kickoff[0].id);
	assert.equal(toActiveInsightEntry(outline, null), null);
});

test("Pulse outline steps the fixture evenly while the fixture's clock stays irregular", async () => {
	const { buildPulseOutline, toPulseInsightEntries } = await loadOutlineHarness();
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const insights = toPulseInsightEntries(buildPulseOutline(PULSE_TIMELINE));
	const last = PULSE_TIMELINE.snapshots.length - 1;

	assert.equal(insights.length, PULSE_TIMELINE.snapshots.length);
	assert.deepEqual(insights.map((entry) => entry.snapshotIndex), insights.map((_, index) => index));
	const count = PULSE_TIMELINE.snapshots.length;
	assert.equal(insights[0].offset, 0);
	// The last insight stops short of the rail's end on purpose: it owns a slice
	// like every other, which is what leaves room for its own section marks.
	assert.ok(Math.abs(insights[last].offset - (1 - 1 / count)) < 1e-12);
	const gaps = insights.slice(1).map((entry, index) => entry.offset - insights[index].offset);
	for (const gap of gaps) {
		assert.ok(Math.abs(gap - 1 / count) < 1e-12, `uneven step: ${gap}`);
	}

	// The evenness is only a real property if the clock it ignores is genuinely
	// lopsided; an evenly spaced fixture would prove nothing. The fixture's
	// longest gap is over three times its shortest — 31.75h against 9.7h — which
	// under the retired time-proportional ruler was the difference between a
	// comfortable target and a four-pixel one.
	const times = PULSE_TIMELINE.snapshots.map((entry) => new Date(entry.timestamp).getTime());
	const elapsed = times.slice(1).map((time, index) => time - times[index]);
	assert.ok(
		Math.max(...elapsed) > 3 * Math.min(...elapsed),
		`the fixture clock should still be lopsided, saw ${Math.max(...elapsed)} vs ${Math.min(...elapsed)}`,
	);
});

/* ------------------------------------------------------------------ */
/* Reading position                                                     */
/* ------------------------------------------------------------------ */

test("Pulse outline resolves the reading position to the last entry that passed the line", async () => {
	const { toActiveOutlineIndex } = await loadOutlineHarness();

	// Positions are each anchor's distance from the reading line: negative once
	// it has scrolled above it. A reader at the very top of the document is
	// reading the first insight, not nothing, so nothing-passed still resolves.
	assert.equal(toActiveOutlineIndex([12, 340, 900]), 0);
	assert.equal(toActiveOutlineIndex([]), 0);
	assert.equal(toActiveOutlineIndex([-900, -420, -8, 260]), 2);
	// Exactly on the line counts as read; a jump parks its target there.
	assert.equal(toActiveOutlineIndex([-40, 0, 90]), 1);
	// The last that passed wins even when an anchor below it is out of order,
	// which happens while a re-keyed article is mid-layout.
	assert.equal(toActiveOutlineIndex([-10, 40, -5, 300]), 2);
	// An unmeasured anchor reports Infinity rather than dropping out of the list.
	assert.equal(toActiveOutlineIndex([-10, Number.POSITIVE_INFINITY, -2]), 2);

	// Ties are stable: several anchors at the same position resolve to the last,
	// which is what the bottom of the rail is full of while the trailing sections
	// stack on the final mark.
	assert.equal(toActiveOutlineIndex([-5, 0, 0, 0]), 3);
	assert.equal(toActiveOutlineIndex([-5, 0, 0, 0]), toActiveOutlineIndex([-5, 0, 0, 0]));

	// Sub-pixel scroll rounding is absorbed by the default threshold rather than
	// by every caller. A jump parks its anchor exactly on the line and the
	// browser then leaves it a hundredth of a pixel short — measured at +0.005px,
	// which used to light the mark above the one just clicked.
	assert.equal(toActiveOutlineIndex([-40, 0.005, 300]), 1);
	assert.equal(toActiveOutlineIndex([-40, 0.005, 300], 0), 0, "the tolerance is still a parameter");
	// A whole pixel is the tolerance, not a licence: 40px away is not "read".
	assert.equal(toActiveOutlineIndex([-40, 40, 300]), 0);
});

test("Pulse outline lists only the sections an insight actually renders, in article order", async () => {
	const { toPulseSections } = await loadOutlineHarness();
	const { PULSE_TIMELINE } = await loadTimelineHarness();

	assert.deepEqual(toPulseSections(snapshot("s")), ["artifacts", "attention", "actions"]);
	assert.deepEqual(toPulseSections(snapshot("s", { artifacts: [] })), ["attention", "actions"]);
	assert.deepEqual(toPulseSections(snapshot("s", { attention: [] })), ["artifacts", "actions"]);
	assert.deepEqual(toPulseSections(snapshot("s", { nextActions: [] })), ["artifacts", "attention"]);
	assert.deepEqual(toPulseSections(snapshot("s", { artifacts: [], attention: [], nextActions: [] })), []);

	// Article order, not fixture order: the same three headings in the same
	// sequence in every insight, which is what makes the ruler's texture legible.
	for (const entry of PULSE_TIMELINE.snapshots) {
		assert.deepEqual(toPulseSections(entry), ["artifacts", "attention", "actions"], entry.id);
	}
});

test("Pulse section stats are the subsection TOC, labelled and counted from the article", async () => {
	const { toPulseAnchorId, toPulseSectionStats, toSectionHeading } = await loadOutlineHarness();
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const kickoff = PULSE_TIMELINE.snapshots[0];
	const stats = toPulseSectionStats(kickoff, {
		artifacts: kickoff.artifacts.length,
		attention: kickoff.attention.length,
		nextActions: kickoff.nextActions.length,
	});

	assert.equal(toSectionHeading("attention"), "Needs input");
	assert.deepEqual(stats.map((row) => row.label), [
		"Artifacts",
		"Needs input",
		"Next best actions",
	]);
	assert.deepEqual(stats.map((row) => row.id), [
		toPulseAnchorId(kickoff.id, "artifacts"),
		toPulseAnchorId(kickoff.id, "attention"),
		toPulseAnchorId(kickoff.id, "actions"),
	]);
	assert.deepEqual(stats.map((row) => row.value), [
		String(kickoff.artifacts.length),
		String(kickoff.attention.length),
		String(kickoff.nextActions.length),
	]);

	// Presence follows the unscoped snapshot; the number is whatever this page
	// actually holds, so a filtered-empty section still has somewhere to jump.
	const zeroed = toPulseSectionStats(kickoff, { artifacts: 0, attention: 0, nextActions: 0 });
	assert.equal(zeroed.length, 3);
	assert.deepEqual(zeroed.map((row) => row.value), ["0", "0", "0"]);
	assert.deepEqual(
		toPulseSectionStats({ ...kickoff, attention: [] }, { artifacts: 4, attention: 0, nextActions: 2 }).map(
			(row) => row.key,
		),
		["artifacts", "actions"],
	);
});

test("Pulse outline exposes the insight marks on their own for snapshot-to-snapshot moves", async () => {
	const { buildPulseOutline, toPulseInsightEntries } = await loadOutlineHarness();
	const outline = buildPulseOutline(timelineOf([
		snapshot("a"),
		snapshot("b", { artifacts: [], attention: [], nextActions: [] }),
		snapshot("c"),
	]));
	const insights = toPulseInsightEntries(outline);

	assert.deepEqual(insights.map((entry) => entry.id), ["pulse-a", "pulse-b", "pulse-c"]);
	assert.ok(insights.every((entry) => entry.kind === "insight"));
	// One per snapshot regardless of how many sections each one earned, so a jump
	// by insight can never miss one.
	assert.deepEqual(insights.map((entry) => entry.snapshotIndex), [0, 1, 2]);
	assert.deepEqual(toPulseInsightEntries([]), []);
});

test("Pulse insight nav disables at the ends and targets the adjacent snapshot", async () => {
	const { toAdjacentInsightIndex } = await loadOutlineHarness();
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const count = PULSE_TIMELINE.snapshots.length;
	const last = count - 1;

	assert.equal(toAdjacentInsightIndex(0, count, "previous"), null);
	assert.equal(toAdjacentInsightIndex(0, count, "next"), 1);
	assert.equal(toAdjacentInsightIndex(1, count, "previous"), 0);
	assert.equal(toAdjacentInsightIndex(1, count, "next"), 2);
	assert.equal(toAdjacentInsightIndex(last, count, "previous"), last - 1);
	assert.equal(toAdjacentInsightIndex(last, count, "next"), null);
	assert.equal(toAdjacentInsightIndex(0, 1, "previous"), null);
	assert.equal(toAdjacentInsightIndex(0, 1, "next"), null);
	assert.equal(toAdjacentInsightIndex(0, 0, "next"), null);
	assert.equal(toAdjacentInsightIndex(Number.NaN, count, "next"), null);
});

test("Pulse scroll alignment keeps ruler and header jumps on their own lines", async () => {
	const { toPulseMeasureLineY, toPulseScrollOffset } = await loadOutlineHarness();
	const geometry = {
		anchorTop: 720,
		readingLine: 0.28,
		scrollportHeight: 600,
		scrollportTop: 120,
	};

	assert.equal(
		toPulseMeasureLineY({ ...geometry, alignment: "reading-line" }),
		288,
		"free scrolling still reads at the established 28% line",
	);
	assert.equal(
		toPulseMeasureLineY({ ...geometry, alignment: "start", startInset: 4 }),
		124,
		"start-aligned jumps measure from the scroller top plus the content inset",
	);
	assert.equal(
		toPulseScrollOffset({ ...geometry, alignment: "reading-line" }),
		432,
		"reading-line jumps retain the established 28% reading line",
	);
	assert.equal(
		toPulseScrollOffset({ ...geometry, alignment: "start", startInset: 4 }),
		596,
		"start-aligned jumps honor the 4px content inset, not a reserved fade band",
	);
	assert.equal(
		toPulseScrollOffset({ ...geometry, alignment: "start" }),
		600,
		"start alignment should still work when the scrollport has no reserved inset",
	);
});

test("Pulse top fade paints while the article is clipped, except after a start-aligned jump", async () => {
	const { isPulseChevronHeaderJump, toPulseArticleTopFadeVisible } = await loadOutlineHarness();

	assert.equal(toPulseArticleTopFadeVisible(true, false), true, "a rest-state clip should fade");
	assert.equal(toPulseArticleTopFadeVisible(false, false), false, "the top of the article has nothing to fade");
	assert.equal(
		toPulseArticleTopFadeVisible(true, true),
		false,
		"a start-aligned jump pins the destination section into the fade band",
	);
	assert.equal(isPulseChevronHeaderJump({ align: "start" }), true);
	assert.equal(isPulseChevronHeaderJump({ align: "reading-line" }), false);
	assert.equal(isPulseChevronHeaderJump(undefined), false);
});

/* ------------------------------------------------------------------ */
/* The lead entry — a scope brief opening the article                   */
/* ------------------------------------------------------------------ */

test("Pulse leaves the outline untouched when the article has no lead", async () => {
	const { buildPulseOutline } = await loadOutlineHarness();

	const timeline = timelineOf([snapshot("one"), snapshot("two")]);
	assert.deepEqual(
		buildPulseOutline(timeline, null),
		buildPulseOutline(timeline),
		"an absent lead must not change a single offset",
	);
});

test("Pulse gives a scope brief a whole slice of the rail rather than the first insight's", async () => {
	const { buildPulseOutline } = await loadOutlineHarness();

	const lead = { id: "pulse-scope", heading: "Sprint 24", label: "Sprint 24 — scope" };
	const entries = buildPulseOutline(timelineOf([snapshot("one"), snapshot("two")]), lead);

	// Two marks at offset 0 stack on one pixel and only the upper one can be
	// clicked, so the brief has to shift the insights down a slot rather than
	// squeeze in above the first one.
	assert.equal(entries[0].id, "pulse-scope");
	assert.equal(entries[0].offset, 0);
	assert.equal(entries[0].kind, "section", "the brief is not a snapshot");
	assert.equal(entries[0].snapshotIndex, 0, "reading the brief should show the first window's work");

	const insights = entries.filter((entry) => entry.kind === "insight");
	assert.deepEqual(insights.map((entry) => entry.offset), [1 / 3, 2 / 3]);
	assert.ok(
		entries.every((entry) => entry.offset >= 0 && entry.offset < 1),
		"no mark may be pinned to the very bottom of the rail",
	);
});

test("Pulse keeps chevron navigation on insights when a lead is present", async () => {
	const { buildPulseOutline, toPulseInsightEntries } = await loadOutlineHarness();

	const lead = { id: "pulse-scope", heading: "PAY-90", label: "PAY-90 — scope" };
	const entries = buildPulseOutline(timelineOf([snapshot("one"), snapshot("two")]), lead);

	// `scrollToSnapshot` resolves `kind === "insight"`. If the brief claimed that
	// kind, the first chevron press would land on the brief instead of insight 1.
	assert.deepEqual(
		toPulseInsightEntries(entries).map((entry) => entry.snapshotIndex),
		[0, 1],
	);
});

test("Pulse still returns an empty outline for an empty timeline, lead or not", async () => {
	const { buildPulseOutline } = await loadOutlineHarness();

	const lead = { id: "pulse-scope", heading: "Sprint 24", label: "Sprint 24 — scope" };
	assert.deepEqual(buildPulseOutline(timelineOf([]), lead), []);
});
