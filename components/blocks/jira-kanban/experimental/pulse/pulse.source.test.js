/**
 * Pulse — the experimental Kanban's timeline mode.
 *
 * Pulse is one continuous article: every insight is on the page at once and the
 * reader scrolls through them, with the ruler on the left as the document's
 * outline. That reshaped what this suite can execute. `usePulseTimeline` no
 * longer owns a snapshot index or a member filter, and it no longer carries the
 * whole mounted snapshot — the position belongs to `usePulseReading`, the filter
 * to `usePulseMemberFilter`, and the per-insight scoping to the article, which
 * derives it for all seven. Tests that used to drive `goToNext`/`goToIndex` or
 * read `host.current.artifacts` say so where they changed.
 *
 * The contracts worth protecting are behavioural, so they are executed rather
 * than grepped: the hooks' derivations run for real against the fixture. That
 * is all this file holds. Source-level assertions — what cannot be executed in
 * Node — moved to `pulse-source-contracts.source.test.js`.
 *
 * The outline that both the ruler and the article are built from lives in
 * `pulse-outline.source.test.js`; the ruler's own drawing and pointer gesture live in
 * `pulse-scrubber.source.test.js`; the fixture is walked in `pulse-fixture.source.test.js`;
 * the "Needs input" agent list is in `pulse-attention.test.js`; the
 * "Next best actions" mapping is in `pulse-next-actions.source.test.js`.
 */

const { test } = require("node:test");

const {
	assert,
	findSnapshotIndex,
	loadTimelineHarness,
	snapshotAt,
	SOURCES,
} = require("./pulse-test-harness");

test("Pulse index clamping tolerates empty, fractional, and out-of-range input", async () => {
	const { clampSnapshotIndex } = await loadTimelineHarness();

	assert.equal(clampSnapshotIndex(0, 0), 0);
	assert.equal(clampSnapshotIndex(4, 0), 0);
	assert.equal(clampSnapshotIndex(Number.NaN, 7), 0);
	assert.equal(clampSnapshotIndex(Number.POSITIVE_INFINITY, 7), 0);
	assert.equal(clampSnapshotIndex(-3, 7), 0);
	assert.equal(clampSnapshotIndex(99, 7), 6);
	assert.equal(clampSnapshotIndex(2.8, 7), 2);
});

test("Pulse scoping helpers keep snapshot order and drop everything outside the scope", async () => {
	const {
		resolveLooseWork,
		resolveWorkItems,
		scopeArtifacts,
		scopeByWorkItem,
	} = await loadTimelineHarness();
	const workItems = [{ key: "PAY-1" }, { key: "PAY-2" }, { key: "PAY-3" }];
	const looseWork = [{ id: "lw-a" }, { id: "lw-b" }];

	assert.deepEqual(
		resolveWorkItems(workItems, ["PAY-3", "PAY-1"], null).map((item) => item.key),
		["PAY-3", "PAY-1"],
	);
	assert.deepEqual(
		resolveWorkItems(workItems, ["PAY-3", "PAY-1"], new Set(["PAY-1"])).map((item) => item.key),
		["PAY-1"],
	);
	// An unresolvable key is dropped rather than rendered as a hole.
	assert.deepEqual(resolveWorkItems(workItems, ["PAY-404"], null), []);
	assert.deepEqual(resolveLooseWork(looseWork, ["lw-b"], null).map((item) => item.id), ["lw-b"]);
	assert.deepEqual(resolveLooseWork(looseWork, ["lw-b"], new Set(["lw-a"])), []);
	assert.deepEqual(scopeArtifacts([{ id: "a1" }, { id: "a2" }], new Set(["a2"])).map((a) => a.id), ["a2"]);
	assert.deepEqual(scopeArtifacts([{ id: "a1" }], null).map((a) => a.id), ["a1"]);
	// Scoped signals hang off a work item; a keyless entry is nobody's to answer for.
	assert.deepEqual(
		scopeByWorkItem([{ id: "s1", workItemKey: "PAY-1" }, { id: "s2" }], new Set(["PAY-1"])).map((s) => s.id),
		["s1"],
	);
	assert.deepEqual(
		scopeByWorkItem([{ id: "s1", workItemKey: "PAY-1" }, { id: "s2" }], null).map((s) => s.id),
		["s1", "s2"],
	);
});

test("Pulse highlights exactly the snapshots a member was active in", async () => {
	const { computeHighlightedIndexes, PULSE_TIMELINE } = await loadTimelineHarness();
	const { snapshots } = PULSE_TIMELINE;

	assert.deepEqual(
		[...computeHighlightedIndexes(snapshots, null)],
		snapshots.map((_, index) => index),
		"an unfiltered timeline highlights every snapshot",
	);

	for (const member of PULSE_TIMELINE.members) {
		const expected = snapshots
			.map((snapshot, index) => (snapshot.memberIds.includes(member.id) ? index : null))
			.filter((index) => index !== null);
		assert.deepEqual([...computeHighlightedIndexes(snapshots, member.id)], expected, member.id);
		assert.ok(expected.length > 0, `${member.id} is never active, so the roster row is dead weight`);
		if (member.id === "venn") {
			assert.equal(expected.length, snapshots.length, "Venn authors every window");
			continue;
		}
		assert.ok(
			expected.length < snapshots.length,
			`${member.id} is active in every snapshot, which makes the muted-tick affordance invisible`,
		);
	}

	assert.deepEqual([...computeHighlightedIndexes(snapshots, "nobody")], []);
});

test("Pulse clamps the reading position it is handed instead of owning one", async () => {
	const { mountPulse, PULSE_TIMELINE } = await loadTimelineHarness();
	const host = mountPulse();
	const last = PULSE_TIMELINE.snapshots.length - 1;

	// This used to assert `goToNext`/`goToPrevious`/`goToIndex` clamping at both
	// ends of a committed index the hook owned. The article is one continuous
	// document now: `usePulseReading` owns the position, the reader moves it by
	// scrolling, and there is no step gesture left to clamp. What survives is the
	// hook's duty to never index past the end of a position handed in from
	// outside — a filter can shorten the outline mid-frame, and a reading line
	// sitting in the runway below the last insight reports past the end.
	assert.equal(typeof host.current.goToIndex, "undefined", "the hook must not own navigation any more");
	assert.equal(typeof host.current.goToNext, "undefined");
	assert.equal(typeof host.current.goToPrevious, "undefined");

	assert.equal(host.current.activeIndex, 0);
	assert.equal(host.current.total, PULSE_TIMELINE.snapshots.length);
	assert.equal(host.current.activeSnapshot.id, PULSE_TIMELINE.snapshots[0].id);

	host.read(1);
	assert.equal(host.current.activeIndex, 1);
	assert.equal(host.current.activeSnapshot.id, PULSE_TIMELINE.snapshots[1].id);

	host.read(99);
	assert.equal(host.current.activeIndex, last, "a position past the end clamps to the last insight");
	assert.equal(host.current.activeSnapshot.id, PULSE_TIMELINE.snapshots[last].id);

	host.read(-4);
	assert.equal(host.current.activeIndex, 0, "a position above the top clamps to the first insight");

	host.read(Number.NaN);
	assert.equal(host.current.activeIndex, 0, "an unmeasured position must not render a hole");

	host.read(3);
	assert.equal(host.current.activeIndex, 3);
	assert.equal(host.current.activeSnapshot.id, PULSE_TIMELINE.snapshots[3].id);
});


/**
 * One insight, scoped the way the article scopes it.
 *
 * `pulse-stream.tsx` renders all seven insights at once, so it derives this for
 * every snapshot rather than only for the one being read. It composes the
 * derivation from the timeline hook's exported pure helpers instead of growing
 * a second definition of "scoped"; this is the same composition, executed. The
 * stream does not export its own `toStreamEntries`, so a source assertion in
 * "Pulse scopes every insight in the article" pins it to these helpers.
 */
function scopeInsight(helpers, timeline, snapshot, memberId) {
	const contribution = helpers.findContribution(snapshot, memberId);
	const workItemScope = memberId === null ? null : new Set(contribution?.workItemKeys ?? []);
	const artifactScope = memberId === null ? null : new Set(contribution?.artifactIds ?? []);
	const looseWorkScope = memberId === null ? null : new Set(contribution?.looseWorkIds ?? []);
	return {
		artifacts: helpers.scopeArtifacts(snapshot.artifacts, artifactScope),
		attention: helpers.scopeByWorkItem(snapshot.attention, workItemScope),
		contribution,
		looseWork: helpers.resolveLooseWork(timeline.looseWork, snapshot.looseWorkIds, looseWorkScope),
		nextActions: helpers.scopeByWorkItem(snapshot.nextActions, workItemScope),
		workItems: helpers.resolveWorkItems(timeline.workItems, snapshot.workItemKeys, workItemScope),
	};
}

test("Pulse shows every insight whole while no member filter is on", async () => {
	const harness = await loadTimelineHarness();
	const { mountPulse, PULSE_TIMELINE } = harness;
	const host = mountPulse();
	const index = findSnapshotIndex(PULSE_TIMELINE, "s1-kickoff");
	host.read(index);
	const snapshot = snapshotAt(PULSE_TIMELINE, index);

	// The model narrowed when the article became continuous: it used to carry the
	// whole mounted snapshot — artifacts, signals, actions, stats, contributors.
	// Those are per-insight now and belong to the article, which renders seven of
	// them; what is left here is the two work columns beside it, the ruler's
	// muting, and the empty state.
	assert.equal(host.current.isFiltered, false);
	assert.equal(host.current.selectedMemberId, null);
	assert.equal(host.current.selectedMember, null);
	assert.deepEqual(host.current.workItems.map((item) => item.key), [...snapshot.workItemKeys]);
	assert.deepEqual(host.current.looseWork.map((item) => item.id), [...snapshot.looseWorkIds]);

	// And unfiltered, every insight in the article is whole — not just the one
	// the reader happens to be on.
	for (const entry of PULSE_TIMELINE.snapshots) {
		const scoped = scopeInsight(harness, PULSE_TIMELINE, entry, null);
		assert.equal(scoped.contribution, null, `${entry.id} narrates a member with no filter on`);
		assert.deepEqual(scoped.workItems.map((item) => item.key), [...entry.workItemKeys], entry.id);
		assert.deepEqual(scoped.looseWork.map((item) => item.id), [...entry.looseWorkIds], entry.id);
		assert.deepEqual(scoped.artifacts.map((item) => item.id), entry.artifacts.map((item) => item.id), entry.id);
		assert.deepEqual(scoped.attention.map((item) => item.id), entry.attention.map((item) => item.id), entry.id);
		assert.deepEqual(scoped.nextActions.map((item) => item.id), entry.nextActions.map((item) => item.id), entry.id);
	}
});

test("Pulse member filter narrows work items, artifacts, loose work and signals", async () => {
	const harness = await loadTimelineHarness();
	const { mountPulse, PULSE_TIMELINE } = harness;
	const host = mountPulse();
	const index = findSnapshotIndex(PULSE_TIMELINE, "s2-spike");
	host.read(index);
	const snapshot = snapshotAt(PULSE_TIMELINE, index);
	const unscopedWorkItems = host.current.workItems.length;

	host.current.selectMember("maya");
	const contribution = snapshot.contributions.find((entry) => entry.memberId === "maya");
	const scoped = scopeInsight(harness, PULSE_TIMELINE, snapshot, "maya");

	assert.equal(host.current.isFiltered, true);
	assert.equal(host.current.selectedMemberId, "maya");
	assert.equal(host.current.selectedMember.name, "Maya Ferreira");
	assert.equal(scoped.contribution, contribution);
	assert.deepEqual(
		host.current.workItems.map((item) => item.key),
		snapshot.workItemKeys.filter((key) => contribution.workItemKeys.includes(key)),
	);
	assert.deepEqual(
		host.current.looseWork.map((item) => item.id),
		snapshot.looseWorkIds.filter((id) => contribution.looseWorkIds.includes(id)),
	);
	assert.deepEqual(
		scoped.artifacts.map((item) => item.id),
		snapshot.artifacts.map((item) => item.id).filter((id) => contribution.artifactIds.includes(id)),
	);
	assert.ok(host.current.workItems.length > 0, "Maya moved work in the spike window");
	assert.ok(host.current.workItems.length < unscopedWorkItems, "scoping must remove something");
	assert.ok(scoped.artifacts.length < snapshot.artifacts.length, "scoping must remove something");
	scoped.attention.forEach((signal) => {
		assert.ok(contribution.workItemKeys.includes(signal.workItemKey), signal.id);
	});
	scoped.nextActions.forEach((action) => {
		assert.ok(contribution.workItemKeys.includes(action.workItemKey), action.id);
	});
});

test("Pulse scopes every insight in the article, not only the one being read", async () => {
	const harness = await loadTimelineHarness();
	const { PULSE_TIMELINE } = harness;

	// The property the continuous article added: a filter rewrites all seven
	// insights at once, because all seven are on the page. Nothing may leak the
	// team's work into a scoped page, at any scroll position.
	for (const member of PULSE_TIMELINE.members) {
		let scopedSomething = false;
		for (const snapshot of PULSE_TIMELINE.snapshots) {
			const scoped = scopeInsight(harness, PULSE_TIMELINE, snapshot, member.id);
			const contribution = snapshot.contributions.find((entry) => entry.memberId === member.id) ?? null;
			assert.equal(scoped.contribution, contribution, `${snapshot.id}/${member.id}`);
			for (const item of scoped.workItems) {
				assert.ok(contribution?.workItemKeys.includes(item.key), `${snapshot.id} leaked ${item.key} to ${member.id}`);
			}
			for (const item of scoped.artifacts) {
				assert.ok(contribution?.artifactIds.includes(item.id), `${snapshot.id} leaked ${item.id} to ${member.id}`);
			}
			for (const item of scoped.looseWork) {
				assert.ok(contribution?.looseWorkIds.includes(item.id), `${snapshot.id} leaked ${item.id} to ${member.id}`);
			}
			scopedSomething ||= scoped.workItems.length > 0;
		}
		assert.ok(scopedSomething, `${member.id} scopes the whole article to nothing`);
	}

	// The stream composes exactly these helpers over every snapshot rather than
	// redefining what "scoped" means for the six insights the model does not see.
	assert.match(SOURCES.stream, /return timeline\.snapshots\.map\(\(snapshot, index\) => \{/u);
	assert.match(SOURCES.stream, /const contribution = findContribution\(snapshot, memberId\);/u);
	assert.match(SOURCES.stream, /artifacts: scopeArtifacts\(snapshot\.artifacts, artifactScope\),/u);
	assert.match(SOURCES.stream, /attention: scopeByWorkItem\(snapshot\.attention, workItemScope\),/u);
	assert.match(SOURCES.stream, /nextActions: scopeByWorkItem\(snapshot\.nextActions, workItemScope\),/u);
});

test("Pulse scopes a quiet member to nothing instead of showing the team's work", async () => {
	const harness = await loadTimelineHarness();
	const { mountPulse, PULSE_TIMELINE } = harness;
	const host = mountPulse();
	const index = findSnapshotIndex(PULSE_TIMELINE, "s4-night-shift");
	const snapshot = snapshotAt(PULSE_TIMELINE, index);
	assert.equal(snapshot.memberIds.includes("maya"), false, "the night shift is the agents-only window");

	host.read(index);
	host.current.selectMember("maya");
	const scoped = scopeInsight(harness, PULSE_TIMELINE, snapshot, "maya");

	assert.equal(scoped.contribution, null);
	assert.deepEqual(host.current.workItems, []);
	assert.deepEqual(host.current.looseWork, []);
	assert.deepEqual(scoped.artifacts, []);
	assert.deepEqual(scoped.attention, []);
	assert.deepEqual(scoped.nextActions, []);
	// The header facepile still lists her, never disabled, because a quiet night
	// is information — and the faces on the insight itself carry only the members
	// active in it, so absence from that row is the signal.
	assert.equal(snapshot.memberIds.includes("maya"), false);
	assert.equal(host.current.members.some((member) => member.id === "maya"), true);
	assert.equal(host.current.highlightedIndexes.has(index), false);
});

test("Pulse member selection survives reading on and clears on demand", async () => {
	const { mountPulse, PULSE_TIMELINE } = await loadTimelineHarness();
	const host = mountPulse();

	host.current.selectMember("review-agent");
	assert.equal(host.current.selectedMemberId, "review-agent");

	// Scrubbing was a commit; reading on is just a new position. Either way the
	// filter is the reader's standing choice and must outlive it.
	host.read(2);
	assert.equal(host.current.activeIndex, 2);
	assert.equal(host.current.selectedMemberId, "review-agent", "moving through the article must not clear the filter");
	assert.equal(host.current.isFiltered, true);
	assert.equal(host.current.selectedMember.name, "Review Agent");
	assert.deepEqual(
		[...host.current.highlightedIndexes],
		PULSE_TIMELINE.snapshots
			.map((snapshot, index) => (snapshot.memberIds.includes("review-agent") ? index : null))
			.filter((index) => index !== null),
	);

	host.read(0);
	assert.equal(host.current.selectedMemberId, "review-agent");

	host.current.selectMember(null);
	assert.equal(host.current.isFiltered, false);
	assert.equal(host.current.selectedMemberId, null);
	assert.equal(host.current.activeIndex, 0, "clearing the filter must not move the reading position by itself");
	assert.deepEqual(
		host.current.workItems.map((item) => item.key),
		[...snapshotAt(PULSE_TIMELINE, 0).workItemKeys],
	);

	// An id nobody owns is treated as no filter at all rather than an empty view.
	host.current.selectMember("ghost");
	assert.equal(host.current.isFiltered, false);
	assert.equal(host.current.selectedMember, null);
	assert.ok(host.current.workItems.length > 0);

	// The article is re-keyed on the selected id, so a filter change restarts the
	// document from the top instead of stranding the reader at an offset that now
	// points at different prose. That reset is `usePulseReading`'s, and the shell
	// is what wires the two together.
	//
	// The key is composite because scope rewrites the article for exactly the
	// same reason a member filter does. Both halves have to be in it: keying on
	// the member alone would leave a reader who switched from an epic to a
	// sprint parked halfway down prose that is no longer there.
	assert.match(SOURCES.shell, /resetKey: `\$\{scopeKey\}\|\$\{filter\.selectedMemberId \?\? ""\}`/u);
});

test("Pulse answers what a member did across the whole week, not just this window", async () => {
	const { computeMemberWeek, PULSE_TIMELINE } = await loadTimelineHarness();
	const { snapshots } = PULSE_TIMELINE;

	// The rail used to swap its window block for this week block while a filter
	// was on, and the hook handed the aggregate over. The rail no longer renders
	// it and the model no longer carries it, so the last assertion here — that
	// `host.current.memberWeek` matched — is gone. The function is still exported
	// and still correct; it is currently consumed by nothing, and should either
	// find a home on the scoped insight or be deleted outright. Keeping the
	// coverage means whichever happens is a deliberate decision rather than a
	// silent one.
	assert.equal(computeMemberWeek(snapshots, null), null, "no filter means no member week");

	for (const member of PULSE_TIMELINE.members) {
		const week = computeMemberWeek(snapshots, member.id);
		const expectedWindows = snapshots.filter((snapshot) => snapshot.memberIds.includes(member.id)).length;
		const expectedItems = new Set();
		const expectedLoose = new Set();
		let expectedArtifacts = 0;
		for (const snapshot of snapshots) {
			const contribution = snapshot.contributions.find((entry) => entry.memberId === member.id);
			if (contribution === undefined) {
				continue;
			}
			expectedArtifacts += contribution.artifactIds.length;
			contribution.workItemKeys.forEach((key) => expectedItems.add(key));
			contribution.looseWorkIds.forEach((id) => expectedLoose.add(id));
		}

		assert.equal(week.totalWindows, snapshots.length, member.id);
		assert.equal(week.windowsActive, expectedWindows, member.id);
		assert.equal(week.workItems, expectedItems.size, member.id);
		assert.equal(week.artifacts, expectedArtifacts, member.id);
		assert.equal(week.looseWork, expectedLoose.size, member.id);
		// The aggregate has to be a week, not a restatement of one window.
		assert.ok(week.windowsActive > 1, `${member.id} cannot demonstrate a week`);
		if (member.id === "venn") {
			assert.equal(week.windowsActive, week.totalWindows, "Venn authors every window");
			continue;
		}
		assert.ok(week.windowsActive < week.totalWindows, `${member.id} is never quiet`);
	}
});

test("Pulse offers a quiet member the nearest windows they were active in", async () => {
	const { findAdjacentActiveIndexes, PULSE_TIMELINE } = await loadTimelineHarness();
	const { snapshots } = PULSE_TIMELINE;
	const nightShift = findSnapshotIndex(PULSE_TIMELINE, "s4-night-shift");
	const mayaWindows = snapshots
		.map((snapshot, index) => (snapshot.memberIds.includes("maya") ? index : null))
		.filter((index) => index !== null);

	assert.deepEqual(findAdjacentActiveIndexes(snapshots, null, 3), { next: null, previous: null });

	const around = findAdjacentActiveIndexes(snapshots, "maya", nightShift);
	assert.equal(around.previous, Math.max(...mayaWindows.filter((index) => index < nightShift)));
	assert.equal(around.next, Math.min(...mayaWindows.filter((index) => index > nightShift)));
	assert.notEqual(around.previous, null);
	assert.notEqual(around.next, null);

	// The way out used to be computed once, for the mounted snapshot, and read
	// off the model as `previousActiveIndex`/`nextActiveIndex`. Every quiet page
	// in the article needs its own pair now, so the stream computes them per
	// insight and turns each into a labelled jump the ruler's own scroll performs.
	assert.match(SOURCES.stream, /const adjacent = findAdjacentActiveIndexes\(timeline\.snapshots, memberId, index\);/u);
	assert.match(SOURCES.stream, /nextActive: toJump\(timeline\.snapshots, adjacent\.next\),/u);
	assert.match(SOURCES.stream, /previousActive: toJump\(timeline\.snapshots, adjacent\.previous\),/u);
	assert.match(SOURCES.stream, /onGoToIndex=\{onGoToSnapshot\}/u);
	assert.match(SOURCES.stream, /onGoToEntry=\{onGoToEntry\}/u);
	assert.match(SOURCES.story, /onClick=\{\(\) => onGoToIndex\(previousActive\.index\)\}/u);
	assert.match(SOURCES.story, /onClick=\{\(\) => onGoToIndex\(nextActive\.index\)\}/u);
});

test("Pulse keeps the unscoped window counts so an emptied section can say what it hides", async () => {
	const harness = await loadTimelineHarness();
	const { PULSE_TIMELINE } = harness;
	const index = findSnapshotIndex(PULSE_TIMELINE, "s4-night-shift");
	const snapshot = snapshotAt(PULSE_TIMELINE, index);
	const scoped = scopeInsight(harness, PULSE_TIMELINE, snapshot, "maya");

	// "Nothing for Maya here — 3 items need input across the team" only works
	// if the unscoped size survives the scoping. The counts moved from the model
	// to the stream with the sections they describe, and narrowed to the three
	// the story can empty: the work columns beside the article are not part of a
	// scoped page's prose, so they never needed a count.
	assert.deepEqual(scoped.attention, [], "Maya was quiet, so nothing is hers to answer for");
	assert.ok(snapshot.attention.length > 0, "the window itself is not empty");
	assert.match(SOURCES.stream, /unscopedCounts: \{\s*artifacts: snapshot\.artifacts\.length,\s*attention: snapshot\.attention\.length,\s*nextActions: snapshot\.nextActions\.length,\s*\},/u);
	assert.match(SOURCES.story, /toEmptyNote\(firstName, unscopedCounts\.artifacts, "artifact", "artifacts"\)/u);
	assert.match(SOURCES.story, /toEmptyNote\(firstName, unscopedCounts\.attention, "item needs input", "items need input"\)/u);
	assert.match(SOURCES.story, /toEmptyNote\(firstName, unscopedCounts\.nextActions, "action", "actions"\)/u);
	assert.match(SOURCES.story, /Nothing here for \$\{firstName\}, and nothing for the team either\./u);
});

test("Pulse survives an empty timeline instead of indexing past the end", async () => {
	const { mountPulse, PULSE_TIMELINE } = await loadTimelineHarness();
	const host = mountPulse({ ...PULSE_TIMELINE, snapshots: [] });

	assert.equal(host.current.total, 0);
	assert.equal(host.current.activeIndex, 0);
	assert.equal(host.current.activeSnapshot, null);
	assert.deepEqual(host.current.workItems, []);
	assert.deepEqual(host.current.looseWork, []);

	host.read(4);
	assert.equal(host.current.activeIndex, 0);
	assert.equal(host.current.activeSnapshot, null);

	// A null active snapshot is the shell's empty state, not a blank article.
	assert.match(SOURCES.shell, /if \(pulse\.activeSnapshot === null\) \{/u);
	assert.match(SOURCES.shell, /This timeline has no snapshots yet\./u);
	// And the outline the ruler draws is empty too, so there is nothing to click.
	assert.match(SOURCES.stream, /if \(entries\.length === 0\) \{\s*return null;/u);
});

