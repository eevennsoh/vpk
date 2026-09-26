const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildAgentsRfpDemoJob,
	createAgentsRfpDemoJobOwner,
} = require("./agents-rfp-demo-job-owner");


function createThreadRecord(id = "thread-1") {
	return {
		id,
		activeDocumentId: null,
		messages: [],
		modelId: null,
		provider: null,
		realtimeMessages: [],
		title: `Thread ${id}`,
		updatedAt: "2026-06-03T15:00:00.000Z",
		visibility: "private",
	};
}

function createHarness({
	advanceRfpDraftingAgentProcessing,
	collectRovoAppUploadIdsFromMessages,
	generateWorkItemVpkHtmlReport,
	runRfpDraftingAgent,
	state = { agent: null },
	threads = [],
} = {}) {
	const calls = [];
	let currentState = state;
	const threadRecords = new Map(threads);

	const owner = createAgentsRfpDemoJobOwner({
		advanceRfpDraftingAgentProcessing: advanceRfpDraftingAgentProcessing ?? (async (current) => ({
			changed: false,
			state: current,
			threadRecords: [],
		})),
		agentsRfpDemoStateManager: {
			readState: async () => {
				calls.push(["readState"]);
				return currentState;
			},
			resetState: async () => { currentState = { agent: null }; return currentState; },
			writeState: async (nextState) => {
				calls.push(["writeState", nextState]);
				currentState = nextState;
				return nextState;
			},
		},
		collectRovoAppUploadIdsFromMessages: collectRovoAppUploadIdsFromMessages ?? ((messages) => {
			calls.push(["collectUploads", messages]);
			return [];
		}),
		deleteRovoAppThreadBrowserWorkspace: async (threadId) => {
			calls.push(["deleteWorkspace", threadId]);
		},
		destroyMirrorBrowser: async (mirrorId) => {
			calls.push(["destroyMirror", mirrorId]);
		},
		generateWorkItemVpkHtmlReport: generateWorkItemVpkHtmlReport ?? (async (input) => {
			calls.push(["generateHtmlReport", input]);
			return { html: "<main>Report</main>", skill: "vpk-html" };
		}),
		rovoAppDocumentManager: {
			deleteDocumentsByThread: async (threadId) => {
				calls.push(["deleteDocuments", threadId]);
			},
		},
		rovoAppGeneratedFilesManager: {
			backfillFromThread: async (thread) => {
				calls.push(["backfillFromThread", thread.id]);
			},
			deleteLegacyRootFiles: async (threadId) => {
				calls.push(["deleteLegacyRootFiles", threadId]);
			},
		},
		rovoAppThreadManager: {
			createThread: async (thread) => {
				calls.push(["createThread", thread.id]);
				threadRecords.set(thread.id, thread);
				return thread;
			},
			deleteThread: async (threadId) => {
				calls.push(["deleteThread", threadId]);
				threadRecords.delete(threadId);
			},
			getThread: async (threadId) => {
				calls.push(["getThread", threadId]);
				return threadRecords.get(threadId) ?? null;
			},
			updateThread: async (threadId, patch) => {
				calls.push(["updateThread", threadId, patch]);
				const nextThread = { ...(threadRecords.get(threadId) ?? {}), ...patch, id: threadId };
				threadRecords.set(threadId, nextThread);
				return nextThread;
			},
		},
		rovoAppUploadManager: {
			deleteUpload: async (uploadId) => {
				calls.push(["deleteUpload", uploadId]);
			},
		},
		rovoAppVoteManager: {
			deleteVotesForThread: async (threadId) => {
				calls.push(["deleteVotes", threadId]);
			},
		},
		runRfpDraftingAgent: runRfpDraftingAgent ?? ((current, input) => {
			calls.push(["runRfpDraftingAgent", current, input]);
			return {
				runSummary: { id: "run-1", summary: "processed one ticket." },
				state: current,
				threadRecords: [],
			};
		}),
	});

	return {
		calls,
		get state() {
			return currentState;
		},
		owner,
		threadRecords,
	};
}

test("deleteAgentsRfpDemoThread cleans existing thread resources before deleting the thread", async () => {
	const thread = {
		id: "thread-1",
		messages: [{ id: "message-1" }],
	};
	const harness = createHarness({
		collectRovoAppUploadIdsFromMessages: (messages) => {
			harness.calls.push(["collectUploads", messages]);
			return ["upload-1", "upload-2"];
		},
		threads: [["thread-1", thread]],
	});

	await harness.owner.deleteAgentsRfpDemoThread("thread-1");

	assert.deepEqual(harness.calls.map((call) => call[0]), [
		"getThread",
		"collectUploads",
		"backfillFromThread",
		"deleteLegacyRootFiles",
		"deleteWorkspace",
		"destroyMirror",
		"deleteUpload",
		"deleteUpload",
		"deleteVotes",
		"deleteDocuments",
		"deleteThread",
	]);
	assert.deepEqual(harness.calls.find((call) => call[0] === "destroyMirror"), [
		"destroyMirror",
		"mirror-thread-1",
	]);
	assert.equal(harness.threadRecords.has("thread-1"), false);
});

test("deleteAgentsRfpDemoThread skips browser cleanup for missing threads", async () => {
	const harness = createHarness();

	await harness.owner.deleteAgentsRfpDemoThread("missing-thread");

	assert.equal(harness.calls.some((call) => call[0] === "deleteWorkspace"), false);
	assert.equal(harness.calls.some((call) => call[0] === "destroyMirror"), false);
	assert.deepEqual(harness.calls.slice(-3), [
		["deleteVotes", "missing-thread"],
		["deleteDocuments", "missing-thread"],
		["deleteThread", "missing-thread"],
	]);
});



test("RFP job view is derived only from domain state and retains display name", () => {
	assert.equal(buildAgentsRfpDemoJob({ agent: null }), null);
	const job = buildAgentsRfpDemoJob({ agent: { jobId: "agents-rfp-demo", jobRunSummaries: [{ id: "r1", status: "failed", summary: "failed" }] } });
	assert.equal(job.id, "agents-rfp-demo");
	assert.equal(job.name, "RFP Drafter - Enterprise RFP Response");
	assert.equal(job.lastError, "failed");
	assert.deepEqual(job.runHistory.map((run) => run.id), ["r1"]);
});

function stateRun(current, options) {
	const summary = { id: options.runId ?? `run-${(current.agent?.jobRunSummaries?.length ?? 0) + 1}`, status: "completed" };
	return {
		state: { ...current, agent: { jobId: options.jobId, jobRunSummaries: [summary, ...(current.agent?.jobRunSummaries ?? [])] } },
		threadRecords: [],
		runSummary: summary,
	};
}

test("manual RFP runs persist stable identity, cap history and ignore duplicate run IDs", async () => {
	let runs = 0;
	const harness = createHarness({ runRfpDraftingAgent: (current, options) => { runs += 1; return stateRun(current, options); } });
	for (let i = 0; i < 12; i += 1) await harness.owner.runAgentsRfpDemoJob({ runId: `run-${i}` });
	const result = await harness.owner.runAgentsRfpDemoJob({ runId: "run-11" });
	assert.equal(runs, 12);
	assert.equal(result.job.id, "agents-rfp-demo");
	assert.equal(result.state.agent.jobId, "agents-rfp-demo");
	assert.equal(result.state.agent.jobRunSummaries.length, 10);
	assert.equal(result.job.runHistory[0].id, "run-11");
});

test("run, polling advance and reset execute in one queue without stale state restoration", async () => {
	let release;
	const blocked = new Promise((resolve) => { release = resolve; });
	const order = [];
	let notifyAdvance;
	const advanceStarted = new Promise((resolve) => { notifyAdvance = resolve; });
	const harness = createHarness({
		runRfpDraftingAgent: (current, options) => { order.push("run"); return stateRun(current, options); },
		advanceRfpDraftingAgentProcessing: async (current) => { order.push("advance-start"); notifyAdvance(); await blocked; order.push("advance-end"); return { changed: true, state: current, threadRecords: [] }; },
	});
	const run = harness.owner.runAgentsRfpDemoJob({ runId: "queued-run" });
	const advance = harness.owner.advanceAgentsRfpDemoProcessing();
	const reset = harness.owner.resetAgentsRfpDemo();
	await run;
	await advanceStarted;
	assert.deepEqual(order, ["run", "advance-start"]);
	release();
	await Promise.all([advance, reset]);
	assert.deepEqual(harness.state, { agent: null });
	assert.deepEqual(order, ["run", "advance-start", "advance-end"]);
});

test("a failed mutation rejects its caller and does not poison later runs", async () => {
	let fail = true;
	const harness = createHarness({ runRfpDraftingAgent: (current, options) => { if (fail) { fail = false; throw new Error("failed run"); } return stateRun(current, options); } });
	await assert.rejects(harness.owner.runAgentsRfpDemoJob({ runId: "retry" }), /failed run/u);
	assert.equal(harness.state.agent, null);
	const result = await harness.owner.runAgentsRfpDemoJob({ runId: "retry" });
	assert.equal(result.job.runHistory[0].id, "retry");
});

test("advance persists result threads, history and report generation", async () => {
	const thread = createThreadRecord();
	const harness = createHarness({
		state: { agent: { jobId: "agents-rfp-demo", jobRunSummaries: [{ id: "r1", status: "running" }] } },
		advanceRfpDraftingAgentProcessing: async (current, { createHtmlReport }) => {
			const report = await createHtmlReport({ contextDescription: "Work item", fields: { title: "RFP" } });
			assert.equal(report.html, "<main>Report</main>");
			return { changed: true, state: { ...current, agent: { ...current.agent, jobRunSummaries: [{ id: "r1", status: "completed" }] } }, threadRecords: [thread] };
		},
	});
	const state = await harness.owner.advanceAgentsRfpDemoProcessing();
	assert.equal(state.agent.jobRunSummaries[0].status, "completed");
	assert.equal(harness.threadRecords.get("thread-1").title, thread.title);
	const reportCall = harness.calls.find(([name]) => name === "generateHtmlReport")[1];
	assert.deepEqual(JSON.parse(await reportCall.generateText()), { title: "RFP" });
	assert.equal(reportCall.runSkillValidation, false);
});

test("chat state updater waits for advance and reset, then applies to the fresh reset state", async () => {
	let releaseAdvance;
	let notifyAdvance;
	const advanceStarted = new Promise((resolve) => { notifyAdvance = resolve; });
	const advanceBlocked = new Promise((resolve) => { releaseAdvance = resolve; });
	const harness = createHarness({
		state: { agent: { jobId: "agents-rfp-demo", jobRunSummaries: [] }, stale: true },
		advanceRfpDraftingAgentProcessing: async (state) => {
			notifyAdvance();
			await advanceBlocked;
			return { changed: true, state: { ...state, advanced: true }, threadRecords: [] };
		},
	});
	const advance = harness.owner.advanceAgentsRfpDemoProcessing();
	await advanceStarted;
	const reset = harness.owner.resetAgentsRfpDemo();
	let updaterInput;
	const update = harness.owner.updateAgentsRfpDemoState(async (state) => {
		updaterInput = state;
		return { ...state, qualificationAnswer: "yes" };
	});
	assert.equal(updaterInput, undefined);
	releaseAdvance();
	await Promise.all([advance, reset]);
	const updated = await update;
	assert.deepEqual(updaterInput, { agent: null });
	assert.deepEqual(updated, { agent: null, qualificationAnswer: "yes" });
	assert.deepEqual(harness.state, updated);
});

test("invalid chat updater fails without blocking subsequent mutations", async () => {
	const harness = createHarness();
	await assert.rejects(harness.owner.updateAgentsRfpDemoState(null), /updater function/u);
	const state = await harness.owner.updateAgentsRfpDemoState((current) => ({ ...current, answer: "ok" }));
	assert.equal(state.answer, "ok");
});
