"use strict";

// The Rovo app router's in-memory managers and a server harness, shared by its route suites.

const http = require("node:http");
const express = require("express");

const { registerRovoAppRoutes } = require("./rovo-app");
const { createCallerIdentityMiddleware } = require("../middleware/caller-identity");

function createState() {
	return {
		checkpoints: new Map(),
		documents: new Map(),
		realtimeMessages: new Map(),
		runs: new Map(),
		threads: new Map(),
		uploads: new Map(),
		votes: new Map(),
		calls: [],
	};
}

function createThreadManager(state) {
	return {
		createThread: async (thread) => {
			const nextThread = {
				createdAt: "2026-07-03T00:00:00.000Z",
				updatedAt: "2026-07-03T00:00:00.000Z",
				...thread,
			};
			state.threads.set(nextThread.id, nextThread);
			return nextThread;
		},
		deleteAllThreads: async () => {
			state.calls.push({ method: "deleteAllThreads" });
			state.threads.clear();
		},
		deleteThread: async (threadId) => {
			state.calls.push({ method: "deleteThread", threadId });
			return state.threads.delete(threadId);
		},
		getRealtimeMessages: async (threadId) => state.realtimeMessages.get(threadId) || [],
		getThread: async (threadId) => state.threads.get(threadId) || null,
		listThreads: async ({ limit, filter } = {}) => {
			const threads = [...state.threads.values()].filter((thread) => typeof filter !== "function" || filter(thread));
			return typeof limit === "number" ? threads.slice(0, limit) : threads;
		},
		replaceRealtimeMessages: async (threadId, messages) => {
			const thread = state.threads.get(threadId);
			if (!thread) {
				return null;
			}
			state.realtimeMessages.set(threadId, messages);
			thread.realtimeMessages = messages;
			return thread;
		},
		updateThread: async (threadId, patch) => {
			const thread = state.threads.get(threadId);
			if (!thread) {
				return null;
			}
			const nextThread = { ...thread, ...patch };
			state.threads.set(threadId, nextThread);
			return nextThread;
		},
		upsertRealtimeMessage: async (threadId, message) => {
			const thread = state.threads.get(threadId);
			if (!thread) {
				return null;
			}
			const messages = [...(state.realtimeMessages.get(threadId) || [])];
			const existingIndex = messages.findIndex((candidate) => candidate.id === message.id);
			if (existingIndex >= 0) {
				messages[existingIndex] = message;
			} else {
				messages.push(message);
			}
			state.realtimeMessages.set(threadId, messages);
			thread.realtimeMessages = messages;
			return thread;
		},
	};
}

function createRunManager(state) {
	return {
		attachSubscriber: () => "subscriber-1",
		getRun: (threadId) => state.runs.get(threadId) || null,
		listRuns: () => [...state.runs.values()],
		setRunStatus: (threadId, status) => {
			const run = state.runs.get(threadId);
			if (!run) {
				return null;
			}
			const nextRun = { ...run, status };
			state.runs.set(threadId, nextRun);
			return nextRun;
		},
	};
}

function createVoteManager(state) {
	return {
		deleteAllVotes: async () => {
			state.calls.push({ method: "deleteAllVotes" });
			state.votes.clear();
		},
		deleteVotesForThread: async (threadId) => {
			state.calls.push({ method: "deleteVotesForThread", threadId });
			state.votes.delete(threadId);
		},
		listVotes: async (threadId) => state.votes.get(threadId) || [],
		setVote: async ({ threadId, messageId, value }) => {
			const vote = { threadId, messageId, value };
			state.votes.set(threadId, [vote]);
			return vote;
		},
	};
}

function createDocumentManager(state) {
	return {
		appendDocumentVersion: async (documentId, patch) => {
			const document = state.documents.get(documentId);
			if (!document) {
				return null;
			}
			const nextDocument = {
				...document,
				...patch,
				versions: [...(document.versions || []), patch],
			};
			state.documents.set(documentId, nextDocument);
			return nextDocument;
		},
		createDocument: async (document) => {
			const id = `doc-${state.documents.size + 1}`;
			const nextDocument = { id, ...document };
			state.documents.set(id, nextDocument);
			return nextDocument;
		},
		deleteAllDocuments: async () => {
			state.calls.push({ method: "deleteAllDocuments" });
			state.documents.clear();
		},
		deleteDocument: async (documentId) => {
			state.documents.delete(documentId);
		},
		deleteDocumentsByThread: async (threadId) => {
			state.calls.push({ method: "deleteDocumentsByThread", threadId });
		},
		getDocument: async (documentId) => state.documents.get(documentId) || null,
		listDocuments: async ({ threadId } = {}) => {
			const documents = [...state.documents.values()];
			return threadId
				? documents.filter((document) => document.threadId === threadId)
				: documents;
		},
		patchDocumentMetadata: async (documentId, patch) => {
			const document = state.documents.get(documentId);
			if (!document) {
				return null;
			}
			const nextDocument = { ...document, ...patch };
			state.documents.set(documentId, nextDocument);
			return nextDocument;
		},
	};
}

function createUploadManager(state) {
	return {
		createUploadFromDataUrl: async ({ dataUrl, filename, mediaType, owner, threadId }) => {
			if (!dataUrl.startsWith("data:")) {
				throw new Error("Invalid data URL");
			}
			const id = `upload-${state.uploads.size + 1}`;
			const buffer = Buffer.from(dataUrl.split(",")[1] || "", "base64");
			const upload = {
				id,
				buffer,
				filename,
				mediaType: mediaType || "application/octet-stream",
				sizeBytes: buffer.length,
				threadId,
				owner,
			};
			state.uploads.set(id, upload);
			return upload;
		},
		deleteAllUploads: async () => {
			state.calls.push({ method: "deleteAllUploads" });
			state.uploads.clear();
		},
		deleteUpload: async (uploadId) => {
			state.calls.push({ method: "deleteUpload", uploadId });
			state.uploads.delete(uploadId);
		},
		getUpload: async (uploadId) => state.uploads.get(uploadId) || null,
	};
}

function createGeneratedFilesManager(state) {
	return {
		backfillFromThread: async (thread) => {
			state.calls.push({ method: "backfillFromThread", threadId: thread.id });
		},
		deleteGeneratedFilesForThreads: async (threadIds) => {
			state.calls.push({ method: "deleteGeneratedFilesForThreads", threadIds });
		},
		deleteLegacyRootFiles: async (threadId) => {
			state.calls.push({ method: "deleteLegacyRootFiles", threadId });
		},
	};
}

function createCheckpointManager(state) {
	return {
		create: async (checkpoint) => {
			const id = `checkpoint-${state.checkpoints.size + 1}`;
			const nextCheckpoint = { id, ...checkpoint };
			state.checkpoints.set(id, nextCheckpoint);
			return nextCheckpoint;
		},
		delete: async (checkpointId) => {
			const checkpoint = state.checkpoints.get(checkpointId);
			state.checkpoints.delete(checkpointId);
			return checkpoint || null;
		},
		list: async () => [...state.checkpoints.values()],
		rollback: async (checkpointId) => {
			const checkpoint = state.checkpoints.get(checkpointId);
			if (!checkpoint) {
				throw new Error("Checkpoint not found");
			}
			return checkpoint;
		},
	};
}

function createDependencies(overrides = {}) {
	const state = overrides.state || createState();
	return {
		state,
		cancelChat: async (port) => {
			state.calls.push({ method: "cancelChat", port });
		},
		checkpointManager: createCheckpointManager(state),
		collectUploadIdsFromMessages: (messages) => {
			const ids = [];
			for (const message of messages || []) {
				for (const part of message.parts || []) {
					const match = typeof part.url === "string" ? part.url.match(/\/files\/([^/?#]+)/u) : null;
					if (match?.[1]) {
						ids.push(match[1]);
					}
				}
			}
			return ids;
		},
		deleteThreadBrowserWorkspace: async (threadId) => {
			state.calls.push({ method: "deleteThreadBrowserWorkspace", threadId });
			return { deleted: true, threadId };
		},
		destroyMirrorBrowser: async (mirrorId) => {
			state.calls.push({ method: "destroyMirrorBrowser", mirrorId });
		},
		ensureThreadBrowserWorkspace: async ({ defaultUrl, threadId }) => ({
			created: true,
			state: { defaultUrl, threadId, workspaceId: `browser-${threadId}` },
		}),
		generatedFilesManager: createGeneratedFilesManager(state),
		getThreadBrowserWorkspace: async ({ threadId }) => ({
			state: { threadId, workspaceId: `browser-${threadId}` },
		}),
		logger: {
			error: () => {},
			warn: () => {},
		},
		maybeMigratePersistedThreadBrowserScreenshots: async (thread) => thread,
		persistMessageFiles: async (_threadId, messages) => Array.isArray(messages) ? messages : [],
		persistRunState: async (threadId, run) => {
			state.calls.push({ method: "persistRunState", run, threadId });
		},
		reconcileOrphanedThread: async (thread) => thread,
		requireRuntimeAdmin: (req, res, next) => {
			if (req.get("x-runtime-admin") === "ok") {
				next();
				return;
			}
			res.status(403).json({ error: "Runtime admin authorization required" });
		},
		rovoAppDocumentManager: createDocumentManager(state),
		rovoAppRunManager: createRunManager(state),
		rovoAppThreadManager: createThreadManager(state),
		rovoAppUploadManager: createUploadManager(state),
		rovoAppVoteManager: createVoteManager(state),
		searchThreads: (threads, query, { limit } = {}) => {
			const results = threads
				.filter((thread) => thread.title?.toLowerCase().includes(query.toLowerCase()))
				.map((thread) => ({ id: thread.id, title: thread.title }));
			return typeof limit === "number" ? results.slice(0, limit) : results;
		},
		settleRun: async (run, outcome) => {
			state.calls.push({ method: "settleRun", runId: run?.id ?? null, threadId: run?.threadId ?? null, outcome });
			const isCurrent = Boolean(run) && state.runs.get(run.threadId) === run;
			if (isCurrent) {
				state.runs.delete(run.threadId);
			}
			return isCurrent;
		},
		syncHermesJobsForRovoThreads: async (threadId = null) => {
			state.calls.push({ method: "syncHermesJobsForRovoThreads", threadId });
		},
		toThreadId: () => "generated-thread",
		...overrides,
	};
}

async function withServer(dependencies, run, { env } = {}) {
	const app = express();
	if (env) {
		app.use(createCallerIdentityMiddleware({ env, logger: { log: () => {}, warn: () => {} } }));
	}
	app.use(express.json({ limit: "2mb" }));
	registerRovoAppRoutes(app, dependencies);

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await run(baseUrl);
	} finally {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
}

module.exports = { createDependencies, withServer };
