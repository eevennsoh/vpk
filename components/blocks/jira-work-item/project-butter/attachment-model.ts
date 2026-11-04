// Loaded directly by node:test suites: keep value imports relative (`./x.ts`); `@/` is fine for types only.
import type { AttachmentGroupType, AttachmentPile, ProjectButterAttachment, ProjectButterAttachmentType } from "@/components/blocks/jira-work-item/project-butter/attachment-data";

/** Attachment filter tabs, in reference order. */
export const ATTACHMENT_FILTERS = ["All", "Documents", "Images", "Videos", "Links"] as const;
export type ProjectButterAttachmentFilter = typeof ATTACHMENT_FILTERS[number];
export type ProjectButterAttachmentViewMode = "grid" | "list";

/**
 * Per-item UI state for the Attachments group. It lives in content (fieldSetter, never audited)
 * so close and reopen keep it, and `openRelatedAdd("attachments")` can drive it.
 */
export interface ProjectButterAttachmentEditor {
	viewMode: ProjectButterAttachmentViewMode;
	filter: ProjectButterAttachmentFilter;
	/** List view pagination ("Show N more"). */
	expanded: boolean;
	composerOpen: boolean;
	query: string;
	/** Bumped by every add request. The composer refocuses on change and the group uses it as its reveal key. */
	createSignal: number;
	/** Bumped by a file drop: forces the group open without moving focus into the composer. */
	revealSignal: number;
}

export function createProjectButterAttachmentEditor(): ProjectButterAttachmentEditor {
	return { viewMode: "grid", filter: "All", expanded: false, composerOpen: false, query: "", createSignal: 0, revealSignal: 0 };
}

const FILTER_TYPES: Readonly<Record<Exclude<ProjectButterAttachmentFilter, "All">, ProjectButterAttachmentType>> = { Documents: "document", Images: "image", Videos: "video", Links: "link" };
const TYPE_FILTERS: Readonly<Record<ProjectButterAttachmentType, Exclude<ProjectButterAttachmentFilter, "All">>> = { document: "Documents", image: "Images", video: "Videos", link: "Links" };
const PROVIDERS = new Set(["confluence", "loom", "google-drive"]);

/** Reference type: loom counts as video; Confluence, Drive and plain files are documents. */
export function attachmentType(item: Pick<ProjectButterAttachment, "kind" | "type">): ProjectButterAttachmentType {
	if (item.type) return item.type;
	return item.kind === "image" ? "image" : item.kind === "video" || item.kind === "loom" ? "video" : item.kind === "link" ? "link" : "document";
}

/** Links and provider content are removed (unlinked), not deleted. */
export function attachmentIsLinked(item: Pick<ProjectButterAttachment, "kind">): boolean {
	return item.kind === "link" || PROVIDERS.has(item.kind);
}

/** Name plus extension, except provider content (Confluence, Loom, Google Drive). */
export function attachmentDisplayName(item: Pick<ProjectButterAttachment, "extension" | "kind" | "name">): string {
	return item.extension && !PROVIDERS.has(item.kind) ? `${item.name}.${item.extension}` : item.name;
}

/** "Mar 9". UTC so server and client render the same day. */
export function attachmentShortDate(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

/** Newest first by updatedAt; ties keep their order. */
export function sortAttachments(items: readonly ProjectButterAttachment[]): ProjectButterAttachment[] {
	return items.map((item, index) => ({ item, index, time: Date.parse(item.updatedAt) || 0 })).sort((a, b) => b.time - a.time || a.index - b.index).map(({ item }) => item);
}

export function filterAttachments(items: readonly ProjectButterAttachment[], filter: ProjectButterAttachmentFilter): readonly ProjectButterAttachment[] {
	return filter === "All" ? items : items.filter((item) => attachmentType(item) === FILTER_TYPES[filter]);
}

export function attachmentFilterForType(type: ProjectButterAttachmentType): Exclude<ProjectButterAttachmentFilter, "All"> {
	return TYPE_FILTERS[type];
}

/**
 * Filter tabs to render. The filled preset always offers all five; the Empty preset only shows the
 * types present, and only once there are two buckets (reference getVisibleAttachmentFilterLabels).
 */
export function visibleAttachmentFilters(items: readonly ProjectButterAttachment[], emptyPreset: boolean): readonly ProjectButterAttachmentFilter[] {
	if (items.length === 0) return [];
	if (!emptyPreset) return ATTACHMENT_FILTERS;
	const present = new Set(items.map((item) => TYPE_FILTERS[attachmentType(item)]));
	return present.size < 2 ? [] : ATTACHMENT_FILTERS.filter((filter) => filter === "All" || present.has(filter));
}

/** The active filter falls back to All when its tab is not offered. */
export function effectiveAttachmentFilter(filter: ProjectButterAttachmentFilter, visible: readonly ProjectButterAttachmentFilter[]): ProjectButterAttachmentFilter {
	return visible.includes(filter) ? filter : "All";
}

const GROUP_ORDER: readonly AttachmentGroupType[] = ["images", "documents", "videos", "links"];
const GROUP_LABELS: Readonly<Record<AttachmentGroupType, string>> = { images: "Images", documents: "Documents", videos: "Videos", links: "Links" };
const TYPE_GROUPS: Readonly<Record<ProjectButterAttachmentType, AttachmentGroupType>> = { image: "images", document: "documents", video: "videos", link: "links" };

/** Grid piles: a type with 2+ items is a stack, a lone item stays a card. Keeps the given order. */
export function groupProjectButterAttachments(items: readonly ProjectButterAttachment[]): { piles: AttachmentPile[]; singles: ProjectButterAttachment[] } {
	const groups = GROUP_ORDER.map((type): AttachmentPile => ({ type, label: GROUP_LABELS[type], items: items.filter((item) => TYPE_GROUPS[attachmentType(item)] === type) }));
	const single = new Set(groups.filter((group) => group.items.length === 1).map((group) => group.type));
	return { piles: groups.filter((group) => group.items.length > 1), singles: items.filter((item) => single.has(TYPE_GROUPS[attachmentType(item)])) };
}

/** Splits "Report.final.pdf" into base and extension. Names without one keep the whole name. */
export function splitFileName(fileName: string): { name: string; extension?: string } {
	const dot = fileName.lastIndexOf(".");
	if (dot <= 0 || dot === fileName.length - 1) return { name: fileName };
	return { name: fileName.slice(0, dot), extension: fileName.slice(dot + 1) };
}

export interface AttachmentStamp {
	id: string;
	/** ISO timestamp for dateAdded and updatedAt. */
	now: string;
	addedBy?: string;
}

/** A dropped or chosen local file. Images get an object-URL preview from the caller. */
export function attachmentFromFile(file: Pick<File, "name" | "type">, { id, now, addedBy = "Annie Cook" }: AttachmentStamp, previewSrc?: string): ProjectButterAttachment {
	const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
	return { id, kind, ...splitFileName(file.name), addedBy, dateAdded: now, updatedAt: now, ...(previewSrc ? { previewSrc } : {}), ...(file instanceof Blob ? { file: file as File } : {}) };
}

/**
 * Prepends new attachments, dropping any that match an existing id or the same display name and
 * type (reference useAttachments.handleAttachItems), so the same file dropped twice lands once.
 */
export function mergeAttachments(existing: readonly ProjectButterAttachment[], added: readonly ProjectButterAttachment[]): { items: ProjectButterAttachment[]; added: ProjectButterAttachment[] } {
	const key = (item: ProjectButterAttachment) => `${attachmentType(item)}\u0000${attachmentDisplayName(item).toLowerCase()}`;
	const seenIds = new Set(existing.map((item) => item.id));
	const seenKeys = new Set(existing.map(key));
	const fresh: ProjectButterAttachment[] = [];
	for (const item of added) {
		if (seenIds.has(item.id) || seenKeys.has(key(item))) continue;
		seenIds.add(item.id);
		seenKeys.add(key(item));
		fresh.push(item);
	}
	return { items: [...fresh, ...existing], added: fresh };
}

/** Arrival / announcement copy: "PDF added", "Video added". */
export function attachmentKindLabel(item: Pick<ProjectButterAttachment, "kind" | "type">): string {
	return { document: "Document", image: "Image", video: "Video", link: "Link" }[attachmentType(item)];
}

export function parseWeblink(value: string): URL | null {
	const trimmed = value.trim();
	const looksLikeUrl = /^(?:https?:\/\/|www\.)/iu.test(trimmed) || (/^[^\s]+\.[^\s]+$/u.test(trimmed) && !trimmed.includes(" "));
	if (!trimmed || !looksLikeUrl) return null;
	try {
		return new URL(/^https?:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`);
	} catch {
		return null;
	}
}

/** Routing segments that sit around the title in a URL rather than naming it. */
const NON_TITLE_SEGMENTS = new Set(["blog", "d", "edit", "file", "folder", "issues", "item", "pages", "pull", "share", "spaces", "view", "wiki"]);

/** Best-effort name for a pasted link, read from its slug (reference AttachmentContentPanelPolish). */
export function deriveDisplayName(url: URL): string {
	const hostName = url.hostname.replace(/^www\./u, "");
	if (/(?:^|\.)(?:docs|drive)\.google\.com$/iu.test(url.hostname)) return "Work item proposal";
	const segments = url.pathname.split("/").filter(Boolean).filter((segment) => !NON_TITLE_SEGMENTS.has(segment.toLowerCase())).reverse();
	const slug = segments.find((segment) => /[-_+]/u.test(segment)) ?? segments.find((segment) => /^[a-z]+$/iu.test(segment) && segment.length <= 24);
	if (!slug) return hostName;
	let decoded: string;
	try {
		decoded = decodeURIComponent(slug.replace(/\+/gu, " "));
	} catch {
		decoded = slug;
	}
	decoded = decoded.replace(/\.[a-z0-9]{2,4}$/iu, "").replace(/[-_]+/gu, " ").trim();
	if (!decoded) return hostName;
	return decoded.length > 48 ? hostName : decoded.charAt(0).toUpperCase() + decoded.slice(1);
}
