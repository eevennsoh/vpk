// @ts-check
const fs = require("node:fs/promises");
const path = require("node:path");

const {
	buildRovoAppThreadPaths,
	getRovoAppLegacyUploadsRootDir,
	getRovoAppThreadsRootDir,
	normalizeThreadId,
} = require("./rovo-app-storage-paths");
const { isStorageId, requireStorageId } = require("./input-schemas");
const { getNonEmptyString } = require("./shared-utils");

const ORPHAN_UPLOAD_THREAD_ID = "_orphaned";

function createId() {
	return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @param {Date | number | string} [value] */
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

function normalizeUpload(rawUpload) {
	if (!rawUpload || typeof rawUpload !== "object") {
		return null;
	}

	const id = typeof rawUpload.id === "string" && rawUpload.id.trim()
		? rawUpload.id.trim()
		: null;
	if (!id) {
		return null;
	}

	return {
		id,
		threadId:
			typeof rawUpload.threadId === "string" && rawUpload.threadId.trim()
				? rawUpload.threadId.trim()
				: ORPHAN_UPLOAD_THREAD_ID,
		filename:
			typeof rawUpload.filename === "string" && rawUpload.filename.trim()
				? rawUpload.filename.trim()
				: "upload.bin",
		mediaType:
			typeof rawUpload.mediaType === "string" && rawUpload.mediaType.trim()
				? rawUpload.mediaType.trim()
				: "application/octet-stream",
		sizeBytes:
			typeof rawUpload.sizeBytes === "number" && Number.isFinite(rawUpload.sizeBytes)
				? rawUpload.sizeBytes
				: 0,
		filePath:
			typeof rawUpload.filePath === "string" && rawUpload.filePath.trim()
				? rawUpload.filePath.trim()
				: null,
		createdAt:
			typeof rawUpload.createdAt === "string" && rawUpload.createdAt.trim()
				? rawUpload.createdAt
				: toIsoDate(),
	};
}

function parseDataUrl(dataUrl) {
	if (typeof dataUrl !== "string") {
		return null;
	}

	const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/u);
	if (!match) {
		return null;
	}

	const mediaType = match[1] || "application/octet-stream";
	const base64 = match[2];
	try {
		return {
			mediaType,
			buffer: Buffer.from(base64, "base64"),
		};
	} catch {
		return null;
	}
}

function sanitizeFileName(filename) {
	if (typeof filename !== "string" || !filename.trim()) {
		return "upload.bin";
	}

	return filename.replace(/[^a-zA-Z0-9._-]/gu, "-");
}

function createRovoAppUploadManager({ baseDir }) {
	const threadsRootDir = getRovoAppThreadsRootDir(baseDir);
	const legacyUploadsRootDir = getRovoAppLegacyUploadsRootDir(baseDir);
	const legacyMetadataRootDir = path.join(legacyUploadsRootDir, "metadata");
	const legacyFilesRootDir = path.join(legacyUploadsRootDir, "files");
	/** @type {Promise<void> | null} */
	let initializationPromise = null;

	const resolveThreadId = (threadId) =>
		normalizeThreadId(threadId) || ORPHAN_UPLOAD_THREAD_ID;

	// The upload id is one directory name under the thread's uploads/.
	const getMetadataPath = (threadId, uploadId) =>
		path.join(
			buildRovoAppThreadPaths(baseDir, resolveThreadId(threadId)).uploadsDir,
			requireStorageId(uploadId, "uploadId"),
			"metadata.json",
		);

	const getBlobPath = (threadId, uploadId) =>
		path.join(
			buildRovoAppThreadPaths(baseDir, resolveThreadId(threadId)).uploadsDir,
			requireStorageId(uploadId, "uploadId"),
			"blob",
		);

	const findUploadRecord = async (uploadId) => {
		const normalizedUploadId = getNonEmptyString(uploadId);
		if (!normalizedUploadId || !isStorageId(normalizedUploadId)) {
			return null;
		}

		let threadEntries;
		try {
			threadEntries = await fs.readdir(threadsRootDir, { withFileTypes: true });
		} catch (error) {
			if (error?.code === "ENOENT") {
				return null;
			}
			throw error;
		}

		for (const entry of threadEntries) {
			if (!entry.isDirectory() || !isStorageId(entry.name)) {
				continue;
			}

			const metadataPath = getMetadataPath(entry.name, normalizedUploadId);
			try {
				const raw = await fs.readFile(metadataPath, "utf8");
				const upload = normalizeUpload(safeJsonParse(raw));
				if (!upload) {
					continue;
				}

				return {
					threadId: entry.name,
					upload,
					metadataPath,
					blobPath: getBlobPath(entry.name, normalizedUploadId),
				};
			} catch (error) {
				if (error?.code !== "ENOENT") {
					throw error;
				}
			}
		}

		return null;
	};

	const findLegacyThreadIdForUploadId = async (uploadId) => {
		let threadEntries;
		try {
			threadEntries = await fs.readdir(threadsRootDir, { withFileTypes: true });
		} catch (error) {
			if (error?.code === "ENOENT") {
				return ORPHAN_UPLOAD_THREAD_ID;
			}
			throw error;
		}

		for (const entry of threadEntries) {
			if (!entry.isDirectory() || !isStorageId(entry.name)) {
				continue;
			}

			const threadFilePath = buildRovoAppThreadPaths(baseDir, entry.name).threadFilePath;
			try {
				const rawThread = await fs.readFile(threadFilePath, "utf8");
				if (rawThread.includes(`/api/rovo/files/${uploadId}`)) {
					return entry.name;
				}
			} catch (error) {
				if (error?.code !== "ENOENT") {
					throw error;
				}
			}
		}

		return ORPHAN_UPLOAD_THREAD_ID;
	};

	const ensureInitialized = async () => {
		if (initializationPromise) {
			return initializationPromise;
		}

		initializationPromise = (async () => {
			let legacyEntries;
			try {
				legacyEntries = await fs.readdir(legacyMetadataRootDir, { withFileTypes: true });
			} catch (error) {
				if (error?.code === "ENOENT") {
					return;
				}
				throw error;
			}

			for (const entry of legacyEntries) {
				if (!entry.isFile() || !entry.name.endsWith(".json")) {
					continue;
				}

				const uploadId = decodeURIComponent(entry.name.replace(/\.json$/u, ""));
				const metadataPath = path.join(legacyMetadataRootDir, entry.name);
				const rawUpload = await fs.readFile(metadataPath, "utf8");
				const upload = normalizeUpload(safeJsonParse(rawUpload));
				if (!upload || !isStorageId(upload.id)) {
					continue;
				}

				const targetThreadId = await findLegacyThreadIdForUploadId(uploadId);
				const nextUpload = {
					...upload,
					threadId: targetThreadId,
					filePath: "blob",
				};
				await writeUpload(nextUpload, upload.filePath
					? await fs.readFile(path.join(legacyFilesRootDir, upload.filePath)).catch(() => Buffer.alloc(0))
					: Buffer.alloc(0));
				await fs.rm(metadataPath, { force: true });
				if (upload.filePath) {
					await fs.rm(path.join(legacyFilesRootDir, upload.filePath), { force: true });
				}
			}

			await fs.rm(legacyUploadsRootDir, { recursive: true, force: true });
		})();

		return initializationPromise;
	};

	const writeUpload = async (upload, buffer) => {
		const threadId = resolveThreadId(upload.threadId);
		await fs.mkdir(path.dirname(getMetadataPath(threadId, upload.id)), { recursive: true });
		await fs.writeFile(
			getMetadataPath(threadId, upload.id),
			`${JSON.stringify(upload, null, 2)}\n`,
			"utf8",
		);
		await fs.writeFile(getBlobPath(threadId, upload.id), buffer);
	};

	const getUpload = async (uploadId) => {
		await ensureInitialized();
		const uploadRecord = await findUploadRecord(uploadId);
		if (!uploadRecord?.upload) {
			return null;
		}

		const buffer = await fs.readFile(uploadRecord.blobPath).catch(() => null);
		if (!buffer) {
			return null;
		}

		return {
			...uploadRecord.upload,
			buffer,
			absolutePath: uploadRecord.blobPath,
		};
	};

	const createUploadFromBuffer = async ({ threadId, filename, mediaType, buffer }) => {
		await ensureInitialized();
		const uploadId = createId();
		const safeName = sanitizeFileName(filename);
		const resolvedThreadId = resolveThreadId(threadId);
		const upload = normalizeUpload({
			id: uploadId,
			threadId: resolvedThreadId,
			filename: safeName,
			mediaType,
			sizeBytes: buffer.length,
			filePath: "blob",
			createdAt: toIsoDate(),
		});
		await writeUpload(upload, buffer);
		return upload;
	};

	const createUploadFromDataUrl = async ({ threadId, filename, mediaType, dataUrl }) => {
		const parsed = parseDataUrl(dataUrl);
		if (!parsed) {
			throw new Error("Invalid data URL payload.");
		}

		return createUploadFromBuffer({
			threadId,
			filename,
			mediaType:
				typeof mediaType === "string" && mediaType.trim()
					? mediaType.trim()
					: parsed.mediaType,
			buffer: parsed.buffer,
		});
	};

	const deleteUpload = async (uploadId) => {
		await ensureInitialized();
		const uploadRecord = await findUploadRecord(uploadId);
		if (!uploadRecord) {
			return;
		}

		await fs.rm(uploadRecord.metadataPath, { force: true });
		await fs.rm(uploadRecord.blobPath, { force: true });
		await fs.rm(path.dirname(uploadRecord.metadataPath), { recursive: true, force: true });
	};

	const deleteAllUploads = async () => {
		await ensureInitialized();
		let threadEntries;
		try {
			threadEntries = await fs.readdir(threadsRootDir, { withFileTypes: true });
		} catch (error) {
			if (error?.code !== "ENOENT") {
				throw error;
			}
			threadEntries = [];
		}

		await Promise.all(
			threadEntries
				.filter((entry) => entry.isDirectory() && isStorageId(entry.name))
				.map((entry) =>
					fs.rm(buildRovoAppThreadPaths(baseDir, entry.name).uploadsDir, {
						recursive: true,
						force: true,
					}),
				),
		);
		await fs.rm(legacyUploadsRootDir, { recursive: true, force: true });
	};

	return {
		getUpload,
		createUploadFromBuffer,
		createUploadFromDataUrl,
		deleteUpload,
		deleteAllUploads,
	};
}

module.exports = {
	createRovoAppUploadManager,
};
