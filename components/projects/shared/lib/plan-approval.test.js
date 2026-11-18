const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
	createPlanApprovalSubmission,
	planWidgetRequiresApproval,
	serializePlanApprovalKey,
	buildPlanApprovalPrompt,
	findAcceptedPlanKey,
	getPlanApprovalState,
	getPlanApprovalKeyFromPlanWidget,
	getPlanApprovalKeyFromSubmission,
} = require("./plan-approval.ts");

describe("planWidgetRequiresApproval", () => {
	it("returns true for deferred exit-plan widgets", () => {
		assert.equal(
			planWidgetRequiresApproval({
				title: "Team settings rollout",
				description: "Plan summary",
				markdown: "# Team settings rollout",
				tasks: [{ id: "task-1", label: "Define scope", blockedBy: [] }],
				agents: [],
				deferredToolCallId: "tool-call-123",
			}),
			true,
		);
	});

	it("returns false when no deferred tool call is present", () => {
		assert.equal(
			planWidgetRequiresApproval({
				title: "Generated checklist",
				description: "Standalone plan output",
				markdown: "# Generated checklist",
				tasks: [{ id: "task-1", label: "Queue follow-up", blockedBy: [] }],
				agents: [],
			}),
			false,
		);
	});

	it("returns false for null", () => {
		assert.equal(planWidgetRequiresApproval(null), false);
	});

	it("returns false for empty tasks and no deferredToolCallId", () => {
		assert.equal(
			planWidgetRequiresApproval({
				title: "Empty",
				markdown: "# Empty",
				tasks: [],
				agents: [],
			}),
			false,
		);
	});
});

describe("createPlanApprovalSubmission", () => {
	it("preserves deferred tool call ids", () => {
		const submission = createPlanApprovalSubmission(
			{ decision: "auto-accept" },
			{
				title: "Team settings rollout",
				description: "Plan summary",
				tasks: [{ id: "task-1", label: "Define scope", blockedBy: [] }],
				agents: [],
				toolCallId: "tool-call-123",
				deferredToolCallId: "tool-call-123",
			},
		);

		assert.equal(submission.toolCallId, "tool-call-123");
		assert.equal(submission.deferredToolCallId, "tool-call-123");
	});

	it("falls back to toolCallId when deferredToolCallId is absent", () => {
		const submission = createPlanApprovalSubmission(
			{ decision: "auto-accept" },
			{
				title: "Plan",
				tasks: [{ id: "task-1", label: "Do thing", blockedBy: [] }],
				agents: [],
				toolCallId: "fallback-id",
			},
		);

		assert.equal(submission.deferredToolCallId, "fallback-id");
		assert.equal(submission.toolCallId, "fallback-id");
	});

	it("maps deferredToolCallId to toolCallId when toolCallId is absent (exit_plan_mode resume)", () => {
		const submission = createPlanApprovalSubmission(
			{ decision: "auto-accept" },
			{
				title: "Plan",
				tasks: [{ id: "task-1", label: "Do thing", blockedBy: [] }],
				agents: [],
				deferredToolCallId: "deferred-exit-plan-1",
			},
		);

		assert.equal(submission.deferredToolCallId, "deferred-exit-plan-1");
		assert.equal(submission.toolCallId, "deferred-exit-plan-1");
	});

	it("includes plan title and no preseeded tasks", () => {
		const submission = createPlanApprovalSubmission(
			{ decision: "auto-accept" },
			{
				title: "  Dashboard Plan  ",
				markdown: "# Dashboard Plan",
				tasks: [
					{ id: "task-1", label: "Create stats card", blockedBy: [], agent: "ui" },
					{ id: "task-2", label: "Build feed", blockedBy: ["task-1"] },
				],
				agents: ["ui"],
			},
		);

		assert.equal(submission.planTitle, "Dashboard Plan");
		assert.deepEqual(submission.planTasks, []);
	});

	it("trims custom instruction whitespace", () => {
		const submission = createPlanApprovalSubmission(
			{ decision: "custom", customInstruction: "  Also add dark mode  " },
			null,
		);

		assert.equal(submission.customInstruction, "Also add dark mode");
	});
});

describe("serializePlanApprovalKey (Test Case 7 — key format)", () => {
	it("serializes title and task ids into a key", () => {
		const key = serializePlanApprovalKey("Dashboard Plan", ["task-1", "task-2", "task-3"]);
		assert.equal(key, "Dashboard Plan-task-1|task-2|task-3");
	});

	it("returns null for empty title", () => {
		assert.equal(serializePlanApprovalKey("", ["task-1"]), null);
		assert.equal(serializePlanApprovalKey("   ", ["task-1"]), null);
	});

	it("falls back to title when task ids are empty", () => {
		assert.equal(serializePlanApprovalKey("Plan", []), "Plan");
	});

	it("filters out empty task ids", () => {
		const key = serializePlanApprovalKey("Plan", ["task-1", "", "  ", "task-3"]);
		assert.equal(key, "Plan-task-1|task-3");
	});

	it("falls back to title when all task ids are empty", () => {
		assert.equal(serializePlanApprovalKey("Plan", ["", "  "]), "Plan");
	});
});

describe("getPlanApprovalKeyFromPlanWidget (Test Case 7)", () => {
	it("generates key from plan widget payload", () => {
		const key = getPlanApprovalKeyFromPlanWidget({
			title: "Sprint Board Plan",
			markdown: "# Sprint Board Plan",
			tasks: [
				{ id: "task-1", label: "Create board", blockedBy: [] },
				{ id: "task-2", label: "Add drag-drop", blockedBy: ["task-1"] },
			],
			agents: [],
		});
		assert.equal(key, "Sprint Board Plan-task-1|task-2");
	});

	it("prefers deferred tool call id for raw markdown plans", () => {
		const key = getPlanApprovalKeyFromPlanWidget({
			title: "Plan",
			markdown: "# Raw plan",
			tasks: [],
			agents: [],
			deferredToolCallId: "tool-plan-1",
		});
		assert.equal(key, "tool:tool-plan-1");
	});

	it("returns null for null widget", () => {
		assert.equal(getPlanApprovalKeyFromPlanWidget(null), null);
	});
});

describe("getPlanApprovalKeyFromSubmission (Test Case 7)", () => {
	it("generates key from submission", () => {
		const key = getPlanApprovalKeyFromSubmission({
			decision: "auto-accept",
			planTitle: "Sprint Board Plan",
			planTasks: [
				{ id: "task-1", label: "Create board", blockedBy: [] },
				{ id: "task-2", label: "Add drag-drop", blockedBy: ["task-1"] },
			],
		});
		assert.equal(key, "Sprint Board Plan-task-1|task-2");
	});

	it("prefers deferred tool call id from submission", () => {
		const key = getPlanApprovalKeyFromSubmission({
			decision: "auto-accept",
			planTitle: "Plan",
			planTasks: [],
			deferredToolCallId: "tool-plan-2",
		});
		assert.equal(key, "tool:tool-plan-2");
	});

	it("returns null for missing planTitle", () => {
		assert.equal(
			getPlanApprovalKeyFromSubmission({
				decision: "auto-accept",
				planTasks: [{ id: "t1", label: "x", blockedBy: [] }],
			}),
			null,
		);
	});
});

describe("buildPlanApprovalPrompt (Test Case 7 — synthetic message)", () => {
	it("generates auto-accept prompt text", () => {
		const prompt = buildPlanApprovalPrompt({
			decision: "auto-accept",
			planTitle: "Dashboard Plan",
		});

		assert.ok(prompt.includes("approval decision"));
		assert.ok(prompt.includes("Yes, let's start cooking"));
		assert.ok(!prompt.includes("Additional instruction"));
	});

	it("generates continue-planning prompt text", () => {
		const prompt = buildPlanApprovalPrompt({
			decision: "continue-planning",
			planTitle: "Dashboard Plan",
		});

		assert.ok(prompt.includes("No, keep planning"));
	});

	it("includes custom instruction when provided", () => {
		const prompt = buildPlanApprovalPrompt({
			decision: "custom",
			customInstruction: "Add dark mode support",
		});

		assert.ok(prompt.includes("Custom instruction"));
		assert.ok(prompt.includes("Add dark mode support"));
	});
});

describe("findAcceptedPlanKey (Test Case 7 + 13 — plan acceptance)", () => {
	it("finds the accepted plan key from messages", () => {
		const messages = [
			{ role: "assistant", id: "a1", parts: [] },
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "Dashboard-task-1|task-2",
				},
			},
			{ role: "assistant", id: "a2", parts: [{ type: "text", text: "Building the dashboard now." }] },
		];

		assert.equal(findAcceptedPlanKey(messages), "Dashboard-task-1|task-2");
	});

	it("returns null when no acceptance exists", () => {
		const messages = [
			{ role: "user", id: "u1", parts: [] },
			{ role: "assistant", id: "a1", parts: [] },
		];

		assert.equal(findAcceptedPlanKey(messages), null);
	});

	it("returns null for continue-planning decisions", () => {
		const messages = [
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "continue-planning",
					planApprovalPlanKey: "Plan-task-1",
				},
			},
		];

		assert.equal(findAcceptedPlanKey(messages), null);
	});

	it("returns the LAST accepted plan key (walks backwards)", () => {
		const messages = [
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "OldPlan-task-1",
				},
			},
			{ role: "assistant", id: "a1", parts: [] },
			{
				role: "user",
				id: "u2",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "NewPlan-task-1|task-2",
				},
			},
			{ role: "assistant", id: "a2", parts: [{ type: "text", text: "Starting the new plan." }] },
		];

		assert.equal(findAcceptedPlanKey(messages), "NewPlan-task-1|task-2");
	});

	it("ignores messages without plan-approval-submit source", () => {
		const messages = [
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "normal-message",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "NotReal-task-1",
				},
			},
		];

		assert.equal(findAcceptedPlanKey(messages), null);
	});

	it("returns null when acceptance is followed by a widget error", () => {
		const messages = [
			{ role: "assistant", id: "a1", parts: [] },
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "FailedPlan-task-1|task-2",
				},
			},
			{
				role: "assistant",
				id: "a2",
				parts: [
					{ type: "data-widget-error", data: { code: "TOOL_FAILED", message: "Tool 'exit_plan_mode' exceeded max retries count of 1" } },
				],
			},
		];

		assert.equal(findAcceptedPlanKey(messages), null);
	});

	it("returns accepted key when assistant follows without error", () => {
		const messages = [
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "GoodPlan-task-1",
				},
			},
			{
				role: "assistant",
				id: "a1",
				parts: [{ type: "text", text: "Starting execution..." }],
			},
		];

		assert.equal(findAcceptedPlanKey(messages), "GoodPlan-task-1");
	});

	it("returns null when approval is still pending on an active run", () => {
		const messages = [
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "PendingPlan-task-1",
				},
			},
			{
				role: "assistant",
				id: "a1",
				parts: [{ type: "data-route-decision", data: { intent: "chat" } }],
			},
		];

		assert.equal(
			findAcceptedPlanKey(messages),
			null,
		);
	});

	it("falls back to earlier acceptance when latest has widget error", () => {
		const messages = [
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "FirstPlan-task-1",
				},
			},
			{ role: "assistant", id: "a1", parts: [{ type: "text", text: "Building..." }] },
			{
				role: "user",
				id: "u2",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "SecondPlan-task-1",
				},
			},
			{
				role: "assistant",
				id: "a2",
				parts: [
					{ type: "data-widget-error", data: { code: "TOOL_FAILED", message: "Error" } },
				],
			},
		];

		assert.equal(findAcceptedPlanKey(messages), "FirstPlan-task-1");
	});

	it("returns null when planApprovalPlanKey is empty or whitespace", () => {
		const messages = [
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "   ",
				},
			},
		];

		assert.equal(findAcceptedPlanKey(messages), null);
	});
});

describe("getPlanApprovalState", () => {
	it("returns pending when the latest approval still has an active run", () => {
		const messages = [
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "Dashboard-task-1",
				},
			},
			{
				role: "assistant",
				id: "a1",
				parts: [{ type: "data-route-decision", data: { intent: "chat" } }],
			},
		];

		assert.deepEqual(
			getPlanApprovalState(messages, {
				id: "run-1",
				status: "background",
				rovoPort: null,
				startedAt: "2026-03-26T00:00:00.000Z",
				updatedAt: "2026-03-26T00:00:10.000Z",
			}),
			{
				status: "pending",
				planKey: "Dashboard-task-1",
			},
		);
	});

	it("returns null for route-decision-only follow-up when no active run remains", () => {
		const messages = [
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "Dashboard-task-1",
				},
			},
			{
				role: "assistant",
				id: "a1",
				parts: [{ type: "data-route-decision", data: { intent: "chat" } }],
			},
		];

		assert.equal(getPlanApprovalState(messages, null), null);
	});

	it("returns accepted for a substantive assistant follow-up after active run clears", () => {
		const messages = [
			{
				role: "user",
				id: "u1",
				parts: [],
				metadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: "Dashboard-task-1",
				},
			},
			{
				role: "assistant",
				id: "a1",
				parts: [{ type: "text", text: "Starting execution..." }],
			},
		];

		assert.deepEqual(getPlanApprovalState(messages, null), {
			status: "accepted",
			planKey: "Dashboard-task-1",
		});
	});
});
