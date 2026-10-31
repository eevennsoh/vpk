import { TEAM_EU26_ATTACHMENTS, type TeamEu26Attachment } from "@/components/blocks/jira-work-item/team-eu26/data/high-confidence-work-item";

export type ProjectButterAttachment = Omit<TeamEu26Attachment, "kind"> & { kind: TeamEu26Attachment["kind"] | "link"; file?: File; url?: string };
export type AttachmentFilter = "all" | "documents" | "images" | "videos" | "links";

export const PROJECT_BUTTER_ATTACHMENTS: readonly ProjectButterAttachment[] = TEAM_EU26_ATTACHMENTS.map((item) => item.id === "feature-walkthrough" ? { ...item, dateAdded: "3 Mar 2026" } : item);

export function matchesAttachmentFilter(item: ProjectButterAttachment, filter: AttachmentFilter): boolean {
	if (filter === "all") return true;
	if (filter === "images") return item.kind === "image";
	if (filter === "videos") return item.kind === "video" || item.kind === "loom";
	if (filter === "links") return item.kind === "confluence" || item.kind === "google-drive" || item.kind === "loom" || item.kind === "link" || Boolean(item.url);
	return item.kind === "file" || item.kind === "confluence" || item.kind === "google-drive";
}

export function attachmentDateLabel(value: string): string {
	return value.replace(/^(\d+) (\w+) \d{4}$/u, "$2 $1");
}

export function attachmentFromFile(file: File): ProjectButterAttachment {
	return { id: crypto.randomUUID(), name: file.name, kind: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file", addedBy: "Annie Cook", dateAdded: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date()), file };
}
