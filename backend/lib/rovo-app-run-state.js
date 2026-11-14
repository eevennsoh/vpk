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
	requireFunction("rovoAppRunManager.setRunBackend", rovoAppRunManager?.setRunBackend);
	requireFunction("rovoAppRunManager.settleRun", rovoAppRunManager?.settleRun);
	requireFunction("rovoAppThreadManager.listThreads", rovoAppThreadManager?.listThreads);
	requireFunction("rovoAppThreadManager.updateThread", rovoAppThreadManager?.updateThread);
	requireFunction("startNextQueuedRun", startNextQueuedRun);
	requireFunction("synchronizeRovoAppThreadGeneratedFiles", synchronizeRovoAppThreadGeneratedFiles);

	async function persistRovoAppRunState(threadId, run) {
		if (!threadId) {
			return null;
		}

		return rovoAppThreadManager.updateThread(threadId, {
			activeRun: buildRovoAppActiveRunThreadPatch(run),
		});
	}

	async function persistRovoAppRunBackend(threadId, backend) {
		const run = rovoAppRunManager.setRunBackend(threadId, backend);
		if (!run) {
			return null;
		}

		return persistRovoAppRunState(threadId, run);
	}

	async function clearRovoAppRunState(threadId) {
		if (!threadId) {
			return null;
		}

		return rovoAppThreadManager.updateThread(threadId, {
			activeRun: null,
		});
	}

	async function persistRovoAppRunMessagesSnapshot(threadId, messages) {
		if (!threadId || !Array.isArray(messages)) {
			return null;
		}

		return rovoAppThreadManager.updateThread(threadId, {
			messages,
		});
	}

	// True when another run now owns the thread: this one was cancelled and a newer request
	// replaced it. Such a run's late settle must not touch the thread, its stored state or its
	// active request, which all belong to the new run now.
	function isSuperseded(run) {
		const current = rovoAppRunManager.getRun(run.threadId);
		return current !== null && current !== undefined && current !== run;
	}

	/**
	 * The one way a managed run ends. `completed` saves `messages` (and records generated
	 * files from `streamedMessages`, what the run's response stream yielded) and clears the
	 * stored active run in the same write; if that write fails the run ends `failed` instead.
	 * `failed` appends a failure card unless the error is an abort; `failed` and `cancelled`
	 * clear the stored active run. Then the run leaves the registry and queued work starts.
	 * A failed thread write is logged, never thrown: the stored active run is then left for
	 * reconcileOrphanedRovoAppThread to clear. Resolves true when this call settled the run.
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

		let resolvedOutcome = outcome;
		let resolvedError = error;
		let savedThread = false;
		if (outcome === "completed" && Array.isArray(messages)) {
			try {
				const updatedThread = await rovoAppThreadManager.updateThread(threadId, {
					activeRun: null,
					messages,
				});
				savedThread = true;
				await synchronizeRovoAppThreadGeneratedFiles(updatedThread, { streamedMessages });
			} catch (saveError) {
				logger.error("[FUTURE-CHAT] Failed to save a finished run:", saveError);
				resolvedOutcome = "failed";
				resolvedError = saveError;
			}
			if (isSuperseded(run)) {
				return false;
			}
		}

		if (resolvedOutcome === "failed" && rovoAppRunManager.getRun(threadId) === run && !isAbortLikeRunFailure(resolvedError)) {
			for (const chunk of createFailureSseChunks(resolvedError)) {
				rovoAppRunManager.appendChunk(threadId, chunk);
			}
		}
		if (!savedThread) {
			try {
				await clearRovoAppRunState(threadId);
			} catch (clearError) {
				logger.error("[FUTURE-CHAT] Failed to clear a settled run's stored state:", clearError);
			}
			if (isSuperseded(run)) {
				return false;
			}
		}

		activeRequests.delete(threadId);
		rovoAppRunManager.settleRun(threadId, {
			outcome: resolvedOutcome,
			runId: run.id,
			error: resolvedOutcome === "failed" ? getRovoAppRunFailurePayload(resolvedError).message : null,
		});
		void startNextQueuedRun();
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
		reconcileOrphanedRovoAppThread,
		settleRovoAppRun,
		sweepOrphanedRovoAppRuns,
	};
}

module.exports = {
	buildRovoAppActiveRunPayload,
	createRovoAppRunStateService,
};
