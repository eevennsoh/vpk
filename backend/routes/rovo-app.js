"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");

const { getNonEmptyString } = require("../lib/shared-utils");
const {
	inferGeneratedMediaContentType,
	resolveGeneratedMediaAbsolutePath,
} = require("../lib/generated-media");
const {
	buildRovoAppFileUrl,
} = require("../lib/rovo-app-upload-helpers");

const REQUIRED_THREAD_MANAGER_METHODS = [
	"createThread",
	"deleteAllThreads",
	"deleteThread",
	"getRealtimeMessages",
	"getThread",
	"listThreads",
	"replaceRealtimeMessages",
	"updateThread",
	"upsertRealtimeMessage",
];

const REQUIRED_RUN_MANAGER_METHODS = [
	"attachSubscriber",
	"cancelRun",
	"getRun",
	"listRuns",
	"setRunStatus",
];

const REQUIRED_VOTE_MANAGER_METHODS = [
	"deleteAllVotes",
	"deleteVotesForThread",
	"listVotes",
	"setVote",
];

const REQUIRED_DOCUMENT_MANAGER_METHODS = [
	"appendDocumentVersion",
	"createDocument",
	"deleteAllDocuments",
	"deleteDocument",
	"deleteDocumentsByThread",
	"getDocument",
	"listDocuments",
	"patchDocumentMetadata",
];

const REQUIRED_UPLOAD_MANAGER_METHODS = [
	"createUploadFromDataUrl",
	"deleteAllUploads",
	"deleteUpload",
	"getUpload",
];

const REQUIRED_GENERATED_FILES_MANAGER_METHODS = [
	"backfillFromThread",
	"deleteLegacyRootFiles",
];

const REQUIRED_CHECKPOINT_MANAGER_METHODS = [
	"create",
	"delete",
	"list",
	"rollback",
];

function createRovoAppThreadId() {
	return `rovo-app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildRovoAppThreadSummary(thread) {
	if (!thread || typeof thread !== "object") {
		return thread;
	}

	const summary = { ...thread };
	delete summary.messages;
	delete summary.realtimeMessages;
	return summary;
}

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppRouter requires ${name}`);
	}
}

function validateManager(name, manager, requiredMethods) {
	if (!manager || typeof manager !== "object") {
		throw new Error(`createRovoAppRouter requires ${name}`);
	}

	for (const method of requiredMethods) {
		if (typeof manager[method] !== "function") {
			throw new Error(`createRovoAppRouter requires ${name}.${method}`);
		}
	}
}

function createRovoAppRouter({
	buildFileUrl = buildRovoAppFileUrl,
	buildThreadSummary = buildRovoAppThreadSummary,
	cancelChat,
	checkpointManager,
	clearRunState,
	collectUploadIdsFromMessages,
	deleteThreadBrowserWorkspace,
	destroyMirrorBrowser,
	ensureThreadBrowserWorkspace,
	fileAccess = fs.access,
	generatedFilesManager,
	getString = getNonEmptyString,
	getThreadBrowserWorkspace,
	inferGeneratedMediaContentTypeFn = inferGeneratedMediaContentType,
	logger = console,
	maybeMigratePersistedThreadBrowserScreenshots,
	persistMessageFiles,
	persistRunState,
	projectRoot = path.join(__dirname, "..", ".."),
	reconcileOrphanedThread,
	requireRuntimeAdmin,
	resolveGeneratedMediaAbsolutePathFn = resolveGeneratedMediaAbsolutePath,
	rovoAppDocumentManager,
	rovoAppRunManager,
	rovoAppThreadManager,
	rovoAppUploadManager,
	rovoAppVoteManager,
	searchThreads,
	startNextQueuedRun,
	toThreadId = createRovoAppThreadId,
} = {}) {
	validateManager("rovoAppThreadManager", rovoAppThreadManager, REQUIRED_THREAD_MANAGER_METHODS);
	validateManager("rovoAppRunManager", rovoAppRunManager, REQUIRED_RUN_MANAGER_METHODS);
	validateManager("rovoAppVoteManager", rovoAppVoteManager, REQUIRED_VOTE_MANAGER_METHODS);
	validateManager("rovoAppDocumentManager", rovoAppDocumentManager, REQUIRED_DOCUMENT_MANAGER_METHODS);
	validateManager("rovoAppUploadManager", rovoAppUploadManager, REQUIRED_UPLOAD_MANAGER_METHODS);
	validateManager("generatedFilesManager", generatedFilesManager, REQUIRED_GENERATED_FILES_MANAGER_METHODS);
	validateManager("checkpointManager", checkpointManager, REQUIRED_CHECKPOINT_MANAGER_METHODS);
	requireFunction("buildFileUrl", buildFileUrl);
	requireFunction("buildThreadSummary", buildThreadSummary);
	requireFunction("cancelChat", cancelChat);
	requireFunction("clearRunState", clearRunState);
	requireFunction("collectUploadIdsFromMessages", collectUploadIdsFromMessages);
	requireFunction("deleteThreadBrowserWorkspace", deleteThreadBrowserWorkspace);
	requireFunction("destroyMirrorBrowser", destroyMirrorBrowser);
	requireFunction("ensureThreadBrowserWorkspace", ensureThreadBrowserWorkspace);
	requireFunction("fileAccess", fileAccess);
	requireFunction("getString", getString);
	requireFunction("getThreadBrowserWorkspace", getThreadBrowserWorkspace);
	requireFunction("inferGeneratedMediaContentTypeFn", inferGeneratedMediaContentTypeFn);
	requireFunction("maybeMigratePersistedThreadBrowserScreenshots", maybeMigratePersistedThreadBrowserScreenshots);
	requireFunction("persistMessageFiles", persistMessageFiles);
	requireFunction("persistRunState", persistRunState);
	requireFunction("reconcileOrphanedThread", reconcileOrphanedThread);
	requireFunction("requireRuntimeAdmin", requireRuntimeAdmin);
	requireFunction("resolveGeneratedMediaAbsolutePathFn", resolveGeneratedMediaAbsolutePathFn);
	requireFunction("searchThreads", searchThreads);
	requireFunction("startNextQueuedRun", startNextQueuedRun);
	requireFunction("toThreadId", toThreadId);

	const router = express.Router();

	router.get("/rovo/messages", async (req, res) => {
		try {
			const rawThreadId = Array.isArray(req.query.threadId) ? req.query.threadId[0] : req.query.threadId;
			const threadId = getString(rawThreadId);
			if (!threadId) {
				return res.status(400).json({ error: "threadId is required" });
			}

			const messages = await rovoAppThreadManager.getRealtimeMessages(threadId);
			return res.status(200).json({
				messages: Array.isArray(messages) ? messages : [],
			});
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to load realtime messages:", error);
			return res.status(500).json({ error: "Failed to load Rovo realtime messages" });
		}
	});

	router.post("/rovo/messages", async (req, res) => {
		try {
			const {
				threadId: rawThreadId,
				message,
				messages,
			} = req.body || {};
			const threadId = getString(rawThreadId);
			if (!threadId) {
				return res.status(400).json({ error: "threadId is required" });
			}

			let thread = null;
			if (message && typeof message === "object") {
				thread = await rovoAppThreadManager.upsertRealtimeMessage(threadId, message);
			} else if (Array.isArray(messages)) {
				thread = await rovoAppThreadManager.replaceRealtimeMessages(threadId, messages);
			} else {
				return res.status(400).json({
					error: "Provide either `message` or `messages` to persist realtime messages.",
				});
			}

			if (!thread) {
				return res.status(404).json({ error: "Thread not found" });
			}

			return res.status(200).json({
				messages: Array.isArray(thread.realtimeMessages) ? thread.realtimeMessages : [],
			});
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to persist realtime messages:", error);
			return res.status(500).json({ error: "Failed to persist Rovo realtime messages" });
		}
	});

	router.get("/rovo/threads", async (req, res) => {
		try {
			const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
			const limit = rawLimit ? Number(rawLimit) : undefined;
			const threads = (
				await Promise.all(
					(await rovoAppThreadManager.listThreads({ limit })).map((thread) =>
						reconcileOrphanedThread(thread),
					),
				)
			)
				.filter(Boolean)
				.map((thread) => buildThreadSummary(thread));
			return res.status(200).json({ threads });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to list threads:", error);
			return res.status(500).json({ error: "Failed to list Rovo threads" });
		}
	});

	router.get("/sessions/search", async (req, res) => {
		try {
			const query = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
			if (!query || typeof query !== "string" || !query.trim()) {
				return res.status(200).json({ results: [] });
			}

			const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
			const limit = rawLimit ? Number(rawLimit) : undefined;
			const threads = await rovoAppThreadManager.listThreads({ limit: 100 });
			const results = searchThreads(threads, query.trim(), { limit });
			return res.status(200).json({ results });
		} catch (error) {
			logger.error?.("[SESSION-SEARCH] Failed to search sessions:", error);
			return res.status(500).json({
				error: "Failed to search sessions",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.get("/checkpoints", async (_req, res) => {
		try {
			const checkpoints = await checkpointManager.list();
			return res.status(200).json({ checkpoints });
		} catch (error) {
			logger.error?.("[CHECKPOINTS] Failed to list checkpoints:", error);
			return res.status(500).json({
				error: "Failed to list checkpoints",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.post("/checkpoints", requireRuntimeAdmin, async (req, res) => {
		try {
			const name = typeof req.body?.name === "string" && req.body.name.trim()
				? req.body.name.trim()
				: `checkpoint-${Date.now()}`;
			const description = typeof req.body?.description === "string"
				? req.body.description.trim()
				: null;
			const checkpoint = await checkpointManager.create({ name, description });
			return res.status(201).json({ checkpoint });
		} catch (error) {
			logger.error?.("[CHECKPOINTS] Failed to create checkpoint:", error);
			return res.status(500).json({
				error: "Failed to create checkpoint",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.post("/checkpoints/:id/rollback", requireRuntimeAdmin, async (req, res) => {
		try {
			const checkpoint = await checkpointManager.rollback(req.params.id);
			return res.status(200).json({ checkpoint });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const statusCode = /not found/iu.test(message) ? 404 : 500;
			return res.status(statusCode).json({
				error: "Failed to rollback checkpoint",
				details: message,
			});
		}
	});

	router.delete("/checkpoints/:id", requireRuntimeAdmin, async (req, res) => {
		try {
			const deleted = await checkpointManager.delete(req.params.id);
			if (!deleted) {
				return res.status(404).json({ error: "Checkpoint not found" });
			}
			return res.status(200).json({ checkpoint: deleted });
		} catch (error) {
			return res.status(500).json({
				error: "Failed to delete checkpoint",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.post("/rovo/threads", async (req, res) => {
		try {
			const {
				id: rawThreadId,
				title,
				messages,
				realtimeMessages,
				visibility,
				modelId,
				provider,
				activeDocumentId,
				sessionId,
				sessionMode,
				createdAt,
				updatedAt,
			} = req.body || {};
			const threadId = getString(rawThreadId) || toThreadId();
			const persistedMessages = await persistMessageFiles(threadId, messages);
			const thread = await rovoAppThreadManager.createThread({
				id: threadId,
				title,
				messages: persistedMessages,
				realtimeMessages,
				visibility,
				modelId,
				provider,
				activeDocumentId,
				sessionId,
				sessionMode,
				createdAt,
				updatedAt,
			});
			return res.status(201).json({ thread });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to create thread:", error);
			const message = error instanceof Error ? error.message : "Failed to create thread";
			return res.status(400).json({ error: message });
		}
	});

	router.delete("/rovo/threads", async (req, res) => {
		try {
			const rawAll = Array.isArray(req.query.all) ? req.query.all[0] : req.query.all;
			if (rawAll !== "true" && rawAll !== "1") {
				return res.status(400).json({ error: "Use ?all=true to delete all threads." });
			}

			const threads = await rovoAppThreadManager.listThreads({ limit: Number.MAX_SAFE_INTEGER });
			await Promise.all(
				threads.map(async (thread) => {
					await generatedFilesManager.deleteLegacyRootFiles(thread.id);
				}),
			);

			await rovoAppThreadManager.deleteAllThreads();
			await rovoAppVoteManager.deleteAllVotes();
			await rovoAppDocumentManager.deleteAllDocuments();
			await rovoAppUploadManager.deleteAllUploads();

			return res.status(200).json({ deleted: true });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to delete all threads:", error);
			return res.status(500).json({ error: "Failed to delete all Rovo threads" });
		}
	});

	router.get("/rovo/threads/:threadId", async (req, res) => {
		try {
			const thread = await maybeMigratePersistedThreadBrowserScreenshots(
				await reconcileOrphanedThread(
					await rovoAppThreadManager.getThread(req.params.threadId),
				),
			);
			if (!thread) {
				return res.status(404).json({ error: "Thread not found" });
			}

			return res.status(200).json({ thread });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to load thread:", error);
			return res.status(500).json({ error: "Failed to load Rovo thread" });
		}
	});

	router.put("/rovo/threads/:threadId", async (req, res) => {
		try {
			const {
				title,
				messages,
				realtimeMessages,
				visibility,
				modelId,
				provider,
				activeDocumentId,
				sessionId,
				sessionMode,
				updatedAt,
			} = req.body || {};
			const persistedMessages =
				messages !== undefined
					? await persistMessageFiles(req.params.threadId, messages)
					: undefined;
			const thread = await rovoAppThreadManager.updateThread(req.params.threadId, {
				title,
				messages: persistedMessages,
				realtimeMessages,
				visibility,
				modelId,
				provider,
				activeDocumentId,
				sessionId,
				sessionMode,
				updatedAt,
			});
			if (!thread) {
				return res.status(404).json({ error: "Thread not found" });
			}

			return res.status(200).json({ thread });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to update thread:", error);
			return res.status(500).json({ error: "Failed to update Rovo thread" });
		}
	});

	router.post("/rovo/detach", async (req, res) => {
		try {
			const threadId = getString(req.body?.threadId);
			if (!threadId) {
				return res.status(400).json({ error: "threadId is required" });
			}
			const run = rovoAppRunManager.getRun(threadId);
			if (!run) {
				return res.status(404).json({ error: "No active stream for threadId" });
			}
			rovoAppRunManager.setRunStatus(
				threadId,
				run.status === "queued" ? "queued" : "background",
			);
			await persistRunState(threadId, rovoAppRunManager.getRun(threadId));
			return res.status(200).json({ detached: true });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to detach stream:", error);
			return res.status(500).json({ error: "Failed to detach stream" });
		}
	});

	router.get("/rovo/background-streams", async (_req, res) => {
		try {
			const streams = rovoAppRunManager.listRuns();
			return res.status(200).json({ streams });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to list background streams:", error);
			return res.status(500).json({ error: "Failed to list background streams" });
		}
	});

	router.get("/rovo/runs/:threadId/stream", async (req, res) => {
		try {
			const threadId = getString(req.params.threadId);
			if (!threadId) {
				return res.status(400).json({ error: "threadId is required" });
			}

			const subscriberId = rovoAppRunManager.attachSubscriber(threadId, res, {
				onDetached: (run) => {
					if (!run) {
						return;
					}
					void persistRunState(threadId, run);
				},
			});
			if (!subscriberId) {
				return res.status(404).json({ error: "No active run for threadId" });
			}

			await persistRunState(threadId, rovoAppRunManager.getRun(threadId));
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to attach run stream:", error);
			return res.status(500).json({ error: "Failed to attach Rovo run stream" });
		}
	});

	router.post("/rovo/runs/:threadId/detach", async (req, res) => {
		try {
			const threadId = getString(req.params.threadId);
			if (!threadId) {
				return res.status(400).json({ error: "threadId is required" });
			}

			const run = rovoAppRunManager.getRun(threadId);
			if (!run) {
				return res.status(404).json({ error: "No active run for threadId" });
			}

			rovoAppRunManager.setRunStatus(
				threadId,
				run.status === "queued" ? "queued" : "background",
			);
			await persistRunState(threadId, rovoAppRunManager.getRun(threadId));
			return res.status(200).json({ detached: true });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to detach run:", error);
			return res.status(500).json({ error: "Failed to detach Rovo run" });
		}
	});

	router.post("/rovo/runs/:threadId/cancel", async (req, res) => {
		try {
			const threadId = getString(req.params.threadId);
			if (!threadId) {
				return res.status(400).json({ error: "threadId is required" });
			}

			const run = rovoAppRunManager.getRun(threadId);
			if (!run) {
				return res.status(404).json({ error: "No active run for threadId" });
			}

			if (typeof run.rovoPort === "number" && run.rovoPort > 0) {
				await cancelChat(run.rovoPort).catch(() => {});
			}

			rovoAppRunManager.cancelRun(threadId);
			await clearRunState(threadId);
			void startNextQueuedRun();
			return res.status(200).json({ cancelled: true });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to cancel run:", error);
			return res.status(500).json({ error: "Failed to cancel Rovo run" });
		}
	});

	router.get("/rovo/threads/:threadId/browser-workspace", async (req, res) => {
		try {
			const threadId = getString(req.params.threadId);
			if (!threadId) {
				return res.status(400).json({ error: "threadId is required" });
			}

			const workspace = await getThreadBrowserWorkspace({ threadId });
			if (!workspace) {
				return res.status(404).json({ error: "Browser workspace not found" });
			}

			return res.status(200).json(workspace.state);
		} catch (error) {
			logger.error?.("[ROVO-BROWSER] Failed to read thread browser workspace:", error);
			return res.status(500).json({ error: "Failed to read thread browser workspace" });
		}
	});

	router.post("/rovo/threads/:threadId/browser-workspace", requireRuntimeAdmin, async (req, res) => {
		try {
			const threadId = getString(req.params.threadId);
			if (!threadId) {
				return res.status(400).json({ error: "threadId is required" });
			}

			const defaultUrl = getString(req.body?.defaultUrl);
			const workspace = await ensureThreadBrowserWorkspace({
				defaultUrl: defaultUrl || undefined,
				threadId,
			});

			return res.status(workspace.created ? 201 : 200).json(workspace.state);
		} catch (error) {
			logger.error?.("[ROVO-BROWSER] Failed to ensure thread browser workspace:", error);
			return res.status(500).json({
				error: "Failed to ensure thread browser workspace",
				...(error instanceof Error && error.message
					? {
						details: error.message,
					}
					: {}),
			});
		}
	});

	router.delete("/rovo/threads/:threadId/browser-workspace", requireRuntimeAdmin, async (req, res) => {
		try {
			const threadId = getString(req.params.threadId);
			if (!threadId) {
				return res.status(400).json({ error: "threadId is required" });
			}

			const sessionResult = await deleteThreadBrowserWorkspace(threadId);
			return res.status(200).json(sessionResult);
		} catch (error) {
			logger.error?.("[ROVO-BROWSER] Failed to delete thread browser workspace:", error);
			return res.status(500).json({ error: "Failed to delete thread browser workspace" });
		}
	});

	router.delete("/rovo/threads/:threadId", async (req, res) => {
		try {
			const threadId = req.params.threadId;
			const activeRun = rovoAppRunManager.getRun(threadId);
			if (activeRun) {
				if (typeof activeRun.rovoPort === "number" && activeRun.rovoPort > 0) {
					await cancelChat(activeRun.rovoPort).catch(() => {});
				}
				rovoAppRunManager.cancelRun(threadId);
			}
			const thread = await rovoAppThreadManager.getThread(threadId);
			const uploadIds = collectUploadIdsFromMessages(thread?.messages);
			if (thread) {
				await generatedFilesManager.backfillFromThread(thread);
				await generatedFilesManager.deleteLegacyRootFiles(threadId);
				await deleteThreadBrowserWorkspace(threadId).catch(() => ({}));
				await destroyMirrorBrowser(`mirror-${threadId}`);
			}
			await Promise.all(
				uploadIds.map((uploadId) =>
					rovoAppUploadManager.deleteUpload(uploadId).catch(() => {})
				)
			);
			await rovoAppVoteManager.deleteVotesForThread(threadId);
			await rovoAppDocumentManager.deleteDocumentsByThread(threadId);
			await rovoAppThreadManager.deleteThread(threadId);
			return res.status(200).json({ deleted: true });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to delete thread:", error);
			return res.status(500).json({ error: "Failed to delete Rovo thread" });
		}
	});

	router.get("/rovo/votes", async (req, res) => {
		try {
			const rawThreadId = Array.isArray(req.query.threadId) ? req.query.threadId[0] : req.query.threadId;
			const threadId = getString(rawThreadId);
			if (!threadId) {
				return res.status(400).json({ error: "threadId is required" });
			}

			const votes = await rovoAppVoteManager.listVotes(threadId);
			return res.status(200).json({ votes });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to list votes:", error);
			return res.status(500).json({ error: "Failed to list Rovo votes" });
		}
	});

	router.patch("/rovo/votes", async (req, res) => {
		try {
			const { threadId: rawThreadId, messageId: rawMessageId, value } = req.body || {};
			const threadId = getString(rawThreadId);
			const messageId = getString(rawMessageId);
			if (!threadId || !messageId) {
				return res.status(400).json({ error: "threadId and messageId are required" });
			}

			const vote = await rovoAppVoteManager.setVote({
				threadId,
				messageId,
				value: value === "up" || value === "down" ? value : null,
			});
			return res.status(200).json({ vote });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to update vote:", error);
			return res.status(500).json({ error: "Failed to update Rovo vote" });
		}
	});

	router.get("/rovo/documents", async (req, res) => {
		try {
			const rawThreadId = Array.isArray(req.query.threadId) ? req.query.threadId[0] : req.query.threadId;
			const rawDocumentId = Array.isArray(req.query.documentId) ? req.query.documentId[0] : req.query.documentId;
			const threadId = getString(rawThreadId);
			const documentId = getString(rawDocumentId);

			if (documentId) {
				const document = await rovoAppDocumentManager.getDocument(documentId);
				if (!document) {
					return res.status(404).json({ error: "Document not found" });
				}
				return res.status(200).json({ document });
			}

			const documents = await rovoAppDocumentManager.listDocuments({ threadId: threadId || undefined });
			return res.status(200).json({ documents });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to list documents:", error);
			return res.status(500).json({ error: "Failed to load Rovo documents" });
		}
	});

	router.post("/rovo/documents", async (req, res) => {
		try {
			const {
				changeLabel,
				documentId,
				threadId,
				title,
				kind,
				content,
				sourceMessageId,
			} = req.body || {};
			if (typeof documentId === "string" && documentId.trim()) {
				if (typeof content === "string") {
					const document = await rovoAppDocumentManager.appendDocumentVersion(documentId, {
						changeLabel,
						title,
						kind,
						content,
					});
					if (!document) {
						return res.status(404).json({ error: "Document not found" });
					}
					return res.status(200).json({ document });
				}

				const document = await rovoAppDocumentManager.patchDocumentMetadata(documentId, {
					sourceMessageId,
				});
				if (!document) {
					return res.status(404).json({ error: "Document not found" });
				}
				return res.status(200).json({ document });
			}

			if (typeof threadId !== "string" || !threadId.trim()) {
				return res.status(400).json({ error: "threadId is required" });
			}

			const document = await rovoAppDocumentManager.createDocument({
				changeLabel,
				threadId,
				title,
				kind,
				content,
				sourceMessageId,
			});
			return res.status(201).json({ document });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to save document:", error);
			return res.status(500).json({ error: "Failed to save Rovo document" });
		}
	});

	router.delete("/rovo/documents", async (req, res) => {
		try {
			const rawDocumentId = Array.isArray(req.query.documentId) ? req.query.documentId[0] : req.query.documentId;
			const documentId = getString(rawDocumentId);
			if (!documentId) {
				return res.status(400).json({ error: "documentId is required" });
			}

			await rovoAppDocumentManager.deleteDocument(documentId);
			return res.status(200).json({ deleted: true });
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to delete document:", error);
			return res.status(500).json({ error: "Failed to delete Rovo document" });
		}
	});

	router.post("/rovo/files/upload", async (req, res) => {
		try {
			const { name, mediaType, dataUrl, threadId } = req.body || {};
			if (typeof dataUrl !== "string" || !dataUrl.trim()) {
				return res.status(400).json({ error: "dataUrl is required" });
			}

			const upload = await rovoAppUploadManager.createUploadFromDataUrl({
				threadId: getString(threadId) || undefined,
				filename: typeof name === "string" && name.trim() ? name : "attachment.bin",
				mediaType: typeof mediaType === "string" && mediaType.trim() ? mediaType : undefined,
				dataUrl,
			});
			return res.status(201).json({
				file: {
					id: upload.id,
					filename: upload.filename,
					mediaType: upload.mediaType,
					sizeBytes: upload.sizeBytes,
					url: buildFileUrl(upload.id),
				},
			});
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to upload file:", error);
			const message = error instanceof Error ? error.message : "Failed to upload file";
			return res.status(400).json({ error: message });
		}
	});

	router.get("/rovo/files/:fileId", async (req, res) => {
		try {
			const upload = await rovoAppUploadManager.getUpload(req.params.fileId);
			if (!upload) {
				return res.status(404).json({ error: "File not found" });
			}

			res.setHeader("Content-Type", upload.mediaType || "application/octet-stream");
			res.setHeader("Content-Length", String(upload.sizeBytes || upload.buffer.length));
			res.setHeader(
				"Content-Disposition",
				`inline; filename="${upload.filename || "attachment.bin"}"`
			);
			return res.status(200).send(upload.buffer);
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to serve file:", error);
			return res.status(500).json({ error: "Failed to serve Rovo file" });
		}
	});

	router.get("/rovo/generated-media", async (req, res) => {
		try {
			const requestedPath = Array.isArray(req.query.path)
				? req.query.path[0]
				: req.query.path;
			const absolutePath = resolveGeneratedMediaAbsolutePathFn(
				projectRoot,
				requestedPath,
			);
			if (!absolutePath) {
				return res.status(400).json({ error: "Invalid generated media path" });
			}

			const contentType = inferGeneratedMediaContentTypeFn(requestedPath);
			if (!contentType) {
				return res.status(400).json({ error: "Unsupported generated media type" });
			}

			await fileAccess(absolutePath);
			res.setHeader("Content-Type", contentType);
			res.setHeader(
				"Content-Disposition",
				`inline; filename="${path.basename(absolutePath)}"`,
			);
			return res.sendFile(absolutePath);
		} catch (error) {
			if (error?.code === "ENOENT") {
				return res.status(404).json({ error: "Generated media file not found" });
			}

			logger.error?.("[FUTURE-CHAT] Failed to serve generated media:", error);
			return res.status(500).json({ error: "Failed to serve generated media" });
		}
	});

	return router;
}

function registerRovoAppRoutes(app, dependencies = {}) {
	app.use("/api", createRovoAppRouter(dependencies));
}

module.exports = {
	buildRovoAppFileUrl,
	buildRovoAppThreadSummary,
	createRovoAppRouter,
	createRovoAppThreadId,
	registerRovoAppRoutes,
};
