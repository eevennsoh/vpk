const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	RFP_DRAFTING_AGENT_CONVERSATION_STARTERS,
	RFP_DRAFTING_AGENT_DESCRIPTION,
	RFP_DRAFTING_AGENT_NAME,
	RFP_DRAFTING_COLUMN_NAME,
	RFP_DRAFTING_EVENT_TRIGGER,
	RFP_DRAFTING_EVENT_TRIGGER_LABEL,
	RFP_DRAFTING_TRIGGER_PROMPT,
	RFP_REVIEW_COLUMN_NAME,
	advanceRfpDraftingAgentProcessing,
	createAgentsRfpDemoStateManager,
	createDefaultAgentsRfpDemoState,
	moveTicketToColumn,
	moveTicketEnteredColumn,
	normalizeAgentsRfpDemoState,
	runRfpDraftingAgent,
} = require("./agents-rfp-demo-state");

const RUN_NOW = Date.parse("2026-01-01T00:00:00.000Z");

async function advanceAll(state, now = RUN_NOW + 40_000) {
	return advanceRfpDraftingAgentProcessing(state, {
		now,
	});
}

test("default RFP demo backend state seeds the current board", () => {
	const state = createDefaultAgentsRfpDemoState();

	assert.deepEqual(
		state.board.columns.map((column) => [column.title, column.cardCodes]),
		[
			["RFP Intake", ["RFP-101", "RFP-102", "RFP-103", "RFP-104", "RFP-105", "RFP-106", "RFP-107"]],
			[RFP_DRAFTING_COLUMN_NAME, ["RFP-141", "RFP-142", "RFP-143"]],
			[RFP_REVIEW_COLUMN_NAME, ["RFP-161", "RFP-162", "RFP-163", "RFP-164"]],
			["Submitted", ["RFP-181", "RFP-182"]],
		],
	);
	assert.equal(state.agent, null);
	assert.equal(state.schedule, null);
});

test("backend normalization preserves RFP attachment comments", () => {
	const normalized = normalizeAgentsRfpDemoState({
		...createDefaultAgentsRfpDemoState(),
		workItems: {
			"RFP-101": {
				status: "RFP Intake",
				attachments: [],
				agentAssignmentIds: [],
				attachmentComment: {
					id: "maya-comment-rfp-101-report-attached",
					authorName: "Maya Chen",
					authorAvatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
					timestampLabel: "Now",
					content: "Rovo drafted this comment\nRovo added Acmecorp RFP qualification DACI.pdf back to RFP-101.",
					attachmentId: "generated-rfp-response-strategy-pdf",
					attachmentLabel: "Open attachment in Rovo Canvas",
					attachmentHref: "#rovo-canvas-generated-rfp-response-strategy-pdf",
				},
			},
		},
	});
	const comment = normalized.workItems["RFP-101"].attachmentComment;

	assert.equal(comment.authorName, "Maya Chen");
	assert.match(comment.content, /^Rovo drafted this comment\n/u);
	assert.equal(comment.attachmentHref, "#rovo-canvas-generated-rfp-response-strategy-pdf");
});

test("backend normalization only keeps valid RFP report versions for canvas handoff", () => {
	const normalized = normalizeAgentsRfpDemoState({
		...createDefaultAgentsRfpDemoState(),
		report: {
			stage: "refined",
			currentVersionId: "missing-version",
			previewHtml: "  <!doctype html><html><body>Report</body></html>  ",
			versions: [
				{
					id: " refined-current-report ",
					label: "Refined current report",
					summary: "",
					createdBy: "Maya",
					timestampLabel: "",
				},
				{ id: "", label: "Broken version" },
				"not-a-version",
			],
		},
	});

	assert.deepEqual(normalized.report.versions, [
		{
			id: "refined-current-report",
			label: "Refined current report",
			summary: "Refined current report",
			createdBy: "Maya",
			timestampLabel: "Now",
		},
	]);
	assert.equal(normalized.report.currentVersionId, undefined);
	assert.equal(normalized.report.previewHtml, "<!doctype html><html><body>Report</body></html>");
});

test("backend normalization promotes completed Review tickets latest first", () => {
	const staleState = createDefaultAgentsRfpDemoState();
	staleState.board.columns = staleState.board.columns.map((column) => (
		column.title === RFP_REVIEW_COLUMN_NAME
			? {
					...column,
					cardCodes: [...column.cardCodes, "RFP-141", "RFP-142", "RFP-143", "RFP-101"],
				}
			: {
					...column,
					cardCodes: column.cardCodes.filter((cardCode) => !["RFP-141", "RFP-142", "RFP-143"].includes(cardCode)),
				}
	));
	staleState.workItems["RFP-141"] = {
		...staleState.workItems["RFP-141"],
		agentStatus: "completed",
		assignee: null,
		completedAt: "2026-06-03T15:02:00.000Z",
		status: RFP_REVIEW_COLUMN_NAME,
	};
	staleState.workItems["RFP-142"] = {
		...staleState.workItems["RFP-142"],
		agentStatus: "completed",
		assignee: null,
		completedAt: "2026-06-03T15:04:00.000Z",
		status: RFP_REVIEW_COLUMN_NAME,
	};
	staleState.workItems["RFP-143"] = {
		...staleState.workItems["RFP-143"],
		agentStatus: "completed",
		assignee: null,
		completedAt: "2026-06-03T15:06:00.000Z",
		status: RFP_REVIEW_COLUMN_NAME,
	};
	staleState.workItems["RFP-101"] = {
		...staleState.workItems["RFP-101"],
		agentStatus: "completed",
		assignee: null,
		completedAt: "2026-06-03T15:20:00.000Z",
		status: RFP_REVIEW_COLUMN_NAME,
	};

	const normalized = normalizeAgentsRfpDemoState(staleState);

	assert.deepEqual(
		normalized.board.columns.find((column) => column.title === RFP_REVIEW_COLUMN_NAME).cardCodes.slice(0, 4),
		["RFP-101", "RFP-143", "RFP-142", "RFP-141"],
	);
});

test("applying the RFP Drafter queues all current Drafting tickets", () => {
	const result = runRfpDraftingAgent(createDefaultAgentsRfpDemoState(), {
		jobId: "job-rfp-drafting",
		now: RUN_NOW,
		runId: "run-initial",
		source: "agent-apply",
	});

	assert.equal(result.state.agent.name, RFP_DRAFTING_AGENT_NAME);
	assert.equal(result.state.agent.description, RFP_DRAFTING_AGENT_DESCRIPTION);
	assert.deepEqual(result.state.agent.conversationStarters, RFP_DRAFTING_AGENT_CONVERSATION_STARTERS);
	assert.equal(result.state.agent.jobId, "job-rfp-drafting");
	assert.deepEqual(result.state.agent.trigger, RFP_DRAFTING_EVENT_TRIGGER);
	assert.equal(result.state.agent.trigger.label, RFP_DRAFTING_EVENT_TRIGGER_LABEL);
	assert.deepEqual(result.runSummary.processedTicketCodes, ["RFP-141", "RFP-142", "RFP-143"]);
	assert.deepEqual(result.runSummary.skippedTicketCodes, []);
	assert.deepEqual(result.runSummary.failedTicketCodes, []);
	assert.equal(result.runSummary.status, "running");
	assert.equal(result.threadRecords.length, 3);

	for (const ticketCode of result.runSummary.processedTicketCodes) {
		const workItem = result.state.workItems[ticketCode];
		assert.equal(workItem.status, RFP_DRAFTING_COLUMN_NAME);
		assert.equal(workItem.assignee, RFP_DRAFTING_AGENT_NAME);
		assert.ok(["queued", "running"].includes(workItem.agentStatus));
		assert.match(workItem.agentReadyAt, /^2026-01-01T00:00:/u);
		assert.equal(workItem.generatedAttachment, null);
		assert.match(workItem.agentSessionThreadId, /^agents-rfp-demo-rfp-/u);
	}
});

test("advancing due tickets completes them at staggered speeds with unique HTML", async () => {
	const initial = runRfpDraftingAgent(createDefaultAgentsRfpDemoState(), {
		jobId: "job-rfp-drafting",
		now: RUN_NOW,
		runId: "run-initial",
	});
	const firstAdvance = await advanceRfpDraftingAgentProcessing(initial.state, {
		now: RUN_NOW + 16_000,
	});

	assert.deepEqual(firstAdvance.completedTicketCodes, ["RFP-141"]);
	assert.equal(firstAdvance.state.workItems["RFP-141"].status, RFP_REVIEW_COLUMN_NAME);
	assert.equal(firstAdvance.state.workItems["RFP-142"].status, RFP_DRAFTING_COLUMN_NAME);
	assert.equal(firstAdvance.state.agent.jobRunSummaries[0].status, "running");

	const finalAdvance = await advanceAll(firstAdvance.state);
	assert.deepEqual(finalAdvance.completedTicketCodes, ["RFP-142", "RFP-143"]);
	assert.equal(finalAdvance.state.agent.jobRunSummaries[0].status, "completed");
	assert.deepEqual(
		finalAdvance.state.board.columns.find((column) => column.title === RFP_REVIEW_COLUMN_NAME).cardCodes.slice(0, 3),
		["RFP-143", "RFP-142", "RFP-141"],
	);
	for (const ticketCode of ["RFP-141", "RFP-142", "RFP-143"]) {
		const workItem = finalAdvance.state.workItems[ticketCode];
		assert.equal(workItem.status, RFP_REVIEW_COLUMN_NAME);
		assert.equal(workItem.assignee, null);
		assert.equal(workItem.agentStatus, "completed");
		assert.equal(workItem.generatedAttachment.displayName, `${ticketCode} response draft.html`);
		assert.equal(workItem.generatedAttachment.previewKind, "html-report");
		assert.match(workItem.generatedAttachment.previewHtml, /<!doctype html>/iu);
		assert.match(workItem.generatedAttachment.previewHtml, new RegExp(ticketCode, "u"));
		assert.equal(workItem.agentComment.authorName, RFP_DRAFTING_AGENT_NAME);
		assert.match(workItem.agentComment.content, /Status: draft complete\./u);
		assert.match(workItem.agentComment.content, /left it unassigned for the response team to pick up/u);
	}
	assert.match(finalAdvance.state.workItems["RFP-141"].generatedAttachment.previewHtml, /Orion Motors/u);
	assert.match(finalAdvance.state.workItems["RFP-142"].generatedAttachment.previewHtml, /NimbusCare/u);
	assert.match(finalAdvance.state.workItems["RFP-143"].generatedAttachment.previewHtml, /Copperline Logistics/u);
	assert.doesNotMatch(finalAdvance.state.workItems["RFP-141"].generatedAttachment.previewHtml, /Acmecorp/u);
	assert.doesNotMatch(finalAdvance.state.workItems["RFP-142"].generatedAttachment.previewHtml, /Acmecorp/u);
	assert.doesNotMatch(finalAdvance.state.workItems["RFP-143"].generatedAttachment.previewHtml, /Acmecorp/u);
	assert.notEqual(
		finalAdvance.state.workItems["RFP-141"].generatedAttachment.previewHtml,
		finalAdvance.state.workItems["RFP-142"].generatedAttachment.previewHtml,
	);
});

test("rerunning skips completed tickets with generated draft output", async () => {
	const initial = runRfpDraftingAgent(createDefaultAgentsRfpDemoState(), {
		jobId: "job-rfp-drafting",
		now: RUN_NOW,
		runId: "run-initial",
	});
	const completed = await advanceAll(initial.state);
	const rerun = runRfpDraftingAgent(completed.state, {
		jobId: "job-rfp-drafting",
		now: RUN_NOW + 20_000,
		runId: "run-rerun",
	});

	assert.deepEqual(rerun.runSummary.processedTicketCodes, []);
	assert.deepEqual(rerun.runSummary.failedTicketCodes, []);
	assert.deepEqual(rerun.runSummary.skippedTicketCodes, ["RFP-141", "RFP-142", "RFP-143"]);
	assert.equal(rerun.runSummary.status, "skipped");
	assert.equal(rerun.threadRecords.length, 0);
	assert.deepEqual(rerun.state.toasts, completed.state.toasts);
	assert.ok(rerun.state.toasts.every((toast) => !/found no new Drafting tickets/u.test(toast.message)));
});

test("normalization drops stale no-work RFP agent toasts", () => {
	const state = {
		...createDefaultAgentsRfpDemoState(),
		toasts: [
				{
					id: "rfp-agent-run-stale",
					message: "RFP Drafter found no new Drafting tickets to process.",
				},
			{
				id: "report-attached",
				message: "Added PDF to RFP-101.",
			},
		],
	};
	const normalized = normalizeAgentsRfpDemoState(state);

	assert.deepEqual(normalized.toasts, [
		{
			id: "report-attached",
			message: "Added PDF to RFP-101.",
		},
	]);
});

test("normalization preserves trigger prompt and explicit no-trigger state", () => {
	const applied = runRfpDraftingAgent(createDefaultAgentsRfpDemoState(), {
		jobId: "job-rfp-drafting",
		now: RUN_NOW,
		runId: "run-initial",
	});
	assert.equal(applied.state.agent.trigger.prompt, RFP_DRAFTING_TRIGGER_PROMPT);
	const prompted = normalizeAgentsRfpDemoState({
		...applied.state,
		agent: {
			...applied.state.agent,
			trigger: {
				...RFP_DRAFTING_EVENT_TRIGGER,
				prompt: "When an RFP ticket enters Drafting, inspect the packet and draft the response package.",
			},
		},
	});

	assert.equal(
		prompted.agent.trigger.prompt,
		"When an RFP ticket enters Drafting, inspect the packet and draft the response package.",
	);

	const cleared = normalizeAgentsRfpDemoState({
		...prompted,
		agent: {
			...prompted.agent,
			trigger: null,
		},
	});

	assert.equal(cleared.agent.trigger, null);
});

test("normalization moves stale running event activity after completed RFP Drafter work", () => {
	const applied = runRfpDraftingAgent(createDefaultAgentsRfpDemoState(), {
		jobId: "job-rfp-drafting",
		runId: "run-initial",
	});
	const staleRunningSummary = {
		id: "run-stale-event",
		jobId: "job-rfp-drafting",
		source: "jira-column-entered",
		triggerLabel: RFP_DRAFTING_EVENT_TRIGGER_LABEL,
		status: "running",
		startedAt: "2026-06-03T15:00:00.000Z",
		finishedAt: null,
		processedTicketCodes: ["RFP-103"],
		skippedTicketCodes: [],
		failedTicketCodes: [],
		threadLinks: [{ ticketCode: "RFP-103", threadId: "agents-rfp-demo-rfp-103" }],
		summary: "Queued 1 ticket, skipped 0, failed 0.",
	};
	const normalized = normalizeAgentsRfpDemoState({
		...applied.state,
		agent: {
			...applied.state.agent,
			jobRunSummaries: [
				staleRunningSummary,
				{
					...applied.state.agent.jobRunSummaries[0],
					status: "completed",
					finishedAt: "2026-06-03T15:08:00.000Z",
				},
			],
		},
	});

	assert.equal(normalized.agent.jobRunSummaries[0].startedAt, "2026-06-03T15:10:00.000Z");
});

test("ticket entered column events do not run when the agent trigger is cleared", () => {
	const applied = runRfpDraftingAgent(createDefaultAgentsRfpDemoState(), {
		jobId: "job-rfp-drafting",
		now: RUN_NOW,
		runId: "run-initial",
	});
	const withoutTrigger = {
		...applied.state,
		agent: {
			...applied.state.agent,
			trigger: null,
		},
	};
	const eventRun = moveTicketEnteredColumn(withoutTrigger, {
		ticketCode: "RFP-102",
		targetColumn: RFP_DRAFTING_COLUMN_NAME,
	});

	assert.equal(eventRun.runSummary, null);
	assert.deepEqual(eventRun.threadRecords, []);
	assert.equal(eventRun.state.workItems["RFP-102"].status, RFP_DRAFTING_COLUMN_NAME);
});

test("a later ticket entering Drafting processes only that ticket", async () => {
	const initial = runRfpDraftingAgent(createDefaultAgentsRfpDemoState(), {
		jobId: "job-rfp-drafting",
		now: RUN_NOW,
		runId: "run-initial",
	});
	const completed = await advanceAll(initial.state);
	const movedState = moveTicketToColumn(completed.state, "RFP-102", RFP_DRAFTING_COLUMN_NAME);
	const eventRun = runRfpDraftingAgent(movedState, {
		jobId: "job-rfp-drafting",
		now: RUN_NOW + 60_000,
		runId: "run-rfp-102",
		source: "jira-column-entered",
		ticketCodes: ["RFP-102"],
	});
	const eventCompletion = await advanceAll(eventRun.state, RUN_NOW + 77_000);

	assert.equal(initial.runSummary.startedAt, "2026-06-03T15:00:00.000Z");
	assert.equal(eventRun.runSummary.startedAt, "2026-06-03T15:10:00.000Z");
	assert.deepEqual(eventRun.runSummary.processedTicketCodes, ["RFP-102"]);
	assert.deepEqual(eventRun.runSummary.skippedTicketCodes, []);
	assert.deepEqual(eventRun.runSummary.failedTicketCodes, []);
	assert.equal(eventRun.state.workItems["RFP-102"].status, RFP_DRAFTING_COLUMN_NAME);
	assert.equal(eventCompletion.state.workItems["RFP-102"].status, RFP_REVIEW_COLUMN_NAME);
	assert.equal(eventCompletion.state.workItems["RFP-102"].assignee, null);
	assert.equal(eventCompletion.state.workItems["RFP-102"].agentComment.authorName, RFP_DRAFTING_AGENT_NAME);
	assert.match(eventCompletion.state.workItems["RFP-102"].generatedAttachment.previewHtml, /Northstar Bank/u);
	assert.doesNotMatch(eventCompletion.state.workItems["RFP-102"].generatedAttachment.previewHtml, /Acmecorp/u);
	assert.equal(eventCompletion.state.workItems["RFP-141"].status, RFP_REVIEW_COLUMN_NAME);
	assert.equal(
		eventCompletion.state.board.columns.find((column) => column.title === RFP_REVIEW_COLUMN_NAME).cardCodes[0],
		"RFP-102",
	);
	assert.equal(eventRun.threadRecords.length, 1);
	assert.equal(eventCompletion.state.agent.jobRunSummaries[0].finishedAt, "2026-06-03T15:14:00.000Z");
	assert.ok(
		Date.parse(eventCompletion.state.agent.jobRunSummaries[0].finishedAt) >
			Date.parse(eventCompletion.state.agent.jobRunSummaries[1].finishedAt),
	);
});

test("failed tickets do not block other tickets and retry on a later run", async () => {
	const withExtraTicket = moveTicketToColumn(createDefaultAgentsRfpDemoState(), "RFP-102", RFP_DRAFTING_COLUMN_NAME);
	const failedRun = runRfpDraftingAgent(withExtraTicket, {
		failTicketCodes: ["RFP-142"],
		jobId: "job-rfp-drafting",
		now: RUN_NOW,
		runId: "run-with-failure",
	});
	const advancedFailedRun = await advanceAll(failedRun.state);

	assert.deepEqual(failedRun.runSummary.failedTicketCodes, ["RFP-142"]);
	assert.deepEqual(failedRun.runSummary.processedTicketCodes, ["RFP-102", "RFP-141", "RFP-143"]);
	assert.equal(failedRun.state.workItems["RFP-142"].status, RFP_DRAFTING_COLUMN_NAME);
	assert.equal(failedRun.state.workItems["RFP-142"].agentStatus, "failed");
	assert.equal(advancedFailedRun.state.workItems["RFP-141"].status, RFP_REVIEW_COLUMN_NAME);
	assert.equal(advancedFailedRun.state.workItems["RFP-143"].status, RFP_REVIEW_COLUMN_NAME);
	assert.equal(advancedFailedRun.state.agent.jobRunSummaries[0].status, "completed-with-failures");

	const retryRun = runRfpDraftingAgent(advancedFailedRun.state, {
		jobId: "job-rfp-drafting",
		now: RUN_NOW + 20_000,
		runId: "run-retry",
	});
	const retryCompletion = await advanceAll(retryRun.state, RUN_NOW + 37_000);
	assert.deepEqual(retryRun.runSummary.processedTicketCodes, ["RFP-142"]);
	assert.equal(retryCompletion.state.workItems["RFP-142"].agentStatus, "completed");
	assert.equal(retryCompletion.state.workItems["RFP-142"].status, RFP_REVIEW_COLUMN_NAME);
});

test("state manager persists normalized demo state and reset clears agent output", async (t) => {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agents-rfp-demo-state-"));
	t.after(() => fs.rm(tempDir, { force: true, recursive: true }));
	const manager = createAgentsRfpDemoStateManager({ baseDir: tempDir });
	const result = runRfpDraftingAgent(createDefaultAgentsRfpDemoState(), {
		jobId: "job-rfp-drafting",
		now: RUN_NOW,
		runId: "run-initial",
	});
	const completed = await advanceAll(result.state);

	await manager.writeState(completed.state);
	const persisted = await manager.readState();
	assert.equal(persisted.agent.jobId, "job-rfp-drafting");
	assert.equal(persisted.workItems["RFP-141"].agentStatus, "completed");

	const reset = await manager.resetState();
	assert.equal(reset.agent, null);
	assert.equal(reset.workItems["RFP-141"].agentStatus, "idle");
	assert.equal(reset.workItems["RFP-141"].generatedAttachment, null);
});

test("state manager serializes concurrent ticket move updates", async (t) => {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agents-rfp-demo-state-"));
	t.after(() => fs.rm(tempDir, { force: true, recursive: true }));
	const manager = createAgentsRfpDemoStateManager({ baseDir: tempDir });

	await manager.writeState(createDefaultAgentsRfpDemoState());
	await Promise.all([
		manager.updateState((state) => moveTicketToColumn(state, "RFP-102", RFP_DRAFTING_COLUMN_NAME)),
		manager.updateState((state) => moveTicketToColumn(state, "RFP-103", RFP_REVIEW_COLUMN_NAME)),
		manager.updateState((state) => moveTicketToColumn(state, "RFP-104", "Submitted")),
	]);

	const persisted = await manager.readState();
	assert.equal(persisted.workItems["RFP-102"].status, RFP_DRAFTING_COLUMN_NAME);
	assert.equal(persisted.workItems["RFP-103"].status, RFP_REVIEW_COLUMN_NAME);
	assert.equal(persisted.workItems["RFP-104"].status, "Submitted");
	assert.deepEqual(
		persisted.board.columns.find((column) => column.title === "RFP Intake").cardCodes,
		["RFP-101", "RFP-105", "RFP-106", "RFP-107"],
	);

	const files = await fs.readdir(path.join(tempDir, "agents-rfp-demo"));
	assert.deepEqual(files, ["state.json"]);
});

test("backend normalization drops an agent session thread id that is not a storage id", () => {
	const workItem = (agentSessionThreadId) => ({ status: "RFP Intake", attachments: [], agentAssignmentIds: [], agentSessionThreadId });
	const normalized = normalizeAgentsRfpDemoState({
		...createDefaultAgentsRfpDemoState(),
		workItems: {
			"RFP-101": workItem("agents-rfp-demo-rfp-101"),
			"RFP-102": workItem("../../outside"),
			"RFP-103": workItem("a/b"),
			"RFP-104": workItem(42),
		},
	});
	assert.equal(normalized.workItems["RFP-101"].agentSessionThreadId, "agents-rfp-demo-rfp-101");
	for (const code of ["RFP-102", "RFP-103", "RFP-104"]) {
		assert.equal(normalized.workItems[code].agentSessionThreadId, null, code);
	}
});
