/**
 * Pulse — "Next best actions" as the shared next-best-action block.
 *
 * The section is not a custom ruled row any more; it is the same suggestion
 * list as `components/blocks/next-best-action`, mapped from the fixture's
 * PulseAction records. What that costs is a mapping, and a mapping is
 * executable, so the row model is asserted for real against the fixture rather
 * than grepped. Only the composition itself — that the section renders the
 * shared block — is a source contract, because Node cannot render it.
 */

const { test } = require("node:test");

const {
	assert,
	findSnapshotIndex,
	loadNextActionsHarness,
	snapshotAt,
	SOURCES,
} = require("./pulse-test-harness");

/** Every next-best-action row for one snapshot, mapped the way the story maps them. */
async function nextActionRows(snapshotId, requestedActionIds = new Set()) {
	const { PULSE_TIMELINE, toPulseNextActionItems } = await loadNextActionsHarness();
	const index = findSnapshotIndex(PULSE_TIMELINE, snapshotId);
	const snapshot = snapshotAt(PULSE_TIMELINE, index);

	return {
		items: toPulseNextActionItems(snapshot.nextActions, requestedActionIds),
		snapshot,
	};
}

test("every action becomes one row that keeps the fixture copy", async () => {
	const { PULSE_TIMELINE } = await loadNextActionsHarness();

	for (const snapshot of PULSE_TIMELINE.snapshots) {
		const { items } = await nextActionRows(snapshot.id);
		assert.equal(items.length, snapshot.nextActions.length, `${snapshot.id} dropped an action`);

		items.forEach((item, index) => {
			const action = snapshot.nextActions[index];
			const where = `${snapshot.id}/${action.id}`;

			assert.equal(item.id, action.id, where);
			assert.equal(item.title, action.label, where);
			assert.equal(item.owner, action.rationale, where);
			assert.equal(item.rowActionLabel, action.actionLabel, where);
		});
	}
});

test("the work-item key rides the source line; a keyless action still has a kind", async () => {
	const { toPulseNextActionSource } = await loadNextActionsHarness();

	assert.equal(
		toPulseNextActionSource({
			id: "keyed",
			label: "l",
			rationale: "r",
			actionLabel: "Capture decision",
			workItemKey: "PAY-101",
		}),
		"PAY-101",
	);
	assert.equal(
		toPulseNextActionSource({
			id: "bare",
			label: "l",
			rationale: "r",
			actionLabel: "Link pull requests",
		}),
		"Suggested action",
	);

	const { items, snapshot } = await nextActionRows("s4-night-shift");
	items.forEach((item, index) => {
		assert.equal(item.source, toPulseNextActionSource(snapshot.nextActions[index]));
	});
	assert.ok(items.every((item) => item.source.startsWith("PAY-")));
	assert.ok(snapshot.nextActions.every((action) => action.workItemKey !== undefined));
});

test("assign-agent rows take the chat tile; everything else takes the page tile", async () => {
	const { items } = await nextActionRows("s1-kickoff");

	const decision = items.find((item) => item.id === "s1-act-decision");
	const assign = items.find((item) => item.id === "s1-act-killswitch");

	assert.equal(decision?.iconName, "page");
	assert.equal(decision?.tileVariant, "blueSubtle");
	assert.equal(assign?.iconName, "ai-chat");
	assert.equal(assign?.tileVariant, "purpleSubtle");
});

test("a requested action keeps its row and only changes the verb", async () => {
	const { toPulseNextActionRowLabel } = await loadNextActionsHarness();
	const action = {
		id: "s1-act-decision",
		label: "Write the adapter decision onto PAY-101",
		rationale: "r",
		actionLabel: "Capture decision",
		workItemKey: "PAY-101",
	};

	assert.equal(toPulseNextActionRowLabel(action, new Set()), "Capture decision");
	assert.equal(toPulseNextActionRowLabel(action, new Set(["s1-act-decision"])), "Requested");

	const { items } = await nextActionRows("s1-kickoff", new Set(["s1-act-decision"]));
	const requested = items.find((item) => item.id === "s1-act-decision");
	const untouched = items.find((item) => item.id === "s1-act-killswitch");

	assert.equal(requested?.rowActionLabel, "Requested");
	assert.equal(requested?.title, action.label);
	assert.equal(untouched?.rowActionLabel, "Assign agent");
});

test("the section renders the shared next-best-action block", () => {
	assert.match(
		SOURCES.signals,
		/import \{ NextBestAction, type NextBestActionItem \} from "@\/components\/blocks\/next-best-action";/u,
	);
	assert.match(SOURCES.signals, /<NextBestAction className="mt-3" items=\{items\} onAct=\{handleAct\} \/>/u);
	assert.match(
		SOURCES.signals,
		/const items = toPulseNextActionItems\(actions, requestedActionIds\);/u,
	);
	assert.match(SOURCES.signals, /if \(requestedActionIds\.has\(item\.id\)\) return;/u);
	// Emptying by scoping is decided on the mapped rows.
	assert.match(SOURCES.signals, /if \(items\.length === 0 && emptyNote === undefined\) return null;/u);
	// The reserved-track row this file used to own must not come back.
	assert.doesNotMatch(SOURCES.signals, /PulseSignalRow/u);
	assert.doesNotMatch(SOURCES.signals, /PULSE_ROW_ACTION_TRACK/u);
	assert.doesNotMatch(SOURCES.signals, /PULSE_ROW_KEY_TRACK/u);
});
