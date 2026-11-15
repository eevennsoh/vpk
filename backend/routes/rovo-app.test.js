"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const express = require("express");

const {
	buildRovoAppFileUrl,
	buildRovoAppThreadSummary,
	createRovoAppRouter,
	registerRovoAppRoutes,
} = require("./rovo-app");
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

test("rovo app router validates required dependencies", () => {
	assert.throws(() => createRovoAppRouter(), /rovoAppThreadManager/u);
	assert.throws(
		() => createRovoAppRouter(createDependencies({
			settleRun: null,
		})),
		/settleRun/u,
	);
	assert.throws(
		() => createRovoAppRouter(createDependencies({ requireRuntimeAdmin: null })),
		/requireRuntimeAdmin/u,
	);
});

test("rovo app helper defaults preserve existing shapes", () => {
	assert.match(buildRovoAppFileUrl("file id"), /^\/api\/rovo\/files\/file%20id$/u);
	assert.deepEqual(buildRovoAppThreadSummary({
		id: "thread-1",
		messages: [{ id: "m1" }],
		realtimeMessages: [{ id: "r1" }],
		title: "Thread",
	}), {
		id: "thread-1",
		title: "Thread",
	});
});

test("realtime message routes validate and persist messages", async () => {
	const dependencies = createDependencies();
	await dependencies.rovoAppThreadManager.createThread({ id: "thread-1", title: "Support" });

	await withServer(dependencies, async (baseUrl) => {
		const missingResponse = await fetch(`${baseUrl}/api/rovo/messages`);
		assert.equal(missingResponse.status, 400);
		assert.deepEqual(await missingResponse.json(), { error: "threadId is required" });

		const persistResponse = await fetch(`${baseUrl}/api/rovo/messages`, {
			body: JSON.stringify({
				threadId: "thread-1",
				message: { id: "message-1", role: "user", parts: [] },
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(persistResponse.status, 200);
		assert.deepEqual(await persistResponse.json(), {
			messages: [{ id: "message-1", role: "user", parts: [] }],
		});

		const loadResponse = await fetch(`${baseUrl}/api/rovo/messages?threadId=thread-1`);
		assert.equal(loadResponse.status, 200);
		assert.deepEqual(await loadResponse.json(), {
			messages: [{ id: "message-1", role: "user", parts: [] }],
		});
	});
});

test("thread routes create, summarize, update, and clean up thread resources", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;

	await withServer(dependencies, async (baseUrl) => {
		const createResponse = await fetch(`${baseUrl}/api/rovo/threads`, {
			body: JSON.stringify({
				title: "Architecture plan",
				messages: [{ id: "message-1", parts: [] }],
				modelId: "model-1",
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(createResponse.status, 201);
		const { thread } = await createResponse.json();
		assert.equal(thread.id, "generated-thread");
		assert.deepEqual(thread.messages, [{ id: "message-1", parts: [] }]);

		const listResponse = await fetch(`${baseUrl}/api/rovo/threads`);
		assert.equal(listResponse.status, 200);
		assert.deepEqual(await listResponse.json(), {
			threads: [{
				id: "generated-thread",
				owner: "local",
				title: "Architecture plan",
				modelId: "model-1",
			}],
		});

		const updateResponse = await fetch(`${baseUrl}/api/rovo/threads/generated-thread`, {
			body: JSON.stringify({ title: "Updated plan" }),
			headers: { "content-type": "application/json" },
			method: "PUT",
		});
		assert.equal(updateResponse.status, 200);
		assert.equal((await updateResponse.json()).thread.title, "Updated plan");

		state.runs.set("generated-thread", {
			id: "run-generated",
			threadId: "generated-thread",
			status: "streaming",
			rovoPort: 8123,
		});
		state.threads.set("generated-thread", {
			...state.threads.get("generated-thread"),
			messages: [{ parts: [{ type: "file", url: "/api/rovo/files/upload-1" }] }],
		});

		const deleteResponse = await fetch(`${baseUrl}/api/rovo/threads/generated-thread`, {
			method: "DELETE",
		});
		assert.equal(deleteResponse.status, 200);
		assert.deepEqual(await deleteResponse.json(), { deleted: true });
		assert.equal(state.threads.has("generated-thread"), false);
		assert.deepEqual(state.calls.filter((call) => [
			"backfillFromThread",
			"deleteLegacyRootFiles",
			"cancelChat",
			"settleRun",
			"deleteDocumentsByThread",
			"deleteThread",
			"deleteThreadBrowserWorkspace",
			"deleteUpload",
			"deleteVotesForThread",
			"destroyMirrorBrowser",
		].includes(call.method)), [
			{ method: "cancelChat", port: 8123 },
			{ method: "settleRun", runId: "run-generated", threadId: "generated-thread", outcome: "cancelled" },
			{ method: "deleteLegacyRootFiles", threadId: "generated-thread" },
			{ method: "deleteThreadBrowserWorkspace", threadId: "generated-thread" },
			{ method: "destroyMirrorBrowser", mirrorId: "mirror-generated-thread" },
			{ method: "deleteUpload", uploadId: "upload-1" },
			{ method: "deleteVotesForThread", threadId: "generated-thread" },
			{ method: "deleteDocumentsByThread", threadId: "generated-thread" },
			{ method: "deleteThread", threadId: "generated-thread" },
		]);
	});
});

test("run and browser workspace mutation routes preserve status and admin behavior", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	state.runs.set("thread-1", { threadId: "thread-1", status: "streaming", rovoPort: 9123 });

	await withServer(dependencies, async (baseUrl) => {
		const detachResponse = await fetch(`${baseUrl}/api/rovo/runs/thread-1/detach`, {
			method: "POST",
		});
		assert.equal(detachResponse.status, 200);
		assert.deepEqual(await detachResponse.json(), { detached: true });
		assert.equal(state.runs.get("thread-1").status, "background");

		const blockedResponse = await fetch(`${baseUrl}/api/rovo/threads/thread-1/browser-workspace`, {
			body: JSON.stringify({ defaultUrl: "https://example.test" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(blockedResponse.status, 403);

		const workspaceResponse = await fetch(`${baseUrl}/api/rovo/threads/thread-1/browser-workspace`, {
			body: JSON.stringify({ defaultUrl: "https://example.test" }),
			headers: {
				"content-type": "application/json",
				"x-runtime-admin": "ok",
			},
			method: "POST",
		});
		assert.equal(workspaceResponse.status, 201);
		assert.deepEqual(await workspaceResponse.json(), {
			defaultUrl: "https://example.test",
			threadId: "thread-1",
			workspaceId: "browser-thread-1",
		});

		const cancelResponse = await fetch(`${baseUrl}/api/rovo/runs/thread-1/cancel`, {
			method: "POST",
		});
		assert.equal(cancelResponse.status, 200);
		assert.deepEqual(await cancelResponse.json(), { cancelled: true });
		assert.equal(state.runs.has("thread-1"), false);
		assert.ok(state.calls.some((call) => call.method === "settleRun" && call.threadId === "thread-1" && call.outcome === "cancelled"));
	});
});

test("checkpoint routes keep runtime admin protection", async () => {
	const dependencies = createDependencies();

	await withServer(dependencies, async (baseUrl) => {
		const blockedResponse = await fetch(`${baseUrl}/api/checkpoints`, {
			body: JSON.stringify({ name: "release" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(blockedResponse.status, 403);

		const createResponse = await fetch(`${baseUrl}/api/checkpoints`, {
			body: JSON.stringify({ description: "Ready", name: "release" }),
			headers: {
				"content-type": "application/json",
				"x-runtime-admin": "ok",
			},
			method: "POST",
		});
		assert.equal(createResponse.status, 201);
		const checkpoint = (await createResponse.json()).checkpoint;
		assert.equal(checkpoint.name, "release");

		const listResponse = await fetch(`${baseUrl}/api/checkpoints`);
		assert.equal(listResponse.status, 200);
		assert.deepEqual(await listResponse.json(), { checkpoints: [checkpoint] });
	});
});

test("session search, votes, documents, files, and generated media preserve response shapes", async () => {
	const projectRoot = mkdtempSync(path.join(os.tmpdir(), "rovo-app-media-"));
	try {
		mkdirSync(path.join(projectRoot, "media/videos/demo"), { recursive: true });
		writeFileSync(path.join(projectRoot, "media/videos/demo/sample.mp4"), "video");

		const dependencies = createDependencies({ projectRoot });
		await dependencies.rovoAppThreadManager.createThread({
			id: "thread-1",
			title: "Architecture cleanup",
		});

		await withServer(dependencies, async (baseUrl) => {
			const searchResponse = await fetch(`${baseUrl}/api/sessions/search?q=cleanup&limit=1`);
			assert.equal(searchResponse.status, 200);
			assert.deepEqual(await searchResponse.json(), {
				results: [{ id: "thread-1", title: "Architecture cleanup" }],
			});

			const voteResponse = await fetch(`${baseUrl}/api/rovo/votes`, {
				body: JSON.stringify({ messageId: "message-1", threadId: "thread-1", value: "up" }),
				headers: { "content-type": "application/json" },
				method: "PATCH",
			});
			assert.equal(voteResponse.status, 200);
			assert.deepEqual(await voteResponse.json(), {
				vote: { messageId: "message-1", threadId: "thread-1", value: "up" },
			});

			const documentResponse = await fetch(`${baseUrl}/api/rovo/documents`, {
				body: JSON.stringify({
					content: "Draft",
					kind: "markdown",
					threadId: "thread-1",
					title: "Plan",
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			});
			assert.equal(documentResponse.status, 201);
			const document = (await documentResponse.json()).document;
			assert.equal(document.title, "Plan");

			const uploadResponse = await fetch(`${baseUrl}/api/rovo/files/upload`, {
				body: JSON.stringify({
					dataUrl: `data:text/plain;base64,${Buffer.from("hello").toString("base64")}`,
					mediaType: "text/plain",
					name: "hello.txt",
					threadId: "thread-1",
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			});
			assert.equal(uploadResponse.status, 201);
			const file = (await uploadResponse.json()).file;
			assert.equal(file.url, "/api/rovo/files/upload-1");

			const fileResponse = await fetch(`${baseUrl}${file.url}`);
			assert.equal(fileResponse.status, 200);
			assert.equal(fileResponse.headers.get("content-type"), "text/plain; charset=utf-8");
			assert.equal(await fileResponse.text(), "hello");

			const mediaResponse = await fetch(
				`${baseUrl}/api/rovo/generated-media?path=${encodeURIComponent("media/videos/demo/sample.mp4")}`,
			);
			assert.equal(mediaResponse.status, 200);
			assert.equal(mediaResponse.headers.get("content-type"), "video/mp4");
			assert.equal(await mediaResponse.text(), "video");
		});
	} finally {
		rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("thread and upload ids that could leave their directory are rejected with 400 before any manager runs", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	const hostileIds = ["..%2F..%2F..%2F..", "..%2Fx", ".git", "a%5Cb", "%2Fetc", "x".repeat(200)];
	const expected = (field) => ({ error: `Invalid ${field}.`, code: "INVALID_INPUT" });

	await withServer(dependencies, async (baseUrl) => {
		const json = (method, body) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
		for (const id of hostileIds) {
			for (const [route, init] of [
				[`/api/rovo/threads/${id}`, { method: "DELETE" }],
				[`/api/rovo/threads/${id}`, { method: "GET" }],
				[`/api/rovo/threads/${id}`, json("PUT", { title: "x" })],
				[`/api/rovo/runs/${id}/cancel`, { method: "POST" }],
				[`/api/rovo/threads/${id}/browser-workspace`, { method: "GET" }],
			]) {
				const response = await fetch(`${baseUrl}${route}`, init);
				assert.equal(response.status, 400, `${init.method} ${route}`);
				assert.deepEqual(await response.json(), expected("threadId"), `${init.method} ${route}`);
			}
			const fileResponse = await fetch(`${baseUrl}/api/rovo/files/${id}`);
			assert.equal(fileResponse.status, 400, `file ${id}`);
			assert.deepEqual(await fileResponse.json(), expected("fileId"));
		}

		const decoded = ["../../../..", "/etc", "a\\b", 42, { id: "x" }];
		for (const threadId of decoded) {
			for (const [route, init] of [
				["/api/rovo/votes", json("PATCH", { threadId, messageId: "m1", value: "up" })],
				["/api/rovo/documents", json("POST", { threadId, title: "t", content: "c", kind: "text" })],
				["/api/rovo/files/upload", json("POST", { threadId, name: "a.png", mediaType: "image/png", dataUrl: "data:image/png;base64,AA==" })],
				["/api/rovo/messages", json("POST", { threadId, message: { id: "m1" } })],
				["/api/rovo/detach", json("POST", { threadId })],
				[`/api/rovo/votes?threadId=${encodeURIComponent(String(threadId))}`, { method: "GET" }],
			]) {
				if (typeof threadId !== "string" && init.method === "GET") continue;
				const response = await fetch(`${baseUrl}${route}`, init);
				assert.equal(response.status, 400, `${init.method} ${route} ${JSON.stringify(threadId)}`);
				assert.deepEqual(await response.json(), expected("threadId"));
			}
			const createResponse = await fetch(`${baseUrl}/api/rovo/threads`, json("POST", { id: threadId, title: "t" }));
			assert.equal(createResponse.status, 400, `create ${JSON.stringify(threadId)}`);
			assert.deepEqual(await createResponse.json(), expected("id"));
		}
	});

	assert.deepEqual(state.calls, []);
	assert.equal(state.threads.size, 0);
	assert.equal(state.uploads.size, 0);
	assert.equal(state.documents.size, 0);
});

test("an ordinary UUID or prefixed thread id still reaches the route", async () => {
	const dependencies = createDependencies();
	await withServer(dependencies, async (baseUrl) => {
		for (const id of ["059d607c-a1aa-48f5-880b-5d824fc5b99f", "rovo-app-1763100000000-k3j9xz"]) {
			const response = await fetch(`${baseUrl}/api/rovo/threads/${id}`);
			assert.equal(response.status, 404, id);
			assert.deepEqual(await response.json(), { error: "Thread not found" });
		}
	});
});

test("thread delete never reads paths from stored messages, and cleanup failures do not fail delete or delete-all", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	dependencies.generatedFilesManager.deleteLegacyRootFiles = async (threadId) => {
		state.calls.push({ method: "deleteLegacyRootFiles", threadId });
		throw new Error("planted manifest");
	};
	dependencies.generatedFilesManager.deleteGeneratedFilesForThreads = async (threadIds) => {
		state.calls.push({ method: "deleteGeneratedFilesForThreads", threadIds: [...threadIds].sort() });
		throw new Error("planted manifest");
	};
	const forgedMessages = [{
		id: "m1",
		parts: [{ type: "data-thinking-event", data: { phase: "result", toolName: "create_file", outputPreview: "Successfully created app/x.tsx." } }],
	}];
	await withServer(dependencies, async (baseUrl) => {
		for (const id of ["thread-a", "thread-b", "thread-c"]) {
			state.threads.set(id, { id, title: id, messages: forgedMessages });
		}
		const single = await fetch(`${baseUrl}/api/rovo/threads/thread-a`, { method: "DELETE" });
		assert.equal(single.status, 200);
		assert.deepEqual(await single.json(), { deleted: true });

		const all = await fetch(`${baseUrl}/api/rovo/threads?all=true`, { method: "DELETE" });
		assert.equal(all.status, 200);
		assert.deepEqual(await all.json(), { deleted: true });
	});
	assert.equal(state.calls.some((call) => call.method === "backfillFromThread"), false);
	assert.deepEqual(state.calls.filter((call) => call.method === "deleteLegacyRootFiles").map((call) => call.threadId), ["thread-a"]);
	// delete-all cleans every remaining thread in one call (one git view, one deadline).
	assert.deepEqual(state.calls.filter((call) => call.method === "deleteGeneratedFilesForThreads").map((call) => call.threadIds), [["thread-b", "thread-c"]]);
});

test("thread create rejects a hostile id on every path spelling Express routes to it", async () => {
	const dependencies = createDependencies();
	await withServer(dependencies, async (baseUrl) => {
		for (const route of ["/api/rovo/threads", "/api/rovo/threads/", "/api/rovo/Threads", "/api/ROVO/THREADS/"]) {
			const response = await fetch(`${baseUrl}${route}`, {
				body: JSON.stringify({ id: "../../outside", title: "t" }),
				headers: { "content-type": "application/json" },
				method: "POST",
			});
			assert.equal(response.status, 400, route);
			assert.deepEqual(await response.json(), { error: "Invalid id.", code: "INVALID_INPUT" }, route);
		}
	});
	assert.equal(dependencies.state.threads.size, 0);
});

test("an uploaded HTML file is served as a sandboxed download, an SVG or image inline under the sandbox", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	const script = "<script>document.title='ran'</script>";
	state.uploads.set("upload-html", { id: "upload-html", buffer: Buffer.from(script), filename: "page.html", mediaType: "text/html", sizeBytes: script.length });
	const styledSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><style>.dot{fill:#c00}</style><circle class="dot" cx="5" cy="5" r="4" style="stroke:#00c"/></svg>';
	state.uploads.set("upload-svg", { id: "upload-svg", buffer: Buffer.from(styledSvg), filename: "logo.svg", mediaType: "image/svg+xml", sizeBytes: styledSvg.length });
	state.uploads.set("upload-png", { id: "upload-png", buffer: Buffer.from("png"), filename: "shot.png", mediaType: "image/png", sizeBytes: 3 });
	await withServer(dependencies, async (baseUrl) => {
		for (const id of ["upload-html"]) {
			const response = await fetch(`${baseUrl}/api/rovo/files/${id}`);
			assert.equal(response.status, 200, id);
			assert.equal(response.headers.get("content-type"), "application/octet-stream", id);
			assert.match(response.headers.get("content-disposition"), /^attachment;/u, id);
			assert.match(response.headers.get("content-security-policy"), /^sandbox;/u, id);
			assert.equal(response.headers.get("x-content-type-options"), "nosniff", id);
			await response.arrayBuffer();
		}
		for (const [id, type] of [["upload-png", "image/png"], ["upload-svg", "image/svg+xml"]]) {
			const image = await fetch(`${baseUrl}/api/rovo/files/${id}`);
			assert.equal(image.headers.get("content-type"), type, id);
			assert.match(image.headers.get("content-disposition"), /^inline;/u, id);
			assert.match(image.headers.get("content-security-policy"), /^sandbox;/u, id);
			assert.equal(image.headers.get("x-content-type-options"), "nosniff", id);
			assert.match(image.headers.get("content-security-policy"), /(?:^|; )style-src 'unsafe-inline'(?:;|$)/u, id);
			const body = await image.text();
			if (id === "upload-svg") {
				assert.equal(body, styledSvg, "the styled SVG is served unchanged");
			}
		}
	});
});

test("reading a thread's browser workspace needs runtime admin in production", async () => {
	const { createRuntimeAdminControls } = require("../middleware/runtime-admin");
	const { requireRuntimeAdmin } = createRuntimeAdminControls({
		allowedOrigins: [],
		consoleImpl: { error() {}, log() {}, warn() {} },
		env: { NODE_ENV: "production", VPK_RUNTIME_ADMIN_TOKEN: "test-admin-token" },
	});
	const dependencies = createDependencies({ requireRuntimeAdmin });
	let reads = 0;
	const getThreadBrowserWorkspace = dependencies.getThreadBrowserWorkspace;
	dependencies.getThreadBrowserWorkspace = (options) => {
		reads += 1;
		return getThreadBrowserWorkspace(options);
	};
	await withServer(dependencies, async (baseUrl) => {
		const url = `${baseUrl}/api/rovo/threads/thread-1/browser-workspace`;
		const anonymous = await fetch(url);
		assert.equal(anonymous.status, 403);
		assert.equal(reads, 0);
		const admin = await fetch(url, { headers: { "x-vpk-runtime-admin-token": "test-admin-token" } });
		assert.equal(admin.status, 200);
		assert.deepEqual(await admin.json(), { threadId: "thread-1", workspaceId: "browser-thread-1" });
	});
});

test("cancelling a run that was replaced while Rovo's cancel was awaited reports cancelled false", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	const original = { id: "run-original", threadId: "thread-1", status: "streaming", rovoPort: 9124 };
	const replacement = { id: "run-replacement", threadId: "thread-1", status: "streaming", rovoPort: 9125 };
	state.runs.set("thread-1", original);
	dependencies.cancelChat = async () => {
		state.runs.set("thread-1", replacement);
	};

	await withServer(dependencies, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/rovo/runs/thread-1/cancel`, { method: "POST" });
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { cancelled: false });
		assert.equal(state.runs.get("thread-1"), replacement);
		assert.ok(state.calls.some((call) => call.method === "settleRun" && call.runId === "run-original"));
	});
});

const PRODUCTION_ENV = Object.freeze({ NODE_ENV: "production" });
const as = (subject, init = {}) => ({ ...init, headers: { ...(init.headers || {}), "x-slauth-subject": subject } });
const jsonAs = (subject, method, body) => as(subject, {
	method,
	headers: { "content-type": "application/json" },
	body: JSON.stringify(body),
});

test("in production a request without X-Slauth-Subject gets 401 and reaches no manager", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	state.threads.set("thread-a", { id: "thread-a", owner: "alice", title: "Alice" });
	await withServer(dependencies, async (baseUrl) => {
		for (const [route, init] of [
			["/api/rovo/threads", {}],
			["/api/rovo/threads/thread-a", {}],
			["/api/rovo/threads/thread-a", { method: "DELETE" }],
			["/api/rovo/threads?all=true", { method: "DELETE" }],
			["/api/sessions/search?q=alice", {}],
		]) {
			const response = await fetch(`${baseUrl}${route}`, init);
			assert.equal(response.status, 401, `${init.method || "GET"} ${route}`);
			assert.deepEqual(await response.json(), { error: "Authentication required", code: "CALLER_IDENTITY_REQUIRED" });
		}
	}, { env: PRODUCTION_ENV });
	assert.deepEqual(state.calls, []);
	assert.equal(state.threads.size, 1);
});

test("in production each caller lists, reads, updates, and deletes only their own threads", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	state.threads.set("thread-a", { id: "thread-a", owner: "alice", title: "Alice plan" });
	state.threads.set("thread-b", { id: "thread-b", owner: "bob", title: "Bob plan" });
	state.threads.set("thread-legacy", { id: "thread-legacy", title: "Legacy plan" });
	await withServer(dependencies, async (baseUrl) => {
		const list = await fetch(`${baseUrl}/api/rovo/threads`, as("alice"));
		assert.deepEqual((await list.json()).threads.map((thread) => thread.id), ["thread-a"]);

		const search = await fetch(`${baseUrl}/api/sessions/search?q=plan`, as("alice"));
		assert.deepEqual((await search.json()).results.map((result) => result.id), ["thread-a"]);

		for (const [route, init] of [
			["/api/rovo/threads/thread-b", as("alice")],
			["/api/rovo/threads/thread-legacy", as("alice")],
			["/api/rovo/threads/thread-b", jsonAs("alice", "PUT", { title: "Taken" })],
			["/api/rovo/threads/thread-b", as("alice", { method: "DELETE" })],
			["/api/rovo/messages?threadId=thread-b", as("alice")],
			["/api/rovo/votes?threadId=thread-b", as("alice")],
			["/api/rovo/runs/thread-b/cancel", as("alice", { method: "POST" })],
		]) {
			const response = await fetch(`${baseUrl}${route}`, init);
			assert.equal(response.status, 404, `${init.method || "GET"} ${route}`);
			assert.deepEqual(await response.json(), { error: "Thread not found" });
		}
		assert.equal(state.threads.get("thread-b").title, "Bob plan");

		const own = await fetch(`${baseUrl}/api/rovo/threads/thread-a`, as("alice"));
		assert.equal(own.status, 200);
		assert.equal((await own.json()).thread.title, "Alice plan");

		const overwrite = await fetch(`${baseUrl}/api/rovo/threads`, jsonAs("alice", "POST", { id: "thread-b", title: "Mine now" }));
		assert.equal(overwrite.status, 409);
		assert.equal(state.threads.get("thread-b").owner, "bob");

		const created = await fetch(`${baseUrl}/api/rovo/threads`, jsonAs("alice", "POST", { id: "thread-a2", title: "New" }));
		assert.equal(created.status, 201);
		assert.equal((await created.json()).thread.owner, "alice");

		const deleteAll = await fetch(`${baseUrl}/api/rovo/threads?all=true`, as("alice", { method: "DELETE" }));
		assert.equal(deleteAll.status, 200);
	}, { env: PRODUCTION_ENV });
	// Alice's delete-all removed only her threads, never the stores wholesale.
	assert.deepEqual([...state.threads.keys()].sort(), ["thread-b", "thread-legacy"]);
	assert.equal(state.calls.some((call) => ["deleteAllThreads", "deleteAllVotes", "deleteAllDocuments", "deleteAllUploads"].includes(call.method)), false);
	assert.deepEqual(state.calls.filter((call) => call.method === "deleteThread").map((call) => call.threadId).sort(), ["thread-a", "thread-a2"]);
});

test("in production delete-all never clears the stores whole, even when every stored thread is the caller's", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	state.threads.set("thread-a", { id: "thread-a", owner: "alice", title: "Alice" });
	// Bob's upload has no thread yet; clearing the upload store would take it too.
	state.uploads.set("upload-bob", { id: "upload-bob", owner: "bob", threadId: "_orphaned", buffer: Buffer.from("x") });
	await withServer(dependencies, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/rovo/threads?all=true`, as("alice", { method: "DELETE" }));
		assert.equal(response.status, 200);
	}, { env: PRODUCTION_ENV });
	assert.equal(state.calls.some((call) => ["deleteAllThreads", "deleteAllVotes", "deleteAllDocuments", "deleteAllUploads"].includes(call.method)), false);
	assert.deepEqual([...state.threads.keys()], []);
	assert.ok(state.uploads.has("upload-bob"));
});

test("in production list and search filter by owner before the limit", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	// Newest first: Bob's threads would fill a limit taken before the owner filter.
	for (let index = 0; index < 3; index += 1) {
		state.threads.set(`thread-b${index}`, { id: `thread-b${index}`, owner: "bob", title: "Bob plan" });
	}
	state.threads.set("thread-a", { id: "thread-a", owner: "alice", title: "Alice plan" });
	await withServer(dependencies, async (baseUrl) => {
		const list = await fetch(`${baseUrl}/api/rovo/threads?limit=2`, as("alice"));
		assert.deepEqual((await list.json()).threads.map((thread) => thread.id), ["thread-a"]);
	}, { env: PRODUCTION_ENV });
});

test("in production documents, files, and background streams of another caller are hidden", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	state.threads.set("thread-a", { id: "thread-a", owner: "alice", title: "Alice" });
	state.threads.set("thread-b", { id: "thread-b", owner: "bob", title: "Bob" });
	state.documents.set("doc-a", { id: "doc-a", threadId: "thread-a", title: "A" });
	state.documents.set("doc-b", { id: "doc-b", threadId: "thread-b", title: "B" });
	state.documents.set("doc-orphan", { id: "doc-orphan", threadId: "thread-gone", title: "Orphan" });
	state.uploads.set("upload-b", { id: "upload-b", threadId: "thread-b", filename: "b.txt", mediaType: "text/plain", buffer: Buffer.from("b") });
	state.uploads.set("upload-legacy-loose", { id: "upload-legacy-loose", threadId: "_orphaned", filename: "d.txt", mediaType: "text/plain", buffer: Buffer.from("d") });
	state.runs.set("thread-a", { id: "run-a", threadId: "thread-a", status: "streaming" });
	state.runs.set("thread-b", { id: "run-b", threadId: "thread-b", status: "streaming" });
	await withServer(dependencies, async (baseUrl) => {
		// An upload with no thread is its uploader's (the route records the owner).
		const loose = await fetch(`${baseUrl}/api/rovo/files/upload`, jsonAs("bob", "POST", { dataUrl: "data:text/plain;base64,Yw==", name: "c.txt" }));
		const looseId = (await loose.json()).file.id;
		for (const documentId of ["doc-b", "doc-orphan"]) {
			const response = await fetch(`${baseUrl}/api/rovo/documents?documentId=${documentId}`, as("alice"));
			assert.equal(response.status, 404, documentId);
			assert.deepEqual(await response.json(), { error: "Document not found" });
		}
		const own = await fetch(`${baseUrl}/api/rovo/documents?documentId=doc-a`, as("alice"));
		assert.equal(own.status, 200);

		const documents = await fetch(`${baseUrl}/api/rovo/documents`, as("alice"));
		assert.deepEqual((await documents.json()).documents.map((document) => document.id), ["doc-a"]);

		for (const fileId of ["upload-b", looseId, "upload-legacy-loose"]) {
			const response = await fetch(`${baseUrl}/api/rovo/files/${fileId}`, as("alice"));
			assert.equal(response.status, 404, fileId);
			assert.deepEqual(await response.json(), { error: "File not found" });
		}
		const bobsLoose = await fetch(`${baseUrl}/api/rovo/files/${looseId}`, as("bob"));
		assert.equal(bobsLoose.status, 200);

		const streams = await fetch(`${baseUrl}/api/rovo/background-streams`, as("alice"));
		assert.deepEqual((await streams.json()).streams.map((run) => run.id), ["run-a"]);
	}, { env: PRODUCTION_ENV });
});

test("outside production the caller is the fixed owner local, who also sees threads stored without an owner", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	state.threads.set("thread-legacy", { id: "thread-legacy", title: "Legacy" });
	state.threads.set("thread-alice", { id: "thread-alice", owner: "alice", title: "Alice" });
	await withServer(dependencies, async (baseUrl) => {
		// A forged subject header changes nothing locally.
		const created = await fetch(`${baseUrl}/api/rovo/threads`, jsonAs("alice", "POST", { id: "thread-new", title: "New" }));
		assert.equal((await created.json()).thread.owner, "local");

		const list = await fetch(`${baseUrl}/api/rovo/threads`, as("alice"));
		assert.deepEqual((await list.json()).threads.map((thread) => thread.id).sort(), ["thread-legacy", "thread-new"]);

		const foreign = await fetch(`${baseUrl}/api/rovo/threads/thread-alice`);
		assert.equal(foreign.status, 404);
	}, { env: {} });
});
