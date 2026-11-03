// Loaded directly by node:test suites: keep value imports relative (`./x.ts`); `@/` is fine for types only.

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
}

export function createProjectButterAttachmentEditor(): ProjectButterAttachmentEditor {
	return { viewMode: "grid", filter: "All", expanded: false, composerOpen: false, query: "", createSignal: 0 };
}
