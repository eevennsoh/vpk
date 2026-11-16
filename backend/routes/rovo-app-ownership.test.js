"use strict";

// Per-caller visibility on the Rovo app routes (lib/rovo-app-thread-ownership.js).

const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createGeneratedMediaOwnerStore, runWithGeneratedMediaScope } = require("../lib/generated-media-owners");
const { withCanonicalPreviewBody } = require("../lib/widget-preview-payload");
const { createDependencies, withServer } = require("./rovo-app-test-dependencies");

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

test("in production a generated video is served only to the caller whose turn generated it", async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "rovo-app-media-owner-"));
	const projectRoot = path.join(root, "project");
	try {
		mkdirSync(path.join(projectRoot, "media/videos/demo"), { recursive: true });
		for (const name of ["alice.mp4", "loose.mp4"]) {
			writeFileSync(path.join(projectRoot, `media/videos/demo/${name}`), `${name} video`);
		}
		const generatedMediaOwnerStore = createGeneratedMediaOwnerStore({ baseDir: path.join(root, "data"), projectRoot });
		// Alice's turn generated alice.mp4; loose.mp4 has no recorded owner (older than owners).
		assert.equal(generatedMediaOwnerStore.claim("./media/videos/demo/alice.mp4", "alice"), true);
		const dependencies = createDependencies({ generatedMediaOwnerStore, projectRoot });
		// Mentioning a path in your own thread does not make the video yours.
		dependencies.state.threads.set("thread-bob", {
			id: "thread-bob",
			owner: "bob",
			title: "Bob",
			messages: [{ role: "user", parts: [{ type: "text", text: "media/videos/demo/alice.mp4 /api/rovo/generated-media?path=media%2Fvideos%2Fdemo%2Falice.mp4" }] }],
		});
		const mediaUrl = (name) => `/api/rovo/generated-media?path=${encodeURIComponent(`media/videos/demo/${name}`)}`;
		await withServer(dependencies, async (baseUrl) => {
			for (const [subject, name] of [["bob", "alice.mp4"], ["alice", "loose.mp4"], ["bob", "loose.mp4"]]) {
				const response = await fetch(`${baseUrl}${mediaUrl(name)}`, as(subject));
				assert.equal(response.status, 404, `${subject} ${name}`);
				assert.deepEqual(await response.json(), { error: "Generated media file not found" });
			}
			const own = await fetch(`${baseUrl}${mediaUrl("alice.mp4")}`, as("alice"));
			assert.equal(own.status, 200);
			assert.equal(await own.text(), "alice.mp4 video");

			// Path validation still answers first.
			const invalid = await fetch(`${baseUrl}/api/rovo/generated-media?path=${encodeURIComponent("../secret.mp4")}`, as("bob"));
			assert.equal(invalid.status, 400);
		}, { env: PRODUCTION_ENV });

		// Locally the one caller reaches every generated video, recorded or not.
		await withServer(dependencies, async (baseUrl) => {
			for (const name of ["alice.mp4", "loose.mp4"]) {
				assert.equal((await fetch(`${baseUrl}${mediaUrl(name)}`)).status, 200, name);
			}
		}, { env: {} });
		await generatedMediaOwnerStore.flush();
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("in production a video a turn plays through a preview that already declares its body is that caller's alone", async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "rovo-app-media-owner-body-"));
	const projectRoot = path.join(root, "project");
	const mediaPath = (name) => `media/videos/demo/${name}`;
	const mediaUrl = (name) => `/api/rovo/generated-media?path=${encodeURIComponent(mediaPath(name))}`;
	// Each preview shape the client plays a generated video from while keeping the body it
	// was given (components/projects/shared/lib/generative-widget-parse.ts).
	const previews = [
		["video-body.mp4", "genui-preview", (name) => ({ body: { kind: "video", videoUrl: mediaUrl(name) } })],
		["json-render.mp4", "genui-preview", (name) => ({
			body: { kind: "json-render", spec: { root: "r", elements: {} } },
			spec: { root: "r", elements: { r: { type: "Text", props: { text: `Rendered ${mediaPath(name)}` } } } },
		})],
		["video-preview.mp4", "video-preview", (name) => ({ videoUrl: mediaUrl(name), body: { kind: "video", videoUrl: mediaUrl(name) } })],
	];
	try {
		mkdirSync(path.join(projectRoot, "media/videos/demo"), { recursive: true });
		const generatedMediaOwnerStore = createGeneratedMediaOwnerStore({ baseDir: path.join(root, "data"), projectRoot });
		for (const [name, type, buildPayload] of previews) {
			writeFileSync(path.join(projectRoot, mediaPath(name)), `${name} video`);
			const payload = buildPayload(name);
			const wrapped = runWithGeneratedMediaScope(
				{ owner: "alice", store: generatedMediaOwnerStore },
				() => withCanonicalPreviewBody(type, payload),
			);
			assert.equal(wrapped, payload, `${name}: the declared body is kept`);
		}
		await withServer(createDependencies({ generatedMediaOwnerStore, projectRoot }), async (baseUrl) => {
			for (const [name] of previews) {
				const own = await fetch(`${baseUrl}${mediaUrl(name)}`, as("alice"));
				assert.equal(own.status, 200, name);
				assert.equal(await own.text(), `${name} video`);
				const foreign = await fetch(`${baseUrl}${mediaUrl(name)}`, as("bob"));
				assert.equal(foreign.status, 404, name);
				assert.deepEqual(await foreign.json(), { error: "Generated media file not found" });
			}
		}, { env: PRODUCTION_ENV });
		await generatedMediaOwnerStore.flush();
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("in production a thread can store only a Rovo session no other caller's thread holds", async () => {
	const dependencies = createDependencies();
	const { state } = dependencies;
	state.threads.set("thread-a", { id: "thread-a", owner: "alice", title: "Alice", sessionId: "session-alice" });
	state.threads.set("thread-b", { id: "thread-b", owner: "bob", title: "Bob" });
	await withServer(dependencies, async (baseUrl) => {
		const forgedCreate = await fetch(`${baseUrl}/api/rovo/threads`, jsonAs("bob", "POST", { id: "thread-forged", title: "Forged", sessionId: "session-alice" }));
		assert.equal(forgedCreate.status, 409);
		assert.equal((await forgedCreate.json()).code, "SESSION_OWNED");
		assert.equal(state.threads.has("thread-forged"), false);
		const forgedUpdate = await fetch(`${baseUrl}/api/rovo/threads/thread-b`, jsonAs("bob", "PUT", { sessionId: "session-alice" }));
		assert.equal(forgedUpdate.status, 409);
		assert.equal(state.threads.get("thread-b").sessionId, undefined);

		// The owner keeps writing it, and a fresh session becomes the first caller's.
		assert.equal((await fetch(`${baseUrl}/api/rovo/threads/thread-a`, jsonAs("alice", "PUT", { sessionId: "session-alice" }))).status, 200);
		assert.equal((await fetch(`${baseUrl}/api/rovo/threads/thread-b`, jsonAs("bob", "PUT", { sessionId: "session-bob" }))).status, 200);
		assert.equal((await fetch(`${baseUrl}/api/rovo/threads`, jsonAs("alice", "POST", { id: "thread-a2", sessionId: "session-bob" }))).status, 409);
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
