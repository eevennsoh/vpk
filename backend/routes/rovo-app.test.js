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
		listThreads: async ({ limit } = {}) => {
			const threads = [...state.threads.values()];
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
		cancelRun: (threadId) => {
			state.calls.push({ method: "cancelRun", threadId });
			state.runs.delete(threadId);
		},
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
		createUploadFromDataUrl: async ({ dataUrl, filename, mediaType, threadId }) => {
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
		clearRunState: async (threadId) => {
			state.calls.push({ method: "clearRunState", threadId });
		},
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
		startNextQueuedRun: () => {
			state.calls.push({ method: "startNextQueuedRun" });
		},
		syncHermesJobsForRovoThreads: async (threadId = null) => {
			state.calls.push({ method: "syncHermesJobsForRovoThreads", threadId });
		},
		toThreadId: () => "generated-thread",
		...overrides,
	};
}

async function withServer(dependencies, run) {
	const app = express();
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
			rovoAppRunManager: { ...createRunManager(createState()), cancelRun: null },
		})),
		/rovoAppRunManager\.cancelRun/u,
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
			"cancelRun",
			"deleteDocumentsByThread",
			"deleteThread",
			"deleteThreadBrowserWorkspace",
			"deleteUpload",
			"deleteVotesForThread",
			"destroyMirrorBrowser",
		].includes(call.method)), [
			{ method: "cancelChat", port: 8123 },
			{ method: "cancelRun", threadId: "generated-thread" },
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
		assert.ok(state.calls.some((call) => call.method === "startNextQueuedRun"));
		assert.ok(state.calls.some((call) => call.method === "clearRunState"));
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
	assert.deepEqual(
		state.calls.filter((call) => call.method === "deleteLegacyRootFiles").map((call) => call.threadId).sort(),
		["thread-a", "thread-b", "thread-c"],
	);
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
||||||| 5ab0d9105

test("an uploaded HTML or SVG file is served as a sandboxed download, an image inline", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	const script = "<script>document.title='ran'</script>";
	state.uploads.set("upload-html", { id: "upload-html", buffer: Buffer.from(script), filename: "page.html", mediaType: "text/html", sizeBytes: script.length });
	state.uploads.set("upload-svg", { id: "upload-svg", buffer: Buffer.from("<svg onload='x()'/>"), filename: "logo.svg", mediaType: "image/svg+xml", sizeBytes: 19 });
	state.uploads.set("upload-png", { id: "upload-png", buffer: Buffer.from("png"), filename: "shot.png", mediaType: "image/png", sizeBytes: 3 });
	await withServer(dependencies, async (baseUrl) => {
		for (const id of ["upload-html", "upload-svg"]) {
			const response = await fetch(`${baseUrl}/api/rovo/files/${id}`);
			assert.equal(response.status, 200, id);
			assert.equal(response.headers.get("content-type"), "application/octet-stream", id);
			assert.match(response.headers.get("content-disposition"), /^attachment;/u, id);
			assert.match(response.headers.get("content-security-policy"), /^sandbox;/u, id);
			assert.equal(response.headers.get("x-content-type-options"), "nosniff", id);
			await response.arrayBuffer();
		}
		const image = await fetch(`${baseUrl}/api/rovo/files/upload-png`);
		assert.equal(image.headers.get("content-type"), "image/png");
		assert.match(image.headers.get("content-disposition"), /^inline;/u);
		assert.match(image.headers.get("content-security-policy"), /^sandbox;/u);
		await image.arrayBuffer();
	});
});
