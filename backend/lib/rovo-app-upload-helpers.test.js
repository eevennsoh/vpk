const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildRovoAppFileUrl,
	collectRovoAppUploadIdsFromMessages,
	createRovoAppBrowserScreenshotPersister,
	createRovoAppMessageFilePersistence,
	extractRovoAppUploadIdFromUrl,
	getJpegImageDimensions,
	getPngImageDimensions,
	getRovoAppBrowserImageMetadata,
	normalizeRovoAppBrowserScreenshotContentType,
} = require("./rovo-app-upload-helpers");

function createPngBuffer({ width = 20, height = 10 } = {}) {
	const buffer = Buffer.alloc(24);
	Buffer.from("89504e470d0a1a0a", "hex").copy(buffer, 0);
	buffer.writeUInt32BE(width, 16);
	buffer.writeUInt32BE(height, 20);
	return buffer;
}

function createJpegBuffer({ width = 20, height = 10 } = {}) {
	const buffer = Buffer.alloc(11);
	buffer[0] = 0xff;
	buffer[1] = 0xd8;
	buffer[2] = 0xff;
	buffer[3] = 0xc0;
	buffer.writeUInt16BE(7, 4);
	buffer[6] = 8;
	buffer.writeUInt16BE(height, 7);
	buffer.writeUInt16BE(width, 9);
	return buffer;
}

function createMessageFilePersistenceHarness({
	persistBrowserScreenshotBuffer,
	updateThreadResult,
} = {}) {
	const calls = [];
	const service = createRovoAppMessageFilePersistence({
		buildFileUrl: (uploadId) => `/files/${uploadId}`,
		persistBrowserScreenshotBuffer: persistBrowserScreenshotBuffer ?? (async (input) => {
			calls.push(["persistBrowserScreenshotBuffer", input]);
			return {
				contentType: input.contentType || "image/png",
				height: 20,
				imageUrl: "/files/screenshot-1",
				width: 10,
			};
		}),
		rovoAppGeneratedFilesManager: {
			recordRunGeneratedFiles: async (threadId, producedMessages) => {
				calls.push(["recordRunGeneratedFiles", threadId, producedMessages]);
			},
			captureRootFilesToWorkspace: async (threadId) => {
				calls.push(["captureRootFilesToWorkspace", threadId]);
			},
		},
		rovoAppThreadManager: {
			updateThread: async (threadId, patch) => {
				calls.push(["updateThread", threadId, patch]);
				return updateThreadResult;
			},
		},
		rovoAppUploadManager: {
			createUploadFromDataUrl: async (input) => {
				calls.push(["createUploadFromDataUrl", input]);
				return {
					filename: `stored-${input.filename}`,
					id: "upload-1",
				};
			},
		},
	});

	return {
		calls,
		service,
	};
}

test("Rovo app file URLs round-trip upload IDs", () => {
	const url = buildRovoAppFileUrl("file id");

	assert.equal(url, "/api/rovo/files/file%20id");
	assert.equal(extractRovoAppUploadIdFromUrl(url), "file id");
	assert.equal(extractRovoAppUploadIdFromUrl(`${url}?download=1#preview`), "file id");
	assert.equal(extractRovoAppUploadIdFromUrl("/api/other/files/file%20id"), null);
});

test("image dimension helpers detect PNG and JPEG metadata", () => {
	const png = createPngBuffer({ width: 320, height: 180 });
	const jpeg = createJpegBuffer({ width: 640, height: 360 });

	assert.deepEqual(getPngImageDimensions(png), {
		width: 320,
		height: 180,
	});
	assert.deepEqual(getJpegImageDimensions(jpeg), {
		width: 640,
		height: 360,
	});
	assert.equal(getPngImageDimensions(jpeg), null);
	assert.equal(getJpegImageDimensions(png), null);
});

test("browser image metadata defaults unknown buffers to PNG", () => {
	assert.deepEqual(getRovoAppBrowserImageMetadata(createJpegBuffer()), {
		contentType: "image/jpeg",
		extension: "jpg",
		width: 20,
		height: 10,
	});
	assert.deepEqual(getRovoAppBrowserImageMetadata(Buffer.from("not image")), {
		contentType: "image/png",
		extension: "png",
		width: undefined,
		height: undefined,
	});
});

test("normalizes browser screenshot content type with fallback", () => {
	assert.equal(
		normalizeRovoAppBrowserScreenshotContentType(" image/jpg ", "image/png"),
		"image/jpeg",
	);
	assert.equal(
		normalizeRovoAppBrowserScreenshotContentType("image/webp", "image/png"),
		"image/png",
	);
	assert.equal(
		normalizeRovoAppBrowserScreenshotContentType("", "image/jpeg"),
		"image/jpeg",
	);
});

test("persists browser screenshot buffers through the upload manager", async () => {
	const calls = [];
	const persistScreenshot = createRovoAppBrowserScreenshotPersister({
		buildFileUrl: (uploadId) => `/files/${uploadId}`,
		now: () => 123,
		rovoAppUploadManager: {
			createUploadFromBuffer: async (input) => {
				calls.push(input);
				return { id: "upload-1" };
			},
		},
	});

	const result = await persistScreenshot({
		threadId: "thread-1",
		buffer: createPngBuffer({ width: 4, height: 3 }),
		contentType: "image/jpg",
	});

	assert.deepEqual(result, {
		contentType: "image/jpeg",
		height: 3,
		imageUrl: "/files/upload-1",
		width: 4,
	});
	assert.equal(calls.length, 1);
	assert.equal(calls[0].threadId, "thread-1");
	assert.equal(calls[0].filename, "browser-screenshot-123.jpg");
	assert.equal(calls[0].mediaType, "image/jpeg");
	assert.equal(Buffer.isBuffer(calls[0].buffer), true);
});

test("collects unique upload IDs from file and browser screenshot message parts", () => {
	assert.deepEqual(collectRovoAppUploadIdsFromMessages([
		{
			parts: [
				{ type: "file", url: "/api/rovo/files/upload-1" },
				{
					type: "data-browser-screenshot",
					data: { imageUrl: "/api/rovo/files/upload-2" },
				},
				{ type: "file", url: "/api/rovo/files/upload-1" },
				{ type: "text", text: "ignore" },
			],
		},
		null,
	]), ["upload-1", "upload-2"]);
	assert.deepEqual(collectRovoAppUploadIdsFromMessages(null), []);
});

test("message file persistence validates required dependencies", () => {
	assert.throws(
		() => createRovoAppMessageFilePersistence(),
		/rovoAppGeneratedFilesManager\.recordRunGeneratedFiles/u,
	);
});

test("message file persistence uploads file data URLs and browser screenshots", async () => {
	const { calls, service } = createMessageFilePersistenceHarness();
	const imageData = Buffer.from("screenshot").toString("base64");

	const messages = await service.persistMessageFiles("thread-1", [
		null,
		{
			id: "message-1",
			parts: [
				"text",
				{
					type: "data-browser-screenshot",
					data: {
						contentType: "image/jpeg",
						imageData,
						timestamp: "2026-01-01T00:00:00.000Z",
					},
				},
				{
					type: "file",
					name: "fallback.txt",
					url: "data:text/plain;base64,SGVsbG8=",
				},
				{
					type: "file",
					filename: "kept.txt",
					mediaType: "text/plain",
					url: "/already-uploaded",
				},
			],
		},
	]);

	assert.equal(messages.length, 1);
	assert.equal(messages[0].parts[0], "text");
	assert.deepEqual(messages[0].parts[1], {
		type: "data-browser-screenshot",
		data: {
			contentType: "image/jpeg",
			height: 20,
			imageUrl: "/files/screenshot-1",
			timestamp: "2026-01-01T00:00:00.000Z",
			width: 10,
		},
	});
	assert.deepEqual(messages[0].parts[2], {
		type: "file",
		name: "fallback.txt",
		filename: "stored-fallback.txt",
		url: "/files/upload-1",
	});
	assert.deepEqual(messages[0].parts[3], {
		type: "file",
		filename: "kept.txt",
		mediaType: "text/plain",
		url: "/already-uploaded",
	});

	const screenshotCall = calls.find((call) => call[0] === "persistBrowserScreenshotBuffer")[1];
	assert.equal(screenshotCall.threadId, "thread-1");
	assert.equal(screenshotCall.contentType, "image/jpeg");
	assert.equal(Buffer.isBuffer(screenshotCall.buffer), true);
	assert.equal(screenshotCall.buffer.toString(), "screenshot");
	assert.deepEqual(calls.find((call) => call[0] === "createUploadFromDataUrl")[1], {
		threadId: "thread-1",
		filename: "fallback.txt",
		mediaType: "application/octet-stream",
		dataUrl: "data:text/plain;base64,SGVsbG8=",
	});
});

test("message file persistence keeps screenshot parts without inline image data", async () => {
	const { calls, service } = createMessageFilePersistenceHarness();
	const messages = [
		{
			parts: [
				{
					type: "data-browser-screenshot",
					data: { imageUrl: "/files/existing" },
				},
			],
		},
	];

	assert.deepEqual(await service.persistMessageFiles("thread-1", messages), messages);
	assert.equal(calls.some((call) => call[0] === "persistBrowserScreenshotBuffer"), false);
});

test("message file persistence detects and migrates persisted browser screenshots", async () => {
	const updateThreadResult = {
		id: "thread-1",
		messages: [{ parts: [] }],
		updatedAt: "updated",
	};
	const { calls, service } = createMessageFilePersistenceHarness({
		updateThreadResult,
	});
	const thread = {
		id: "thread-1",
		messages: [
			{
				parts: [
					{
						type: "data-browser-screenshot",
						data: { imageData: Buffer.from("inline").toString("base64") },
					},
				],
			},
		],
		updatedAt: "old-updated",
	};

	assert.equal(service.hasPersistedBrowserScreenshotImageData(thread.messages), true);
	assert.equal(service.hasPersistedBrowserScreenshotImageData([{ parts: [] }]), false);

	const migrated = await service.maybeMigratePersistedThreadBrowserScreenshots(thread);
	assert.equal(migrated, updateThreadResult);
	assert.equal(calls.find((call) => call[0] === "updateThread")[1], "thread-1");
	assert.equal(calls.find((call) => call[0] === "updateThread")[2].updatedAt, "old-updated");
	const unchangedThread = { id: "thread-2", messages: [] };
	assert.equal(
		await service.maybeMigratePersistedThreadBrowserScreenshots(unchangedThread),
		unchangedThread,
	);
});

test("message file persistence falls back when migration update returns null", async () => {
	const { service } = createMessageFilePersistenceHarness({
		updateThreadResult: null,
	});
	const thread = {
		id: "thread-1",
		messages: [
			{
				parts: [
					{
						type: "data-browser-screenshot",
						data: { imageData: Buffer.from("inline").toString("base64") },
					},
				],
			},
		],
		updatedAt: "old-updated",
	};

	const migrated = await service.maybeMigratePersistedThreadBrowserScreenshots(thread);
	assert.equal(migrated.id, "thread-1");
	assert.equal(typeof migrated.messages[0].parts[0].data.imageUrl, "string");
	assert.equal(migrated.messages[0].parts[0].data.imageData, undefined);
});

test("message file persistence synchronizes generated files for valid threads", async () => {
	const { calls, service } = createMessageFilePersistenceHarness();
	const thread = { id: "thread-1", messages: [{ id: "stored", parts: [] }] };
	const producedMessages = [{ parts: [] }];

	assert.equal(await service.synchronizeThreadGeneratedFiles(undefined), undefined);
	assert.equal(await service.synchronizeThreadGeneratedFiles(thread, { producedMessages }), thread);
	assert.deepEqual(calls.filter((call) => call[0] !== "persistBrowserScreenshotBuffer"), [
		// Recorded from what the run produced, never from the stored thread's messages.
		["recordRunGeneratedFiles", "thread-1", producedMessages],
		["captureRootFilesToWorkspace", "thread-1"],
	]);
});
