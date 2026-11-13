/**
 * Pulse scrubber — the ruler that is the article's outline, and the pointer
 * gesture that reads it.
 *
 * What changed under the continuous-article model: the ruler no longer owns a
 * model. It used to build its own tick geometry from snapshot timestamps
 * (`toSnapshotOffsets`, `buildTickModel`) and hand back a snapshot index
 * (`toNearestSnapshotIndex`). Both the spacing and the anchors now come from
 * `buildPulseOutline`, so the marks and the prose cannot disagree — the even
 * insight spacing, the section spread and the anchor ids are asserted in
 * `pulse-outline.source.test.js`, against the frozen contract that produces them.
 *
 * What is left here is what the ruler still owns: how a mark is drawn and
 * spoken (`toMarkState`, `toMarkLabel`, `toWeekdayLabel`), where the pointer
 * resolves to (`toNearestEntryIndex`, `toMagnification`), and the wiring that
 * cannot run in Node — the pointer handlers and the roving tabindex.
 */

const { test } = require("node:test");

const {
	assert,
	loadOutlineHarness,
	loadScrubberHarness,
	loadTimelineHarness,
	SOURCES,
} = require("./pulse-test-harness");

test("Pulse scrubber draws the outline it is handed and derives no geometry of its own", async () => {
	const { buildPulseOutline } = await loadOutlineHarness();
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const outline = buildPulseOutline(PULSE_TIMELINE);

	// Position comes straight off the entry. Nothing between the outline and the
	// pixel: no second offset table to drift, no filler minors with no anchor
	// behind them, and no timestamp arithmetic anywhere in the file.
	assert.match(SOURCES.scrubber, /style=\{axis === "y" \? \{ top: `\$\{entry\.offset \* 100\}%` \}/u);
	assert.match(SOURCES.scrubber, /\{ left: `\$\{entry\.offset \* 100\}%` \}\}/u);
	assert.match(SOURCES.scrubber, /\{marks\.map\(\(\{ entry, isActive, label, state, tabbable \}, index\) => \(/u);
	assert.doesNotMatch(SOURCES.scrubber, /new Date\(|getTime\(\)|\.timestamp/u, "the ruler must not read the clock");
	assert.doesNotMatch(SOURCES.marks, /new Date\(|getTime\(\)/u, "nor may its geometry");
	assert.doesNotMatch(SOURCES.scrubber, /buildTickModel|toSnapshotOffsets|toNearestSnapshotIndex/u);

	// Both ranks are drawn from one list and both are selectable, so there are no
	// dead zones on the rail.
	assert.ok(outline.some((entry) => entry.kind === "insight"));
	assert.ok(outline.some((entry) => entry.kind === "section"));
	assert.match(SOURCES.marks, /RULE_WEIGHT: Record<PulseOutlineKind, Record<PulseMarkState, PulseRuleWeight>>/u);
	// A section may never swell to an insight's length, or the two ranks trade
	// places under the pointer and the outline stops reading as a hierarchy.
	// The weights moved to `lib/pulse-marks.ts` with the rest of the geometry —
	// a component file that also exports helpers defeats Fast Refresh.
	const insightPeak = Number.parseInt(SOURCES.marks.match(/current: \{ rest: 14, peak: (\d+)/u)[1], 10);
	const sectionPeak = Number.parseInt(SOURCES.marks.match(/current: \{ rest: 8, peak: (\d+)/u)[1], 10);
	assert.ok(sectionPeak < insightPeak, `a section peaks at ${sectionPeak} against an insight's ${insightPeak}`);
});

test("Pulse scrubber never lets the current position override a member's absence", async () => {
	const { isInsightRevised, toMarkLabel, toMarkState, toPulseInsightEyebrow, toPulseInsightHeadline } = await loadScrubberHarness();
	const snapshot = { chapterLabel: "Night shift", dateLabel: "Wed 19 Aug", timeLabel: "02:30" };
	const revised = {
		...snapshot,
		updatedDateLabel: "Wed 19 Aug",
		updatedTimeLabel: "08:15",
	};
	const insight = { heading: "Night shift", id: "pulse-s4", kind: "insight", label: "Night shift", offset: 0.5, snapshotIndex: 3 };
	const section = { heading: "Needs input", id: "pulse-s4-attention", kind: "section", label: "Night shift — Needs input", offset: 0.58, snapshotIndex: 3 };

	// The bug this guards: reading into a window the filtered member sat out used
	// to make that absent mark the darkest one on the whole ruler.
	assert.equal(toMarkState(true, true), "muted");
	assert.equal(toMarkState(true, false), "muted");
	assert.equal(toMarkState(false, true), "current");
	assert.equal(toMarkState(false, false), "resting");

	// Muting is visual; the accessible name has to carry the same fact. The rank
	// is spoken too — it is otherwise carried by rule length alone. The stamp is
	// when the outcome was generated, not a time-window, because the ruler no
	// longer is a clock.
	assert.equal(toMarkLabel(insight, snapshot, false, "Maya Ferreira"), "Insight: Night shift — generated Wed 19 Aug, 02:30");
	assert.equal(
		toMarkLabel(insight, snapshot, true, "Maya Ferreira"),
		"Insight: Night shift — generated Wed 19 Aug, 02:30 — no activity from Maya Ferreira",
	);
	assert.equal(
		toMarkLabel(insight, revised, false, null),
		"Insight: Night shift — generated Wed 19 Aug, 02:30, last updated Wed 19 Aug, 08:15",
	);
	assert.equal(isInsightRevised(snapshot), false);
	assert.equal(isInsightRevised(revised), true);
	assert.equal(
		isInsightRevised({
			dateLabel: "Wed 19 Aug",
			timeLabel: "02:30",
			timestamp: "2026-08-19T02:30:00Z",
			updatedAt: "2026-08-19T02:30:41Z",
			updatedDateLabel: "Wed 19 Aug",
			updatedTimeLabel: "02:30",
		}),
		true,
		"a revision inside the same displayed minute is still a revision",
	);
	assert.equal(
		isInsightRevised({
			dateLabel: "Wed 19 Aug",
			timeLabel: "02:30",
			timestamp: "2026-08-19T02:30:00Z",
			updatedAt: "2026-08-19T02:30:00Z",
			updatedDateLabel: "Wed 19 Aug",
			updatedTimeLabel: "02:30",
		}),
		false,
	);
	assert.equal(
		toPulseInsightEyebrow(revised),
		"Night shift · Last updated Wed 19 Aug 08:15",
	);
	assert.equal(
		toPulseInsightEyebrow({ ...snapshot, updatedDateLabel: "Wed 19 Aug", updatedTimeLabel: "02:30" }),
		"Night shift · Last updated Wed 19 Aug 02:30",
	);
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	assert.equal(
		toPulseInsightEyebrow(PULSE_TIMELINE.snapshots[0]),
		"Adapter deleted · Last updated Mon 17 Aug 09:26",
	);
	assert.equal(
		toPulseInsightHeadline({ title: "We agreed to delete the adapter, not wrap it" }, null),
		"We agreed to delete the adapter, not wrap it",
	);
	assert.equal(
		toPulseInsightHeadline(
			{ title: "We agreed to delete the adapter, not wrap it" },
			{ title: "The first port does not ship without a kill switch" },
		),
		"The first port does not ship without a kill switch",
	);
	assert.equal(
		toPulseInsightHeadline({ title: "We agreed to delete the adapter, not wrap it" }, { title: "  " }),
		"We agreed to delete the adapter, not wrap it",
	);
	// A section's label already names its parent insight, so it does not repeat
	// the timestamp.
	assert.equal(toMarkLabel(section, snapshot, false, null), "Section: Night shift — Needs input");
	assert.equal(
		toMarkLabel(section, snapshot, true, null),
		"Section: Night shift — Needs input — no activity from the selected member",
	);
	// A mark with no snapshot behind it still speaks rather than saying "undefined".
	assert.equal(toMarkLabel(insight, undefined, false, null), "Insight: Night shift");
});

test("Pulse scrubber slides one pill through insight and section headings", async () => {
	const { toMarkHint, toWeekdayLabel } = await loadScrubberHarness();
	const { buildPulseOutline, toRulerHeading } = await loadOutlineHarness();
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const outline = buildPulseOutline(PULSE_TIMELINE);
	const kickoff = outline.filter((entry) => entry.snapshotIndex === 0);

	// The weekday helper remains for accessible names; the pill no longer uses it.
	assert.equal(toWeekdayLabel("Mon 17 Aug"), "Mon");
	assert.deepEqual(kickoff.map((entry) => toRulerHeading(entry)), [
		"Adapter deleted",
		"Artifacts",
		"Needs input",
		"Next best actions",
	]);
	assert.equal(toMarkHint(kickoff[0], kickoff[0].id), null, "the sliding pill already names Adapter deleted");
	assert.equal(toMarkHint(kickoff[1], kickoff[0].id), null, "child ticks stay unlabeled");
	assert.equal(toMarkHint(kickoff[2], kickoff[0].id), null);
	assert.equal(toMarkHint(kickoff[3], kickoff[0].id), null);
	assert.equal(toMarkHint(kickoff[1], kickoff[1].id), null, "the active section is the pill, not a tick label");
	assert.equal(toMarkHint(kickoff[0], kickoff[1].id), "Adapter deleted", "inactive insights may reveal their name on hover");

	assert.match(SOURCES.scrubber, /toRulerHeading\(activeEntry\)/u);
	assert.match(SOURCES.scrubber, /toMarkHint\(entry, activeEntry\?\.id \?\? null\)/u);
	assert.match(SOURCES.scrubber, /top: `\$\{activeEntry\.offset \* 100\}%`/u);
	assert.match(
		SOURCES.scrubber,
		/const PILL = "bg-bg-neutral-bold text-text-inverse inline-flex items-center rounded-md/u,
	);
	assert.doesNotMatch(SOURCES.scrubber, /bg-primary|text-primary-foreground/u);
	assert.doesNotMatch(SOURCES.scrubber, /toWeekdayLabel\(activeSnapshot|activeSnapshot\.timeLabel/u);
	assert.doesNotMatch(SOURCES.scrubber, /hintAlways/u);
});

test("Pulse ruler preview dims every article section except its matching anchor", async () => {
	const { isPulseSectionDimmed } = await loadScrubberHarness();
	const artifactsId = "pulse-s1-kickoff-artifacts";

	assert.equal(isPulseSectionDimmed(null, artifactsId), false, "idle leaves the reading-position opacity in charge");
	assert.equal(isPulseSectionDimmed(artifactsId, artifactsId), false, "the matching section stays at full opacity");
	assert.equal(isPulseSectionDimmed(artifactsId, "pulse-s1-kickoff"), true, "the intro recedes");
	assert.equal(isPulseSectionDimmed(artifactsId, "pulse-s1-kickoff-attention"), true, "a sibling section recedes");
	assert.equal(isPulseSectionDimmed(artifactsId, "pulse-s2-first-cut"), true, "sections in other insights recede");

	assert.match(SOURCES.scrubber, /onHoveredEntryChange\(hoveredEntryId\)/u);
	assert.match(SOURCES.scrubber, /onFocus=\{\(\) => onFocusChange\(entry\.id\)\}/u);
	assert.match(SOURCES.shell, /const previewEntryId = focusedEntryId \?\? hoveredEntryId;/u);
	assert.match(SOURCES.stream, /previewEntryId=\{previewEntry\?\.id \?\? null\}/u);
	assert.match(SOURCES.story, /const SECTION_DIMMED = "opacity-\(--opacity-disabled\)";/u);
});

test("Pulse vertical scrubber limits pointer capture to a 24px tick strip", () => {
	const verticalScrubber = SOURCES.scrubber.slice(
		SOURCES.scrubber.indexOf("export function PulseScrubber("),
		SOURCES.scrubber.indexOf("export function PulseScrubberCompact("),
	);

	assert.match(verticalScrubber, /className="pointer-events-none relative h-full min-h-\[24rem\] w-36"/u);
	assert.match(verticalScrubber, /className="pointer-events-auto relative h-full w-6"/u);
	assert.doesNotMatch(verticalScrubber, /className="[^"]*pointer-events-auto[^"]*w-36/u);
	// Rules and labels can paint beyond the 24px button without extending its
	// hit target into the article.
	assert.match(SOURCES.scrubber, /className=\{axis === "y" \? "pointer-events-none absolute left-0 h-px bg-text"/u);
	assert.match(SOURCES.scrubber, /className="pointer-events-none absolute top-1\/2 left-5/u);
});

test("Pulse keeps its keyboard and screen-reader affordances on the scrubber", () => {
	assert.match(SOURCES.scrubber, /role="listbox"/u);
	assert.match(SOURCES.scrubber, /aria-orientation="vertical"/u);
	assert.match(SOURCES.scrubber, /aria-orientation="horizontal"/u);
	assert.match(SOURCES.scrubber, /role="option"/u);
	assert.match(SOURCES.scrubber, /aria-selected=\{isActive\}/u);
	// Roving tabindex is clamped rather than tied to `isActive`: an active index
	// outside the outline — an empty article, a filter that shortened it
	// mid-frame — would otherwise leave the whole ruler unreachable by Tab.
	assert.match(SOURCES.scrubber, /tabIndex=\{tabbable \? 0 : -1\}/u);
	assert.match(SOURCES.scrubber, /const focusIndex = Math\.min\(Math\.max\(activeEntryIndex, 0\), entries\.length - 1\);/u);
	// Home/End walk the whole outline, both ranks, not just the insights.
	assert.match(SOURCES.scrubber, /event\.key === "Home" \? 0 : entries\.length - 1/u);
	assert.match(SOURCES.scrubber, /ArrowDown: 1,[\s\S]*ArrowUp: -1,/u);
	assert.match(SOURCES.scrubber, /focus-visible:ring-2/u);
	// Arrows step from the focused mark, not the reading position: selecting
	// scrolls the article and the position only catches up next frame, so
	// stepping from it would drop a keypress whenever key repeat outran it.
	assert.match(SOURCES.scrubber, /const focused = markRefs\.current\.findIndex\(\(node\) => node !== null && node === document\.activeElement\);/u);
});

test("Pulse scrubber magnification falls off smoothly and has compact support", async () => {
	const { toMagnification } = await loadScrubberHarness();
	// Peak under the pointer, nothing at or beyond the radius. Compact support
	// is what keeps the far half of the ruler perfectly still while the near
	// half swells — an exponential falloff would leave the whole column
	// breathing faintly, which reads as drift rather than response.
	assert.strictEqual(toMagnification(0, 76), 1);
	assert.strictEqual(toMagnification(76, 76), 0);
	assert.strictEqual(toMagnification(400, 76), 0);
	assert.strictEqual(toMagnification(-20, 76), toMagnification(20, 76), "falloff is symmetric about the pointer");
	// Monotonic decay, so a neighbour can never out-swell a closer mark.
	let previous = Infinity;
	for (let distance = 0; distance <= 76; distance += 4) {
		const value = toMagnification(distance, 76);
		assert.ok(value <= previous, `magnification rose at ${distance}px`);
		assert.ok(value >= 0 && value <= 1, `magnification left 0..1 at ${distance}px`);
		previous = value;
	}
	// A NaN reaching a motion value poisons it permanently — the ruler would
	// never recover for the life of the component.
	assert.strictEqual(toMagnification(Number.NaN, 76), 0);
	assert.strictEqual(toMagnification(Number.POSITIVE_INFINITY, 76), 0);
	assert.strictEqual(toMagnification(10, 0), 0, "a rail of zero size cannot divide");
});

test("Pulse scrubber resolves the nearest outline entry, majors and minors alike", async () => {
	const { toNearestEntryIndex } = await loadScrubberHarness();
	const { buildPulseOutline } = await loadOutlineHarness();
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const entries = buildPulseOutline(PULSE_TIMELINE);

	// Every entry is a target now. Under the retired model the minors were filler
	// with nothing behind them and the pointer had to be snapped back to the
	// nearest major; a section is a real place in the article, so the nearest
	// mark is simply the nearest mark.
	entries.forEach((entry, index) => {
		const resolved = toNearestEntryIndex(entries, entry.offset);
		assert.equal(entries[resolved].offset, entry.offset, `offset ${entry.offset} did not resolve to its own mark`);
		if (entries.filter((candidate) => candidate.offset === entry.offset).length === 1) {
			assert.strictEqual(resolved, index, entry.id);
		}
	});
	const section = entries.find((entry) => entry.kind === "section");
	assert.ok(section, "the fixture should produce section marks");
	assert.strictEqual(entries[toNearestEntryIndex(entries, section.offset)].kind, "section");

	// The ends clamp rather than wrap, and a midpoint falls to one side or the
	// other — never to null, or the sweep would have a hole in it.
	assert.strictEqual(toNearestEntryIndex(entries, -5), 0);
	// Past the bottom resolves to the FIRST entry holding the largest offset, not
	// the last: the scan keeps its incumbent on a tie (`distance < shortest`).
	// With the outline stacking the final insight and its three sections on
	// offset 1 (see `pulse-outline.source.test.js`), that is the insight rather than the
	// last section — and it disagrees with `toActiveOutlineIndex`, which resolves
	// a tie to the last. Both behaviours are defensible; the disagreement only
	// exists because four marks share a pixel, and it goes away when the
	// outline's trailing clamp is fixed.
	const bottom = toNearestEntryIndex(entries, 99);
	// The rail no longer ends at exactly 1: the last insight owns a slice like
	// every other, so the final mark is its last section, short of the end.
	assert.strictEqual(entries[bottom].offset, Math.max(...entries.map((entry) => entry.offset)));
	assert.ok(entries[bottom].offset < 1);
	assert.strictEqual(bottom, entries.length - 1, "past the last mark resolves to the last mark");
	const midpoint = (entries[0].offset + entries[1].offset) / 2;
	assert.ok([0, 1].includes(toNearestEntryIndex(entries, midpoint)));

	assert.strictEqual(toNearestEntryIndex(entries, Number.NaN), null);
	assert.strictEqual(toNearestEntryIndex([], 0.5), null, "an empty ruler commits nothing");
});

test("Pulse scrubber scrubs on pointer move and leaves the reading position sticky", () => {
	// Hover is the primary gesture; click and the keyboard remain the touch and
	// assistive paths.
	assert.match(SOURCES.scrubber, /onPointerMove=\{handlePointerMove\}/u);
	assert.match(SOURCES.scrubber, /onPointerLeave=\{handlePointerLeave\}/u);
	assert.match(SOURCES.scrubber, /onSelect=\{\(\) => moveTo\(index\)\}/u);
	assert.match(SOURCES.scrubber, /onClick=\{onSelect\}/u);
	// A finger sliding down the rail is a page scroll, not a scrub.
	assert.match(SOURCES.scrubber, /if \(event\.pointerType === "touch"\) \{\s*return;/u);
	// Commit only on change, or every mouse pixel re-scrolls the article. The
	// comparison is against the entry index now, not a snapshot index: a sweep
	// across one insight's sections has to move the reader.
	assert.match(SOURCES.scrubber, /if \(nearest !== null && nearest !== activeEntryIndex\) \{/u);
	// Reduced motion keeps the hover preview but skips ruler swell and
	// hover-driven scrolling.
	assert.match(SOURCES.scrubber, /onHoveredEntryChange\(hoveredEntryId\);[\s\S]*if \(shouldReduceMotion\) \{\s*return;/u);
	// Leaving fades the swell but must not rewind the article. Scope the check to
	// the function body: `handlePointerLeave` is also named in the hook's return
	// object, a few characters from unrelated wiring.
	const leaveBody = SOURCES.scrubber.slice(
		SOURCES.scrubber.indexOf("function handlePointerLeave()"),
		SOURCES.scrubber.indexOf("return { handlePointerLeave"),
	);
	assert.ok(leaveBody.length > 0, "handlePointerLeave should be declared before the hook returns");
	assert.doesNotMatch(leaveBody, /onSelectEntry/u);
	assert.match(leaveBody, /animate\(magnify, 0, MAGNIFY_OUT\)/u);
	// The parked pointer stays finite: -1 rather than Infinity or null.
	assert.match(SOURCES.marks, /const POINTER_AWAY = -1;/u);
	// The swell rides motion values, never React state — 28 rules re-rendering
	// per mouse pixel would stall the column.
	assert.match(SOURCES.scrubber, /useTransform\(\[pointerOffset, magnify\]/u);
	assert.doesNotMatch(SOURCES.scrubber, /useState[\s\S]{0,80}pointer/iu);
});
