"use strict";

const {
	AGENTS_RFP_DEMO_JOB_NAME,
	AGENTS_RFP_DEMO_SURFACE,
	RFP_DRAFTING_EVENT_TRIGGER,
	RFP_DRAFTING_EVENT_TRIGGER_LABEL,
	advanceRfpDraftingAgentProcessing: defaultAdvanceRfpDraftingAgentProcessing,
	getDemoCreatedThreadIds,
	moveTicketToColumn,
	runRfpDraftingAgent: defaultRunRfpDraftingAgent,
} = require("./agents-rfp-demo-state");
const { isOwnedByCaller } = require("./caller-identity");
const { collectRovoAppUploadIdsFromMessages: defaultCollectRovoAppUploadIdsFromMessages } = require("./rovo-app-upload-helpers");
const { getNonEmptyString } = require("./shared-utils");
const { generateWorkItemVpkHtmlReport: defaultGenerateWorkItemVpkHtmlReport } = require("./work-item-vpk-html-report-generator");

const AGENTS_RFP_DEMO_JOB_ID = "agents-rfp-demo";

function buildAgentsRfpDemoJob(state) {
	if (!state.agent?.jobId) return null;
	const runHistory = state.agent.jobRunSummaries ?? [];
	const latestRun = runHistory[0];
	return {
		id: AGENTS_RFP_DEMO_JOB_ID,
		name: AGENTS_RFP_DEMO_JOB_NAME,
		surface: AGENTS_RFP_DEMO_SURFACE,
		trigger: RFP_DRAFTING_EVENT_TRIGGER,
		triggerLabel: RFP_DRAFTING_EVENT_TRIGGER_LABEL,
		status: latestRun?.status ?? "idle",
		runHistory: runHistory.slice(0, 10),
		lastRunAt: latestRun?.startedAt ?? null,
		lastError: latestRun?.status === "failed" ? latestRun.summary : null,
	};
}

function createAgentsRfpDemoJobOwner({
	advanceRfpDraftingAgentProcessing = defaultAdvanceRfpDraftingAgentProcessing,
	agentsRfpDemoStateManager,
	collectRovoAppUploadIdsFromMessages = defaultCollectRovoAppUploadIdsFromMessages,
	deleteRovoAppThreadBrowserWorkspace,
	destroyMirrorBrowser,
	generateWorkItemVpkHtmlReport = defaultGenerateWorkItemVpkHtmlReport,
	rovoAppDocumentManager,
	rovoAppGeneratedFilesManager,
	rovoAppThreadManager,
	rovoAppUploadManager,
	rovoAppVoteManager,
	runRfpDraftingAgent = defaultRunRfpDraftingAgent,
} = {}) {
	const required = {
		advanceRfpDraftingAgentProcessing,
		"agentsRfpDemoStateManager.readState": agentsRfpDemoStateManager?.readState,
		"agentsRfpDemoStateManager.writeState": agentsRfpDemoStateManager?.writeState,
		"agentsRfpDemoStateManager.resetState": agentsRfpDemoStateManager?.resetState,
		collectRovoAppUploadIdsFromMessages,
		deleteRovoAppThreadBrowserWorkspace,
		destroyMirrorBrowser,
		generateWorkItemVpkHtmlReport,
		"rovoAppDocumentManager.deleteDocumentsByThread": rovoAppDocumentManager?.deleteDocumentsByThread,
		"rovoAppGeneratedFilesManager.deleteLegacyRootFiles": rovoAppGeneratedFilesManager?.deleteLegacyRootFiles,
		"rovoAppThreadManager.assignOwnerIfMissing": rovoAppThreadManager?.assignOwnerIfMissing,
		"rovoAppThreadManager.createThread": rovoAppThreadManager?.createThread,
		"rovoAppThreadManager.deleteThread": rovoAppThreadManager?.deleteThread,
		"rovoAppThreadManager.getThread": rovoAppThreadManager?.getThread,
		"rovoAppThreadManager.updateThread": rovoAppThreadManager?.updateThread,
		"rovoAppUploadManager.deleteUpload": rovoAppUploadManager?.deleteUpload,
		"rovoAppVoteManager.deleteVotesForThread": rovoAppVoteManager?.deleteVotesForThread,
		runRfpDraftingAgent,
	};
	for (const [name, value] of Object.entries(required)) {
		if (typeof value !== "function") throw new Error(`createAgentsRfpDemoJobOwner requires ${name}`);
	}

	// All domain mutations share a queue: polling and resets cannot overwrite a run.
	let mutationTail = Promise.resolve();
	function serialize(operation) {
		const result = mutationTail.then(operation);
		mutationTail = result.catch(() => {});
		return result;
	}

	// The caller whose run created each demo thread, so processing that recreates a thread
	// (after it was deleted mid-run) gives it the same owner. In memory: after a restart a
	// recreated thread has no owner.
	const runOwnerByThreadId = new Map();

	// A demo thread belongs to the caller who started the run that created it
	// (lib/caller-identity.js). Another caller's run never touches it: the board state is
	// shared, but the thread is not theirs to rewrite. A thread with no owner (one stored
	// before owners) is adopted by the next caller who runs its ticket. Processing has no
	// caller: it updates the thread its run created and keeps that thread's owner.
	async function upsertAgentsRfpDemoThread(threadRecord, caller) {
		const threadId = threadRecord.id;
		let existingThread = await rovoAppThreadManager.getThread(threadId);
		if (existingThread && caller) {
			if (!existingThread.owner) {
				existingThread = (await rovoAppThreadManager.assignOwnerIfMissing(threadId, caller.owner)).thread;
			}
			if (!existingThread) {
				return null;
			}
			if (existingThread.owner !== caller.owner) {
				return existingThread;
			}
		}
		if (existingThread) {
			return rovoAppThreadManager.updateThread(threadId, {
				activeDocumentId: threadRecord.activeDocumentId ?? null,
				messages: threadRecord.messages,
				modelId: threadRecord.modelId ?? null,
				provider: threadRecord.provider ?? null,
				realtimeMessages: threadRecord.realtimeMessages ?? [],
				title: threadRecord.title,
				updatedAt: threadRecord.updatedAt,
				visibility: threadRecord.visibility ?? "private",
			});
		}

		const owner = caller ? caller.owner : runOwnerByThreadId.get(threadId) ?? null;
		if (caller) {
			runOwnerByThreadId.set(threadId, caller.owner);
		}
		return rovoAppThreadManager.createThread({ ...threadRecord, owner: getNonEmptyString(owner) });
	}

	async function persistResult(result, { caller = null } = {}) {
		await Promise.all(result.threadRecords.map((threadRecord) => upsertAgentsRfpDemoThread(threadRecord, caller)));
		return agentsRfpDemoStateManager.writeState({
			...result.state,
			agent: result.state.agent ? {
				...result.state.agent,
				jobId: AGENTS_RFP_DEMO_JOB_ID,
				jobRunSummaries: (result.state.agent.jobRunSummaries ?? []).slice(0, 10),
			} : null,
		});
	}

	async function runFromState(currentState, { caller = null, source = "manual", ticketCodes, runId } = {}) {
		const normalizedRunId = getNonEmptyString(runId);
		if (normalizedRunId && currentState.agent?.jobRunSummaries?.some((run) => run.id === normalizedRunId)) {
			return { job: buildAgentsRfpDemoJob(currentState), state: currentState };
		}
		const result = runRfpDraftingAgent(currentState, {
			jobId: AGENTS_RFP_DEMO_JOB_ID,
			runId: normalizedRunId ?? undefined,
			source: getNonEmptyString(source) ?? "manual",
			ticketCodes: Array.isArray(ticketCodes) ? ticketCodes : undefined,
		});
		const state = await persistResult(result, { caller });
		return { job: buildAgentsRfpDemoJob(state), state };
	}

	function runAgentsRfpDemoJob(options = {}) {
		return serialize(async () => runFromState(await agentsRfpDemoStateManager.readState(), options));
	}

	function advanceAgentsRfpDemoProcessing() {
		return serialize(async () => {
			const currentState = await agentsRfpDemoStateManager.readState();
			const result = await advanceRfpDraftingAgentProcessing(currentState, {
				createHtmlReport: async ({ contextDescription, fields }) => {
					const report = await generateWorkItemVpkHtmlReport({
						contextDescription,
						generateText: async () => JSON.stringify(fields),
						runSkillValidation: false,
						runVisualVerify: false,
					});
					return { html: report.html, skill: report.skill };
				},
			});
			return result.changed ? persistResult(result) : currentState;
		});
	}

	function updateAgentsRfpDemoState(updater) {
		if (typeof updater !== "function") {
			return Promise.reject(new TypeError("updateAgentsRfpDemoState requires an updater function"));
		}
		return serialize(async () => {
			const currentState = await agentsRfpDemoStateManager.readState();
			return agentsRfpDemoStateManager.writeState(await updater(currentState));
		});
	}

	function saveAgentsRfpDemoState(state) {
		return serialize(() => agentsRfpDemoStateManager.writeState(state));
	}

	function handleAgentsRfpDemoTicketEvent({ ticketCode, targetColumn, runId, caller = null }) {
		return serialize(async () => {
			const currentState = await agentsRfpDemoStateManager.readState();
			const state = await agentsRfpDemoStateManager.writeState(moveTicketToColumn(currentState, ticketCode, targetColumn));
			if (targetColumn !== RFP_DRAFTING_EVENT_TRIGGER.column || !state.agent?.trigger) {
				return { job: buildAgentsRfpDemoJob(state), state };
			}
			return runFromState(state, { caller, source: "jira-column-entered", ticketCodes: [ticketCode], runId });
		});
	}

	async function deleteAgentsRfpDemoThread(threadId) {
		const thread = await rovoAppThreadManager.getThread(threadId);
		const uploadIds = collectRovoAppUploadIdsFromMessages(thread?.messages);
		if (thread) {
			// Only what this thread's runs recorded; never paths read from its stored messages.
			await rovoAppGeneratedFilesManager.deleteLegacyRootFiles(threadId);
			await deleteRovoAppThreadBrowserWorkspace(threadId).catch(() => ({}));
			await destroyMirrorBrowser(`mirror-${threadId}`);
		}
		await Promise.all(
			uploadIds.map((uploadId) =>
				rovoAppUploadManager.deleteUpload(uploadId).catch(() => {})
			),
		);
		await rovoAppVoteManager.deleteVotesForThread(threadId);
		await rovoAppDocumentManager.deleteDocumentsByThread(threadId);
		await rovoAppThreadManager.deleteThread(threadId);
	}

	// Resets the shared board, but deletes only the caller's demo threads (and the records
	// left under a demo thread that is gone): another caller's thread stays theirs.
	function resetAgentsRfpDemo({ caller = null } = {}) {
		return serialize(async () => {
			const state = await agentsRfpDemoStateManager.readState();
			await Promise.all(getDemoCreatedThreadIds(state).map(async (threadId) => {
				const thread = await rovoAppThreadManager.getThread(threadId);
				if (!thread || isOwnedByCaller(thread.owner, caller)) {
					await deleteAgentsRfpDemoThread(threadId);
				}
			}));
			return agentsRfpDemoStateManager.resetState();
		});
	}

	return {
		advanceAgentsRfpDemoProcessing,
		deleteAgentsRfpDemoThread,
		handleAgentsRfpDemoTicketEvent,
		resetAgentsRfpDemo,
		runAgentsRfpDemoJob,
		saveAgentsRfpDemoState,
		updateAgentsRfpDemoState,
	};
}

module.exports = { AGENTS_RFP_DEMO_JOB_ID, buildAgentsRfpDemoJob, createAgentsRfpDemoJobOwner };
