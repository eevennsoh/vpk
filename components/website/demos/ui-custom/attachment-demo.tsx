"use client";

import Image from "next/image";
import {
	Attachment,
	AttachmentItem,
	AttachmentPreview,
	AttachmentInfo,
	AttachmentRemove,
	AttachmentHoverCard,
	AttachmentHoverCardTrigger,
	AttachmentHoverCardContent,
	AttachmentEmpty,
} from "@/components/ui-custom/attachment";
import type { AttachmentData } from "@/components/ui-custom/attachment";

// ============================================================================
// Sample data
// ============================================================================

const SAMPLE_IMAGE: AttachmentData = {
	id: "1",
	type: "file",
	mediaType: "image/png",
	filename: "screenshot.png",
	url: "https://picsum.photos/seed/vpk-attach-1/400/300",
};

const SAMPLE_PDF: AttachmentData = {
	id: "2",
	type: "file",
	mediaType: "application/pdf",
	filename: "quarterly-report.pdf",
	url: "",
};

const SAMPLE_VIDEO: AttachmentData = {
	id: "3",
	type: "file",
	mediaType: "video/mp4",
	filename: "demo-recording.mp4",
	url: "",
};

const SAMPLE_SOURCE: AttachmentData = {
	id: "4",
	type: "source-document",
	sourceId: "src-1",
	mediaType: "text/html",
	title: "Atlassian Design System",
	filename: "atlassian.design",
	providerMetadata: {},
};

const SAMPLE_AUDIO: AttachmentData = {
	id: "5",
	type: "file",
	mediaType: "audio/mpeg",
	filename: "podcast-episode.mp3",
	url: "",
};

const SAMPLE_IMAGE_2: AttachmentData = {
	id: "6",
	type: "file",
	mediaType: "image/jpeg",
	filename: "architecture-diagram.jpg",
	url: "https://picsum.photos/seed/vpk-attach-2/400/300",
};

const ALL_FILES: AttachmentData[] = [
	SAMPLE_IMAGE,
	SAMPLE_PDF,
	SAMPLE_VIDEO,
	SAMPLE_SOURCE,
	SAMPLE_AUDIO,
	SAMPLE_IMAGE_2,
];

const IMAGE_FILES: AttachmentData[] = [SAMPLE_IMAGE, SAMPLE_IMAGE_2];

// ============================================================================
// Default demo — Grid with images
// ============================================================================

export default function AttachmentDemo() {
	return (
		<Attachment variant="grid">
			{IMAGE_FILES.map((file) => (
				<AttachmentItem key={file.id} data={file} onRemove={() => {}}>
					<AttachmentPreview />
					<AttachmentRemove />
				</AttachmentItem>
			))}
		</Attachment>
	);
}

// ============================================================================
// Grid variant — mixed file types with remove
// ============================================================================

export function AttachmentDemoGrid() {
	return (
		<Attachment variant="grid">
			{ALL_FILES.slice(0, 4).map((file) => (
				<AttachmentItem key={file.id} data={file} onRemove={() => {}}>
					<AttachmentPreview />
					<AttachmentRemove />
				</AttachmentItem>
			))}
		</Attachment>
	);
}

// ============================================================================
// Inline variant — compact badges with info
// ============================================================================

export function AttachmentDemoInline() {
	return (
		<Attachment variant="inline">
			{ALL_FILES.slice(0, 3).map((file) => (
				<AttachmentItem key={file.id} data={file} onRemove={() => {}}>
					<AttachmentPreview />
					<AttachmentInfo />
					<AttachmentRemove />
				</AttachmentItem>
			))}
		</Attachment>
	);
}

// ============================================================================
// List variant — full rows with media type
// ============================================================================

export function AttachmentDemoList() {
	return (
		<Attachment variant="list">
			{ALL_FILES.slice(0, 4).map((file) => (
				<AttachmentItem key={file.id} data={file} onRemove={() => {}}>
					<AttachmentPreview />
					<AttachmentInfo showMediaType />
					<AttachmentRemove />
				</AttachmentItem>
			))}
		</Attachment>
	);
}

// ============================================================================
// Hover card — inline with hover preview
// ============================================================================

export function AttachmentDemoHoverCard() {
	return (
		<Attachment variant="inline">
			{IMAGE_FILES.map((file) => (
				<AttachmentHoverCard key={file.id}>
					<AttachmentItem data={file}>
						<AttachmentHoverCardTrigger>
							<AttachmentPreview />
							<AttachmentInfo />
						</AttachmentHoverCardTrigger>
					</AttachmentItem>
					<AttachmentHoverCardContent>
							<Image
								alt={file.filename ?? "Preview"}
								className="max-h-48 rounded object-contain"
								src={(file as { url: string }).url}
								width={400}
								height={300}
								unoptimized
							/>
					</AttachmentHoverCardContent>
				</AttachmentHoverCard>
			))}
		</Attachment>
	);
}

// ============================================================================
// Read-only — no remove buttons
// ============================================================================

export function AttachmentDemoReadOnly() {
	return (
		<Attachment variant="grid">
			{IMAGE_FILES.map((file) => (
				<AttachmentItem key={file.id} data={file}>
					<AttachmentPreview />
				</AttachmentItem>
			))}
		</Attachment>
	);
}

// ============================================================================
// Empty state
// ============================================================================

export function AttachmentDemoEmpty() {
	return (
		<Attachment variant="grid">
			<AttachmentEmpty />
		</Attachment>
	);
}
