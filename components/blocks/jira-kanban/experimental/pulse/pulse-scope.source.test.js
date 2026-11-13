/**
 * Pulse scope — narrowing the article to one epic or one sprint.
 *
 * The scope brief draws two things a reader will act on: a percentage and a
 * burndown. Both are arithmetic, and both are the kind of arithmetic that goes
 * quietly wrong — three bands that round to 99 leave a hairline of empty track
 * where the bar should have closed, and a burndown whose guideline is drawn
 * from the wrong origin tells a lead the sprint is fine when it is not.
 *
 * So the arithmetic is pure, lives in `lib/`, and is executed here rather than
 * grepped. The fixture is checked against the real timeline too: a scope whose
 * work items do not exist would narrow the article to an empty page, and that
 * failure is invisible in a screenshot of the brief itself.
 */

const { test } = require("node:test");

const { assert, loadScopeHarness, withoutComments } = require("./pulse-test-harness");

function segments(done, progress, todo) {
	return [
		{ tone: "done", label: "Done", count: done },
		{ tone: "progress", label: "In progress", count: progress },
		{ tone: "todo", label: "Not started", count: todo },
	];
}

/* ------------------------------------------------------------------ */
/* Progress arithmetic                                                  */
/* ------------------------------------------------------------------ */

test("progress bands always tile the track to exactly 100", async () => {
	const { toPulseProgressModel } = await loadScopeHarness();

	// Thirds are the case that breaks naive rounding: three floors of 33 leave
	// one percent unassigned, and the bar renders a 1px seam of bare track at
	// its closed end. Largest-remainder hands that percent to a real band.
	for (const counts of [[1, 1, 1], [17, 9, 14], [6, 7, 2], [11, 4, 3], [1, 0, 2], [5, 5, 5]]) {
		const model = toPulseProgressModel(segments(...counts));
		const total = model.bands.reduce((sum, band) => sum + band.percent, 0);
		assert.equal(total, 100, `bands for ${counts.join("/")} summed to ${total}`);
	}
});

test("progress drops empty bands rather than drawing zero-width ones", async () => {
	const { toPulseProgressModel } = await loadScopeHarness();

	const model = toPulseProgressModel(segments(3, 0, 1));
	assert.deepEqual(model.bands.map((band) => band.tone), ["done", "todo"]);
	assert.equal(model.bands.reduce((sum, band) => sum + band.percent, 0), 100);
});

test("progress reads zero rather than dividing by an empty total", async () => {
	const { toPulseProgressModel } = await loadScopeHarness();

	const model = toPulseProgressModel(segments(0, 0, 0));
	assert.equal(model.total, 0);
	assert.equal(model.donePercent, 0);
	assert.deepEqual(model.bands, []);
	assert.equal(model.summary, "Nothing tracked yet");
});

test("progress summary names the count, not just the percentage", async () => {
	const { toPulseProgressModel } = await loadScopeHarness();

	// The reference prints "38%" of an unstated total, which is a number a
	// reader cannot act on. The accessible summary must carry both.
	assert.equal(toPulseProgressModel(segments(17, 9, 14)).summary, "43% done — 17 of 40 items");
	assert.equal(toPulseProgressModel(segments(1, 0, 0)).summary, "100% done — 1 of 1 item");
});

test("child bars scale by how much work they hold, with a legible floor", async () => {
	const { toPulseProgressScale } = await loadScopeHarness();

	assert.equal(toPulseProgressScale(14, 14), 1);
	assert.equal(toPulseProgressScale(7, 14), 0.5);
	// A three-item stream beside a forty-item one would collapse to a dot and
	// stop showing three bands at all, so the scale floors rather than vanishes.
	assert.equal(toPulseProgressScale(1, 40), 0.22);
	assert.equal(toPulseProgressScale(0, 0), 0.22);
});

/* ------------------------------------------------------------------ */
/* Burndown geometry                                                    */
/* ------------------------------------------------------------------ */

function burndown(...remaining) {
	return remaining.map((value, index) => ({ label: `d${index}`, remaining: value }));
}

test("the guideline runs from the commitment at the open to zero at the close", async () => {
	const { buildPulseBurndownGeometry } = await loadScopeHarness();

	const geometry = buildPulseBurndownGeometry({
		points: burndown(80, 60, 40, 20, 0),
		totalPoints: 80,
		width: 320,
		height: 160,
		gutterLeft: 20,
		padTop: 0,
	});

	// Origin sits at the left edge of the plot, at the commitment; the end sits
	// at the right edge, on the baseline. Drawing it from the *current* scope
	// instead of the opening commitment is the failure this pins down.
	assert.match(geometry.guidelinePath, /^M20 \d/);
	assert.ok(geometry.guidelinePath.endsWith("L320 160"));
});

test("the scale makes room for a sprint that took on more than it committed", async () => {
	const { buildPulseBurndownGeometry } = await loadScopeHarness();

	const geometry = buildPulseBurndownGeometry({
		points: burndown(84, 82, 89, 84, 71),
		totalPoints: 84,
		width: 320,
		height: 160,
	});

	// 89 > 84. A scale topped at the commitment would clip the one day the
	// figure exists to explain.
	assert.ok(geometry.yMax >= 89, `yMax ${geometry.yMax} clips the peak`);
	assert.equal(geometry.gridLines.length, 5);
	assert.equal(geometry.gridLines[geometry.gridLines.length - 1].isBaseline, true);
	assert.equal(geometry.gridLines[geometry.gridLines.length - 1].label, "0");
});

test("today is the last day that actually closed, not the last day on the axis", async () => {
	const { buildPulseBurndownGeometry } = await loadScopeHarness();

	const geometry = buildPulseBurndownGeometry({
		points: [...burndown(84, 82, 89, 84, 71), ...burndown(null, null, null, null, null)],
		totalPoints: 84,
		width: 320,
		height: 160,
		gutterLeft: 20,
	});

	// Ten days on the axis, five closed: the marker belongs at index 4 of 9.
	const expected = 20 + ((320 - 20) * 4) / 9;
	assert.ok(Math.abs(geometry.todayX - expected) < 0.02, `todayX ${geometry.todayX} ≠ ${expected}`);
	assert.equal(geometry.firstLabel, "d0");
	assert.equal(geometry.lastLabel, "d4");
	// The area closes onto the baseline at both ends or it fills upward.
	assert.ok(geometry.areaPath.endsWith("Z"));
	assert.ok(geometry.areaPath.includes(" 160 "));
});

test("a sprint that has not started yet draws an axis and no line", async () => {
	const { buildPulseBurndownGeometry } = await loadScopeHarness();

	const geometry = buildPulseBurndownGeometry({
		points: burndown(null, null, null),
		totalPoints: 40,
		width: 320,
		height: 160,
	});

	assert.equal(geometry.linePath, "");
	assert.equal(geometry.areaPath, "");
	assert.equal(geometry.todayX, null);
	assert.ok(geometry.gridLines.length > 0);
});

test("the verdict compares today against the guideline, not against zero", async () => {
	const { toPulseBurndownVerdict } = await loadScopeHarness();

	// Day 4 of 9. The guideline is at 84 * (1 - 4/9) ≈ 46.7; 71 remaining is far
	// above it, so the sprint is behind however much has been burned down.
	assert.equal(
		toPulseBurndownVerdict({ points: [...burndown(84, 82, 89, 84, 71), ...burndown(null, null, null, null, null)], totalPoints: 84 }),
		"behind",
	);
	assert.equal(toPulseBurndownVerdict({ points: burndown(80, 60, 40, 20, 0), totalPoints: 80 }), "on-track");
	assert.equal(
		toPulseBurndownVerdict({ points: [...burndown(80, 30), ...burndown(null, null, null)], totalPoints: 80 }),
		"ahead",
	);
	assert.equal(toPulseBurndownVerdict({ points: burndown(null, null), totalPoints: 40 }), "on-track");
});

/* ------------------------------------------------------------------ */
/* Scope resolution and the fixture's integrity                         */
/* ------------------------------------------------------------------ */

test("scopes resolve by kind and id, and an unknown id resolves to nothing", async () => {
	const { findPulseScope, PULSE_EPICS, PULSE_SPRINTS, toPulseScopeKey } = await loadScopeHarness();

	assert.equal(findPulseScope(null), null);
	assert.equal(findPulseScope({ kind: "epic", id: "nope" }), null);
	// An epic id must not resolve through the sprint pool or the picker could
	// select one thing and the article narrow to another.
	assert.equal(findPulseScope({ kind: "sprint", id: PULSE_EPICS[0].id }), null);

	const epic = findPulseScope({ kind: "epic", id: PULSE_EPICS[0].id });
	assert.equal(epic.kind, "epic");
	assert.equal(toPulseScopeKey(epic), `epic:${PULSE_EPICS[0].id}`);
	assert.equal(toPulseScopeKey(null), "");
	assert.equal(
		toPulseScopeKey(findPulseScope({ kind: "sprint", id: PULSE_SPRINTS[0].id })),
		`sprint:${PULSE_SPRINTS[0].id}`,
	);
});

test("a brief opens for exactly one selection and for nothing else", async () => {
	const { PULSE_EPICS, PULSE_SPRINTS, resolvePulseScopeFromSelections } = await loadScopeHarness();
	const epic = PULSE_EPICS[0].id;
	const sprint = PULSE_SPRINTS[0].id;

	assert.equal(resolvePulseScopeFromSelections({ parent: [], sprint: [] }), null);
	assert.equal(resolvePulseScopeFromSelections({ parent: [epic], sprint: [] }).id, epic);
	assert.equal(resolvePulseScopeFromSelections({ parent: [], sprint: [sprint] }).id, sprint);

	// The board filter is multi-select per field, which is right for a board.
	// A brief is one document about one body of work, and there is no honest
	// page about two sprints — so two selections close it rather than silently
	// showing the first one's numbers under a filter that says something else.
	assert.equal(resolvePulseScopeFromSelections({ parent: [epic, PULSE_EPICS[1].id], sprint: [] }), null);
	assert.equal(resolvePulseScopeFromSelections({ parent: [epic], sprint: [sprint] }), null);
	// An id the fixture does not know resolves to nothing rather than a ghost.
	assert.equal(resolvePulseScopeFromSelections({ parent: ["nope"], sprint: [] }), null);
});

test("every scope points at work items the timeline actually holds", async () => {
	const { PULSE_EPICS, PULSE_SPRINTS, PULSE_TIMELINE } = await loadScopeHarness();

	const known = new Set(PULSE_TIMELINE.workItems.map((workItem) => workItem.key));
	for (const scope of [...PULSE_EPICS, ...PULSE_SPRINTS]) {
		assert.ok(scope.workItemKeys.length > 0, `${scope.id} scopes nothing`);
		for (const key of scope.workItemKeys) {
			assert.ok(known.has(key), `${scope.id} references unknown work item ${key}`);
		}
	}
});

test("every epic's roll-up is at least as large as its largest stream", async () => {
	const { PULSE_EPICS, toPulseProgressModel } = await loadScopeHarness();

	for (const epic of PULSE_EPICS) {
		const rollUp = toPulseProgressModel(epic.segments).total;
		const streams = epic.children.map((child) => toPulseProgressModel(child.segments).total);
		assert.ok(epic.children.length > 0, `${epic.id} has no streams`);
		assert.ok(
			rollUp >= Math.max(...streams),
			`${epic.id} rolls up ${rollUp} but a stream holds ${Math.max(...streams)}`,
		);
	}
});

test("every sprint's three point totals tell one consistent story", async () => {
	const { PULSE_SPRINTS } = await loadScopeHarness();

	for (const sprint of PULSE_SPRINTS) {
		const net = sprint.scopeChange.reduce((sum, entry) => sum + entry.points, 0);
		assert.equal(net, sprint.scopeChangeNetPoints, `${sprint.id} net ${sprint.scopeChangeNetPoints} ≠ ${net}`);

		// What it opened with, plus what moved, is what it holds now.
		assert.equal(
			sprint.committedPoints + sprint.scopeChangeNetPoints,
			sprint.scopePoints,
			`${sprint.id}: ${sprint.committedPoints} committed ${sprint.scopeChangeNetPoints >= 0 ? "+" : ""}${sprint.scopeChangeNetPoints} ≠ ${sprint.scopePoints} in scope`,
		);

		const closed = sprint.burndown.filter((point) => point.remaining !== null);
		assert.ok(closed.length > 0, `${sprint.id} has no closed days`);

		// And what is done plus what is left is what it holds now. Reading the
		// brief's lead sentence off `committedPoints` instead printed "30 of 84
		// points done, 71 to go" — three true numbers adding to a lie, and the
		// first thing a lead notices. This is the assertion that catches it.
		const remaining = closed[closed.length - 1].remaining;
		assert.equal(
			sprint.donePoints + remaining,
			sprint.scopePoints,
			`${sprint.id}: ${sprint.donePoints} done + ${remaining} remaining ≠ ${sprint.scopePoints} in scope`,
		);

		// The guideline is drawn from the commitment, so the burndown has to open
		// on it or the ideal line starts somewhere the sprint never was.
		assert.equal(
			closed[0].remaining,
			sprint.committedPoints,
			`${sprint.id} opens at ${closed[0].remaining} but committed ${sprint.committedPoints}`,
		);
	}
});

/* ------------------------------------------------------------------ */
/* Narrowing the article                                                */
/* ------------------------------------------------------------------ */

test("scoping narrows work items and signals but never drops an insight", async () => {
	const { PULSE_TIMELINE, scopeTimelineToWorkItemKeys } = await loadScopeHarness();

	const keys = new Set(["PAY-101", "PAY-104"]);
	const scoped = scopeTimelineToWorkItemKeys(PULSE_TIMELINE, keys);

	assert.equal(scoped.snapshots.length, PULSE_TIMELINE.snapshots.length);
	assert.deepEqual(scoped.workItems.map((item) => item.key), ["PAY-101", "PAY-104"]);
	for (const snapshot of scoped.snapshots) {
		for (const key of snapshot.workItemKeys) {
			assert.ok(keys.has(key));
		}
		for (const signal of [...snapshot.attention, ...snapshot.nextActions]) {
			assert.ok(keys.has(signal.workItemKey));
		}
		for (const contribution of snapshot.contributions) {
			for (const key of contribution.workItemKeys) {
				assert.ok(keys.has(key));
			}
		}
	}
});

test("scoping to nothing returns the timeline untouched, by identity", async () => {
	const { PULSE_TIMELINE, scopeTimelineToWorkItemKeys } = await loadScopeHarness();

	// Identity matters: the shell memoises the outline on the timeline, and a
	// fresh object every render would rebuild the ruler on every keystroke.
	assert.equal(scopeTimelineToWorkItemKeys(PULSE_TIMELINE, null), PULSE_TIMELINE);
});

test("scoping leaves the prose and the roster alone", async () => {
	const { PULSE_TIMELINE, scopeTimelineToWorkItemKeys } = await loadScopeHarness();

	const scoped = scopeTimelineToWorkItemKeys(PULSE_TIMELINE, new Set(["PAY-101"]));
	assert.deepEqual(scoped.members, PULSE_TIMELINE.members);
	assert.deepEqual(scoped.looseWork, PULSE_TIMELINE.looseWork);
	assert.deepEqual(scoped.snapshots[0].paragraphs, PULSE_TIMELINE.snapshots[0].paragraphs);
	assert.deepEqual(scoped.snapshots[0].artifacts, PULSE_TIMELINE.snapshots[0].artifacts);
});

/* ------------------------------------------------------------------ */
/* Questions                                                            */
/* ------------------------------------------------------------------ */

test("suggested questions change with the scope", async () => {
	const { PULSE_EPICS, PULSE_SPRINTS, toPulseSuggestedQuestions } = await loadScopeHarness();

	const unscoped = toPulseSuggestedQuestions(null);
	const sprint = toPulseSuggestedQuestions(PULSE_SPRINTS[0]);
	const epic = toPulseSuggestedQuestions(PULSE_EPICS[0]);

	for (const set of [unscoped, sprint, epic]) {
		assert.ok(set.length >= 3);
		for (const suggestion of set) {
			assert.ok(suggestion.question.trim().length > 0);
			assert.ok(suggestion.answer.trim().length > 0);
		}
	}
	assert.notDeepEqual(unscoped.map((s) => s.id), sprint.map((s) => s.id));
	assert.notDeepEqual(sprint.map((s) => s.id), epic.map((s) => s.id));
});

test("a suggested question gets its written answer, whatever the casing", async () => {
	const { PULSE_SPRINTS, toPulseAnswer, toPulseSuggestedQuestions } = await loadScopeHarness();

	const scope = PULSE_SPRINTS[0];
	const suggestions = toPulseSuggestedQuestions(scope);
	const target = suggestions[0];
	const answer = toPulseAnswer(`  ${target.question.toLocaleUpperCase()}  `, scope, suggestions);

	assert.equal(answer.answer, target.answer);
	assert.equal(answer.question, target.question.toLocaleUpperCase());
});

test("an unwritten question is answered honestly rather than invented", async () => {
	const { PULSE_SPRINTS, toPulseAnswer, toPulseSuggestedQuestions } = await loadScopeHarness();

	const scope = PULSE_SPRINTS[0];
	const answer = toPulseAnswer("who broke the build", scope, toPulseSuggestedQuestions(scope));

	assert.match(answer.answer, /no answer written/i);
	assert.ok(answer.answer.includes(scope.key));
	assert.equal(answer.id, "answer-who-broke-the-build");
});

test("asking the same question twice moves its answer rather than duplicating it", async () => {
	const { appendPulseAnswer } = await loadScopeHarness();

	const first = { id: "answer-a", question: "A?", answer: "..." };
	const second = { id: "answer-b", question: "B?", answer: "..." };

	const both = appendPulseAnswer(appendPulseAnswer([], first), second);
	assert.deepEqual(both.map((entry) => entry.id), ["answer-a", "answer-b"]);

	// Two identical paragraphs stacked on each other read as a rendering fault,
	// not as a record of having asked twice.
	const again = appendPulseAnswer(both, { ...first });
	assert.deepEqual(again.map((entry) => entry.id), ["answer-b", "answer-a"]);
	assert.equal(again.length, 2);
});

test("appending an answer never mutates the list it was given", async () => {
	const { appendPulseAnswer } = await loadScopeHarness();

	const original = [{ id: "answer-a", question: "A?", answer: "..." }];
	const next = appendPulseAnswer(original, { id: "answer-b", question: "B?", answer: "..." });

	assert.equal(original.length, 1, "React state must not be written in place");
	assert.notEqual(next, original);
});

/* ------------------------------------------------------------------ */
/* Source contracts — what Node cannot execute                          */
/* ------------------------------------------------------------------ */

const { existsSync: existsSource, readFileSync: readSource, join: joinPath, PULSE_DIR: DIR, EXPERIMENTAL_DIR: EXP } = require("./pulse-test-harness");

const SCOPE_SOURCES = {
	brief: readSource(joinPath(DIR, "components", "pulse-scope-brief.tsx"), "utf8"),
	composer: readSource(joinPath(DIR, "components", "pulse-insights-composer.tsx"), "utf8"),
	epic: readSource(joinPath(DIR, "components", "pulse-scope-brief-epic.tsx"), "utf8"),
	header: readSource(joinPath(EXP, "experimental-board-header.tsx"), "utf8"),
	options: readSource(joinPath(EXP, "data", "board-filter-options.ts"), "utf8"),
	shell: readSource(joinPath(DIR, "experimental-pulse.tsx"), "utf8"),
	popover: readSource(joinPath(EXP, "components", "board-filter-popover.tsx"), "utf8"),
	page: readSource(joinPath(EXP, "page.tsx"), "utf8"),
	progress: readSource(joinPath(DIR, "components", "pulse-progress-bar.tsx"), "utf8"),
	sprint: readSource(joinPath(DIR, "components", "pulse-scope-brief-sprint.tsx"), "utf8"),
};

test("Insights reads the board's own Filter rather than a second one", () => {
	// The header used to grey Filter out in Insights because the popover only
	// wrote `selectedAssigneeIds`, which Insights never reads. The board filter
	// that landed alongside this work replaced the header's own popover with a
	// `filterControl` slot, so the fix is no longer a capability prop — it is
	// that Insights derives its scope from the same selection model the board
	// uses. There must be exactly one filter in this directory.
	assert.doesNotMatch(withoutComments(SCOPE_SOURCES.header), /disableAssigneeFilter/u, "the boolean must not return");
	assert.doesNotMatch(withoutComments(SCOPE_SOURCES.page), /disableAssigneeFilter/u);
	assert.match(SCOPE_SOURCES.header, /filterControl\?: ReactNode;/u);
	assert.doesNotMatch(
		SCOPE_SOURCES.header,
		/filterFields|ExperimentalBoardFilterField/u,
		"the parallel filter implementation must not come back",
	);
	assert.ok(
		!existsSource(joinPath(EXP, "experimental-board-filter.tsx")),
		"a second board filter must not coexist with components/board-filter-popover.tsx",
	);
	assert.match(SCOPE_SOURCES.page, /resolvePulseScopeFromSelections\(boardFilter\.model\.selectedValueIdsByField\)/u);
});

test("Parent and Sprint offer exactly the scopes the article can open", () => {
	// Derived from the fixture, not hand-listed. A static option list makes the
	// failure invisible until someone clicks a row and the brief comes up empty.
	assert.match(SCOPE_SOURCES.options, /parent: PULSE_EPICS\.map/u);
	assert.match(SCOPE_SOURCES.options, /sprint: PULSE_SPRINTS\.map/u);
	assert.match(SCOPE_SOURCES.options, /sprint: "Sprint",/u, "the field needs a label or the rail renders blank");
});

test("described Parent and Sprint rows still render name and key", () => {
	// Parent/Sprint are two-line (label + key). Clustering the mark next to
	// the label for Work type/Project used a `hasDescription ? null` branch
	// that also swallowed the label block, leaving empty checkboxes.
	assert.match(SCOPE_SOURCES.options, /description: epic\.key/u);
	assert.match(SCOPE_SOURCES.options, /description: sprint\.key/u);
	assert.doesNotMatch(
		SCOPE_SOURCES.popover,
		/hasDescription \? null : tightLeading/u,
		"described rows must still render their label block",
	);
	assert.match(
		SCOPE_SOURCES.popover,
		/hasDescription \? null : leadingVisual[\s\S]*\{labelBlock\}/u,
	);
});

test("choosing a scope opens the surface the brief lives on", () => {
	// The brief only exists in Insights. Without this, picking an epic from the
	// board filter recomputes the scope and leaves the reader on the board
	// looking at columns — the feature silently doing nothing.
	//
	// It hangs off the filter action rather than an effect on `scope`, so the
	// mode change is caused by the click and does not also fire when a scope is
	// restored on mount. `updateMode` rather than a raw setter: the mode may be
	// controlled from outside, and a scope pick has to reach that owner too.
	assert.match(
		SCOPE_SOURCES.page,
		/toggleValue: \(fieldId, valueId\) => \{[\s\S]*?handleOpenTimeline\(\)/u,
	);
	assert.doesNotMatch(
		SCOPE_SOURCES.page,
		/useEffect\([\s\S]*?updateMode\("pulse"\)/u,
		"the mode change is an event, not a reaction to derived state",
	);
	// The popover must go through the wrapped actions or it silently keeps the
	// un-wrapped behaviour.
	assert.match(SCOPE_SOURCES.page, /actions=\{filterActions\}/u);
});

test("an unsent draft does not survive a change of scope", () => {
	// A question typed under Sprint 24 is entity-local state. Carrying it into
	// PAY-90 would submit it against the new scope's answers, which is the
	// accepted-input-silently-discarded failure in gotchas-ui.md — except worse,
	// because the input is not discarded, it is misfiled.
	assert.match(SCOPE_SOURCES.shell, /<PulseInsightsComposer[\s\S]*?key=\{scopeKey\}/u);
	assert.doesNotMatch(
		SCOPE_SOURCES.composer,
		/useEffect/u,
		"re-keying is the reset; an effect would run after the render that already showed the stale draft",
	);
});

test("Filter is the only standing statement of scope in the toolbar", () => {
	// The Filter badge already shows that the page is narrowed. A second chip
	// beside it restated the same selection and is not coming back.
	assert.doesNotMatch(withoutComments(SCOPE_SOURCES.page), /PulseScopeChip/u);
	assert.ok(
		!existsSource(joinPath(DIR, "components", "pulse-scope-chip.tsx")),
		"the scope chip file must stay deleted",
	);
});

test("both briefs sit on the article's own rungs rather than inventing a second set", () => {
	for (const [name, source] of [["sprint", SCOPE_SOURCES.sprint], ["epic", SCOPE_SOURCES.epic]]) {
		// The display rung lives on the type scale, not on a component file: two
		// files need it, and a component that also exports constants stops being
		// Fast-Refresh-safe.
		assert.match(source, /\bHEADLINE_STYLE,\n/u, `${name} must borrow the display rung`);
		assert.doesNotMatch(source, /const HEADLINE_STYLE/u, `${name} must not keep a second copy of the clamp`);
		assert.match(source, /PULSE_EYEBROW/u, `${name} must use the shared eyebrow`);
		assert.match(source, /PulseSectionLabel/u, `${name} must use the shared section label`);
		// Card chrome is the whole thing the reference does and the article does not.
		assert.doesNotMatch(source, /rounded-(?:lg|xl|2xl)[^"]*border|shadow-|bg-surface-raised|bg-surface-overlay/u, `${name} grew card chrome`);
		assert.doesNotMatch(source, /bg-\[var\(--ds-|text-\[var\(--ds-/u, `${name} used a raw token escape hatch`);
	}
});

test("one progress bar serves the roll-up and every child row", () => {
	// Two bars would drift in weight, radius and seam within a week of each
	// other, and the epic's ranking only reads if every row is drawn the same.
	assert.match(SCOPE_SOURCES.sprint, /from ".*pulse-progress-bar"/u);
	assert.match(SCOPE_SOURCES.epic, /from ".*pulse-progress-bar"/u);
	assert.match(SCOPE_SOURCES.progress, /role="img"/u, "the bar speaks once, not once per band");
	assert.match(SCOPE_SOURCES.progress, /aria-label=\{label \?\? model\.summary\}/u);
});

test("the brief switch is exhaustive over the scope union", () => {
	// A third scope kind must fail to compile here rather than silently render
	// nothing at the top of the article.
	assert.match(SCOPE_SOURCES.brief, /const exhaustive: never = scope;/u);
});

test("the ask dock reuses the work item's composer instead of growing a third one", () => {
	assert.match(SCOPE_SOURCES.composer, /JiraActivityComposer/u);
	assert.match(SCOPE_SOURCES.composer, /variant="comment"/u);
	assert.doesNotMatch(SCOPE_SOURCES.composer, /\bexpandOnFocus\b/u);
	// Controlled, or a suggestion tap leaves the typed draft alive under an
	// answer that has already been given.
	assert.match(SCOPE_SOURCES.composer, /value=\{draft\}/u);
	assert.match(SCOPE_SOURCES.composer, /onValueChange=\{setDraft\}/u);
	// The work item's ActivityComposer is bound to four contexts and is not liftable.
	assert.doesNotMatch(SCOPE_SOURCES.composer, /experimental-v3\/components\/activity-composer/u);
});

test("the suggestion row uses the context-bar prompt flyout", () => {
	// One docked pill, with the rest stacked straight up on hover or click.
	// `Suggestions` is a horizontal ScrollArea built for a full-width chat pane
	// and would clip the third chip at this 36rem measure.
	assert.match(SCOPE_SOURCES.composer, /ContextBarPromptFlyout/u);
	assert.match(SCOPE_SOURCES.composer, /ariaLabel="Suggested questions"/u);
	assert.doesNotMatch(SCOPE_SOURCES.composer, /<Suggestions\b/u);
	assert.doesNotMatch(SCOPE_SOURCES.composer, /<Suggestion\b/u);
	assert.doesNotMatch(SCOPE_SOURCES.composer, /flex min-w-0 flex-wrap gap-2/u);
});

test("answers enter with their own exit timing and a reduced-motion guard", () => {
	// A lone `transition` prop applies to enter AND exit, silently running the
	// exit at the entrance's pace.
	assert.match(SCOPE_SOURCES.composer, /exit=\{\{ opacity: 0, transition: exit, y: offset \}\}/u);
	assert.match(SCOPE_SOURCES.composer, /useReducedMotion\(\)/u);
	assert.doesNotMatch(SCOPE_SOURCES.composer, /duration-\d|duration-\[|ease-\[/u);
	// The suggestions row frees real space when it retires, but `height` cannot
	// be the thing animated — it re-runs layout every frame. Motion's `layout`
	// prop FLIPs the same change with a transform.
	assert.doesNotMatch(SCOPE_SOURCES.composer, /height: "auto"|height: 0/u);
	assert.match(SCOPE_SOURCES.composer, /layout=\{shouldReduceMotion \? false : "position"\}/u);
});

test("scope and questions are owned above the surface that renders them", () => {
	// Insights unmounts when the mode is toggled. Neither "I narrowed this to
	// Sprint 24" nor "I asked why the burndown went up" is view state.
	// Answers are keyed by scope rather than cleared on change: an answer about
	// Sprint 24 shown as a reply to a question asked of PAY-90 would be a lie
	// the page told by omission, and a key avoids an effect that resets state
	// behind the reader.
	assert.match(SCOPE_SOURCES.page, /const \[answersByScope, setAnswersByScope\] = useState</u);
	assert.match(SCOPE_SOURCES.page, /answersByScope\[scopeKey\] \?\? EMPTY_ANSWERS/u);
	assert.doesNotMatch(SCOPE_SOURCES.page, /setAnswers\(\[\]\)/u, "no effect may clear answers behind the reader");
});
