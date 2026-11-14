const { randomUUID } = require("node:crypto");

const { isTerminalRunStatus, runReducer } = require("./rovo-app-run-machine");

function toIsoDate(value = Date.now()) {
	const date = value instanceof Date ? value : new Date(value);
	return date.toISOString();
}

function createRovoAppRunManager({ logger = console } = {}) {
	const runs = new Map();
	const queuedThreadIds = [];

	function createRun({ backend = "ai-gateway", threadId, requestBody, requestedPortIndex = null }) {
		const existingRun = runs.get(threadId);
		if (existingRun) {
			return existingRun;
		}

		const now = toIsoDate();
		const run = {
			id: `rovo-app-run-${randomUUID()}`,
			backend: backend === "rovo" ? "rovo" : "ai-gateway",
			threadId,
			requestBody,
			requestedPortIndex:
				typeof requestedPortIndex === "number"
				&& Number.isInteger(requestedPortIndex)
				&& requestedPortIndex >= 0
					? requestedPortIndex
					: null,
			assignedPortIndex: null,
			rovoPort: null,
			status: "queued",
			startedAt: now,
			updatedAt: now,
			bufferedChunks: [],
			subscribers: new Map(),
			abortController: new AbortController(),
			error: null,
		};

		runs.set(threadId, run);
		return run;
	}

	function getRun(threadId) {
		return runs.get(threadId) ?? null;
	}

	function hasRun(threadId) {
		return runs.has(threadId);
	}

	function listRuns() {
		return Array.from(runs.values()).map((run) => ({
			threadId: run.threadId,
			id: run.id,
			backend: run.backend === "rovo" ? "rovo" : "ai-gateway",
			status: run.status,
			startedAt: Date.parse(run.startedAt),
			updatedAt: run.updatedAt,
			portIndex: run.assignedPortIndex,
			rovoPort: run.rovoPort,
		}));
	}

	function listQueuedThreadIds() {
		return [...queuedThreadIds];
	}

	function enqueueRun(threadId) {
		if (!queuedThreadIds.includes(threadId)) {
			queuedThreadIds.push(threadId);
		}
	}

	function removeQueuedRun(threadId) {
		const index = queuedThreadIds.indexOf(threadId);
		if (index !== -1) {
			queuedThreadIds.splice(index, 1);
			return true;
		}
		return false;
	}

	function markRunStarted(threadId, { backend, portIndex = null, rovoPort = null, status } = {}) {
		const run = runs.get(threadId);
		if (!run) {
			return null;
		}

		removeQueuedRun(threadId);
		const now = toIsoDate();
		run.assignedPortIndex =
			typeof portIndex === "number" && Number.isInteger(portIndex) && portIndex >= 0
				? portIndex
				: null;
		run.rovoPort =
			typeof rovoPort === "number" && Number.isInteger(rovoPort) && rovoPort > 0
				? rovoPort
				: null;
		if (backend === "rovo" || backend === "ai-gateway") {
			run.backend = backend;
		}
		run.startedAt = now;
		run.updatedAt = now;
		run.status = runReducer(run.status, {
			type: "start",
			streaming:
				status === "background" || status === "streaming"
					? status === "streaming"
					: run.subscribers.size > 0,
		});
		return run;
	}

	function setRunStatus(threadId, status) {
		const run = runs.get(threadId);
		if (!run) {
			return null;
		}

		// Only the live statuses can be set here; settling goes through settleRun.
		if (status === "background") {
			run.status = runReducer(run.status, { type: "detach" });
		} else if (status === "streaming") {
			run.status = runReducer(run.status, { type: "attach" });
		} else if (status !== "queued") {
			return run;
		}

		run.updatedAt = toIsoDate();
		return run;
	}

	function setRunBackend(threadId, backend) {
		const run = runs.get(threadId);
		if (!run) {
			return null;
		}

		if (backend !== "rovo" && backend !== "ai-gateway") {
			return run;
		}

		run.backend = backend;
		if (backend === "ai-gateway") {
			run.assignedPortIndex = null;
			run.rovoPort = null;
		}
		run.updatedAt = toIsoDate();
		return run;
	}

	function initializeSseResponse(res) {
		if (typeof res.status === "function") {
			res.status(200);
		}
		if (typeof res.setHeader === "function") {
			res.setHeader("Content-Type", "text/event-stream");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");
		}
		if (typeof res.flushHeaders === "function") {
			res.flushHeaders();
		}
	}

	function attachSubscriber(threadId, res, { onDetached } = {}) {
		const run = runs.get(threadId);
		if (!run) {
			return null;
		}

		initializeSseResponse(res);
		for (const chunk of run.bufferedChunks) {
			res.write(chunk);
		}

		const subscriberId = randomUUID();
		run.subscribers.set(subscriberId, res);
		if (run.status === "background") {
			run.status = runReducer(run.status, { type: "attach" });
			run.updatedAt = toIsoDate();
		}

		res.once("close", () => {
			detachSubscriber(threadId, subscriberId);
			onDetached?.(run);
		});
		return subscriberId;
	}

	function detachSubscriber(threadId, subscriberId) {
		const run = runs.get(threadId);
		if (!run) {
			return false;
		}

		const removed = run.subscribers.delete(subscriberId);
		if (!removed) {
			return false;
		}

		run.updatedAt = toIsoDate();
		if (run.subscribers.size === 0) {
			run.status = runReducer(run.status, { type: "detach" });
		}
		return true;
	}

	function hasSubscribers(threadId) {
		const run = runs.get(threadId);
		return run ? run.subscribers.size > 0 : false;
	}

	function appendChunk(threadId, chunk) {
		const run = runs.get(threadId);
		if (!run) {
			return false;
		}

		run.bufferedChunks.push(chunk);
		run.updatedAt = toIsoDate();
		for (const subscriber of run.subscribers.values()) {
			subscriber.write(chunk);
		}
		return true;
	}

	function endSubscribers(threadId) {
		const run = runs.get(threadId);
		if (!run) {
			return;
		}

		for (const subscriber of run.subscribers.values()) {
			try {
				subscriber.end();
			} catch (error) {
				logger.warn?.("[FUTURE-CHAT] Failed to end run subscriber:", error);
			}
		}
		run.subscribers.clear();
	}

	/**
	 * The one way a run ends: makes it terminal (`completed`, `failed` or `cancelled`), aborts
	 * it when cancelled, drops its queue entry, ends its subscribers and removes it from the
	 * registry. With `runId`, only that run is settled, so a late settle of a run that was
	 * cancelled and replaced cannot end the thread's new run. Returns the settled run, or
	 * null when there was nothing to settle.
	 * @param {string} threadId
	 * @param {{ outcome: "completed" | "failed" | "cancelled", runId?: string | null, error?: unknown }} options
	 */
	function settleRun(threadId, { outcome, runId = null, error = null }) {
		const run = runs.get(threadId);
		if (!run || (runId && run.id !== runId) || isTerminalRunStatus(run.status) || !isTerminalRunStatus(outcome)) {
			return null;
		}

		run.status = runReducer(run.status, { type: "settle", outcome });
		if (error !== null && error !== undefined) {
			run.error = error instanceof Error ? error.message : String(error);
		}
		run.updatedAt = toIsoDate();
		removeQueuedRun(threadId);
		if (outcome === "cancelled") {
			try {
				run.abortController.abort();
			} catch {}
		}
		endSubscribers(threadId);
		runs.delete(threadId);
		return run;
	}

	return {
		appendChunk,
		attachSubscriber,
		createRun,
		detachSubscriber,
		enqueueRun,
		getRun,
		hasRun,
		hasSubscribers,
		listQueuedThreadIds,
		listRuns,
		markRunStarted,
		removeQueuedRun,
		setRunBackend,
		setRunStatus,
		settleRun,
	};
}

module.exports = {
	createRovoAppRunManager,
};
