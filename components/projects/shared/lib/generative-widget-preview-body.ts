import type { Spec } from "@json-render/react";
import { getElementProps } from "@/components/projects/shared/lib/generative-widget-spec-query";
import { getNonEmptyString, isObjectRecord } from "@/components/projects/shared/lib/generative-widget-text";
import type {
	PreviewAudioBody,
	PreviewBody,
	PreviewExcalidrawScene,
	PreviewImageBody,
	PreviewVideoBody,
	PreviewVideoClip,
	PreviewVideoTrack,
} from "@/components/projects/shared/lib/generative-widget-types";

const GENERATED_MEDIA_ROUTE = "/api/rovo/generated-media";
const GENERATED_VIDEO_PATH_PATTERN =
	/(?:^|[\s"'`])((?:\.\/)?media\/videos\/[^\s"'`]+?\.(?:mp4|webm|mov|m4v|ogv))(?:$|[\s"'`])/giu;
const GENERATED_VIDEO_MIME_TYPES: Readonly<Record<string, string>> = {
	".m4v": "video/x-m4v",
	".mov": "video/quicktime",
	".mp4": "video/mp4",
	".ogv": "video/ogg",
	".webm": "video/webm",
};

function normalizeGeneratedVideoPath(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const normalizedValue = value.trim().replace(/\\/g, "/");
	if (!normalizedValue || normalizedValue.startsWith("/")) {
		return undefined;
	}

	const withoutCurrentDirPrefix = normalizedValue.replace(/^(?:\.\/)+/u, "");
	if (!withoutCurrentDirPrefix) {
		return undefined;
	}

	const segments = withoutCurrentDirPrefix
		.split("/")
		.filter((segment) => segment.length > 0 && segment !== ".");
	if (segments.length === 0) {
		return undefined;
	}

	const normalizedSegments: string[] = [];
	for (const segment of segments) {
		if (segment === "..") {
			return undefined;
		}
		normalizedSegments.push(segment);
	}

	const normalizedPath = normalizedSegments.join("/");
	if (
		!/^media\/videos(?:\/|$)/u.test(normalizedPath) ||
		!/\.(?:mp4|webm|mov|m4v|ogv)$/iu.test(normalizedPath)
	) {
		return undefined;
	}

	return normalizedPath;
}

function buildGeneratedMediaUrl(relativePath: string): string {
	return `${GENERATED_MEDIA_ROUTE}?path=${encodeURIComponent(relativePath)}`;
}

function inferGeneratedVideoMimeType(relativePath: string): string | undefined {
	const extensionMatch = relativePath.match(/\.[^./]+$/u);
	if (!extensionMatch) {
		return undefined;
	}

	return GENERATED_VIDEO_MIME_TYPES[extensionMatch[0].toLowerCase()];
}

function findGeneratedVideoPathInValue(value: unknown, depth = 0): string | undefined {
	if (depth > 6 || value === null || value === undefined) {
		return undefined;
	}

	if (typeof value === "string") {
		for (const match of value.matchAll(new RegExp(GENERATED_VIDEO_PATH_PATTERN))) {
			const normalizedPath = normalizeGeneratedVideoPath(match[1]);
			if (normalizedPath) {
				return normalizedPath;
			}
		}
		return undefined;
	}

	if (Array.isArray(value)) {
		for (const entry of value) {
			const nestedMatch = findGeneratedVideoPathInValue(entry, depth + 1);
			if (nestedMatch) {
				return nestedMatch;
			}
		}
		return undefined;
	}

	if (!isObjectRecord(value)) {
		return undefined;
	}

	for (const entry of Object.values(value)) {
		const nestedMatch = findGeneratedVideoPathInValue(entry, depth + 1);
		if (nestedMatch) {
			return nestedMatch;
		}
	}

	return undefined;
}

const SANITIZED_SPEC_TEXT_PROP_KEYS = [
	"title",
	"description",
	"content",
	"text",
	"label",
	"subtitle",
	"summary",
	"caption",
	"placeholder",
] as const;

function sanitizeSpecElementTextProps(
	elements: Record<string, unknown>
): Record<string, unknown> {
	let hasChanges = false;
	const sanitizedElements: Record<string, unknown> = {};

	for (const [key, element] of Object.entries(elements)) {
		if (!isObjectRecord(element)) {
			sanitizedElements[key] = element;
			continue;
		}

		const props = getElementProps(element);
		if (!props) {
			sanitizedElements[key] = element;
			continue;
		}

		let propsChanged = false;
		const nextProps: Record<string, unknown> = { ...props };
		for (const propKey of SANITIZED_SPEC_TEXT_PROP_KEYS) {
			if (!Object.prototype.hasOwnProperty.call(nextProps, propKey)) {
				continue;
			}

			const rawValue = nextProps[propKey];
			if (typeof rawValue !== "string") {
				continue;
			}

			const sanitizedValue = getNonEmptyString(rawValue);
			if (!sanitizedValue) {
				delete nextProps[propKey];
				propsChanged = true;
				continue;
			}

			if (sanitizedValue !== rawValue) {
				nextProps[propKey] = sanitizedValue;
				propsChanged = true;
			}
		}

		if (!propsChanged) {
			sanitizedElements[key] = element;
			continue;
		}

		sanitizedElements[key] = {
			...element,
			props: nextProps,
		};
		hasChanges = true;
	}

	return hasChanges ? sanitizedElements : elements;
}

export function parseJsonRenderPreviewBody(value: unknown): Extract<PreviewBody, { kind: "json-render" }> | null {
	if (!isObjectRecord(value) || !isObjectRecord(value.spec)) {
		return null;
	}

	const rawSpec = value.spec;
	const root = typeof rawSpec.root === "string" ? rawSpec.root : "";
	const elements = isObjectRecord(rawSpec.elements) ? rawSpec.elements : null;
	if (!root.trim() || !elements || Object.keys(elements).length === 0) {
		return null;
	}

	const sanitizedElements = sanitizeSpecElementTextProps(elements);
	return {
		kind: "json-render",
		spec: {
			root,
			elements: sanitizedElements,
			...(Object.prototype.hasOwnProperty.call(rawSpec, "state")
				? { state: rawSpec.state }
				: {}),
		} as Spec,
	};
}

export function parseAudioPreviewBody(value: unknown): PreviewAudioBody | null {
	if (!isObjectRecord(value) || typeof value.audioUrl !== "string") {
		return null;
	}

	const audioUrl = value.audioUrl.trim();
	if (!audioUrl) {
		return null;
	}

	const mimeType = getNonEmptyString(value.mimeType);
	const transcript = getNonEmptyString(value.transcript);

	return {
		kind: "audio",
		audioUrl,
		...(mimeType ? { mimeType } : {}),
		...(transcript ? { transcript } : {}),
	};
}

export function parseImagePreviewBody(value: unknown): PreviewImageBody | null {
	if (!isObjectRecord(value) || !Array.isArray(value.images)) {
		return null;
	}

	const images = value.images
		.filter((entry): entry is Record<string, unknown> => isObjectRecord(entry))
		.map((entry) => ({
			url: typeof entry.url === "string" ? entry.url.trim() : "",
			mimeType: getNonEmptyString(entry.mimeType),
		}))
		.filter((entry) => entry.url.length > 0);
	if (images.length === 0) {
		return null;
	}

	const prompt = getNonEmptyString(value.prompt);

	return {
		kind: "image",
		images,
		...(prompt ? { prompt } : {}),
	};
}

export function parseVideoPreviewBody(value: unknown): PreviewVideoBody | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	const directVideoUrl =
		getNonEmptyString(value.videoUrl) || getNonEmptyString(value.url);
	const posterUrl = getNonEmptyString(value.posterUrl);
	const mimeType = getNonEmptyString(value.mimeType);
	const fileName =
		getNonEmptyString(value.fileName) || getNonEmptyString(value.filename);

	const composition = isObjectRecord(value.composition)
		? value.composition
		: null;
	const compositionFps =
		composition && typeof composition.fps === "number"
			? composition.fps
			: null;
	const compositionDurationInFrames =
		composition && typeof composition.durationInFrames === "number"
			? composition.durationInFrames
			: null;
	const hasValidComposition =
		Boolean(composition) &&
		typeof compositionFps === "number" &&
		typeof compositionDurationInFrames === "number";

	if (!directVideoUrl && !hasValidComposition) {
		return null;
	}

	const body: PreviewVideoBody = {
		kind: "video",
		...(directVideoUrl ? { videoUrl: directVideoUrl } : {}),
		...(mimeType ? { mimeType } : {}),
		...(posterUrl ? { posterUrl } : {}),
		...(fileName ? { fileName } : {}),
		...(isObjectRecord(value.audio) ? { audio: value.audio as { tracks: unknown[] } } : {}),
	};

	if (hasValidComposition && composition) {
		body.composition = {
			id: typeof composition.id === "string" ? composition.id : "main",
			fps: compositionFps,
			width: typeof composition.width === "number" ? composition.width : 1920,
			height: typeof composition.height === "number" ? composition.height : 1080,
			durationInFrames: compositionDurationInFrames,
		};
		body.tracks = Array.isArray(value.tracks) ? value.tracks as PreviewVideoTrack[] : [];
		body.clips = Array.isArray(value.clips) ? value.clips as PreviewVideoClip[] : [];
	}

	return body;
}

export function parseExcalidrawPreviewScene(value: unknown): PreviewExcalidrawScene | null {
	if (!isObjectRecord(value) || !Array.isArray(value.elements)) {
		return null;
	}

	const type = getNonEmptyString(value.type);
	const source = getNonEmptyString(value.source);
	const appState = isObjectRecord(value.appState) ? value.appState : null;
	const files = isObjectRecord(value.files) ? value.files : undefined;
	const version = typeof value.version === "number" ? value.version : undefined;

	return {
		...(type ? { type } : {}),
		...(version !== undefined ? { version } : {}),
		...(source ? { source } : {}),
		elements: value.elements,
		...(appState ? { appState } : {}),
		...(files ? { files } : {}),
	};
}

export function parseExplicitPreviewBody(value: unknown): PreviewBody | null {
	if (!isObjectRecord(value) || !isObjectRecord(value.body)) {
		return null;
	}

	const body = value.body;
	const kind = getNonEmptyString(body.kind);
	if (!kind) {
		return { kind: "json", value: body };
	}

	if (kind === "json-render") {
		return parseJsonRenderPreviewBody(body);
	}

	if (kind === "audio") {
		return parseAudioPreviewBody(body);
	}

	if (kind === "image") {
		return parseImagePreviewBody(body);
	}

	if (kind === "video") {
		return parseVideoPreviewBody(body);
	}

	if (kind === "text") {
		const text = getNonEmptyString(body.text);
		if (!text) {
			return null;
		}

		return {
			kind: "text",
			text,
			...(typeof body.markdown === "boolean" ? { markdown: body.markdown } : {}),
		};
	}

	if (kind === "code") {
		const code = getNonEmptyString(body.code);
		if (!code) {
			return null;
		}

		const language = getNonEmptyString(body.language);
		return {
			kind: "code",
			code,
			...(language ? { language } : {}),
		};
	}

	if (kind === "html") {
		const html = getNonEmptyString(body.html ?? body.content);
		if (!html) {
			return null;
		}

		const summary = getNonEmptyString(body.summary);
		return {
			kind: "html",
			html,
			...(summary ? { summary } : {}),
		};
	}

	if (kind === "app-url") {
		const url = getNonEmptyString(body.url);
		if (!url) {
			return null;
		}

		const summary = getNonEmptyString(body.summary);
		return {
			kind: "app-url",
			url,
			...(summary ? { summary } : {}),
		};
	}

	if (kind === "excalidraw") {
		const scene = parseExcalidrawPreviewScene(body.scene ?? body);
		return scene ? { kind: "excalidraw", scene } : null;
	}

	if (kind === "json") {
		return {
			kind: "json",
			value: Object.prototype.hasOwnProperty.call(body, "value") ? body.value : body,
		};
	}

	return {
		kind: "json",
		value: body,
	};
}

export function inferGeneratedVideoPreviewBody(value: unknown): PreviewVideoBody | null {
	const generatedVideoPath = findGeneratedVideoPathInValue(value);
	if (!generatedVideoPath) {
		return null;
	}

	return {
		kind: "video",
		videoUrl: buildGeneratedMediaUrl(generatedVideoPath),
		mimeType: inferGeneratedVideoMimeType(generatedVideoPath),
		fileName: generatedVideoPath.split("/").at(-1),
	};
}
