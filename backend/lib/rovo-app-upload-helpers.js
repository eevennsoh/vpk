"use strict";

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppMessageFilePersistence requires ${name}`);
	}
}

function buildRovoAppFileUrl(uploadId) {
	return `/api/rovo/files/${encodeURIComponent(uploadId)}`;
}

function extractRovoAppUploadIdFromUrl(rawUrl) {
	if (typeof rawUrl !== "string" || rawUrl.length === 0) {
		return null;
	}

	const match = rawUrl.match(/\/api\/rovo\/files\/([^/?#]+)/u);
	if (!match?.[1]) {
		return null;
	}

	try {
		return decodeURIComponent(match[1]);
	} catch {
		return match[1];
	}
}

function getPngImageDimensions(buffer) {
	if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
		return null;
	}

	if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
		return null;
	}

	return {
		height: buffer.readUInt32BE(20),
		width: buffer.readUInt32BE(16),
	};
}

function getJpegImageDimensions(buffer) {
	if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
		return null;
	}

	if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
		return null;
	}

	let offset = 2;
	while (offset + 8 < buffer.length) {
		if (buffer[offset] !== 0xff) {
			offset += 1;
			continue;
		}

		const marker = buffer[offset + 1];
		offset += 2;

		if (marker === 0xd8 || marker === 0xd9) {
			continue;
		}

		if (offset + 2 > buffer.length) {
			break;
		}

		const segmentLength = buffer.readUInt16BE(offset);
		if (segmentLength < 2 || offset + segmentLength > buffer.length) {
			break;
		}

		const isStartOfFrame =
			(marker >= 0xc0 && marker <= 0xc3) ||
			(marker >= 0xc5 && marker <= 0xc7) ||
			(marker >= 0xc9 && marker <= 0xcb) ||
			(marker >= 0xcd && marker <= 0xcf);
		if (isStartOfFrame && segmentLength >= 7) {
			return {
				height: buffer.readUInt16BE(offset + 3),
				width: buffer.readUInt16BE(offset + 5),
			};
		}

		offset += segmentLength;
	}

	return null;
}

function getRovoAppBrowserImageMetadata(buffer) {
	const pngDimensions = getPngImageDimensions(buffer);
	if (pngDimensions) {
		return {
			contentType: "image/png",
			extension: "png",
			...pngDimensions,
		};
	}

	const jpegDimensions = getJpegImageDimensions(buffer);
	if (jpegDimensions) {
		return {
			contentType: "image/jpeg",
			extension: "jpg",
			...jpegDimensions,
		};
	}

	return {
		contentType: "image/png",
		extension: "png",
		height: undefined,
		width: undefined,
	};
}

function normalizeRovoAppBrowserScreenshotContentType(rawContentType, fallbackContentType) {
	if (typeof rawContentType !== "string" || rawContentType.trim().length === 0) {
		return fallbackContentType;
	}

	const normalized = rawContentType.trim().toLowerCase();
	if (normalized === "image/jpg") {
		return "image/jpeg";
	}
	if (normalized === "image/jpeg" || normalized === "image/png") {
		return normalized;
	}

	return fallbackContentType;
}

function createRovoAppBrowserScreenshotPersister({
	buildFileUrl = buildRovoAppFileUrl,
	now = Date.now,
	rovoAppUploadManager,
} = {}) {
	return async function persistRovoAppBrowserScreenshotBuffer({
		buffer,
		contentType,
		threadId,
	}) {
		const metadata = getRovoAppBrowserImageMetadata(buffer);
		const resolvedContentType = normalizeRovoAppBrowserScreenshotContentType(
			contentType,
			metadata.contentType,
		);
		const extension = resolvedContentType === "image/jpeg" ? "jpg" : metadata.extension;
		const upload = await rovoAppUploadManager.createUploadFromBuffer({
			threadId,
			filename: `browser-screenshot-${now()}.${extension}`,
			mediaType: resolvedContentType,
			buffer,
		});

		return {
			contentType: resolvedContentType,
			height: metadata.height,
			imageUrl: buildFileUrl(upload.id),
			width: metadata.width,
		};
	};
}

function collectRovoAppUploadIdsFromMessages(messages) {
	if (!Array.isArray(messages)) {
		return [];
	}

	const uploadIds = new Set();
	for (const message of messages) {
		if (!message || typeof message !== "object" || !Array.isArray(message.parts)) {
			continue;
		}

		for (const part of message.parts) {
			if (!part || typeof part !== "object") {
				continue;
			}

			const uploadId = part.type === "file"
				? extractRovoAppUploadIdFromUrl(part.url)
				: part.type === "data-browser-screenshot"
					? extractRovoAppUploadIdFromUrl(part.data?.imageUrl)
					: null;
			if (uploadId) {
				uploadIds.add(uploadId);
			}
		}
	}

	return [...uploadIds];
}

function createRovoAppMessageFilePersistence({
	buildFileUrl = buildRovoAppFileUrl,
	persistBrowserScreenshotBuffer,
	rovoAppGeneratedFilesManager,
	rovoAppThreadManager,
	rovoAppUploadManager,
} = {}) {
	const persistRovoAppBrowserScreenshotBuffer =
		typeof persistBrowserScreenshotBuffer === "function"
			? persistBrowserScreenshotBuffer
			: createRovoAppBrowserScreenshotPersister({
				buildFileUrl,
				rovoAppUploadManager,
			});

	requireFunction("persistBrowserScreenshotBuffer", persistRovoAppBrowserScreenshotBuffer);
	requireFunction("rovoAppGeneratedFilesManager.recordRunGeneratedFiles", rovoAppGeneratedFilesManager?.recordRunGeneratedFiles);
	requireFunction("rovoAppGeneratedFilesManager.captureRootFilesToWorkspace", rovoAppGeneratedFilesManager?.captureRootFilesToWorkspace);
	requireFunction("rovoAppThreadManager.updateThread", rovoAppThreadManager?.updateThread);
	requireFunction("rovoAppUploadManager.createUploadFromDataUrl", rovoAppUploadManager?.createUploadFromDataUrl);

	async function persistMessageFiles(threadId, messages) {
		if (!Array.isArray(messages)) {
			return [];
		}

		const nextMessages = [];
		for (const message of messages) {
			if (!message || typeof message !== "object") {
				continue;
			}

			const messageParts = Array.isArray(message.parts) ? message.parts : [];
			const nextParts = [];
			for (const part of messageParts) {
				if (!part || typeof part !== "object") {
					nextParts.push(part);
					continue;
				}

				if (part.type === "data-browser-screenshot") {
					const screenshotData =
						part.data && typeof part.data === "object" ? part.data : null;
					const imageData =
						typeof screenshotData?.imageData === "string" && screenshotData.imageData.trim()
							? screenshotData.imageData.trim()
							: null;
					if (!imageData) {
						nextParts.push(part);
						continue;
					}

					const buffer = Buffer.from(imageData, "base64");
					const persistedScreenshot = await persistRovoAppBrowserScreenshotBuffer({
						threadId,
						buffer,
						contentType: screenshotData?.contentType,
					});
					const screenshotOutput = {
						...screenshotData,
						...persistedScreenshot,
						timestamp:
							typeof screenshotData.timestamp === "string" &&
							screenshotData.timestamp.trim()
								? screenshotData.timestamp
								: new Date().toISOString(),
					};
					delete screenshotOutput.imageData;
					nextParts.push({
						...part,
						data: screenshotOutput,
					});
					continue;
				}

				if (part.type !== "file") {
					nextParts.push(part);
					continue;
				}

				if (typeof part.url === "string" && part.url.startsWith("data:")) {
					const upload = await rovoAppUploadManager.createUploadFromDataUrl({
						threadId,
						filename:
							typeof part.filename === "string" && part.filename.trim()
								? part.filename
								: typeof part.name === "string" && part.name.trim()
									? part.name
									: "attachment.bin",
						mediaType:
							typeof part.mediaType === "string" && part.mediaType.trim()
								? part.mediaType
								: "application/octet-stream",
						dataUrl: part.url,
					});
					nextParts.push({
						...part,
						filename: upload.filename,
						url: buildFileUrl(upload.id),
					});
					continue;
				}

				nextParts.push(part);
			}

			nextMessages.push({
				...message,
				parts: nextParts,
			});
		}

		return nextMessages;
	}

	function hasPersistedBrowserScreenshotImageData(messages) {
		if (!Array.isArray(messages)) {
			return false;
		}

		for (const message of messages) {
			if (!message || typeof message !== "object" || !Array.isArray(message.parts)) {
				continue;
			}

			for (const part of message.parts) {
				if (
					part?.type === "data-browser-screenshot" &&
					typeof part.data?.imageData === "string" &&
					part.data.imageData.trim().length > 0
				) {
					return true;
				}
			}
		}

		return false;
	}

	async function maybeMigratePersistedThreadBrowserScreenshots(thread) {
		if (!thread?.id || !hasPersistedBrowserScreenshotImageData(thread.messages)) {
			return thread;
		}

		const persistedMessages = await persistMessageFiles(thread.id, thread.messages);
		return (
			await rovoAppThreadManager.updateThread(thread.id, {
				messages: persistedMessages,
				updatedAt: thread.updatedAt,
			})
		) ?? {
			...thread,
			messages: persistedMessages,
		};
	}

	// `producedMessages` are the parts the finished run produced (selectRunProducedMessages),
	// not the stored thread, whose messages a client can write.
	async function synchronizeThreadGeneratedFiles(thread, { producedMessages = [] } = {}) {
		if (!thread?.id) {
			return thread;
		}

		await rovoAppGeneratedFilesManager.recordRunGeneratedFiles(thread.id, producedMessages);
		await rovoAppGeneratedFilesManager.captureRootFilesToWorkspace(thread.id);
		return thread;
	}

	return {
		hasPersistedBrowserScreenshotImageData,
		maybeMigratePersistedThreadBrowserScreenshots,
		persistBrowserScreenshotBuffer: persistRovoAppBrowserScreenshotBuffer,
		persistMessageFiles,
		synchronizeThreadGeneratedFiles,
	};
}

module.exports = {
	buildRovoAppFileUrl,
	collectRovoAppUploadIdsFromMessages,
	createRovoAppMessageFilePersistence,
	createRovoAppBrowserScreenshotPersister,
	extractRovoAppUploadIdFromUrl,
	getJpegImageDimensions,
	getPngImageDimensions,
	getRovoAppBrowserImageMetadata,
	normalizeRovoAppBrowserScreenshotContentType,
};
