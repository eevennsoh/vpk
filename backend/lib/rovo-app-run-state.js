"use strict";

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
	rovoAppRunManager,
	rovoAppThreadManager,
	startNextQueuedRun,
	synchronizeRovoAppThreadGeneratedFiles,
} = {}) {
	requireFunction("activeRequests.delete", activeRequests?.delete);
	requireFunction("rovoAppRunManager.clearRun", rovoAppRunManager?.clearRun);
	requireFunction("rovoAppRunManager.hasRun", rovoAppRunManager?.hasRun);
	requireFunction("rovoAppRunManager.setRunBackend", rovoAppRunManager?.setRunBackend);
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

	// `streamedMessages`: what the run's response stream yielded (see the managed response
	// consumer); generated files are recorded from those only.
	async function finalizeRovoAppRun(threadId, run, messages, { streamedMessages = [] } = {}) {
		if (threadId && Array.isArray(messages)) {
			const updatedThread = await rovoAppThreadManager.updateThread(threadId, {
				activeRun: null,
				messages,
			});
			await synchronizeRovoAppThreadGeneratedFiles(updatedThread, { streamedMessages });
		} else {
			await clearRovoAppRunState(threadId);
		}
		if (threadId) {
			activeRequests.delete(threadId);
		}
		rovoAppRunManager.clearRun(threadId);
		void startNextQueuedRun();
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

	return {
		clearRovoAppRunState,
		finalizeRovoAppRun,
		persistRovoAppRunBackend,
		persistRovoAppRunMessagesSnapshot,
		persistRovoAppRunState,
		reconcileOrphanedRovoAppThread,
	};
}

module.exports = {
	buildRovoAppActiveRunPayload,
	createRovoAppRunStateService,
};
