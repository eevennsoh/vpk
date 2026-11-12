// Loaded directly by node:test suites (through attachment-model.ts): keep value imports relative.

export type ProjectButterAttachmentKind = "confluence" | "file" | "google-drive" | "image" | "link" | "loom" | "video";
/** Reference `type`: the filter and pile bucket. */
export type ProjectButterAttachmentType = "document" | "image" | "video" | "link";
/** Confluence object type, for catalog items (page, live doc, whiteboard, database). */
export type ProjectButterAttachmentObjectType = "page" | "livedoc" | "whiteboard" | "database";

export interface ProjectButterAttachment {
	id: string;
	kind: ProjectButterAttachmentKind;
	/** Base name. File names keep their extension in `extension`; see attachmentDisplayName. */
	name: string;
	extension?: string;
	/** Derived from `kind` when absent (attachmentType). */
	type?: ProjectButterAttachmentType;
	objectType?: ProjectButterAttachmentObjectType;
	addedBy: string;
	/** ISO timestamp. Display formatting lives in attachment-model.ts. */
	dateAdded: string;
	/** ISO timestamp; lists sort by it, newest first. */
	updatedAt: string;
	url?: string;
	previewSrc?: string;
	file?: File;
}

export type AttachmentGroupType = "images" | "documents" | "videos" | "links";
export interface AttachmentPile { type: AttachmentGroupType; label: string; items: readonly ProjectButterAttachment[] }

// atlassian/prototyping wiv-v2/main @3a53253, VITA-1 attachments: att-1, 2, 3, 5, 6, 8, 9, 16.
// The reference has no uploader; addedBy is its list-order fallback cycle, stored so it never reshuffles.
export const PROJECT_BUTTER_ATTACHMENTS: readonly ProjectButterAttachment[] = [
	{ id: "marketing-strategy", kind: "confluence", objectType: "page", name: "Q1 Marketing Strategy & Goals", addedBy: "John Vaughan", dateAdded: "2026-03-01T09:00:00Z", updatedAt: "2026-03-09T14:30:00Z", previewSrc: "/ambient/atlassian/abstract/combo-1/primary/blue.svg" },
	{ id: "campaign-draft", kind: "file", name: "Social Media Campaign Draft", extension: "pdf", addedBy: "Sarah Smith", dateAdded: "2026-03-02T10:00:00Z", updatedAt: "2026-03-09T11:00:00Z", previewSrc: "/ambient/ado/line/primary/yellow.svg" },
	{ id: "brand-guidelines", kind: "google-drive", name: "Brand Asset Guidelines 2026", addedBy: "Marcus Kim", dateAdded: "2026-03-02T11:00:00Z", updatedAt: "2026-03-09T09:15:00Z", previewSrc: "/ambient/ado/shape/primary/blue.svg" },
	{ id: "feature-walkthrough", kind: "loom", name: "Feature Walkthrough - New UI", addedBy: "Elena Rodriguez", dateAdded: "2026-03-03T14:00:00Z", updatedAt: "2026-03-08T16:45:00Z", previewSrc: "/ambient/atlassian/pictorial/communication/primary/purple.svg" },
	{ id: "hero-image", kind: "image", name: "Hero Image - Summer Launch", extension: "png", addedBy: "David Chen", dateAdded: "2026-03-04T09:30:00Z", updatedAt: "2026-03-08T10:20:00Z", previewSrc: "/ambient/atlassian/abstract/shape-1/primary/lime.svg" },
	{ id: "feedback-summary", kind: "file", name: "User Feedback Summary", extension: "docx", addedBy: "Amara Okafor", dateAdded: "2026-03-05T10:00:00Z", updatedAt: "2026-03-07T15:45:00Z", previewSrc: "/ambient/ado/dots/primary/neutral.svg" },
	{ id: "analysis-link", kind: "link", name: "http://insight-metrics.io/analysis-q1", addedBy: "John Vaughan", dateAdded: "2026-03-05T11:00:00Z", updatedAt: "2026-03-06T12:00:00Z", url: "http://insight-metrics.io/analysis-q1", previewSrc: "/ambient/itsm/grid/primary/yellow.svg" },
	{ id: "team-offsite-recap", kind: "loom", name: "Team Offsite Recap", addedBy: "Sarah Smith", dateAdded: "2026-03-08T08:00:00Z", updatedAt: "2026-03-02T10:00:00Z", previewSrc: "/ambient/atlassian/abstract/line-2/primary/purple.svg" },
];
