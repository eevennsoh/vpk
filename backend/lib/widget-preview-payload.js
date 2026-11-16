const path = require("node:path");

const {
	buildGeneratedMediaUrl,
	findGeneratedVideoPathInValue,
	inferGeneratedMediaContentType,
	parseGeneratedMediaUrlPath,
} = require("./generated-media");
const { recordGeneratedMediaForCurrentScope } = require("./generated-media-owners");

function isObjectRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

function normalizeImageEntries(images) {
	if (!Array.isArray(images)) {
		return [];
	}

	return images
		.filter((entry) => isObjectRecord(entry))
		.map((entry) => ({
			url: typeof entry.url === "string" ? entry.url.trim() : "",
			...(getNonEmptyString(entry.mimeType) ? { mimeType: getNonEmptyString(entry.mimeType) } : {}),
		}))
		.filter((entry) => entry.url.length > 0);
}

function buildVideoPreviewBody(payload) {
	if (!isObjectRecord(payload)) {
		return null;
	}

	const directVideoUrl =
		getNonEmptyString(payload.videoUrl) || getNonEmptyString(payload.url);
	const directMimeType = getNonEmptyString(payload.mimeType);
	const directPosterUrl = getNonEmptyString(payload.posterUrl);
	const directFileName =
		getNonEmptyString(payload.fileName) || getNonEmptyString(payload.filename);
	if (directVideoUrl) {
		const generatedMediaPath = parseGeneratedMediaUrlPath(directVideoUrl);
		if (generatedMediaPath) {
			recordGeneratedMediaForCurrentScope(generatedMediaPath);
		}
		return {
			kind: "video",
			videoUrl: directVideoUrl,
			...(directMimeType ? { mimeType: directMimeType } : {}),
			...(directPosterUrl ? { posterUrl: directPosterUrl } : {}),
			...(directFileName ? { fileName: directFileName } : {}),
		};
	}

	const generatedVideoPath = findGeneratedVideoPathInValue(payload);
	if (generatedVideoPath) {
		const generatedVideoUrl = buildGeneratedMediaUrl(generatedVideoPath);
		if (generatedVideoUrl) {
			// The turn that produced the video owns it (backend/lib/generated-media-owners.js).
			recordGeneratedMediaForCurrentScope(generatedVideoPath);
			return {
				kind: "video",
				videoUrl: generatedVideoUrl,
				mimeType:
					inferGeneratedMediaContentType(generatedVideoPath) || undefined,
				fileName: path.posix.basename(generatedVideoPath),
			};
		}
	}

	if (
		isObjectRecord(payload.composition) &&
		typeof payload.composition.fps === "number" &&
		typeof payload.composition.durationInFrames === "number"
	) {
		return {
			kind: "video",
			composition: payload.composition,
			tracks: Array.isArray(payload.tracks) ? payload.tracks : [],
			clips: Array.isArray(payload.clips) ? payload.clips : [],
			...(isObjectRecord(payload.audio) ? { audio: payload.audio } : {}),
		};
	}

	return null;
}

/** The generated video a video URL (as the client reads it) serves, or null. */
function generatedMediaPathOfUrl(value) {
	if (!isObjectRecord(value)) {
		return null;
	}
	const videoUrl = getNonEmptyString(value.videoUrl) || getNonEmptyString(value.url);
	return videoUrl ? parseGeneratedMediaUrlPath(videoUrl) : null;
}

/** Whether the client accepts a value's spec as a json-render body (parseJsonRenderPreviewBody). */
function hasRenderableSpec(value) {
	if (!isObjectRecord(value) || !isObjectRecord(value.spec)) {
		return false;
	}
	const { root, elements } = value.spec;
	return typeof root === "string" && root.trim().length > 0
		&& isObjectRecord(elements) && Object.keys(elements).length > 0;
}

/** Whether the client accepts a body as a video body (parseVideoPreviewBody). */
function isPlayableVideoBody(body) {
	const composition = body.composition;
	return Boolean(getNonEmptyString(body.videoUrl) || getNonEmptyString(body.url))
		|| (isObjectRecord(composition)
			&& typeof composition.fps === "number"
			&& typeof composition.durationInFrames === "number");
}

/**
 * The generated video the client plays for a payload that already declares its body
 * (parseGenuiPreviewWidgetData and parseVideoPreviewWidgetData in
 * components/projects/shared/lib/generative-widget-parse.ts), or null:
 * - a video-preview plays its top-level URL and ignores the body;
 * - a genui-preview with a playable video body plays that body's URL;
 * - a genui-preview with a renderable json-render body plays a generated video path
 *   found anywhere in the payload;
 * - a genui-preview whose video or json-render body the client rejects falls back to the
 *   top-level spec, and plays a generated video path found in the payload when that spec
 *   renders.
 * Scanning the payload claims a path the model wrote, so a turn could name another
 * caller's video. Claims are first-come and only for files younger than
 * CLAIM_MAX_FILE_AGE_MS (backend/lib/generated-media-owners.js), which keeps that to a
 * fresh, still-unclaimed video; previews without a body have always been scanned this way.
 */
function findPlayedGeneratedVideoPath(type, payload) {
	if (type === "video-preview") {
		return generatedMediaPathOfUrl(payload);
	}
	if (type !== "genui-preview") {
		return null;
	}
	const kind = getNonEmptyString(payload.body.kind);
	if (kind === "video" && isPlayableVideoBody(payload.body)) {
		return generatedMediaPathOfUrl(payload.body);
	}
	if (kind === "json-render" && hasRenderableSpec(payload.body)) {
		return findGeneratedVideoPathInValue(payload);
	}
	if ((kind === "video" || kind === "json-render") && hasRenderableSpec(payload)) {
		return findGeneratedVideoPathInValue(payload);
	}
	return null;
}

function withCanonicalPreviewBody(type, payload) {
	if (!isObjectRecord(payload)) {
		return payload;
	}

	if (isObjectRecord(payload.body)) {
		// The body is kept as declared, but the video it plays was just produced by this
		// turn, so its caller owns it (backend/lib/generated-media-owners.js).
		const playedVideoPath = findPlayedGeneratedVideoPath(type, payload);
		if (playedVideoPath) {
			recordGeneratedMediaForCurrentScope(playedVideoPath);
		}
		return payload;
	}

	if (type === "genui-preview") {
		const inferredVideoBody = buildVideoPreviewBody(payload);
		if (inferredVideoBody) {
			return {
				...payload,
				body: inferredVideoBody,
			};
		}
	}

	if (type === "genui-preview" && isObjectRecord(payload.spec)) {
		return {
			...payload,
			body: {
				kind: "json-render",
				spec: payload.spec,
			},
		};
	}

	if (type === "audio-preview" && getNonEmptyString(payload.audioUrl)) {
		return {
			...payload,
			body: {
				kind: "audio",
				audioUrl: payload.audioUrl.trim(),
				...(getNonEmptyString(payload.mimeType) ? { mimeType: getNonEmptyString(payload.mimeType) } : {}),
				...(getNonEmptyString(payload.transcript) ? { transcript: getNonEmptyString(payload.transcript) } : {}),
			},
		};
	}

	if (type === "image-preview") {
		const images = normalizeImageEntries(payload.images);
		if (images.length === 0) {
			return payload;
		}

		return {
			...payload,
			body: {
				kind: "image",
				images,
				...(getNonEmptyString(payload.prompt) ? { prompt: getNonEmptyString(payload.prompt) } : {}),
			},
		};
	}

	if (type === "video-preview") {
		const videoBody = buildVideoPreviewBody(payload);
		if (!videoBody) {
			return payload;
		}

		return {
			...payload,
			body: videoBody,
		};
	}

	return payload;
}

module.exports = {
	withCanonicalPreviewBody,
};
