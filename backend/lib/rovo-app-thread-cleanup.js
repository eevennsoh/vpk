"use strict";

function createRovoAppThreadCleanup({
	cancelChat,
	deleteThreadBrowserWorkspace,
	destroyMirrorBrowser,
	rovoAppRunManager,
	settleRun,
}) {
	async function cancelRun(run) {
		if (!run) return false;
		if (typeof run.rovoPort === "number" && run.rovoPort > 0) {
			try {
				await cancelChat(run.rovoPort);
			} catch {}
		}
		return settleRun(run, "cancelled");
	}

	async function cancelAllRuns() {
		// listRuns returns summaries. Capture the actual runs before awaiting any cancel,
		// so settlement names those runs even if another run starts during the wait.
		const runs = rovoAppRunManager.listRuns().map(({ threadId }) => rovoAppRunManager.getRun(threadId));
		await Promise.all(runs.map(cancelRun));
	}

	async function deleteThreadBrowsers(threadId) {
		try {
			await deleteThreadBrowserWorkspace(threadId);
		} catch {}
		try {
			await destroyMirrorBrowser(`mirror-${threadId}`);
		} catch {}
	}

	return { cancelAllRuns, cancelRun, deleteThreadBrowsers };
}

module.exports = { createRovoAppThreadCleanup };
