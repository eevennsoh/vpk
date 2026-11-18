const test = require("node:test");
const assert = require("node:assert/strict");

const {
	buildRovoAppPlanExecutionDismissKey,
	clearRovoAppPlanExecutionDismissalsForThread,
	resolveRovoAppPlanExecutionTracker,
} = require("./rovo-app-plan-execution-tracker.ts");
const {
	getPlanApprovalKeyFromPlanWidget,
} = require("../../shared/lib/plan-approval.ts");

function createPlanWidgetPayload() {
	return {
		title: "Build dashboard",
		description: "Ship the execution flow",
		markdown: "## Plan",
		tasks: [
			{ id: "task-1", label: "Audit current flow", blockedBy: [], agent: "Planner" },
			{ id: "task-2", label: "Refactor orchestration", blockedBy: ["task-1"], agent: "Builder" },
			{ id: "task-3", label: "Run validation", blockedBy: ["task-2"] },
		],
		deferredToolCallId: "tool-plan-1",
	};
}

function createVerbosePlanWidgetPayload() {
	return {
		title: "Reporting Dashboard",
		description: "Build the reporting view",
		markdown: "## Plan",
		tasks: [
			{
				id: "task-1",
				label: "Create mock report data with status, owner, and date fields.",
				blockedBy: [],
			},
			{
				id: "task-2",
				label: "Build report table component using existing table primitives.",
				blockedBy: ["task-1"],
			},
		],
		deferredToolCallId: "tool-plan-verbose",
	};
}

function createPlanAssistantMessage(planWidget) {
	return {
		id: "assistant-plan",
		role: "assistant",
		parts: [
			{
				type: "data-widget-data",
				data: {
					type: "plan",
					payload: planWidget,
				},
			},
		],
	};
}

function createApprovalUserMessage(planKey, createdAt = "2026-03-30T10:00:00.000Z") {
	return {
		id: "user-approval",
		role: "user",
		metadata: {
			source: "plan-approval-submit",
			planApprovalDecision: "auto-accept",
			planApprovalPlanKey: planKey,
			createdAt,
			updatedAt: createdAt,
		},
		parts: [
			{
				type: "text",
				text: "Accepted the plan.",
				state: "done",
			},
		],
	};
}

function createExecutionAssistantMessage({
	outputPreview,
	text = "Working through the approved plan.",
	timestamp = "2026-03-30T10:04:00.000Z",
}) {
	return {
		id: "assistant-execution",
		role: "assistant",
		metadata: {
			updatedAt: timestamp,
		},
		parts: [
			{
				type: "data-thinking-event",
				data: {
					eventId: "event-update-todo",
					phase: "result",
					toolName: "update_todo",
					outputPreview,
					timestamp,
				},
			},
			{
				type: "text",
				text,
				state: "done",
			},
			{
				type: "data-turn-complete",
				data: {
					timestamp,
				},
			},
		],
	};
}

// 1cdace1ff derives tracker tasks only from update_todo snapshots, so accepted plan tasks no
// longer seed, label or re-id the tracker; the plan-task fallback cases went with it.
test("resolveRovoAppPlanExecutionTracker counts distinct nonblank accepted-plan task agents before update_todo", () => {
	const planWidget = createPlanWidgetPayload();
	planWidget.tasks.push(
		{ id: "task-4", label: "Review", blockedBy: [], agent: " Planner " },
		{ id: "task-5", label: "Unassigned", blockedBy: [], agent: "   " },
	);
	const tracker = resolveRovoAppPlanExecutionTracker({
		activeRun: {
			id: "run-1",
			status: "streaming",
			rovoPort: 8000,
			startedAt: "2026-03-30T10:00:10.000Z",
			updatedAt: "2026-03-30T10:00:20.000Z",
		},
		messages: [
			createPlanAssistantMessage(planWidget),
			createApprovalUserMessage(getPlanApprovalKeyFromPlanWidget(planWidget)),
		],
		threadId: "thread-1",
		threadUpdatedAt: "2026-03-30T10:00:20.000Z",
	});

	assert.equal(tracker?.agentCount, 2);
	assert.equal(tracker?.taskCount, 1);
	assert.equal(tracker?.taskStatusGroups.todo[0]?.id, "__pending-update-todo__");
});

test("resolveRovoAppPlanExecutionTracker maps update_todo snapshot into task groups", () => {
	const planWidget = createPlanWidgetPayload();
	const planKey = getPlanApprovalKeyFromPlanWidget(planWidget);
	const tracker = resolveRovoAppPlanExecutionTracker({
		activeRun: {
			id: "run-1",
			status: "streaming",
			rovoPort: 8000,
			startedAt: "2026-03-30T10:00:10.000Z",
			updatedAt: "2026-03-30T10:03:00.000Z",
		},
		messages: [
			createPlanAssistantMessage(planWidget),
			createApprovalUserMessage(planKey),
			createExecutionAssistantMessage({
				outputPreview: [
					"<todo>",
					'{"id":"task-1","content":"Audit current flow","status":"completed"}',
					'{"id":"task-2","content":"Refactor orchestration","active_form":"Refactoring orchestration","status":"in_progress"}',
					'{"id":"task-3","content":"Run validation","status":"pending"}',
					"</todo>",
				].join("\n"),
			}),
		],
		threadId: "thread-1",
		threadUpdatedAt: "2026-03-30T10:03:00.000Z",
	});

	assert.equal(tracker?.runStatus, "running");
	assert.equal(tracker?.taskStatusGroups.done.length, 1);
	assert.equal(tracker?.taskStatusGroups.inProgress.length, 1);
	assert.equal(tracker?.taskStatusGroups.todo.length, 1);
	assert.equal(
		tracker?.taskStatusGroups.inProgress[0]?.label,
		"Refactor orchestration",
	);
	assert.equal(
		tracker?.taskStatusGroups.inProgress[0]?.description,
		"Refactoring orchestration",
	);
});

test("resolveRovoAppPlanExecutionTracker marks completed runs when all tasks are done", () => {
	const planWidget = createPlanWidgetPayload();
	const planKey = getPlanApprovalKeyFromPlanWidget(planWidget);
	const tracker = resolveRovoAppPlanExecutionTracker({
		activeRun: null,
		messages: [
			createPlanAssistantMessage(planWidget),
			createApprovalUserMessage(planKey),
			createExecutionAssistantMessage({
				outputPreview: [
					"<todo>",
					'{"id":"task-1","content":"Audit current flow","status":"completed"}',
					'{"id":"task-2","content":"Refactor orchestration","status":"completed"}',
					'{"id":"task-3","content":"Run validation","status":"completed"}',
					"</todo>",
				].join("\n"),
				text: "Your app is ready.",
				timestamp: "2026-03-30T10:05:00.000Z",
			}),
		],
		threadId: "thread-1",
		threadUpdatedAt: "2026-03-30T10:05:00.000Z",
	});

	assert.equal(tracker?.runStatus, "completed");
	assert.equal(tracker?.runCompletedAt, "2026-03-30T10:05:00.000Z");
	assert.equal(tracker?.taskStatusGroups.done.length, 3);
});

test("resolveRovoAppPlanExecutionTracker accepts numeric todo ids from update_todo", () => {
	const planWidget = createPlanWidgetPayload();
	const planKey = getPlanApprovalKeyFromPlanWidget(planWidget);
	const tracker = resolveRovoAppPlanExecutionTracker({
		activeRun: null,
		messages: [
			createPlanAssistantMessage(planWidget),
			createApprovalUserMessage(planKey),
			createExecutionAssistantMessage({
				outputPreview: [
					"<todo>",
					'{"id":1,"content":"Audit current flow","status":"completed"}',
					'{"id":2,"content":"Refactor orchestration","status":"completed"}',
					'{"id":3,"content":"Run validation","status":"completed"}',
					"</todo>",
				].join("\n"),
				text: "Run complete.",
				timestamp: "2026-03-30T10:06:00.000Z",
			}),
		],
		threadId: "thread-1",
		threadUpdatedAt: "2026-03-30T10:06:00.000Z",
	});

	assert.equal(tracker?.taskCount, 3);
	assert.equal(tracker?.runStatus, "completed");
	assert.equal(tracker?.taskStatusGroups.done.length, 3);
	assert.equal(tracker?.taskStatusGroups.todo.length, 0);
	assert.deepEqual(
		tracker?.taskStatusGroups.done.map((task) => task.id),
		["1", "2", "3"],
	);
	assert.deepEqual(
		tracker?.taskStatusGroups.done.map((task) => task.label),
		["Audit current flow", "Refactor orchestration", "Run validation"],
	);
});

test("resolveRovoAppPlanExecutionTracker uses update_todo labels directly (backward compat with plan labels)", () => {
	const planWidget = createVerbosePlanWidgetPayload();
	const planKey = getPlanApprovalKeyFromPlanWidget(planWidget);
	const tracker = resolveRovoAppPlanExecutionTracker({
		activeRun: null,
		messages: [
			createPlanAssistantMessage(planWidget),
			createApprovalUserMessage(planKey),
			createExecutionAssistantMessage({
				outputPreview: [
					"<todo>",
					'{"id":1,"content":"Create mock report data and TypeScript interface","status":"completed"}',
					'{"id":2,"content":"Build report table component with sorting/filtering","status":"completed"}',
					"</todo>",
				].join("\n"),
				text: "Run complete.",
				timestamp: "2026-03-30T10:07:00.000Z",
			}),
		],
		threadId: "thread-1",
		threadUpdatedAt: "2026-03-30T10:07:00.000Z",
	});

	assert.deepEqual(
		tracker?.taskStatusGroups.done.map((task) => task.label),
		[
			"Create mock report data and TypeScript interface",
			"Build report table component with sorting/filtering",
		],
	);
});

test("resolveRovoAppPlanExecutionTracker marks failed runs when work remains incomplete", () => {
	const planWidget = createPlanWidgetPayload();
	const planKey = getPlanApprovalKeyFromPlanWidget(planWidget);
	const tracker = resolveRovoAppPlanExecutionTracker({
		activeRun: null,
		messages: [
			createPlanAssistantMessage(planWidget),
			createApprovalUserMessage(planKey),
			createExecutionAssistantMessage({
				outputPreview: [
					"<todo>",
					'{"id":"task-1","content":"Audit current flow","status":"completed"}',
					'{"id":"task-2","content":"Refactor orchestration","status":"pending"}',
					'{"id":"task-3","content":"Run validation","status":"pending"}',
					"</todo>",
				].join("\n"),
				text: "The run stopped before all tasks completed.",
				timestamp: "2026-03-30T10:05:00.000Z",
			}),
		],
		threadId: "thread-1",
		threadUpdatedAt: "2026-03-30T10:05:00.000Z",
	});

	assert.equal(tracker?.runStatus, "failed");
	assert.equal(tracker?.taskStatusGroups.done.length, 1);
	assert.equal(tracker?.taskStatusGroups.todo.length, 2);
});

test("resolveRovoAppPlanExecutionTracker marks all tasks completed when artifact was generated", () => {
	const planWidget = createPlanWidgetPayload();
	const planKey = getPlanApprovalKeyFromPlanWidget(planWidget);
	const tracker = resolveRovoAppPlanExecutionTracker({
		activeRun: null,
		messages: [
			createPlanAssistantMessage(planWidget),
			createApprovalUserMessage(planKey),
			{
				id: "assistant-execution",
				role: "assistant",
				metadata: {
					updatedAt: "2026-03-30T10:05:00.000Z",
				},
				parts: [
					{
						type: "data-thinking-event",
						data: {
							eventId: "event-update-todo",
							phase: "result",
							toolName: "update_todo",
							outputPreview: [
								"<todo>",
								'{"id":"task-1","content":"Audit current flow","status":"completed"}',
								'{"id":"task-2","content":"Refactor orchestration","status":"completed"}',
								'{"id":"task-3","content":"Run validation","status":"pending"}',
								"</todo>",
							].join("\n"),
							timestamp: "2026-03-30T10:04:00.000Z",
						},
					},
					{
						type: "data-artifact-result",
						data: {
							action: "create",
							documentId: "doc-1",
							kind: "nextjs-app",
							title: "Dashboard",
						},
					},
					{
						type: "text",
						text: "Your app is ready.",
						state: "done",
					},
					{
						type: "data-turn-complete",
						data: {
							timestamp: "2026-03-30T10:05:00.000Z",
						},
					},
				],
			},
		],
		threadId: "thread-1",
		threadUpdatedAt: "2026-03-30T10:05:00.000Z",
	});

	assert.equal(tracker?.runStatus, "completed");
	assert.equal(tracker?.taskStatusGroups.done.length, 3);
	assert.equal(tracker?.taskStatusGroups.todo.length, 0);
	assert.equal(tracker?.taskStatusGroups.inProgress.length, 0);
});

function createEmptyTasksPlanWidgetPayload() {
	return {
		title: "Build dashboard",
		description: "Ship the execution flow",
		markdown: "## Plan",
		tasks: [],
		deferredToolCallId: "tool-plan-empty",
	};
}

test("resolveRovoAppPlanExecutionTracker works with empty plan tasks and update_todo snapshot", () => {
	const planWidget = createEmptyTasksPlanWidgetPayload();
	const planKey = getPlanApprovalKeyFromPlanWidget(planWidget);
	const tracker = resolveRovoAppPlanExecutionTracker({
		activeRun: {
			id: "run-1",
			status: "streaming",
			rovoPort: 8000,
			startedAt: "2026-03-30T10:00:10.000Z",
			updatedAt: "2026-03-30T10:03:00.000Z",
		},
		messages: [
			createPlanAssistantMessage(planWidget),
			createApprovalUserMessage(planKey),
			createExecutionAssistantMessage({
				outputPreview: [
					"<todo>",
					'{"id":"task-1","content":"Audit current flow","status":"completed"}',
					'{"id":"task-2","content":"Refactor orchestration","active_form":"Refactoring orchestration","status":"in_progress"}',
					'{"id":"task-3","content":"Run validation","status":"pending"}',
					"</todo>",
				].join("\n"),
			}),
		],
		threadId: "thread-1",
		threadUpdatedAt: "2026-03-30T10:03:00.000Z",
	});

	assert.equal(tracker?.runStatus, "running");
	assert.equal(tracker?.taskCount, 3);
	assert.equal(tracker?.taskStatusGroups.done.length, 1);
	assert.equal(tracker?.taskStatusGroups.inProgress.length, 1);
	assert.equal(tracker?.taskStatusGroups.todo.length, 1);
	assert.equal(
		tracker?.taskStatusGroups.inProgress[0]?.label,
		"Refactor orchestration",
	);
	assert.equal(
		tracker?.taskStatusGroups.inProgress[0]?.description,
		"Refactoring orchestration",
	);
});

test("resolveRovoAppPlanExecutionTracker shows placeholder progress before update_todo arrives", () => {
	const planWidget = createEmptyTasksPlanWidgetPayload();
	const planKey = getPlanApprovalKeyFromPlanWidget(planWidget);
	const tracker = resolveRovoAppPlanExecutionTracker({
		activeRun: {
			id: "run-1",
			status: "streaming",
			rovoPort: 8000,
			startedAt: "2026-03-30T10:00:10.000Z",
			updatedAt: "2026-03-30T10:00:20.000Z",
		},
		messages: [
			createPlanAssistantMessage(planWidget),
			createApprovalUserMessage(planKey),
		],
		threadId: "thread-1",
		threadUpdatedAt: "2026-03-30T10:00:20.000Z",
	});

	assert.equal(tracker?.runStatus, "running");
	assert.equal(tracker?.taskCount, 1);
	assert.equal(tracker?.agentCount, 1);
	assert.deepEqual(tracker?.taskStatusGroups, {
		done: [],
		inReview: [],
		inProgress: [],
		failed: [],
		todo: [
			{
				id: "__pending-update-todo__",
				label: "Preparing task list",
				description: "Waiting for the first task update",
				agentName: undefined,
			},
		],
	});
});

test("resolveRovoAppPlanExecutionTracker marks completed with empty plan tasks when all snapshot tasks done", () => {
	const planWidget = createEmptyTasksPlanWidgetPayload();
	const planKey = getPlanApprovalKeyFromPlanWidget(planWidget);
	const tracker = resolveRovoAppPlanExecutionTracker({
		activeRun: null,
		messages: [
			createPlanAssistantMessage(planWidget),
			createApprovalUserMessage(planKey),
			createExecutionAssistantMessage({
				outputPreview: [
					"<todo>",
					'{"id":"task-1","content":"Audit current flow","status":"completed"}',
					'{"id":"task-2","content":"Refactor orchestration","status":"completed"}',
					"</todo>",
				].join("\n"),
				text: "Your app is ready.",
				timestamp: "2026-03-30T10:05:00.000Z",
			}),
		],
		threadId: "thread-1",
		threadUpdatedAt: "2026-03-30T10:05:00.000Z",
	});

	assert.equal(tracker?.runStatus, "completed");
	assert.equal(tracker?.taskCount, 2);
	assert.equal(tracker?.taskStatusGroups.done.length, 2);
	assert.equal(tracker?.taskStatusGroups.todo.length, 0);
});

test("clearRovoAppPlanExecutionDismissalsForThread removes only matching thread keys", () => {
	const nextKeys = clearRovoAppPlanExecutionDismissalsForThread(
		new Set([
			buildRovoAppPlanExecutionDismissKey("thread-1", "plan-a"),
			buildRovoAppPlanExecutionDismissKey("thread-2", "plan-b"),
		]),
		"thread-1",
	);

	assert.deepEqual(
		Array.from(nextKeys),
		[buildRovoAppPlanExecutionDismissKey("thread-2", "plan-b")],
	);
});
