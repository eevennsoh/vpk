import type { PreviewBody } from "@/components/projects/shared/lib/generative-widget";
import { parseExcalidrawPreviewScene } from "@/components/projects/shared/lib/generative-widget-preview-body";

export type PreviewArtifactKind = "text" | "code" | "html" | "image" | "sheet" | "react" | "excalidraw" | "browser";

function parseExcalidrawSceneString(content: string) {
	const trimmedContent = content.trim();
	if (!trimmedContent.startsWith("{") || !trimmedContent.endsWith("}")) {
		return null;
	}

	try {
		const parsed = JSON.parse(trimmedContent) as unknown;
		return parseExcalidrawPreviewScene(parsed);
	} catch {
		return null;
	}
}

export function buildArtifactPreviewBody({
	content,
	kind,
	summary,
}: Readonly<{
	content: string;
	kind: PreviewArtifactKind;
	summary?: string | null;
}>): PreviewBody {
	const excalidrawScene = parseExcalidrawSceneString(content);
	if (excalidrawScene) {
		return {
			kind: "excalidraw",
			scene: excalidrawScene,
		};
	}

	if (kind === "react") {
		return {
			kind: "app-url",
			url: content,
			...(summary?.trim() ? { summary: summary.trim() } : {}),
		};
	}

	if (kind === "html") {
		return {
			kind: "html",
			html: content,
			...(summary?.trim() ? { summary: summary.trim() } : {}),
		};
	}

	if (kind === "code") {
		return {
			kind: "code",
			code: content,
		};
	}

	if (kind === "excalidraw") {
		return {
			kind: "text",
			text: content,
			markdown: false,
		};
	}

	if (kind === "image" && /^https?:|^data:image\//u.test(content)) {
		return {
			kind: "image",
			images: [{ url: content }],
		};
	}

	return {
		kind: "text",
		text: content,
		markdown: true,
	};
}
