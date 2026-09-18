const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createSessionCohort,
	isTransferSourceFaded,
	selectDragCohort,
	sessionCohortIds,
	singletonSessionCohort,
} = require("./session-cohort.ts");

function session(id) {
	return {
		agent: { id: "claude", kind: "agent", name: "Claude" },
		host: "local",
		id,
		sessionDetails: { host: "local", issueSummary: `${id} work` },
		state: "complete",
		title: `${id} title`,
	};
}

test("a marked origin publishes every visible marked session in list order", () => {
	const visible = [session("lw-a"), session("lw-b"), session("lw-c")];
	const cohort = selectDragCohort("lw-a", {
		markedIds: new Set(["lw-c", "lw-a"]),
	}, visible);

	assert.deepEqual(sessionCohortIds(cohort), ["lw-a", "lw-c"]);
});

test("the grabbed session leads the cohort even when another marked card appears first", () => {
	const visible = [session("lw-a"), session("lw-b"), session("lw-c")];
	const selected = { markedIds: new Set(["lw-a", "lw-c"]) };
	const fromFirst = selectDragCohort("lw-a", selected, visible);
	const fromLast = selectDragCohort("lw-c", selected, visible);
	assert.deepEqual(sessionCohortIds(fromLast), ["lw-c", "lw-a"]);
	assert.equal(fromLast.members[0], visible[2]);
	assert.equal(fromLast.key, fromFirst.key);
});

test("an unmarked origin among marks publishes that session only", () => {
	const visible = [session("lw-a"), session("lw-b"), session("lw-c")];
	const cohort = selectDragCohort("lw-b", {
		markedIds: new Set(["lw-a", "lw-c"]),
	}, visible);

	assert.deepEqual(sessionCohortIds(cohort), ["lw-b"]);
});

test("a marked origin omits marked sessions that are not visible", () => {
	const visible = [session("lw-a"), session("lw-c")];
	const cohort = selectDragCohort("lw-a", {
		markedIds: new Set(["lw-a", "lw-hidden", "lw-c"]),
	}, visible);

	assert.deepEqual(sessionCohortIds(cohort), ["lw-a", "lw-c"]);
});

test("empty marks publish the grabbed session as a singleton", () => {
	const visible = [session("lw-a"), session("lw-b")];
	const cohort = selectDragCohort("lw-b", { markedIds: new Set() }, visible);

	assert.deepEqual(sessionCohortIds(cohort), ["lw-b"]);
});

test("the cohort key is order-independent while members keep visible order", () => {
	const first = createSessionCohort([session("lw-b"), session("lw-a")]);
	const second = createSessionCohort([session("lw-a"), session("lw-b")]);

	assert.ok(first);
	assert.ok(second);
	assert.equal(first.key, second.key);
	assert.deepEqual(sessionCohortIds(first), ["lw-b", "lw-a"]);
	assert.deepEqual(sessionCohortIds(second), ["lw-a", "lw-b"]);
	assert.equal(first.key, "lw-a|lw-b");
	assert.equal(singletonSessionCohort(session("lw-a")).key, "lw-a");
});

test("followers fade and the publisher keeps its footprint", () => {
	const draggingIds = new Set(["lw-a", "lw-b"]);
	assert.equal(isTransferSourceFaded("lw-b", draggingIds, false), true);
	assert.equal(isTransferSourceFaded("lw-a", draggingIds, true), false);
	assert.equal(isTransferSourceFaded("lw-c", draggingIds, false), false);
});

test("createSessionCohort refuses an empty member list", () => {
	assert.equal(createSessionCohort([]), null);
	const parsed = createSessionCohort([{ id: "a" }, { id: "b" }]);
	assert.ok(parsed);
	assert.deepEqual(sessionCohortIds(parsed), ["a", "b"]);
});
