import assert from "node:assert/strict";
import test from "node:test";

import type { ApproveTarget } from "../agent-session/agent-session-approve";
import type { AgentSessionItem } from "../agent-session/agent-session-types";
import type { UntrackedWorkTriage } from "../agent-session/untracked-work-triage";

import { runBulkAction } from "./untracked-selection-actions.ts";
import { buildUntrackedHeaderModel, NO_SELECTION_MARKS, reduceSelectionMarks, resolveLeadSpotlight, resolveTriageApprove, resolveUntrackedSelectionGesture, resolveVisibleLeadId, selectEffectiveSelection } from "./untracked-selection.ts";

function session(id: string, issueKey?: string): AgentSessionItem {
	return {
		agent: { id: "claude", kind: "agent", name: "Claude" },
		host: "local",
		id,
		sessionDetails: issueKey === undefined
			? { host: "local", issueSummary: `${id} work` }
			: { host: "local", issueKey, issueSummary: `${issueKey} work` },
		state: "complete",
		title: `${id} title`,
	};
}

test("toggle adds and removes marks without pruning the set", () => {
	const added = reduceSelectionMarks(NO_SELECTION_MARKS, { type: "toggle", id: "lw-a" });
	assert.deepEqual([...added.markedIds], ["lw-a"]);

	const both = reduceSelectionMarks(added, { type: "toggle", id: "lw-b" });
	assert.deepEqual([...both.markedIds], ["lw-a", "lw-b"]);

	const removed = reduceSelectionMarks(both, { type: "toggle", id: "lw-a" });
	assert.deepEqual([...removed.markedIds], ["lw-b"]);
});

test("clear is a no-op on an empty mark set", () => {
	assert.equal(reduceSelectionMarks(NO_SELECTION_MARKS, { type: "clear" }), NO_SELECTION_MARKS);
});

test("select-all adds visible ids and keeps marks that are already there", () => {
	const marked = reduceSelectionMarks(NO_SELECTION_MARKS, { type: "toggle", id: "lw-a" });
	const selected = reduceSelectionMarks(marked, {
		type: "select-all",
		ids: ["lw-a", "lw-b", "lw-c"],
	});

	assert.deepEqual([...selected.markedIds], ["lw-a", "lw-b", "lw-c"]);
});

test("select-all is a no-op when every id is already marked", () => {
	const marked = reduceSelectionMarks(
		reduceSelectionMarks(NO_SELECTION_MARKS, { type: "toggle", id: "lw-a" }),
		{ type: "toggle", id: "lw-b" },
	);

	assert.equal(
		reduceSelectionMarks(marked, { type: "select-all", ids: ["lw-a", "lw-b"] }),
		marked,
	);
	assert.equal(
		reduceSelectionMarks(NO_SELECTION_MARKS, { type: "select-all", ids: [] }),
		NO_SELECTION_MARKS,
	);
});

test("clear empties marks, keeps the keyboard lead, and does not invent a spotlight field", () => {
	const marked = reduceSelectionMarks(NO_SELECTION_MARKS, { type: "toggle", id: "lw-a" });
	const cleared = reduceSelectionMarks(marked, { type: "clear" });
	assert.deepEqual([...cleared.markedIds], []);
	assert.equal(cleared.leadId, "lw-a");
	assert.equal(cleared.anchorId, "lw-a");
	assert.equal("selectedItemId" in cleared, false);
	assert.equal(reduceSelectionMarks(NO_SELECTION_MARKS, { type: "clear" }), NO_SELECTION_MARKS);
});

test("effective selection intersects marks with visible rows in list order", () => {
	const visible = [session("lw-a", "PAY-101"), session("lw-b", "PAY-102"), session("lw-c", "PAY-103")];
	const marks = {
		anchorId: "lw-a",
		leadId: "lw-c",
		markedIds: new Set(["lw-c", "lw-hidden", "lw-a"]),
	};

	const selection = selectEffectiveSelection(marks, visible);
	assert.equal(selection.kind, "active");
	if (selection.kind !== "active") {
		return;
	}

	assert.deepEqual(selection.items.map((item: AgentSessionItem) => item.id), ["lw-a", "lw-c"]);
	assert.equal(selection.items.length >= 1, true);
});

test("hidden, captured, or filtered-out marks stay in the set and stay inert", () => {
	const marks = reduceSelectionMarks(
		reduceSelectionMarks(NO_SELECTION_MARKS, { type: "toggle", id: "lw-hidden" }),
		{ type: "toggle", id: "lw-visible" },
	);
	assert.deepEqual([...marks.markedIds], ["lw-hidden", "lw-visible"]);

	const selection = selectEffectiveSelection(marks, [session("lw-visible", "PAY-101")]);
	assert.equal(selection.kind, "active");
	if (selection.kind === "active") {
		assert.deepEqual(selection.items.map((item: AgentSessionItem) => item.id), ["lw-visible"]);
	}

	assert.equal(selectEffectiveSelection(marks, [session("lw-other", "PAY-102")]).kind, "empty");
	assert.deepEqual([...marks.markedIds], ["lw-hidden", "lw-visible"]);
});

test("an empty intersection is empty, not an active selection of zero", () => {
	assert.deepEqual(
		selectEffectiveSelection({ markedIds: new Set(["lw-gone"]), anchorId: null, leadId: null }, [session("lw-a")]),
		{ kind: "empty" },
	);
	assert.deepEqual(
		selectEffectiveSelection(NO_SELECTION_MARKS, [session("lw-a")]),
		{ kind: "empty" },
	);
});

const ORDERED_IDS = ["lw-a", "lw-b", "lw-c", "lw-d"];

test("a plain activate replaces the selection and sets the shift anchor", () => {
	const first = reduceSelectionMarks(NO_SELECTION_MARKS, {
		gesture: { additive: false, range: false },
		id: "lw-b",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual([...first.markedIds], ["lw-b"]);
	assert.equal(first.anchorId, "lw-b");
	assert.equal(first.leadId, "lw-b");

	const replaced = reduceSelectionMarks(first, {
		gesture: { additive: false, range: false },
		id: "lw-d",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual([...replaced.markedIds], ["lw-d"]);
	assert.equal(replaced.anchorId, "lw-d");
});

test("plain clicks add and remove rows after the first selection", () => {
	const first = reduceSelectionMarks(NO_SELECTION_MARKS, {
		gesture: { additive: false, range: false },
		id: "lw-a",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	const firstSelection = selectEffectiveSelection(first, ORDERED_IDS.map((id) => session(id)));
	const addedGesture = resolveUntrackedSelectionGesture(
		{ additive: false, range: false },
		firstSelection,
	);
	const added = reduceSelectionMarks(first, {
		gesture: addedGesture,
		id: "lw-c",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual([...added.markedIds], ["lw-a", "lw-c"]);

	const addedSelection = selectEffectiveSelection(added, ORDERED_IDS.map((id) => session(id)));
	const removedGesture = resolveUntrackedSelectionGesture(
		{ additive: false, range: false },
		addedSelection,
	);
	const removed = reduceSelectionMarks(added, {
		gesture: removedGesture,
		id: "lw-c",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual([...removed.markedIds], ["lw-a"]);
	assert.deepEqual(
		resolveLeadSpotlight(added, removed, removedGesture, "lw-c"),
		{ kind: "clear" },
	);
});

test("range clicks keep replacing the active range", () => {
	const anchor = reduceSelectionMarks(NO_SELECTION_MARKS, {
		gesture: { additive: false, range: false },
		id: "lw-a",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	const selectedThroughD = reduceSelectionMarks(anchor, {
		gesture: { additive: false, range: true },
		id: "lw-d",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	const selection = selectEffectiveSelection(
		selectedThroughD,
		ORDERED_IDS.map((id) => session(id)),
	);
	const rangeGesture = resolveUntrackedSelectionGesture(
		{ additive: false, range: true },
		selection,
	);
	assert.deepEqual(rangeGesture, { additive: false, range: true });

	const shrunk = reduceSelectionMarks(selectedThroughD, {
		gesture: rangeGesture,
		id: "lw-b",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual([...shrunk.markedIds], ["lw-a", "lw-b"]);
});

test("an additive activate toggles without moving the shift anchor", () => {
	const anchor = reduceSelectionMarks(NO_SELECTION_MARKS, {
		gesture: { additive: false, range: false },
		id: "lw-a",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	const added = reduceSelectionMarks(anchor, {
		gesture: { additive: true, range: false },
		id: "lw-c",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual([...added.markedIds], ["lw-a", "lw-c"]);
	assert.equal(added.anchorId, "lw-a");
	assert.equal(added.leadId, "lw-c");

	const removed = reduceSelectionMarks(added, {
		gesture: { additive: true, range: false },
		id: "lw-a",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual([...removed.markedIds], ["lw-c"]);
	assert.equal(removed.anchorId, "lw-a");
});

test("visible lead stays on a present row and otherwise falls back to the first", () => {
	assert.equal(resolveVisibleLeadId(ORDERED_IDS, "lw-c"), "lw-c");
	assert.equal(resolveVisibleLeadId(ORDERED_IDS, "lw-hidden"), "lw-a");
	assert.equal(resolveVisibleLeadId(ORDERED_IDS, null), "lw-a");
	assert.equal(resolveVisibleLeadId([], "lw-a"), null);
});

test("additive unmark of the lead clears the spotlight; other toggles keep it", () => {
	const exclusive = reduceSelectionMarks(NO_SELECTION_MARKS, {
		gesture: { additive: false, range: false },
		id: "lw-a",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual(
		resolveLeadSpotlight(NO_SELECTION_MARKS, exclusive, { additive: false, range: false }, "lw-a"),
		{ kind: "item", id: "lw-a" },
	);

	const added = reduceSelectionMarks(exclusive, {
		gesture: { additive: true, range: false },
		id: "lw-c",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual(
		resolveLeadSpotlight(exclusive, added, { additive: true, range: false }, "lw-c"),
		{ kind: "item", id: "lw-c" },
	);

	const unmarkedLead = reduceSelectionMarks(added, {
		gesture: { additive: true, range: false },
		id: "lw-c",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual(
		resolveLeadSpotlight(added, unmarkedLead, { additive: true, range: false }, "lw-c"),
		{ kind: "clear" },
	);

	const unmarkedOther = reduceSelectionMarks(added, {
		gesture: { additive: true, range: false },
		id: "lw-a",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual(
		resolveLeadSpotlight(added, unmarkedOther, { additive: true, range: false }, "lw-a"),
		{ kind: "none" },
	);
});

test("a range activate selects every visible id between the anchor and the lead", () => {
	const anchor = reduceSelectionMarks(NO_SELECTION_MARKS, {
		gesture: { additive: false, range: false },
		id: "lw-a",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	const ranged = reduceSelectionMarks(anchor, {
		gesture: { additive: false, range: true },
		id: "lw-c",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual([...ranged.markedIds], ["lw-a", "lw-b", "lw-c"]);
	assert.equal(ranged.anchorId, "lw-a");
	assert.equal(ranged.leadId, "lw-c");

	const shrunk = reduceSelectionMarks(ranged, {
		gesture: { additive: false, range: true },
		id: "lw-b",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual([...shrunk.markedIds], ["lw-a", "lw-b"]);
	assert.equal(shrunk.anchorId, "lw-a");
});

test("an additive range unions the span without dropping earlier cherry-picks", () => {
	const cherry = reduceSelectionMarks(
		reduceSelectionMarks(NO_SELECTION_MARKS, {
			gesture: { additive: false, range: false },
			id: "lw-a",
			orderedIds: ORDERED_IDS,
			type: "activate",
		}),
		{
			gesture: { additive: true, range: false },
			id: "lw-d",
			orderedIds: ORDERED_IDS,
			type: "activate",
		},
	);
	const united = reduceSelectionMarks(cherry, {
		gesture: { additive: true, range: true },
		id: "lw-c",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	assert.deepEqual([...united.markedIds], ["lw-a", "lw-d", "lw-b", "lw-c"]);
	assert.equal(united.anchorId, "lw-a");
});

test("arrow move replaces, and shift-arrow extends from the anchor", () => {
	const origin = reduceSelectionMarks(NO_SELECTION_MARKS, {
		gesture: { additive: false, range: false },
		id: "lw-b",
		orderedIds: ORDERED_IDS,
		type: "activate",
	});
	const moved = reduceSelectionMarks(origin, {
		direction: "next",
		extend: false,
		orderedIds: ORDERED_IDS,
		type: "move",
	});
	assert.deepEqual([...moved.markedIds], ["lw-c"]);
	assert.equal(moved.anchorId, "lw-c");

	const extended = reduceSelectionMarks(origin, {
		direction: "next",
		extend: true,
		orderedIds: ORDERED_IDS,
		type: "move",
	});
	assert.deepEqual([...extended.markedIds], ["lw-b", "lw-c"]);
	assert.equal(extended.anchorId, "lw-b");
	assert.equal(extended.leadId, "lw-c");
});

test("move clamps at the ends and starts from the first row when nothing is focused", () => {
	const atEnd = reduceSelectionMarks(NO_SELECTION_MARKS, {
		direction: "last",
		extend: false,
		orderedIds: ORDERED_IDS,
		type: "move",
	});
	assert.deepEqual([...atEnd.markedIds], ["lw-d"]);
	assert.equal(
		reduceSelectionMarks(atEnd, {
			direction: "next",
			extend: false,
			orderedIds: ORDERED_IDS,
			type: "move",
		}),
		atEnd,
	);

	const fromEmpty = reduceSelectionMarks(NO_SELECTION_MARKS, {
		direction: "next",
		extend: false,
		orderedIds: ORDERED_IDS,
		type: "move",
	});
	assert.deepEqual([...fromEmpty.markedIds], ["lw-a"]);
});

test("the browsing header keeps the host title and count", () => {
	assert.deepEqual(
		buildUntrackedHeaderModel({
			approveTargetById: new Map(),
			count: 4,
			selection: { kind: "empty" },
			title: "Unlink sessions",
			visibleCount: 4,
		}),
		{ kind: "browsing", title: "Unlink sessions", count: 4 },
	);
});

test("the selecting header counts only rows Approve can attach", () => {
	const linkable = session("lw-a", "PAY-101");
	const unknown = session("lw-b", "PAY-999");
	const captured = session("lw-c", "PAY-102");
	const approveTargetById = new Map<string, ApproveTarget<{ code: string }>>([
		["lw-a", { kind: "work-item", key: "PAY-101", target: { code: "PAY-101" } }],
		["lw-b", { kind: "unavailable", reason: "unknown-work-item" }],
		["lw-c", { kind: "unavailable", reason: "already-attached" }],
	]);

	const model = buildUntrackedHeaderModel({
		approveTargetById,
		count: 8,
		selection: { kind: "active", items: [linkable, unknown, captured] },
		title: "Unlink sessions",
		visibleCount: 8,
	});

	assert.equal(model.kind, "selecting");
	if (model.kind !== "selecting") {
		return;
	}

	assert.equal(model.count, 3);
	assert.equal(model.allSelected, false);
	assert.deepEqual(model.actions, [
		{
			id: "approve",
			eligibleCount: 1,
			hint: { kind: "available", text: "Link agent sessions" },
		},
		{
			id: "create",
			eligibleCount: 2,
			hint: { kind: "available", text: "Create 3 work items" },
		},
		{
			id: "archive",
			eligibleCount: 3,
			hint: { kind: "available", text: "Archive 3 agent sessions" },
		},
		{
			id: "clear",
			eligibleCount: 3,
			hint: { kind: "available", text: "Clear" },
		},
	]);
});

test("header Create copy uses selectedCount, not eligibleCount", () => {
	const linkable = session("lw-a", "PAY-101");
	const captured = session("lw-c", "PAY-102");
	const model = buildUntrackedHeaderModel({
		approveTargetById: new Map([
			["lw-a", { kind: "work-item", key: "PAY-101", target: { code: "PAY-101" } }],
			["lw-c", { kind: "unavailable", reason: "already-attached" }],
		]),
		count: 2,
		selection: { kind: "active", items: [linkable, captured] },
		title: "Unlink sessions",
		visibleCount: 2,
	});

	assert.equal(model.kind, "selecting");
	if (model.kind !== "selecting") {
		return;
	}

	const create = model.actions.find((action) => action.id === "create");
	assert.equal(create?.eligibleCount, 1);
	assert.deepEqual(create?.hint, { kind: "available", text: "Create 2 work items" });
});

test("the selecting header is all-selected only when every visible row is marked", () => {
	const first = session("lw-a", "PAY-101");
	const second = session("lw-b", "PAY-102");
	const partial = buildUntrackedHeaderModel({
		approveTargetById: new Map(),
		count: 2,
		selection: { kind: "active", items: [first] },
		title: "Unlink sessions",
		visibleCount: 2,
	});
	const complete = buildUntrackedHeaderModel({
		approveTargetById: new Map(),
		count: 2,
		selection: { kind: "active", items: [first, second] },
		title: "Unlink sessions",
		visibleCount: 2,
	});

	assert.equal(partial.kind, "selecting");
	assert.equal(complete.kind, "selecting");
	if (partial.kind !== "selecting" || complete.kind !== "selecting") {
		return;
	}

	assert.equal(partial.allSelected, false);
	assert.equal(complete.allSelected, true);
});

test("header copy table pins exact available and unavailable strings", () => {
	const captured = session("lw-c", "PAY-102");
	const model = buildUntrackedHeaderModel({
		approveTargetById: new Map([
			["lw-c", { kind: "unavailable", reason: "already-attached" }],
		]),
		count: 1,
		selection: { kind: "active", items: [captured] },
		title: "Unlink sessions",
		visibleCount: 1,
	});

	assert.equal(model.kind, "selecting");
	if (model.kind !== "selecting") {
		return;
	}

	assert.deepEqual(model.actions.map((action) => action.hint), [
		{ kind: "unavailable", text: "No selected sessions have a work item to link" },
		{ kind: "unavailable", text: "No selected sessions can create a work item" },
		{ kind: "available", text: "Archive 1 agent session" },
		{ kind: "available", text: "Clear" },
	]);
});

test("the selecting header Unarchives when the archived view is open", () => {
	const captured = session("lw-c", "PAY-102");
	const model = buildUntrackedHeaderModel({
		approveTargetById: new Map([
			["lw-c", { kind: "unavailable", reason: "already-attached" }],
		]),
		count: 1,
		selection: { kind: "active", items: [captured] },
		title: "Archived",
		visibleCount: 1,
		visibilityLabel: "Unarchive",
	});

	assert.equal(model.kind, "selecting");
	if (model.kind !== "selecting") {
		return;
	}

	const archive = model.actions.find((action) => action.id === "archive");
	assert.deepEqual(archive?.hint, { kind: "available", text: "Unarchive 1 agent session" });
});

test("bulk approve attaches the located target and skips unavailable rows", () => {
	const linkable = session("lw-a", "PAY-101");
	const unknown = session("lw-b", "PAY-999");
	const located = { code: "PAY-101" };
	const attached: Array<readonly [string, { code: string }]> = [];
	const triage: UntrackedWorkTriage<{ code: string }> = {
		archive: () => undefined,
		attach: (item: AgentSessionItem, target: { code: string }) => {
			attached.push([item.id, target]);
		},
		createFrom: () => undefined,
		locateTarget: () => located,
	};

	runBulkAction("approve", { kind: "active", items: [linkable, unknown] }, {
		approveTargetById: new Map([
			["lw-a", { kind: "work-item", key: "PAY-101", target: located }],
			["lw-b", { kind: "unavailable", reason: "unknown-work-item" }],
		]),
		triage,
	});

	assert.deepEqual(attached, [["lw-a", located]]);
	assert.equal(attached[0]?.[1], located);
});

test("bulk create and archive skip ineligible rows and ignore an empty selection", () => {
	const open = session("lw-a", "PAY-101");
	const captured = session("lw-c", "PAY-102");
	const created: string[] = [];
	const archived: string[] = [];
	const triage: UntrackedWorkTriage<{ code: string }> = {
		archive: (item: AgentSessionItem) => {
			archived.push(item.id);
		},
		attach: () => undefined,
		createFrom: (item: AgentSessionItem) => {
			created.push(item.id);
		},
		locateTarget: () => undefined,
	};
	const approveTargetById = new Map<string, ApproveTarget<{ code: string }>>([
		["lw-a", { kind: "unavailable", reason: "no-suggestion" }],
		["lw-c", { kind: "unavailable", reason: "already-attached" }],
	]);

	runBulkAction("create", { kind: "active", items: [open, captured] }, {
		approveTargetById,
		triage,
	});
	runBulkAction("archive", { kind: "active", items: [open, captured] }, {
		approveTargetById,
		triage,
	});
	runBulkAction("approve", { kind: "empty" }, { approveTargetById, triage });

	assert.deepEqual(created, ["lw-a"]);
	assert.deepEqual(archived, ["lw-a", "lw-c"]);
});

test("a row offers the link check when the board still has the feature", () => {
	const target: ApproveTarget<{ code: string }> = {
		kind: "work-item",
		key: "PAY-107",
		target: { code: "PAY-107" },
	};
	let attached = 0;
	const approve = resolveTriageApprove(target, {
		enabled: true,
		onApprove: () => {
			attached += 1;
		},
	});

	assert.notEqual(approve, null);
	assert.equal(approve?.target, target);
	approve?.onApprove();
	assert.equal(attached, 1);
});

test("a board without the link feature gets no approve action, not a dead one", () => {
	const target: ApproveTarget<{ code: string }> = {
		kind: "work-item",
		key: "PAY-107",
		target: { code: "PAY-107" },
	};
	let attached = 0;

	assert.equal(
		resolveTriageApprove(target, {
			enabled: false,
			onApprove: () => {
				attached += 1;
			},
		}),
		null,
	);
	assert.equal(attached, 0);
});
