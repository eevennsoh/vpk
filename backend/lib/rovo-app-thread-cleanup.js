"use strict";

const BROWSER_CLEANUP_TIMEOUT_MS = 5_000;

function createRovoAppThreadCleanup({
	browserCleanupTimeoutMs = BROWSER_CLEANUP_TIMEOUT_MS,
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

	async function cancelThreadRuns(threadIds) {
		// Capture the actual runs before awaiting any cancel,
		// so settlement names those runs even if another run starts during the wait.
		const runs = threadIds.map((threadId) => rovoAppRunManager.getRun(threadId));
		await Promise.all(runs.map(cancelRun));
	}

	function cancelAllRuns() {
		// listRuns returns summaries, not the run objects settlement needs.
		return cancelThreadRuns(rovoAppRunManager.listRuns().map(({ threadId }) => threadId));
	}

	async function deleteThreadBrowsers(threadId, isExpired = () => false) {
		try {
			await deleteThreadBrowserWorkspace(threadId);
		} catch {}
		if (isExpired()) return;
		try {
			await destroyMirrorBrowser(`mirror-${threadId}`);
		} catch {}
	}

	async function deleteAllThreadBrowsers(threadIds) {
		if (threadIds.length === 0) return;
		let expired = false;
		let timeout;
		const deadline = new Promise((resolve) => {
			timeout = setTimeout(() => {
				expired = true;
				resolve();
			}, browserCleanupTimeoutMs);
		});
		// One thread at a time, under one overall deadline. A pending workspace close has
		// no cancellation handle; after expiry it may finish, but starts no more cleanup.
		const cleanup = async () => {
			for (const threadId of threadIds) {
				if (expired) return;
				await deleteThreadBrowsers(threadId, () => expired);
			}
		};
		try {
			await Promise.race([deadline, cleanup()]);
		} finally {
			clearTimeout(timeout);
		}
	}

	return { cancelAllRuns, cancelRun, cancelThreadRuns, deleteAllThreadBrowsers, deleteThreadBrowsers };
}

module.exports = { createRovoAppThreadCleanup };
