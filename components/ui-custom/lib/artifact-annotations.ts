import type { ArtifactKind } from "@/components/ui-custom/lib/artifact-kind";
import { collapseWhitespace, createId } from "@/lib/utils";

export type ArtifactAnnotationKind = ArtifactKind;

export interface ArtifactAnnotationSource {
	filePath: string | null;
	lineNumber: number | null;
	componentName: string | null;
	stackString: string;
}

export interface ArtifactAnnotationAnchor {
	selector: string | null;
	textExcerpt: string;
	htmlPreview: string;
	codeLineNumber?: number | null;
	codeLineText?: string | null;
	imagePoint?: {
		x: number;
		y: number;
	} | null;
}

export interface ArtifactAnnotationPosition {
	top: number;
	left: number;
	width: number;
	height: number;
}

export interface ArtifactAnnotation {
	id: string;
	index: number;
	documentId: string;
	documentVersionId: string | null;
	kind: ArtifactAnnotationKind;
	comment: string;
	anchor: ArtifactAnnotationAnchor;
	source: ArtifactAnnotationSource;
	position: ArtifactAnnotationPosition;
	createdAt: number;
}

export interface PendingArtifactSelection {
	element: Element;
	position: ArtifactAnnotationPosition;
	source: ArtifactAnnotationSource;
	anchor: ArtifactAnnotationAnchor;
}

interface CreateAnnotationFromSelectionOptions {
	comment: string;
	createdAt?: number;
	documentId: string;
	documentVersionId: string | null;
	id?: string;
	kind: ArtifactAnnotationKind;
	pendingSelection: Pick<PendingArtifactSelection, "anchor" | "position" | "source">;
}

const DEFAULT_RING_BUFFER_LIMIT = 20;
const MAX_TEXT_LENGTH = 180;
const MAX_HTML_LENGTH = 180;

function createAnnotationId(): string {
	return createId("artifact-annotation");
}

function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, maxLength - 1).trimEnd()}\u2026`;
}

function normalizeComment(comment: string): string {
	return collapseWhitespace(comment);
}

function normalizeAnchor(anchor: ArtifactAnnotationAnchor): ArtifactAnnotationAnchor {
	return {
		selector: collapseWhitespace(anchor.selector),
		textExcerpt: truncate(collapseWhitespace(anchor.textExcerpt), MAX_TEXT_LENGTH),
		htmlPreview: truncate(collapseWhitespace(anchor.htmlPreview), MAX_HTML_LENGTH),
		codeLineNumber: anchor.codeLineNumber ?? null,
		codeLineText: truncate(collapseWhitespace(anchor.codeLineText), MAX_TEXT_LENGTH),
		imagePoint: anchor.imagePoint
			? {
				x: Number(anchor.imagePoint.x.toFixed(3)),
				y: Number(anchor.imagePoint.y.toFixed(3)),
			}
			: null,
	};
}

function formatSource(source: ArtifactAnnotationSource): string {
	if (source.filePath) {
		return source.lineNumber ? `${source.filePath}:${source.lineNumber}` : source.filePath;
	}

	if (source.componentName) {
		return `component ${source.componentName}`;
	}

	if (collapseWhitespace(source.stackString)) {
		return truncate(collapseWhitespace(source.stackString), MAX_TEXT_LENGTH);
	}

	return "unknown";
}

function formatViewerAnchor(anchor: ArtifactAnnotationAnchor, kind: ArtifactAnnotationKind): string {
	if (kind === "code" && anchor.codeLineNumber) {
		return `code line ${anchor.codeLineNumber}`;
	}

	if (kind === "image" && anchor.imagePoint) {
		return `image point (${anchor.imagePoint.x.toFixed(2)}, ${anchor.imagePoint.y.toFixed(2)})`;
	}

	if (anchor.selector) {
		return anchor.selector;
	}

	return "viewer selection";
}

export function createAnnotationFromSelection({
	comment,
	createdAt = Date.now(),
	documentId,
	documentVersionId,
	id = createAnnotationId(),
	kind,
	pendingSelection,
}: CreateAnnotationFromSelectionOptions): ArtifactAnnotation {
	return {
		id,
		index: 0,
		documentId,
		documentVersionId,
		kind,
		comment: normalizeComment(comment),
		anchor: normalizeAnchor(pendingSelection.anchor),
		source: {
			filePath: pendingSelection.source.filePath ?? null,
			lineNumber: pendingSelection.source.lineNumber ?? null,
			componentName: pendingSelection.source.componentName ?? null,
			stackString: pendingSelection.source.stackString ?? "",
		},
		position: {
			top: pendingSelection.position.top,
			left: pendingSelection.position.left,
			width: pendingSelection.position.width,
			height: pendingSelection.position.height,
		},
		createdAt,
	};
}

export function reindexAnnotations(
	annotations: ReadonlyArray<ArtifactAnnotation>,
): ArtifactAnnotation[] {
	return annotations.map((annotation, index) => ({
		...annotation,
		index: index + 1,
	}));
}

export function appendWithRingBuffer(
	annotations: ReadonlyArray<ArtifactAnnotation>,
	annotation: ArtifactAnnotation,
	limit = DEFAULT_RING_BUFFER_LIMIT,
): ArtifactAnnotation[] {
	const normalizedLimit = Math.max(1, Math.floor(limit));
	return reindexAnnotations([...annotations, annotation].slice(-normalizedLimit));
}

export function formatAnnotationsForVoiceContext(
	annotations: ReadonlyArray<ArtifactAnnotation>,
): string {
	if (annotations.length === 0) {
		return "";
	}

	const kinds = [...new Set(annotations.map((annotation) => annotation.kind))];
	const lines = ["[Artifact Annotations]"];

	if (kinds.length === 1) {
		lines.push(`Artifact kind: ${kinds[0]}`);
	}

	for (const annotation of annotations) {
		lines.push("");
		lines.push(
			annotation.comment
				? `#${annotation.index}: "${annotation.comment}"`
				: `#${annotation.index}`,
		);
		lines.push(`- viewer anchor: ${formatViewerAnchor(annotation.anchor, annotation.kind)}`);

		if (annotation.anchor.textExcerpt) {
			lines.push(`- selected text: "${annotation.anchor.textExcerpt}"`);
		} else if (annotation.anchor.codeLineText) {
			lines.push(`- line text: "${annotation.anchor.codeLineText}"`);
		} else if (annotation.anchor.htmlPreview) {
			lines.push(`- html preview: "${annotation.anchor.htmlPreview}"`);
		}

		lines.push(`- source: ${formatSource(annotation.source)}`);

		if (annotation.anchor.selector) {
			lines.push(`- selector: ${annotation.anchor.selector}`);
		}
	}

	return lines.join("\n");
}

export function buildVoiceContextDescription(
	existingContext: string | null | undefined,
	annotationContext: string | null | undefined,
): string {
	const normalizedExisting = collapseWhitespace(existingContext);
	const normalizedAnnotations = (annotationContext ?? "").trim();

	if (!normalizedExisting) {
		return normalizedAnnotations;
	}

	if (!normalizedAnnotations) {
		return normalizedExisting;
	}

	return `${normalizedExisting}\n\n${normalizedAnnotations}`;
}
