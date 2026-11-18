import type { FileUIPart, SourceDocumentUIPart } from "ai";

export type AttachmentData =
	| (FileUIPart & { id: string })
	| (SourceDocumentUIPart & { id: string });

export type AttachmentMediaCategory =
	| "image"
	| "video"
	| "audio"
	| "document"
	| "source"
	| "unknown";

export function getMediaCategory(data: AttachmentData): AttachmentMediaCategory {
	if (data.type === "source-document") {
		return "source";
	}

	const mediaType = data.mediaType ?? "";

	if (mediaType.startsWith("image/")) {
		return "image";
	}
	if (mediaType.startsWith("video/")) {
		return "video";
	}
	if (mediaType.startsWith("audio/")) {
		return "audio";
	}
	if (mediaType.startsWith("application/") || mediaType.startsWith("text/")) {
		return "document";
	}

	return "unknown";
}

export function getAttachmentLabel(data: AttachmentData): string {
	if (data.type === "source-document") {
		return data.title || data.filename || "Source";
	}

	const category = getMediaCategory(data);
	return data.filename || (category === "image" ? "Image" : "Attachment");
}

/** Stable React key and `id` for a file part that arrives without one. */
export function getFileAttachmentId(part: Pick<FileUIPart, "url" | "filename">, scope?: string): string {
	const base = `${part.url}-${part.filename ?? "attachment"}`;
	return scope ? `${scope}-${base}` : base;
}
