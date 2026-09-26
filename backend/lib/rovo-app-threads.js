const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const {
	buildRovoAppThreadPaths,
	getRovoAppThreadsRootDir,
} = require("./rovo-app-storage-paths");

const RETENTION_LIMIT = 40;

function createId() {
	return `rovo-app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toIsoDate(value = Date.now()) {
	const date = value instanceof Date ? value : new Date(value);
	return date.toISOString();
}

function safeJsonParse(rawValue) {
	try {
		return JSON.parse(rawValue);
	} catch {
		return null;
	}
}

function normalizeSessionId(rawSessionId) {
	return typeof rawSessionId === "string" && rawSessionId.trim()
		? rawSessionId.trim()
		: null;
}

function normalizeSessionMode(rawSessionMode, hasSessionId = false) {
	if (!hasSessionId) {
		return null;
	}

	if (rawSessionMode === "persistent" || rawSessionMode === "ephemeral") {
		return rawSessionMode;
	}

	return "persistent";
}

function getTimestamp(value) {
	if (typeof value !== "string" || !value.trim()) {
		return Number.NaN;
	}

	return Date.parse(value);
}

function normalizeRealtimeMessages(rawMessages) {
	if (!Array.isArray(rawMessages)) {
		return [];
	}

	return rawMessages.flatMap((message) => {
		if (
			message &&
			typeof message === "object" &&
			typeof message.id === "string" &&
			message.id.trim().length > 0 &&
			(message.role === "user" || message.role === "assistant") &&
			Array.isArray(message.parts)
		) {
			return [message];
		}

		return [];
	});
}

function omitUndefinedFields(fields) {
	const definedFields = {};

	for (const [key, value] of Object.entries(fields || {})) {
		if (value !== undefined) {
			definedFields[key] = value;
		}
	}

	return definedFields;
}

function normalizeActiveRun(rawActiveRun, updatedAtFallback, threadSessionFallback = {}) {
	if (!rawActiveRun || typeof rawActiveRun !== "object") {
		return null;
	}

	const id =
		typeof rawActiveRun.id === "string" && rawActiveRun.id.trim()
			? rawActiveRun.id.trim()
			: null;
	if (!id) {
		return null;
	}

	const status =
		rawActiveRun.status === "queued"
		|| rawActiveRun.status === "streaming"
		|| rawActiveRun.status === "background"
			? rawActiveRun.status
			: null;
	if (!status) {
		return null;
	}

	const startedAt =
		typeof rawActiveRun.startedAt === "string" && rawActiveRun.startedAt.trim()
			? rawActiveRun.startedAt.trim()
			: updatedAtFallback;
	const updatedAt =
		typeof rawActiveRun.updatedAt === "string" && rawActiveRun.updatedAt.trim()
			? rawActiveRun.updatedAt.trim()
			: startedAt;
	const sessionId =
		normalizeSessionId(rawActiveRun.sessionId ?? rawActiveRun.session_id) ??
		normalizeSessionId(threadSessionFallback.sessionId ?? threadSessionFallback.session_id);
	const rovoPort =
		typeof rawActiveRun.rovoPort === "number"
		&& Number.isInteger(rawActiveRun.rovoPort)
		&& rawActiveRun.rovoPort > 0
			? rawActiveRun.rovoPort
			: null;
	const backend =
		rawActiveRun.backend === "rovo" || rawActiveRun.backend === "ai-gateway"
			? rawActiveRun.backend
			: rovoPort !== null
				? "rovo"
				: "ai-gateway";

	return {
		id,
		backend,
		status,
		portIndex:
			typeof rawActiveRun.portIndex === "number"
			&& Number.isInteger(rawActiveRun.portIndex)
			&& rawActiveRun.portIndex >= 0
				? rawActiveRun.portIndex
				: null,
		rovoPort,
		sessionId,
		sessionMode: normalizeSessionMode(
			rawActiveRun.sessionMode ??
				rawActiveRun.session_mode ??
				threadSessionFallback.sessionMode ??
				threadSessionFallback.session_mode,
			Boolean(sessionId),
		),
		startedAt,
		updatedAt,
	};
}

function normalizeThreadRecord(rawThread) {
	if (!rawThread || typeof rawThread !== "object") {
		return null;
	}

	const id = typeof rawThread.id === "string" && rawThread.id.trim()
		? rawThread.id.trim()
		: null;
	if (!id) {
		return null;
	}

	const createdAt = typeof rawThread.createdAt === "string" && rawThread.createdAt.trim()
		? rawThread.createdAt
		: toIsoDate();
	const updatedAt = typeof rawThread.updatedAt === "string" && rawThread.updatedAt.trim()
		? rawThread.updatedAt
		: createdAt;
	const sessionId = normalizeSessionId(rawThread.sessionId ?? rawThread.session_id);

	return {
		id,
		title:
			typeof rawThread.title === "string" && rawThread.title.trim()
				? rawThread.title.trim()
				: "New chat",
		messages: Array.isArray(rawThread.messages) ? rawThread.messages : [],
		visibility: rawThread.visibility === "public" ? "public" : "private",
		modelId:
			typeof rawThread.modelId === "string" && rawThread.modelId.trim()
				? rawThread.modelId.trim()
				: null,
			provider:
				typeof rawThread.provider === "string" && rawThread.provider.trim()
					? rawThread.provider.trim()
					: null,
			realtimeMessages: normalizeRealtimeMessages(rawThread.realtimeMessages),
			activeDocumentId:
				typeof rawThread.activeDocumentId === "string" && rawThread.activeDocumentId.trim()
					? rawThread.activeDocumentId.trim()
					: null,
			sessionId,
		sessionMode: normalizeSessionMode(
			rawThread.sessionMode ?? rawThread.session_mode,
			Boolean(sessionId),
		),
		activeRun: normalizeActiveRun(rawThread.activeRun, updatedAt, {
			sessionId,
			sessionMode: rawThread.sessionMode ?? rawThread.session_mode,
		}),
		createdAt,
		updatedAt,
	};
}

function createRovoAppThreadManager({ baseDir, logger }) {
	const threadsRootDir = getRovoAppThreadsRootDir(baseDir);
	const mutationQueues = new Map();

	const getMutationQueueKey = (threadId) =>
		typeof threadId === "string" && threadId.trim()
			? threadId.trim()
			: threadId;

	const enqueueThreadMutation = (threadId, operation) => {
		const queueKey = getMutationQueueKey(threadId);
		const previousQueue = mutationQueues.get(queueKey) || Promise.resolve();
		const operationPromise = previousQueue.catch(() => {}).then(operation);
		const queueTail = operationPromise.catch(() => {});

		mutationQueues.set(queueKey, queueTail);
		queueTail.finally(() => {
			if (mutationQueues.get(queueKey) === queueTail) {
				mutationQueues.delete(queueKey);
			}
		});

		return operationPromise;
	};

	const writeJsonFile = async (filePath, payload) => {
		const fileDir = path.dirname(filePath);
		const tempFilePath = path.join(
			fileDir,
			`.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
		);

		await fs.mkdir(fileDir, { recursive: true });
		try {
			await fs.writeFile(
				tempFilePath,
				`${JSON.stringify(payload, null, 2)}\n`,
				{ encoding: "utf8", flag: "wx" },
			);
			await fs.rename(tempFilePath, filePath);
		} catch (error) {
			await fs.rm(tempFilePath, { force: true }).catch(() => {});
			throw error;
		}
	};

	const readThread = async (threadId) => {
		const { threadFilePath } = buildRovoAppThreadPaths(baseDir, threadId);

		try {
			const raw = await fs.readFile(threadFilePath, "utf8");
			return normalizeThreadRecord(safeJsonParse(raw));
		} catch (error) {
			if (error && error.code === "ENOENT") {
				return null;
			}

			throw error;
		}
	};

	const listThreads = async ({ limit } = {}) => {
		let entries;
		try {
			entries = await fs.readdir(threadsRootDir);
		} catch (error) {
			if (error && error.code === "ENOENT") {
				return [];
			}

			throw error;
		}

		const threadResults = await Promise.all(
			entries.map((entry) => readThread(entry)),
		);
		const threads = threadResults.filter(Boolean);

		threads.sort((left, right) => {
			const leftTime = getTimestamp(left.updatedAt);
			const rightTime = getTimestamp(right.updatedAt);
			return rightTime - leftTime;
		});

		const resolvedLimit =
			typeof limit === "number" && Number.isFinite(limit) && limit > 0
				? Math.floor(limit)
				: RETENTION_LIMIT;
		return threads.slice(0, resolvedLimit);
	};

	const deleteThreadDir = async (threadId) => {
		const { threadDir } = buildRovoAppThreadPaths(baseDir, threadId);
		await fs.rm(threadDir, { recursive: true, force: true });
	};

	const persistUpdatedThread = async (threadId, currentThread, fields = {}) => {
		const definedFields = omitUndefinedFields(fields);
		const nextThread = normalizeThreadRecord({
			...currentThread,
			...definedFields,
			id: currentThread.id,
			createdAt: currentThread.createdAt,
			updatedAt:
				typeof definedFields.updatedAt === "string" && definedFields.updatedAt.trim()
					? definedFields.updatedAt
					: toIsoDate(),
		});
		const { threadFilePath } = buildRovoAppThreadPaths(baseDir, threadId);
		await writeJsonFile(threadFilePath, nextThread);
		return nextThread;
	};

	const updateThreadRecord = async (threadId, fields = {}) => {
		const currentThread = await readThread(threadId);
		if (!currentThread) {
			return null;
		}

		return persistUpdatedThread(threadId, currentThread, fields);
	};

	const deleteThread = async (threadId) =>
		enqueueThreadMutation(threadId, () => deleteThreadDir(threadId));

	const pruneOldThreads = async ({ skipThreadId } = {}) => {
		const threads = await listThreads({ limit: RETENTION_LIMIT + 20 });
		if (threads.length <= RETENTION_LIMIT) {
			return;
		}

		const staleThreads = threads.slice(RETENTION_LIMIT);
		await Promise.all(staleThreads.map(async (thread) => {
			if (thread.id === skipThreadId) {
				return;
			}

			try {
				await deleteThread(thread.id);
			} catch (error) {
				logger.error?.(`[FUTURE-CHAT] Failed to prune thread ${thread.id}:`, error);
			}
		}));
	};

	const createThread = async ({
		id,
		title,
		messages,
		realtimeMessages,
		visibility,
		modelId,
		provider,
		activeDocumentId,
		sessionId,
		sessionMode,
		activeRun,
		createdAt,
		updatedAt,
	} = {}) => {
		const threadId =
			typeof id === "string" && id.trim() ? id.trim() : createId();
		const now = toIsoDate();
		const nextThread = normalizeThreadRecord({
			id: threadId,
			title,
			messages,
			realtimeMessages,
			visibility,
			modelId,
			provider,
			activeDocumentId,
			sessionId,
			sessionMode,
			activeRun,
			createdAt: createdAt || now,
			updatedAt: updatedAt || now,
		});

		const createdThread = await enqueueThreadMutation(threadId, async () => {
			const { threadFilePath } = buildRovoAppThreadPaths(baseDir, threadId);
			await writeJsonFile(threadFilePath, nextThread);
			return nextThread;
		});
		await pruneOldThreads({ skipThreadId: threadId });
		return createdThread;
	};

	const updateThread = async (threadId, fields = {}) =>
		enqueueThreadMutation(threadId, () => updateThreadRecord(threadId, fields));

	const getRealtimeMessages = async (threadId) => {
		const thread = await readThread(threadId);
		if (!thread) {
			return null;
		}

		return normalizeRealtimeMessages(thread.realtimeMessages);
	};

	const replaceRealtimeMessages = async (threadId, realtimeMessages) =>
		enqueueThreadMutation(threadId, async () => {
			const currentThread = await readThread(threadId);
			if (!currentThread) {
				return null;
			}

			const nextRealtimeMessages = normalizeRealtimeMessages(realtimeMessages);
			return persistUpdatedThread(threadId, currentThread, {
				realtimeMessages: nextRealtimeMessages,
			});
		});

	const upsertRealtimeMessage = async (threadId, realtimeMessage) =>
		enqueueThreadMutation(threadId, async () => {
			const currentThread = await readThread(threadId);
			if (!currentThread) {
				return null;
			}

			const [nextRealtimeMessage] = normalizeRealtimeMessages([realtimeMessage]);
			if (!nextRealtimeMessage) {
				return currentThread;
			}

			const existingMessages = normalizeRealtimeMessages(currentThread.realtimeMessages);
			const existingIndex = existingMessages.findIndex(
				(message) => message.id === nextRealtimeMessage.id,
			);
			if (existingIndex === -1) {
				existingMessages.push(nextRealtimeMessage);
			} else {
				existingMessages.splice(existingIndex, 1, nextRealtimeMessage);
			}

			return persistUpdatedThread(threadId, currentThread, {
				realtimeMessages: existingMessages,
			});
		});

	const deleteAllThreads = async () => {
		let entries;
		try {
			entries = await fs.readdir(threadsRootDir);
		} catch (error) {
			if (error && error.code === "ENOENT") {
				return;
			}

			throw error;
		}

		await Promise.all(entries.map((entry) => deleteThread(entry)));
		await fs.rmdir(threadsRootDir).catch((error) => {
			if (error && (error.code === "ENOENT" || error.code === "ENOTEMPTY")) {
				return;
			}
			throw error;
		});
	};

	return {
		listThreads,
		getThread: readThread,
		getRealtimeMessages,
		createThread,
		replaceRealtimeMessages,
		upsertRealtimeMessage,
		updateThread,
		deleteThread,
		deleteAllThreads,
	};
}

module.exports = {
	createRovoAppThreadManager,
};
