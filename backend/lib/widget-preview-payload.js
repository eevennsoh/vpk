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
			// The turn that produced the video owns it (lib/generated-media-owners.js).
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

function withCanonicalPreviewBody(type, payload) {
	if (!isObjectRecord(payload) || isObjectRecord(payload.body)) {
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
