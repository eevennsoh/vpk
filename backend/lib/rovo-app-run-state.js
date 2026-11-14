"use strict";

const {
	createRovoAppFailureSseChunks,
	getRovoAppRunFailurePayload,
	isAbortLikeRunFailure,
} = require("./rovo-app-run-failure");
const { getNonEmptyString } = require("./shared-utils");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppRunStateService requires ${name}`);
	}
	return value;
}

function buildRovoAppActiveRunPayload(run, thread) {
	if (!run) {
		return null;
	}

	const sessionId = getNonEmptyString(thread?.sessionId);
	const sessionMode =
		thread?.sessionMode === "ephemeral"
			? "ephemeral"
			: sessionId
				? thread?.sessionMode ?? "persistent"
				: null;

	return {
		id: run.id,
		backend: run.backend === "rovo" ? "rovo" : "ai-gateway",
		status: run.status,
		portIndex: null,
		rovoPort:
			typeof run.rovoPort === "number" && Number.isInteger(run.rovoPort) && run.rovoPort > 0
				? run.rovoPort
				: null,
		sessionId,
		sessionMode,
		startedAt: run.startedAt,
		updatedAt: run.updatedAt,
	};
}

function buildRovoAppActiveRunThreadPatch(run) {
	return buildRovoAppActiveRunPayload(run, null);
}

function createRovoAppRunStateService({
	activeRequests,
	createFailureSseChunks = createRovoAppFailureSseChunks,
	logger = console,
	rovoAppRunManager,
	rovoAppThreadManager,
	startNextQueuedRun,
	synchronizeRovoAppThreadGeneratedFiles,
} = {}) {
	requireFunction("activeRequests.delete", activeRequests?.delete);
	requireFunction("createFailureSseChunks", createFailureSseChunks);
	requireFunction("logger.error", logger?.error);
	requireFunction("rovoAppRunManager.appendChunk", rovoAppRunManager?.appendChunk);
	requireFunction("rovoAppRunManager.getRun", rovoAppRunManager?.getRun);
	requireFunction("rovoAppRunManager.hasRun", rovoAppRunManager?.hasRun);
	requireFunction("rovoAppRunManager.isCurrentRun", rovoAppRunManager?.isCurrentRun);
	requireFunction("rovoAppRunManager.isLatestRun", rovoAppRunManager?.isLatestRun);
	requireFunction("rovoAppRunManager.setRunBackend", rovoAppRunManager?.setRunBackend);
	requireFunction("rovoAppRunManager.settleRun", rovoAppRunManager?.settleRun);
	requireFunction("rovoAppThreadManager.listThreads", rovoAppThreadManager?.listThreads);
	requireFunction("rovoAppThreadManager.updateThread", rovoAppThreadManager?.updateThread);
	requireFunction("startNextQueuedRun", startNextQueuedRun);
	requireFunction("synchronizeRovoAppThreadGeneratedFiles", synchronizeRovoAppThreadGeneratedFiles);

	// A run another run has replaced on its thread. That is remembered after the newer run
	// ends, so such a run's late writes are always dropped.
	function isSuperseded(run) {
		return !rovoAppRunManager.isLatestRun(run);
	}

	/**
	 * Stores `run` as the thread's active run, or clears it when `run` is null. A run that is
	 * no longer the thread's registered run (settled or replaced) is not stored.
	 */
	async function persistRovoAppRunState(threadId, run) {
		if (!threadId || (run && !rovoAppRunManager.isCurrentRun(run))) {
			return null;
		}

		return rovoAppThreadManager.updateThread(threadId, {
			activeRun: buildRovoAppActiveRunThreadPatch(run),
		});
	}

	// Fire-and-forget form for listeners (a subscriber leaving): a failed write is logged.
	function persistRovoAppRunStateInBackground(threadId, run) {
		void persistRovoAppRunState(threadId, run).catch((error) => {
			logger.error("[FUTURE-CHAT] Failed to store a run's state:", error);
		});
	}

	/** With `run`, only that run's backend changes. */
	async function persistRovoAppRunBackend(threadId, backend, { run = null } = {}) {
		const updatedRun = rovoAppRunManager.setRunBackend(threadId, backend, { runId: run?.id ?? null });
		if (!updatedRun) {
			return null;
		}

		return persistRovoAppRunState(threadId, updatedRun);
	}

	async function clearRovoAppRunState(threadId) {
		if (!threadId) {
			return null;
		}

		return rovoAppThreadManager.updateThread(threadId, {
			activeRun: null,
		});
	}

	/** With `run`, nothing is written once a newer run has replaced it. */
	async function persistRovoAppRunMessagesSnapshot(threadId, messages, { run = null } = {}) {
		if (!threadId || !Array.isArray(messages) || (run && isSuperseded(run))) {
			return null;
		}

		return rovoAppThreadManager.updateThread(threadId, {
			messages,
		});
	}

	async function saveFinishedRunMessages(threadId, messages, streamedMessages) {
		const updatedThread = await rovoAppThreadManager.updateThread(threadId, {
			activeRun: null,
			messages,
		});
		await synchronizeRovoAppThreadGeneratedFiles(updatedThread, { streamedMessages });
	}

	async function clearSettledRunState(threadId) {
		try {
			await clearRovoAppRunState(threadId);
		} catch (clearError) {
			logger.error("[FUTURE-CHAT] Failed to clear a settled run's stored state:", clearError);
		}
	}

	/**
	 * The one way a managed run ends. Never rejects; a failed thread write is logged and the
	 * stored active run is left for reconcileOrphanedRovoAppThread to clear.
	 * - `cancelled`: the run is settled (aborted, subscribers ended) at once, then its stored
	 *   state is cleared.
	 * - `completed`: `messages` are saved with the stored active run cleared in one write, and
	 *   generated files are recorded from `streamedMessages` (what the run's stream yielded);
	 *   if that fails the run ends `failed` instead.
	 * - `failed`: a failure card is appended unless the error is an abort, then the stored
	 *   state is cleared.
	 * Each settled run clears the thread's active request and starts queued work, once.
	 * A run that a newer run replaced touches nothing. A run that was already settled (it was
	 * cancelled) only saves its late partial messages, if it finished with any.
	 * Resolves true when this call settled the run.
	 * @param {{ id: string, threadId: string } | null | undefined} run
	 * @param {"completed" | "failed" | "cancelled"} outcome
	 * @param {{ error?: unknown, messages?: unknown[], streamedMessages?: unknown[] }} [details]
	 * @returns {Promise<boolean>}
	 */
	async function settleRovoAppRun(run, outcome, { error = null, messages, streamedMessages = [] } = {}) {
		const threadId = getNonEmptyString(run?.threadId);
		if (!run || !threadId || isSuperseded(run)) {
			return false;
		}
		if (!rovoAppRunManager.isCurrentRun(run)) {
			if (outcome === "completed" && Array.isArray(messages)) {
				try {
					await saveFinishedRunMessages(threadId, messages, streamedMessages);
				} catch (saveError) {
					logger.error("[FUTURE-CHAT] Failed to save a cancelled run's messages:", saveError);
				}
			}
			return false;
		}

		const finish = (finalOutcome, finalError) => {
			// Settling a cancelled run aborts it, and its abort reaches the in-process chat
			// request, whose controller is the thread's active request. Only an active request
			// that is already aborted is removed: a live one belongs to a stream that is still
			// running (shutdown and /chat/cancel find it there), and removes itself when it ends.
			rovoAppRunManager.settleRun(threadId, {
				outcome: finalOutcome,
				runId: run.id,
				error: finalOutcome === "failed" ? getRovoAppRunFailurePayload(finalError).message : null,
			});
			const activeRequest = activeRequests.get(threadId);
			if (activeRequest && activeRequest.abortController?.signal?.aborted !== false) {
				activeRequests.delete(threadId);
			}
			void startNextQueuedRun();
		};

		if (outcome === "cancelled") {
			finish("cancelled", null);
			await clearSettledRunState(threadId);
			return true;
		}

		let resolvedOutcome = outcome;
		let resolvedError = error;
		if (outcome === "completed" && Array.isArray(messages)) {
			try {
				await saveFinishedRunMessages(threadId, messages, streamedMessages);
			} catch (saveError) {
				logger.error("[FUTURE-CHAT] Failed to save a finished run:", saveError);
				resolvedOutcome = "failed";
				resolvedError = saveError;
			}
			// Cancelled while saving: the cancel already settled it.
			if (!rovoAppRunManager.isCurrentRun(run)) {
				return false;
			}
			if (resolvedOutcome === "completed") {
				finish("completed", null);
				return true;
			}
		}

		if (resolvedOutcome === "failed" && !isAbortLikeRunFailure(resolvedError)) {
			for (const chunk of createFailureSseChunks(resolvedError)) {
				rovoAppRunManager.appendChunk(threadId, chunk, { runId: run.id });
			}
		}
		await clearSettledRunState(threadId);
		if (!rovoAppRunManager.isCurrentRun(run)) {
			return false;
		}
		finish(resolvedOutcome, resolvedError);
		return true;
	}

	async function reconcileOrphanedRovoAppThread(thread) {
		if (!thread?.id || !thread.activeRun) {
			return thread;
		}

		if (rovoAppRunManager.hasRun(thread.id)) {
			return thread;
		}

		return clearRovoAppRunState(thread.id);
	}

	// At startup no run is live, so every stored active run is left over from the previous
	// process. Clears them instead of waiting for each thread to be read. Never throws;
	// resolves the number of threads cleared.
	async function sweepOrphanedRovoAppRuns() {
		let threads;
		try {
			threads = await rovoAppThreadManager.listThreads({ limit: Number.MAX_SAFE_INTEGER });
		} catch (error) {
			logger.error("[FUTURE-CHAT] Startup sweep could not list threads:", error);
			return 0;
		}
		let cleared = 0;
		for (const thread of Array.isArray(threads) ? threads : []) {
			if (!thread?.id || !thread.activeRun || rovoAppRunManager.hasRun(thread.id)) {
				continue;
			}
			try {
				await reconcileOrphanedRovoAppThread(thread);
				cleared += 1;
			} catch (error) {
				logger.error("[FUTURE-CHAT] Startup sweep could not clear a stored run:", error);
			}
		}
		return cleared;
	}

	return {
		clearRovoAppRunState,
		persistRovoAppRunBackend,
		persistRovoAppRunMessagesSnapshot,
		persistRovoAppRunState,
		persistRovoAppRunStateInBackground,
		reconcileOrphanedRovoAppThread,
		settleRovoAppRun,
		sweepOrphanedRovoAppRuns,
	};
}

module.exports = {
	buildRovoAppActiveRunPayload,
	createRovoAppRunStateService,
};
