const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { createRovoAppThreadManager } = require("./rovo-app-threads");
const { createRovoAppVoteManager } = require("./rovo-app-votes");
const { createRovoAppDocumentManager } = require("./rovo-app-documents");
const { createRovoAppUploadManager } = require("./rovo-app-uploads");

async function createTempBaseDir() {
	return fs.mkdtemp(path.join(os.tmpdir(), "rovo-app-test-"));
}

test("rovo app thread manager persists and lists thread metadata", async () => {
	const baseDir = await createTempBaseDir();
	const manager = createRovoAppThreadManager({ baseDir, logger: console });

	const createdThread = await manager.createThread({
		id: "thread-1",
		title: "Launch plan",
		messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] }],
		visibility: "public",
		modelId: "anthropic/claude-4.5-sonnet",
		provider: "anthropic",
		sessionId: "session-1",
		sessionMode: "persistent",
		hermesContext: {
			selectedSkillIds: ["research/llm-wiki"],
			autoSelectedSkillIds: ["research/arxiv"],
			pendingDraftIds: ["draft-1"],
		},
		activeRun: {
			id: "run-1",
			backend: "rovo",
			status: "queued",
			portIndex: 1,
			rovoPort: 8001,
			sessionId: "session-1",
			sessionMode: "persistent",
			startedAt: "2026-03-18T00:00:00.000Z",
			updatedAt: "2026-03-18T00:00:00.000Z",
		},
	});

	assert.equal(createdThread.id, "thread-1");
	assert.equal(createdThread.visibility, "public");
	assert.equal(createdThread.modelId, "anthropic/claude-4.5-sonnet");
	assert.equal(createdThread.sessionId, "session-1");
	assert.equal(createdThread.sessionMode, "persistent");
	assert.equal(Object.hasOwn(createdThread, "hermesContext"), false);
	assert.equal(createdThread.activeRun?.backend, "rovo");
	assert.equal(createdThread.activeRun?.status, "queued");
	assert.equal(createdThread.activeRun?.rovoPort, 8001);
	assert.equal(createdThread.activeRun?.sessionId, "session-1");
	assert.equal(createdThread.activeRun?.sessionMode, "persistent");

	const updatedThread = await manager.updateThread("thread-1", {
		title: "Updated launch plan",
		activeDocumentId: "doc-1",
		sessionMode: "ephemeral",
		hermesContext: {
			selectedSkillIds: ["research/llm-wiki", "research/llm-wiki"],
			autoSelectedSkillIds: ["research/arxiv", "research/arxiv"],
			pendingDraftIds: ["draft-2", "draft-2"],
		},
	});

	assert.equal(updatedThread?.title, "Updated launch plan");
	assert.equal(updatedThread?.activeDocumentId, "doc-1");
	assert.equal(updatedThread?.sessionMode, "ephemeral");
	assert.equal(Object.hasOwn(updatedThread, "hermesContext"), false);

	const listedThreads = await manager.listThreads();
	assert.equal(listedThreads.length, 1);
	assert.equal(listedThreads[0].id, "thread-1");
});

test("rovo app thread manager preserves existing fields when updates omit them", async () => {
	const baseDir = await createTempBaseDir();
	const manager = createRovoAppThreadManager({ baseDir, logger: console });

	await manager.createThread({
		id: "thread-preserve-fields",
		title: "Specific title",
		messages: [],
		visibility: "private",
	});

	const updatedThread = await manager.updateThread("thread-preserve-fields", {
		title: undefined,
		messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] }],
	});

	assert.equal(updatedThread?.title, "Specific title");
	assert.equal(updatedThread?.messages.length, 1);
});

test("rovo app thread manager preserves ordinary realtime assistant visibility", async () => {
	const baseDir = await createTempBaseDir();
	const manager = createRovoAppThreadManager({ baseDir, logger: console });

	await manager.createThread({
		id: "thread-visible",
		title: "Visible thread",
		messages: [],
		realtimeMessages: [
			{
				id: "assistant-visible",
				role: "assistant",
				metadata: {
					createdAt: "2026-04-10T00:00:00.000Z",
					updatedAt: "2026-04-10T00:00:00.000Z",
				},
				parts: [
					{
						type: "text",
						text: "Visible response",
						state: "done",
					},
				],
			},
		],
	});

	const thread = await manager.getThread("thread-visible");

	assert.equal(thread?.realtimeMessages[0]?.metadata?.visibility, undefined);
});

test("rovo app vote manager stores one vote per message", async () => {
	const baseDir = await createTempBaseDir();
	const manager = createRovoAppVoteManager({ baseDir });

	await manager.setVote({
		threadId: "thread-1",
		messageId: "assistant-1",
		value: "up",
	});
	await manager.setVote({
		threadId: "thread-1",
		messageId: "assistant-2",
		value: "down",
	});

	let votes = await manager.listVotes("thread-1");
	assert.equal(votes.length, 2);
	assert.equal(votes.find((vote) => vote.messageId === "assistant-1")?.isUpvoted, true);
	assert.equal(votes.find((vote) => vote.messageId === "assistant-2")?.isUpvoted, false);

	await manager.setVote({
		threadId: "thread-1",
		messageId: "assistant-1",
		value: null,
	});

	votes = await manager.listVotes("thread-1");
	assert.equal(votes.length, 1);
	assert.equal(votes[0].messageId, "assistant-2");

	const storedVotesPath = path.join(
		baseDir,
		"rovo-app",
		"threads",
		"thread-1",
		"votes.json",
	);
	const storedVotes = JSON.parse(await fs.readFile(storedVotesPath, "utf8"));
	assert.equal(storedVotes["assistant-2"], "down");
});

test("rovo app document manager versions artifacts over time", async () => {
	const baseDir = await createTempBaseDir();
	const manager = createRovoAppDocumentManager({ baseDir });

	const createdDocument = await manager.createDocument({
		threadId: "thread-1",
		title: "Spec draft",
		kind: "text",
		content: "Version one",
		sourceMessageId: "assistant-1",
	});

	assert.equal(createdDocument.versions.length, 1);
	const storedDocumentPath = path.join(
		baseDir,
		"rovo-app",
		"threads",
		"thread-1",
		"documents",
		`${createdDocument.id}.json`,
	);
	await fs.access(storedDocumentPath);

	const updatedDocument = await manager.appendDocumentVersion(createdDocument.id, {
		changeLabel: "Renamed title",
		content: "Version two",
		title: "Spec draft v2",
	});

	assert.equal(updatedDocument?.title, "Spec draft v2");
	assert.equal(updatedDocument?.versions.length, 2);
	assert.equal(updatedDocument?.versions[0].title, "Spec draft");
	assert.equal(updatedDocument?.versions[0].changeLabel, "Created");
	assert.equal(updatedDocument?.versions[1].title, "Spec draft v2");
	assert.equal(updatedDocument?.versions[1].changeLabel, "Renamed title");

	const listedDocuments = await manager.listDocuments({ threadId: "thread-1" });
	assert.equal(listedDocuments.length, 1);
	assert.equal(listedDocuments[0].versions[1].content, "Version two");
});

test("rovo app document manager parses list timestamps once per document", async () => {
	const baseDir = await createTempBaseDir();
	const documentsDir = path.join(
		baseDir,
		"rovo-app",
		"threads",
		"thread-1",
		"documents",
	);
	await fs.mkdir(documentsDir, { recursive: true });

	for (const document of [
		{
			id: "older-doc",
			updatedAt: "2026-03-09T00:05:00.000Z",
		},
		{
			id: "newer-doc",
			updatedAt: "2026-03-09T00:10:00.000Z",
		},
		{
			id: "middle-doc",
			updatedAt: "2026-03-09T00:07:00.000Z",
		},
	]) {
		await fs.writeFile(
			path.join(documentsDir, `${document.id}.json`),
			JSON.stringify({
				...document,
				threadId: "thread-1",
				title: document.id,
				kind: "text",
				createdAt: "2026-03-09T00:00:00.000Z",
				versions: [],
			}),
			"utf8",
		);
	}

	const manager = createRovoAppDocumentManager({ baseDir });
	const originalDateParse = Date.parse;
	let parseCalls = 0;
	Date.parse = (value) => {
		parseCalls += 1;
		return originalDateParse(value);
	};

	try {
		const listedDocuments = await manager.listDocuments();

		assert.deepEqual(
			listedDocuments.map((document) => document.id),
			["newer-doc", "middle-doc", "older-doc"],
		);
		assert.equal(parseCalls, listedDocuments.length);
	} finally {
		Date.parse = originalDateParse;
	}
});

test("rovo app document manager sorts malformed persisted timestamps last", async () => {
	const baseDir = await createTempBaseDir();
	const documentsDir = path.join(
		baseDir,
		"rovo-app",
		"threads",
		"thread-1",
		"documents",
	);
	await fs.mkdir(documentsDir, { recursive: true });

	for (const document of [
		{
			id: "invalid-doc",
			updatedAt: "not-a-date",
		},
		{
			id: "newer-doc",
			updatedAt: "2026-03-09T00:10:00.000Z",
		},
		{
			id: "older-doc",
			updatedAt: "2026-03-09T00:05:00.000Z",
		},
	]) {
		await fs.writeFile(
			path.join(documentsDir, `${document.id}.json`),
			JSON.stringify({
				...document,
				threadId: "thread-1",
				title: document.id,
				kind: "text",
				createdAt: "2026-03-09T00:00:00.000Z",
				versions: [],
			}),
			"utf8",
		);
	}

	const manager = createRovoAppDocumentManager({ baseDir });
	const listedDocuments = await manager.listDocuments({ threadId: "thread-1" });

	assert.deepEqual(
		listedDocuments.map((document) => document.id),
		["newer-doc", "older-doc", "invalid-doc"],
	);
	assert.equal(listedDocuments.at(-1)?.updatedAt, "not-a-date");
});

test("rovo app document manager can create and finalize streaming document shells", async () => {
	const baseDir = await createTempBaseDir();
	const manager = createRovoAppDocumentManager({ baseDir });

	const shellDocument = await manager.createDocumentShell({
		documentId: "doc-shell-1",
		threadId: "thread-1",
		title: "Streaming draft",
		kind: "text",
	});

	assert.equal(shellDocument.versions.length, 0);

	const finalizedDocument = await manager.finalizeDocumentShell(shellDocument.id, {
		content: "Streamed content",
	});

	assert.equal(finalizedDocument?.versions.length, 1);
	assert.equal(finalizedDocument?.versions[0].content, "Streamed content");
	assert.equal(finalizedDocument?.versions[0].changeLabel, "Created");
	assert.equal(finalizedDocument?.versions[0].title, "Streaming draft");
});

test("rovo app document manager preserves react app artifacts", async () => {
	const baseDir = await createTempBaseDir();
	const manager = createRovoAppDocumentManager({ baseDir });

	const createdDocument = await manager.createDocument({
		threadId: "thread-1",
		title: "Analytics",
		kind: "react",
		content: "/analytics",
		previewSummary: "Monitor KPIs, trends, and campaign performance metrics",
		sourceMessageId: "assistant-1",
	});

	assert.equal(createdDocument.kind, "react");
	assert.equal(
		createdDocument.previewSummary,
		"Monitor KPIs, trends, and campaign performance metrics",
	);

	const updatedDocument = await manager.appendDocumentVersion(createdDocument.id, {
		changeLabel: "Updated route",
		content: "/analytics-v2",
		kind: "react",
	});

	assert.equal(updatedDocument?.kind, "react");
	assert.equal(updatedDocument?.versions.at(-1)?.content, "/analytics-v2");
	assert.equal(
		updatedDocument?.previewSummary,
		"Monitor KPIs, trends, and campaign performance metrics",
	);

	const shellDocument = await manager.createDocumentShell({
		documentId: "doc-react-shell",
		threadId: "thread-1",
		title: "Dashboard",
		kind: "react",
	});

	assert.equal(shellDocument.kind, "react");

	const finalizedShell = await manager.finalizeDocumentShell(shellDocument.id, {
		content: "/dashboard",
		kind: "react",
	});

	assert.equal(finalizedShell?.kind, "react");
	assert.equal(finalizedShell?.versions[0].content, "/dashboard");
	assert.equal(finalizedShell?.previewSummary, undefined);
});

test("rovo app document manager preserves excalidraw artifacts", async () => {
	const baseDir = await createTempBaseDir();
	const manager = createRovoAppDocumentManager({ baseDir });

	const shellDocument = await manager.createDocumentShell({
		documentId: "doc-diagram-shell",
		threadId: "thread-1",
		title: "System Diagram",
		kind: "excalidraw",
	});

	assert.equal(shellDocument.kind, "excalidraw");

	const finalizedShell = await manager.finalizeDocumentShell(shellDocument.id, {
		content: "{\"type\":\"excalidraw\",\"version\":2,\"elements\":[{\"id\":\"a\",\"type\":\"rectangle\"}]}",
		kind: "excalidraw",
	});

	assert.equal(finalizedShell?.kind, "excalidraw");
	assert.match(finalizedShell?.versions[0].content || "", /"type":"excalidraw"/);
});

test("rovo app document manager backfills legacy versions without title snapshots", async () => {
	const baseDir = await createTempBaseDir();
	const documentsDir = path.join(baseDir, "rovo-app", "documents");
	await fs.mkdir(documentsDir, { recursive: true });
	await fs.writeFile(
		path.join(documentsDir, "legacy-doc.json"),
		JSON.stringify({
			id: "legacy-doc",
			threadId: "thread-1",
			title: "Legacy artifact",
			kind: "text",
			createdAt: "2026-03-09T00:00:00.000Z",
			updatedAt: "2026-03-09T00:05:00.000Z",
			versions: [
				{
					id: "legacy-version-1",
					content: "Legacy content",
					createdAt: "2026-03-09T00:00:00.000Z",
				},
			],
		}),
		"utf8",
	);

	const manager = createRovoAppDocumentManager({ baseDir });
	const document = await manager.getDocument("legacy-doc");

	assert.equal(document?.versions[0].title, "Legacy artifact");
	assert.equal(document?.versions[0].changeLabel, "Created");
	await fs.access(
		path.join(
			baseDir,
			"rovo-app",
			"threads",
			"thread-1",
			"documents",
			"legacy-doc.json",
		),
	);
});

test("rovo app upload manager writes and reads data-url files", async () => {
	const baseDir = await createTempBaseDir();
	const manager = createRovoAppUploadManager({ baseDir });

	const createdUpload = await manager.createUploadFromDataUrl({
		threadId: "thread-1",
		filename: "note.txt",
		mediaType: "text/plain",
		dataUrl: "data:text/plain;base64,SGVsbG8gUm92bw==",
	});

	assert.equal(createdUpload.filename.endsWith(".txt"), true);
	assert.equal(createdUpload.mediaType, "text/plain");

	const loadedUpload = await manager.getUpload(createdUpload.id);
	assert.ok(loadedUpload);
	assert.equal(loadedUpload?.buffer.toString("utf8"), "Hello Rovo");
	await fs.access(
		path.join(
			baseDir,
			"rovo-app",
			"threads",
			"thread-1",
			"uploads",
			createdUpload.id,
			"metadata.json",
		),
	);
	await fs.access(
		path.join(
			baseDir,
			"rovo-app",
			"threads",
			"thread-1",
			"uploads",
			createdUpload.id,
			"blob",
		),
	);
});
