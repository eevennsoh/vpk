const fs = require("node:fs/promises");
const path = require("node:path");

const {
	buildRovoAppThreadPaths,
	getRovoAppLegacyDocumentsDir,
	getRovoAppThreadsRootDir,
	normalizeThreadId,
} = require("./rovo-app-storage-paths");
const { isStorageId } = require("./input-schemas");
const { getNonEmptyString } = require("./shared-utils");

function createId(prefix) {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function getDocumentUpdatedAtMs(document) {
	const updatedAtMs = Date.parse(document.updatedAt);
	return Number.isFinite(updatedAtMs) ? updatedAtMs : Number.NEGATIVE_INFINITY;
}

function sortDocumentsByUpdatedAtDesc(documents) {
	return documents
		.map((document) => ({
			document,
			updatedAtMs: getDocumentUpdatedAtMs(document),
		}))
		.sort((left, right) => {
			if (left.updatedAtMs === right.updatedAtMs) {
				return 0;
			}

			return right.updatedAtMs - left.updatedAtMs;
		})
		.map(({ document }) => document);
}

function normalizeDocumentKind(value, fallbackKind = "text") {
	return (
		value === "code" ||
		value === "excalidraw" ||
		value === "html" ||
		value === "image" ||
		value === "sheet" ||
		value === "text" ||
		value === "react"
	)
		? value
		: fallbackKind;
}

function normalizeDocumentVersion(rawVersion, options) {
	if (!rawVersion || typeof rawVersion !== "object") {
		return null;
	}

	const versionId = typeof rawVersion.id === "string" && rawVersion.id.trim()
		? rawVersion.id.trim()
		: createId("doc-version");
	return {
		id: versionId,
		changeLabel:
			getNonEmptyString(rawVersion.changeLabel) || options.fallbackChangeLabel,
		content: typeof rawVersion.content === "string" ? rawVersion.content : "",
		createdAt:
			typeof rawVersion.createdAt === "string" && rawVersion.createdAt.trim()
				? rawVersion.createdAt
				: options.fallbackCreatedAt,
		title: getNonEmptyString(rawVersion.title) || options.fallbackTitle,
	};
}

function normalizeDocument(rawDocument) {
	if (!rawDocument || typeof rawDocument !== "object") {
		return null;
	}

	const id = typeof rawDocument.id === "string" && rawDocument.id.trim()
		? rawDocument.id.trim()
		: null;
	if (!id) {
		return null;
	}

	const threadId = typeof rawDocument.threadId === "string" && rawDocument.threadId.trim()
		? rawDocument.threadId.trim()
		: null;
	if (!threadId) {
		return null;
	}

	const createdAt = typeof rawDocument.createdAt === "string" && rawDocument.createdAt.trim()
		? rawDocument.createdAt
		: toIsoDate();
	const normalizedTitle =
		getNonEmptyString(rawDocument.title) || "Untitled artifact";
	const versions = Array.isArray(rawDocument.versions)
		? rawDocument.versions
			.map((version, index) =>
				normalizeDocumentVersion(version, {
					fallbackChangeLabel: index === 0 ? "Created" : "Updated",
					fallbackCreatedAt: createdAt,
					fallbackTitle: normalizedTitle,
				})
			)
			.filter(Boolean)
		: [];

	return {
		id,
		threadId,
		title: normalizedTitle,
		kind: normalizeDocumentKind(rawDocument.kind),
		previewSummary: getNonEmptyString(rawDocument.previewSummary) || undefined,
		sourceMessageId:
			typeof rawDocument.sourceMessageId === "string" && rawDocument.sourceMessageId.trim()
				? rawDocument.sourceMessageId.trim()
				: null,
		createdAt,
		updatedAt:
			typeof rawDocument.updatedAt === "string" && rawDocument.updatedAt.trim()
				? rawDocument.updatedAt
				: createdAt,
		versions,
	};
}

function createRovoAppDocumentManager({ baseDir }) {
	const threadsRootDir = getRovoAppThreadsRootDir(baseDir);
	const legacyDocumentsRootDir = getRovoAppLegacyDocumentsDir(baseDir);
	let initializationPromise = null;

	const getDocumentPath = (threadId, documentId) =>
		path.join(
			buildRovoAppThreadPaths(baseDir, threadId).documentsDir,
			`${encodeURIComponent(documentId)}.json`,
		);

	const writeDocument = async (document) => {
		await fs.mkdir(buildRovoAppThreadPaths(baseDir, document.threadId).documentsDir, {
			recursive: true,
		});
		await fs.writeFile(
			getDocumentPath(document.threadId, document.id),
			`${JSON.stringify(document, null, 2)}\n`,
			"utf8",
		);
	};

	const readDocumentFromPath = async (filePath) => {
		try {
			const raw = await fs.readFile(filePath, "utf8");
			return normalizeDocument(safeJsonParse(raw));
		} catch (error) {
			if (error && error.code === "ENOENT") {
				return null;
			}

			throw error;
		}
	};

	const listThreadIds = async () => {
		try {
			const entries = await fs.readdir(threadsRootDir, { withFileTypes: true });
			return entries.filter((entry) => entry.isDirectory() && isStorageId(entry.name)).map((entry) => entry.name);
		} catch (error) {
			if (error && error.code === "ENOENT") {
				return [];
			}

			throw error;
		}
	};

	const locateDocument = async (documentId) => {
		const normalizedDocumentId = getNonEmptyString(documentId);
		if (!normalizedDocumentId) {
			return null;
		}

		const threadIds = await listThreadIds();
		for (const threadId of threadIds) {
			const documentPath = getDocumentPath(threadId, normalizedDocumentId);
			const document = await readDocumentFromPath(documentPath);
			if (document) {
				return {
					document,
					documentPath,
				};
			}
		}

		return null;
	};

	const ensureInitialized = async () => {
		if (initializationPromise) {
			return initializationPromise;
		}

		initializationPromise = (async () => {
			let legacyEntries;
			try {
				legacyEntries = await fs.readdir(legacyDocumentsRootDir, { withFileTypes: true });
			} catch (error) {
				if (error && error.code === "ENOENT") {
					return;
				}

				throw error;
			}

			for (const entry of legacyEntries) {
				if (!entry.isFile() || !entry.name.endsWith(".json")) {
					continue;
				}

				const legacyDocumentPath = path.join(legacyDocumentsRootDir, entry.name);
				const legacyDocument = await readDocumentFromPath(legacyDocumentPath);
				if (!legacyDocument || !normalizeThreadId(legacyDocument.threadId)) {
					continue;
				}

				const existingDocumentRecord = await locateDocument(legacyDocument.id);
				if (!existingDocumentRecord) {
					await writeDocument(legacyDocument);
				} else {
					const existingTimestamp = Date.parse(existingDocumentRecord.document.updatedAt);
					const legacyTimestamp = Date.parse(legacyDocument.updatedAt);
					if (
						Number.isFinite(legacyTimestamp)
						&& (!Number.isFinite(existingTimestamp) || legacyTimestamp > existingTimestamp)
					) {
						await writeDocument(legacyDocument);
					}
				}

				await fs.rm(legacyDocumentPath, { force: true });
			}

			await fs.rm(legacyDocumentsRootDir, { recursive: true, force: true });
		})();

		return initializationPromise;
	};

	const readDocumentsForThread = async (threadId) => {
		const normalizedThreadId = normalizeThreadId(threadId);
		if (!normalizedThreadId) {
			return [];
		}

		const documentsDir = buildRovoAppThreadPaths(baseDir, normalizedThreadId).documentsDir;
		let entries;
		try {
			entries = await fs.readdir(documentsDir, { withFileTypes: true });
		} catch (error) {
			if (error && error.code === "ENOENT") {
				return [];
			}

			throw error;
		}

		const documents = await Promise.all(
			entries
				.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
				.map((entry) => readDocumentFromPath(path.join(documentsDir, entry.name))),
		);
		return documents.filter(Boolean);
	};

	const listDocuments = async ({ threadId } = {}) => {
		await ensureInitialized();
		const normalizedThreadId = normalizeThreadId(threadId);
		const documents = normalizedThreadId
			? await readDocumentsForThread(normalizedThreadId)
			: (
				await Promise.all((await listThreadIds()).map((id) => readDocumentsForThread(id)))
			).flat();

		return sortDocumentsByUpdatedAtDesc(documents);
	};

	const readDocument = async (documentId) => {
		await ensureInitialized();
		return (await locateDocument(documentId))?.document ?? null;
	};

	const createDocument = async ({
		changeLabel,
		threadId,
		title,
		kind,
		content,
		previewSummary,
		sourceMessageId,
	}) => {
		await ensureInitialized();
		const now = toIsoDate();
		const nextDocument = normalizeDocument({
			id: createId("doc"),
			threadId,
			title,
			kind,
			previewSummary: getNonEmptyString(previewSummary) || undefined,
			sourceMessageId,
			createdAt: now,
			updatedAt: now,
			versions: [{
				changeLabel: getNonEmptyString(changeLabel) || "Created",
				id: createId("doc-version"),
				content: typeof content === "string" ? content : "",
				createdAt: now,
				title: getNonEmptyString(title) || "Untitled artifact",
			}],
		});
		await writeDocument(nextDocument);
		return nextDocument;
	};

	const createDocumentShell = async ({
		documentId,
		threadId,
		title,
		kind,
		previewSummary,
		sourceMessageId,
	}) => {
		await ensureInitialized();
		const now = toIsoDate();
		const nextDocument = normalizeDocument({
			id: typeof documentId === "string" && documentId.trim() ? documentId.trim() : createId("doc"),
			threadId,
			title,
			kind,
			previewSummary: getNonEmptyString(previewSummary) || undefined,
			sourceMessageId,
			createdAt: now,
			updatedAt: now,
			versions: [],
		});
		await writeDocument(nextDocument);
		return nextDocument;
	};

	const appendDocumentVersion = async (documentId, {
		changeLabel,
		title,
		content,
		kind,
	}) => {
		await ensureInitialized();
		const currentDocument = await readDocument(documentId);
		if (!currentDocument) {
			return null;
		}

		const now = toIsoDate();
		const nextTitle =
			typeof title === "string" && title.trim() ? title.trim() : currentDocument.title;
		const nextDocument = normalizeDocument({
			...currentDocument,
			title: nextTitle,
			kind: normalizeDocumentKind(kind, currentDocument.kind),
			updatedAt: now,
			versions: [
				...currentDocument.versions,
				{
					changeLabel: getNonEmptyString(changeLabel) || "Updated",
					id: createId("doc-version"),
					content: typeof content === "string" ? content : "",
					createdAt: now,
					title: nextTitle,
				},
			],
		});
		await writeDocument(nextDocument);
		return nextDocument;
	};

	const finalizeDocumentShell = async (documentId, {
		changeLabel,
		title,
		content,
		kind,
	}) => {
		await ensureInitialized();
		const currentDocument = await readDocument(documentId);
		if (!currentDocument) {
			return null;
		}

		const now = toIsoDate();
		const nextTitle =
			typeof title === "string" && title.trim() ? title.trim() : currentDocument.title;
		const nextVersions =
			currentDocument.versions.length === 0
				? [
						{
							changeLabel: getNonEmptyString(changeLabel) || "Created",
							id: createId("doc-version"),
							content: typeof content === "string" ? content : "",
							createdAt: now,
							title: nextTitle,
						},
					]
				: [
						...currentDocument.versions,
						{
							changeLabel: getNonEmptyString(changeLabel) || "Updated",
							id: createId("doc-version"),
							content: typeof content === "string" ? content : "",
							createdAt: now,
							title: nextTitle,
						},
					];

		const nextDocument = normalizeDocument({
			...currentDocument,
			title: nextTitle,
			kind: normalizeDocumentKind(kind, currentDocument.kind),
			updatedAt: now,
			versions: nextVersions,
		});
		await writeDocument(nextDocument);
		return nextDocument;
	};

	const patchDocumentMetadata = async (documentId, patch) => {
		await ensureInitialized();
		const currentDocument = await readDocument(documentId);
		if (!currentDocument) {
			return null;
		}

		const nextDocument = normalizeDocument({
			...currentDocument,
			...(typeof patch.sourceMessageId === "string" ? { sourceMessageId: patch.sourceMessageId } : {}),
			...(typeof patch.previewSummary === "string"
				? { previewSummary: getNonEmptyString(patch.previewSummary) || undefined }
				: {}),
		});
		await writeDocument(nextDocument);
		return nextDocument;
	};

	const deleteDocument = async (documentId) => {
		await ensureInitialized();
		const existingDocument = await locateDocument(documentId);
		if (!existingDocument) {
			return;
		}

		await fs.rm(existingDocument.documentPath, { force: true });
	};

	const deleteDocumentsByThread = async (threadId) => {
		await ensureInitialized();
		const normalizedThreadId = normalizeThreadId(threadId);
		if (!normalizedThreadId) {
			return;
		}

		await fs.rm(
			buildRovoAppThreadPaths(baseDir, normalizedThreadId).documentsDir,
			{ recursive: true, force: true },
		);
	};

	const deleteAllDocuments = async () => {
		await ensureInitialized();
		await Promise.all(
			(await listThreadIds()).map((threadId) =>
				fs.rm(buildRovoAppThreadPaths(baseDir, threadId).documentsDir, {
					recursive: true,
					force: true,
				}),
			),
		);
		await fs.rm(legacyDocumentsRootDir, { recursive: true, force: true });
	};

	return {
		listDocuments,
		getDocument: readDocument,
		createDocument,
		createDocumentShell,
		appendDocumentVersion,
		finalizeDocumentShell,
		patchDocumentMetadata,
		deleteDocument,
		deleteDocumentsByThread,
		deleteAllDocuments,
	};
}

module.exports = {
	createRovoAppDocumentManager,
};
