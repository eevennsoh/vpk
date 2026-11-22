"use strict";

const { runWithGeneratedMediaScope } = require("./generated-media-owners");

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
	rovoAppRunManager,
	settleRovoAppRun,
} = {}) {
	requireFunction("executeRovoAppManagedRun", executeRovoAppManagedRun);
	requireFunction("logger.error", logger?.error);
	requireFunction("persistRovoAppRunState", persistRovoAppRunState);
	requireFunction("rovoAppRunManager.hasSubscribers", rovoAppRunManager?.hasSubscribers);
	requireFunction("rovoAppRunManager.isCurrentRun", rovoAppRunManager?.isCurrentRun);
	requireFunction("rovoAppRunManager.markRunStarted", rovoAppRunManager?.markRunStarted);
	requireFunction("settleRovoAppRun", settleRovoAppRun);

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
		// Cancelled (or replaced) while its state was stored: nothing to execute.
		if (!rovoAppRunManager.isCurrentRun(markedRun) || markedRun.abortController.signal.aborted) {
			return;
		}
		// Run as the turn of the caller who sent it.
		void runWithGeneratedMediaScope(markedRun.mediaScope ?? null, () => executeRovoAppManagedRun(markedRun)).catch(async (error) => {
			const wasAborted = markedRun.abortController.signal.aborted;
			if (!wasAborted) {
				logger.error("[FUTURE-CHAT] Managed run failed:", error);
			}
			await failRovoAppRun(markedRun, error);
		});
	}

	return {
		failRovoAppRun,
		startManagedRovoAppRun,
	};
}

module.exports = {
	createRovoAppManagedRunLifecycle,
};
