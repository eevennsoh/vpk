import { formatDistanceToNow } from "date-fns";
import type { ArtifactKind } from "@/components/ui-custom/lib/artifact-kind";

export interface ArtifactVersion {
	id: string;
	content: string;
	title: string;
	changeLabel: string;
	createdAt: string;
}

export interface ArtifactDocument {
	id: string;
	title: string;
	kind: ArtifactKind;
	previewSummary?: string;
	versions: ArtifactVersion[];
	createdAt: string;
	updatedAt: string;
}

export function getArtifactVersionNumber(
	document: Pick<ArtifactDocument, "versions">,
	versionId: string,
): number {
	const versionIndex = document.versions.findIndex((version) => version.id === versionId);
	return versionIndex === -1 ? document.versions.length : versionIndex + 1;
}

export function getArtifactVersionTitle(options: {
	document: Pick<ArtifactDocument, "title">;
	version: Pick<ArtifactVersion, "title"> | null;
}): string {
	return options.version?.title ?? options.document.title;
}

export function formatArtifactVersionLabel(options: {
	document: Pick<ArtifactDocument, "versions">;
	referenceDate?: Date;
	version: Pick<ArtifactVersion, "changeLabel" | "createdAt" | "id">;
}): string {
	const versionNumber = getArtifactVersionNumber(
		options.document,
		options.version.id,
	);
	const relativeTime = formatDistanceToNow(
		new Date(options.version.createdAt),
		{
			addSuffix: true,
			...(options.referenceDate
				? { now: options.referenceDate.getTime() }
				: {}),
		},
	);

	return `Version ${versionNumber} \u2022 ${options.version.changeLabel} \u2022 ${relativeTime}`;
}

export function formatArtifactVersionSummaryLabel(options: {
	referenceDate?: Date;
	version: Pick<ArtifactVersion, "changeLabel" | "createdAt">;
}): string {
	const relativeTime = formatDistanceToNow(
		new Date(options.version.createdAt),
		{
			addSuffix: true,
			...(options.referenceDate
				? { now: options.referenceDate.getTime() }
				: {}),
		},
	);

	return `${options.version.changeLabel} \u2022 ${relativeTime}`;
}
