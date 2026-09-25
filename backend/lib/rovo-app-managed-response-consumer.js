"use strict";

const {
	collectUiMessagesFromResponseStream: defaultCollectUiMessagesFromResponseStream,
	createUiMessageChunkSseStream: defaultCreateUiMessageChunkSseStream,
} = require("./rovo-app-ui-stream");
const {
	parseRouteDecisionFromSseChunk,
} = require("./route-decision");
const { getPositiveInteger } = require("./shared-utils");

const DEFAULT_MESSAGE_PERSIST_DEBOUNCE_MS = 450;

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppManagedResponseConsumer requires ${name}`);
	}
	return value;
}

function createRovoAppManagedResponseConsumer({
	collectUiMessagesFromResponseStream = defaultCollectUiMessagesFromResponseStream,
	createUiMessageChunkSseStream = defaultCreateUiMessageChunkSseStream,
	finalizeRovoAppRun,
	logger = console,
	messagePersistDebounceMs = DEFAULT_MESSAGE_PERSIST_DEBOUNCE_MS,
	persistRovoAppRunMessagesSnapshot,
	persistRovoAppRunState,
	rovoAppRunManager,
	rovoAppThreadManager,
	syncRovoAppThreadSession,
} = {}) {
	requireFunction("collectUiMessagesFromResponseStream", collectUiMessagesFromResponseStream);
	requireFunction("createUiMessageChunkSseStream", createUiMessageChunkSseStream);
	requireFunction("finalizeRovoAppRun", finalizeRovoAppRun);
	requireFunction("logger.info", logger?.info);
	requireFunction("logger.warn", logger?.warn);
	requireFunction("persistRovoAppRunMessagesSnapshot", persistRovoAppRunMessagesSnapshot);
	requireFunction("persistRovoAppRunState", persistRovoAppRunState);
	requireFunction("rovoAppRunManager.appendChunk", rovoAppRunManager?.appendChunk);
	requireFunction("rovoAppThreadManager.getThread", rovoAppThreadManager?.getThread);
	requireFunction("syncRovoAppThreadSession", syncRovoAppThreadSession);

	async function consumeRovoAppManagedResponse({
		initialMessages,
		prependChunk,
		response,
		run,
		stageTrace,
		threadId,
	}) {
		const contentType = response.headers.get("content-type") || "";
		if (!contentType.includes("text/event-stream") || !response.body) {
			throw new Error("Rovo expected an event stream response.");
		}

		const resolvedPort = getPositiveInteger(response.headers.get("x-vpk-port"))
			?? getPositiveInteger(response.headers.get("x-vpk-rovo-port"));
		if (
			typeof resolvedPort === "number"
			&& Number.isInteger(resolvedPort)
			&& resolvedPort > 0
			&& run.rovoPort !== resolvedPort
		) {
			run.rovoPort = resolvedPort;
			run.updatedAt = new Date().toISOString();
			await persistRovoAppRunState(threadId, run);
		}

		const [broadcastStream, parseStream] = response.body.tee();
		const routeDecisionToSuppress = parseRouteDecisionFromSseChunk(prependChunk);
		if (prependChunk) {
			rovoAppRunManager.appendChunk(threadId, prependChunk);
		}

		let latestMessagesSnapshot = Array.isArray(initialMessages) ? [...initialMessages] : [];
		let scheduledPersistTimeout = null;
		let persistInFlight = null;
		let hasPendingPersist = false;

		const clearScheduledPersist = () => {
			if (scheduledPersistTimeout !== null) {
				clearTimeout(scheduledPersistTimeout);
				scheduledPersistTimeout = null;
			}
		};

		const flushPersistedMessages = async () => {
			clearScheduledPersist();
			if (!threadId) {
				return;
			}
			if (persistInFlight) {
				hasPendingPersist = true;
				await persistInFlight;
				return;
			}

			const snapshotToPersist = latestMessagesSnapshot;
			persistInFlight = persistRovoAppRunMessagesSnapshot(
				threadId,
				snapshotToPersist,
			)
				.catch((error) => {
					logger.warn("[FUTURE-CHAT] Failed to persist in-flight thread messages:", {
						threadId,
						error: error instanceof Error ? error.message : String(error),
					});
				})
				.finally(() => {
					persistInFlight = null;
				});
			await persistInFlight;

			if (hasPendingPersist && latestMessagesSnapshot !== snapshotToPersist) {
				hasPendingPersist = false;
				await flushPersistedMessages();
				return;
			}

			hasPendingPersist = false;
		};

		const schedulePersistedMessages = (messages) => {
			latestMessagesSnapshot = Array.isArray(messages) ? [...messages] : [];
			if (!threadId || scheduledPersistTimeout !== null) {
				return;
			}

			scheduledPersistTimeout = setTimeout(() => {
				void flushPersistedMessages();
			}, messagePersistDebounceMs);
		};

		const parsePromise = collectUiMessagesFromResponseStream({
			initialMessages,
			onMessagesUpdated: schedulePersistedMessages,
			routeDecisionToSuppress,
			stream: parseStream,
		});

		const filteredSseStream = createUiMessageChunkSseStream({
			routeDecisionToSuppress,
			stream: broadcastStream,
		});
		const filteredSseReader = filteredSseStream.getReader();
		let hasLoggedFirstChunk = false;
		try {
			while (true) {
				const { done, value } = await filteredSseReader.read();
				if (done) {
					break;
				}

				if (!hasLoggedFirstChunk) {
					hasLoggedFirstChunk = true;
					stageTrace.mark("future_chat_first_chunk", {
						bytes:
							typeof value === "string"
								? Buffer.byteLength(value)
								: typeof value?.length === "number" && Number.isFinite(value.length)
									? value.length
									: null,
					});
				}
				rovoAppRunManager.appendChunk(threadId, value);
			}
		} finally {
			filteredSseReader.releaseLock();
		}

		const messages = await parsePromise;
		latestMessagesSnapshot = Array.isArray(messages) ? [...messages] : [];
		await flushPersistedMessages();
		try {
			const synchronizedThread = await syncRovoAppThreadSession(threadId, run.rovoPort, {
				thread: threadId ? await rovoAppThreadManager.getThread(threadId) : null,
			});
			if (synchronizedThread?.sessionId) {
				run.sessionId = synchronizedThread.sessionId;
				run.sessionMode = synchronizedThread.sessionMode ?? "persistent";
			}
		} catch (error) {
			logger.warn("[FUTURE-CHAT] Failed to synchronize thread session:", {
				threadId,
				port: run.rovoPort,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		await finalizeRovoAppRun(threadId, run, messages);
	}

	return {
		consumeRovoAppManagedResponse,
	};
}

module.exports = {
	DEFAULT_MESSAGE_PERSIST_DEBOUNCE_MS,
	createRovoAppManagedResponseConsumer,
};
