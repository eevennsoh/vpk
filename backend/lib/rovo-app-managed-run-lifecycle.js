"use strict";

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppManagedRunLifecycle requires ${name}`);
	}
	return value;
}

function createRovoAppManagedRunLifecycle({
	executeRovoAppManagedRun,
	logger = console,
	persistRovoAppRunState,
	resolveRovoAppPortAvailability,
	rovoAppRunManager,
	settleRovoAppRun,
} = {}) {
	requireFunction("executeRovoAppManagedRun", executeRovoAppManagedRun);
	requireFunction("logger.error", logger?.error);
	requireFunction("persistRovoAppRunState", persistRovoAppRunState);
	requireFunction("resolveRovoAppPortAvailability", resolveRovoAppPortAvailability);
	requireFunction("rovoAppRunManager.getRun", rovoAppRunManager?.getRun);
	requireFunction("rovoAppRunManager.hasSubscribers", rovoAppRunManager?.hasSubscribers);
	requireFunction("rovoAppRunManager.listQueuedThreadIds", rovoAppRunManager?.listQueuedThreadIds);
	requireFunction("rovoAppRunManager.markRunStarted", rovoAppRunManager?.markRunStarted);
	requireFunction("rovoAppRunManager.removeQueuedRun", rovoAppRunManager?.removeQueuedRun);
	requireFunction("settleRovoAppRun", settleRovoAppRun);

	let isProcessingRovoAppRunQueue = false;

	// Settling never throws, so a run whose failure cannot be saved still ends.
	async function failRovoAppRun(run, error) {
		await settleRovoAppRun(run, "failed", { error });
	}

	async function startManagedRovoAppRun(run) {
		const markedRun = rovoAppRunManager.markRunStarted(run.threadId, {
			backend: run.backend === "rovo" ? "rovo" : "ai-gateway",
			portIndex: null,
			rovoPort: null,
			status: rovoAppRunManager.hasSubscribers(run.threadId) ? "streaming" : "background",
		});
		if (!markedRun) {
			return;
		}

		try {
			await persistRovoAppRunState(run.threadId, markedRun);
		} catch (error) {
			// The stored active run only helps a reloaded page find the run; the run itself
			// does not depend on it, so it still starts.
			logger.error("[FUTURE-CHAT] Failed to store a started run:", error);
		}
		void executeRovoAppManagedRun(markedRun).catch(async (error) => {
			const wasAborted = markedRun.abortController.signal.aborted;
			if (!wasAborted) {
				logger.error("[FUTURE-CHAT] Managed run failed:", error);
			}
			await failRovoAppRun(markedRun, error);
		});
	}

	async function startNextQueuedRovoAppRun() {
		if (isProcessingRovoAppRunQueue) {
			return;
		}

		isProcessingRovoAppRunQueue = true;
		try {
			const queuedThreadIds = rovoAppRunManager.listQueuedThreadIds();
			for (const threadId of queuedThreadIds) {
				const run = rovoAppRunManager.getRun(threadId);
				if (!run) {
					rovoAppRunManager.removeQueuedRun(threadId);
					continue;
				}

				const assignment = resolveRovoAppPortAvailability();
				if (!assignment) {
					continue;
				}

				await startManagedRovoAppRun(run);
				break;
			}
		} finally {
			isProcessingRovoAppRunQueue = false;
		}
	}

	return {
		failRovoAppRun,
		startManagedRovoAppRun,
		startNextQueuedRovoAppRun,
	};
}

module.exports = {
	createRovoAppManagedRunLifecycle,
};
