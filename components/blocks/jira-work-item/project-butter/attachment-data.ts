import type { TeamEu26Attachment } from "@/components/blocks/jira-work-item/team-eu26/data/high-confidence-work-item";

export type ProjectButterAttachment = Omit<TeamEu26Attachment, "kind"> & { kind: TeamEu26Attachment["kind"] | "link"; file?: File; url?: string; previewSrc?: string };
export type AttachmentGroupType = "images" | "documents" | "videos" | "links";
export interface AttachmentPile { type: AttachmentGroupType; label: string; items: readonly ProjectButterAttachment[] }

// atlassian/prototyping wiv-v2/main @3a53253, VITA-1 attachment selection.
export const PROJECT_BUTTER_ATTACHMENTS: readonly ProjectButterAttachment[] = [
	{ id: "marketing-strategy", kind: "confluence", name: "Q1 Marketing Strategy & Goals", addedBy: "John Vaughan", dateAdded: "1 Mar 2026" },
	{ id: "campaign-draft", kind: "file", name: "Social Media Campaign Draft.pdf", addedBy: "Sarah Smith", dateAdded: "2 Mar 2026" },
	{ id: "brand-guidelines", kind: "google-drive", name: "Brand Asset Guidelines 2026", addedBy: "Marcus Kim", dateAdded: "2 Mar 2026" },
	{ id: "feature-walkthrough", kind: "loom", name: "Feature Walkthrough - New UI", addedBy: "Elena Rodriguez", dateAdded: "3 Mar 2026", previewSrc: "/illustration/project-butter-attachments/feature-walkthrough.webp" },
	{ id: "hero-image", kind: "image", name: "Hero Image - Summer Launch.png", addedBy: "David Chen", dateAdded: "4 Mar 2026", previewSrc: "/illustration/project-butter-attachments/summer-launch.webp" },
	{ id: "feedback-summary", kind: "file", name: "User Feedback Summary.docx", addedBy: "Sia Vale", dateAdded: "5 Mar 2026" },
	{ id: "analysis-link", kind: "link", name: "http://insight-metrics.io/analysis-q1", addedBy: "Zoe Loft", dateAdded: "5 Mar 2026", url: "http://insight-metrics.io/analysis-q1" },
	{ id: "customer-interview", kind: "video", name: "Customer Interview Recording.mp4", addedBy: "Amara Okafor", dateAdded: "9 Mar 2026" },
];

function attachmentGroup(item: ProjectButterAttachment): AttachmentGroupType {
	return item.kind === "image" ? "images" : item.kind === "video" || item.kind === "loom" ? "videos" : item.kind === "link" ? "links" : "documents";
}

export function groupProjectButterAttachments(items: readonly ProjectButterAttachment[]) {
	const labels: Record<AttachmentGroupType, string> = { images: "Images", documents: "Documents", videos: "Videos", links: "Links" };
	const order: readonly AttachmentGroupType[] = ["images", "documents", "videos", "links"];
	const groups = order.map((type): AttachmentPile => ({ type, label: labels[type], items: items.filter((item) => attachmentGroup(item) === type) }));
	return { piles: groups.filter((group) => group.items.length > 1), singles: items.filter((item) => groups.find((group) => group.type === attachmentGroup(item))?.items.length === 1) };
}

export function attachmentFromFile(file: File): ProjectButterAttachment {
	return { id: crypto.randomUUID(), name: file.name, kind: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file", addedBy: "Annie Cook", dateAdded: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date()), file };
}
