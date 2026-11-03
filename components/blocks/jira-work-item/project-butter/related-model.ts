import type { PriorityValue } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editor-data";

/** Butter related rows use three statuses. Placeholder data that says "In review" is mapped to "In progress" in placeholder-fill.ts. */
export type ProjectButterRelatedStatus = "To do" | "In progress" | "Done";
export const RELATED_STATUSES: readonly ProjectButterRelatedStatus[] = ["To do", "In progress", "Done"];

/** The three related-work groups, in render order. */
export type ProjectButterRelatedKind = "attachments" | "children" | "linked";
export const RELATED_KINDS: readonly ProjectButterRelatedKind[] = ["attachments", "children", "linked"];
export interface ProjectButterRelatedItem {
	id: string;
	key: string;
	summary: string;
	priority: PriorityValue;
	assignee: string;
	status: ProjectButterRelatedStatus;
	relationship?: string;
	dueDate?: string;
	estimate?: string;
	labels?: readonly string[];
	createdAt?: string;
	/** Created children are Subtasks (Stories under an Epic); created links are Tasks. */
	workType?: ProjectButterRelatedWorkType;
}

export type ProjectButterRelatedWorkType = "Epic" | "Story" | "Task" | "Bug" | "Subtask";

export type ProjectButterRelatedAddRequest =
	| { kind: "create"; summary: string; relationship?: string }
	| { kind: "existing"; item: ProjectButterRelatedItem; relationship?: string };

export type ProjectButterRelatedSearchItem = ProjectButterRelatedItem & {
	workType: ProjectButterRelatedWorkType;
};

/** The person who creates items in the prototype (reference CURRENT_USER). */
export const RELATED_CURRENT_USER = "Annie Cook";

/** Resolves a related key to an opener when the host can open that work item; undefined renders the key as plain text. */
export type RelatedItemOpener = (key: string) => (() => void) | undefined;

/** Priorities offered by the row menu; any stored value still renders its glyph. */
export const RELATED_PRIORITY_OPTIONS: readonly PriorityValue[] = ["High", "Medium", "Low", "Lowest"];

/** Linked work relationships in reference order. New links default to "Clones". */
export const RELATED_RELATIONSHIPS = ["Blocks", "Blocked by", "Is blocked by", "Clones", "Is cloned by", "Duplicates", "Is duplicated by", "Relates to"] as const;

export const RELATED_SORT_OPTIONS = [
	{ value: "rank", label: "Rank" }, { value: "created", label: "Created" },
	{ value: "key", label: "Key" }, { value: "priority", label: "Priority" },
	{ value: "status", label: "Status" }, { value: "assignee", label: "Assignee" },
] as const;

export const RELATED_DISPLAY_PROPERTIES = [
	{ id: "priority", label: "Priority" }, { id: "id", label: "Key" },
	{ id: "status", label: "Status" }, { id: "labels", label: "Labels" },
	{ id: "dueDate", label: "Due date" }, { id: "estimate", label: "Estimate" },
	{ id: "assignee", label: "Assignee" },
] as const;

export type ProjectButterRelatedSort = typeof RELATED_SORT_OPTIONS[number]["value"];
export type ProjectButterRelatedField = typeof RELATED_DISPLAY_PROPERTIES[number]["id"];
export type ProjectButterRelatedFields = Readonly<Record<ProjectButterRelatedField, boolean>>;
export interface ProjectButterRelatedListEditor {
	expanded: boolean;
	composerOpen: boolean;
	/** Bumped by every add request. The composer refocuses on change and the group uses it as its reveal key. */
	createSignal: number;
	/** The display options popover; add requests close it. */
	displayOptionsOpen: boolean;
	query: string;
	relationship: string;
	editingId: string | null;
	summaryDrafts: Readonly<Record<string, string>>;
	hideDone: boolean;
	sortBy: ProjectButterRelatedSort | null;
	sortAscending: boolean;
	visibleFields: ProjectButterRelatedFields;
}

export function createProjectButterRelatedListEditor(): ProjectButterRelatedListEditor {
	return {
		expanded: false, composerOpen: false, createSignal: 0, displayOptionsOpen: false, query: "", relationship: "Clones", editingId: null,
		summaryDrafts: {}, hideDone: false, sortBy: null, sortAscending: true,
		visibleFields: { status: true, id: true, labels: false, dueDate: false, estimate: false, priority: true, assignee: true },
	};
}

export function createProjectButterRelatedEditorState() {
	return { children: createProjectButterRelatedListEditor(), linked: createProjectButterRelatedListEditor() };
}

export function relatedWorkItemKey(text: string): string | undefined {
	return text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/i)?.[1].toUpperCase();
}

export function relatedSearchText(text: string): string {
	return /https?:|\/browse\/|\/jira\//i.test(text) ? relatedWorkItemKey(text) ?? text.trim() : text.trim();
}

export interface RelatedStatusCounts {
	todo: number;
	inProgress: number;
	done: number;
	total: number;
}

/** Header counts over the whole list (hide done never changes them). */
export function relatedStatusCounts(items: readonly ProjectButterRelatedItem[]): RelatedStatusCounts {
	const done = items.filter((item) => item.status === "Done").length;
	const inProgress = items.filter((item) => item.status === "In progress").length;
	return { todo: items.length - done - inProgress, inProgress, done, total: items.length };
}

/** "10 of 15 done, 5 in progress, 0 to do"; undefined with no children (no indicator either). */
export function relatedProgressLabel(counts: RelatedStatusCounts): string | undefined {
	return counts.total ? `${counts.done} of ${counts.total} done, ${counts.inProgress} in progress, ${counts.todo} to do` : undefined;
}

export type RelatedWorkChoice =
	| { kind: "existing"; id: string; item: ProjectButterRelatedSearchItem }
	| { kind: "create"; id: "create"; summary: string };

export interface RelatedComposerSearch {
	query: string;
	/** Keys already in this list. */
	existingKeys: ReadonlySet<string>;
	/** The open work item's own key; it can never relate to itself. */
	ownKey: string;
	/** Child lists filter by the parent's type; linked lists take every type. */
	kind: "children" | "linked";
	parentType?: ProjectButterRelatedWorkType;
	catalog: readonly ProjectButterRelatedSearchItem[];
}

/** Types a child may have: Story/Task/Bug under an Epic, otherwise Subtask (reference useInlineWorkItemAdd). */
export function relatedChildTypes(parentType: ProjectButterRelatedWorkType | undefined): readonly ProjectButterRelatedWorkType[] {
	return parentType === "Epic" ? ["Story", "Task", "Bug"] : ["Subtask"];
}

/**
 * Composer choices: an exact key match first, then up to 6 key/summary matches, then
 * "Create" unless the query names an exact or already-added key.
 */
export function relatedComposerChoices({ catalog, existingKeys, kind, ownKey, parentType, query }: Readonly<RelatedComposerSearch>): { choices: RelatedWorkChoice[]; matchCount: number } {
	const text = relatedSearchText(query);
	if (!text) return { choices: [], matchCount: 0 };
	const allowed = kind === "children" ? relatedChildTypes(parentType) : undefined;
	const addable = (item: ProjectButterRelatedSearchItem) => item.key !== ownKey && !existingKeys.has(item.key) && (!allowed || allowed.includes(item.workType));
	const lower = text.toLowerCase();
	const matches = catalog.filter((item) => addable(item) && (item.key.toLowerCase().includes(lower) || item.summary.toLowerCase().includes(lower))).slice(0, 6);
	const exact = catalog.find((item) => item.key.toUpperCase() === text.toUpperCase() && addable(item));
	const ordered = exact ? [exact, ...matches.filter((item) => item.key !== exact.key)] : matches;
	const choices: RelatedWorkChoice[] = ordered.map((item) => ({ kind: "existing", id: item.key, item }));
	const knownKey = relatedWorkItemKey(text);
	if (!exact && !(knownKey && existingKeys.has(knownKey))) choices.push({ kind: "create", id: "create", summary: text });
	return { choices, matchCount: matches.length };
}

/** Project prefix of a work item key: "PAY-12" gives "PAY"; anything else falls back to VITA. */
export function relatedKeyPrefix(key: string | undefined): string {
	return key?.match(/^([A-Z][A-Z0-9]+)-\d+$/i)?.[1].toUpperCase() ?? "VITA";
}

/** A new random 4-digit key under the parent's project, unique against `taken`. */
export function nextRelatedKey(prefix: string, taken: ReadonlySet<string>, random: () => number = Math.random): string {
	for (let attempt = 0; attempt < 50; attempt++) {
		const key = `${prefix}-${Math.floor(1000 + random() * 9000)}`;
		if (!taken.has(key)) return key;
	}
	let fallback = 10000;
	while (taken.has(`${prefix}-${fallback}`)) fallback++;
	return `${prefix}-${fallback}`;
}

/**
 * The row an add request inserts. Existing matches keep their own status, priority, assignee and type;
 * created items are To do, Medium and assigned to the current user.
 */
export function relatedItemFromRequest(request: ProjectButterRelatedAddRequest, { id, key, kind, parentType }: Readonly<{ id: string; key: string; kind: "children" | "linked"; parentType?: ProjectButterRelatedWorkType }>): ProjectButterRelatedItem {
	const relationship = kind === "linked" ? request.relationship ?? "Clones" : undefined;
	if (request.kind === "existing") return { ...request.item, id, relationship };
	const workType: ProjectButterRelatedWorkType = kind === "linked" ? "Task" : parentType === "Epic" ? "Story" : "Subtask";
	return { id, key, summary: request.summary, status: "To do", priority: "Medium", assignee: RELATED_CURRENT_USER, workType, relationship };
}

/** Collapse whitespace and trim, for summary commits and pasted text. */
export function normalizeRelatedSummary(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

export function orderRelatedItems(items: readonly ProjectButterRelatedItem[], editor: ProjectButterRelatedListEditor) {
	const shown = editor.hideDone ? items.filter((item) => item.status !== "Done") : [...items];
	const sortBy = editor.sortBy;
	if (!sortBy || sortBy === "rank") return editor.sortAscending ? shown : [...shown].reverse();
	const priorities = { Highest: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 };
	const valueFor = (item: ProjectButterRelatedItem) => sortBy === "priority" ? priorities[item.priority] : sortBy === "created" ? item.createdAt ?? "" : item[sortBy];
	return [...shown].sort((left, right) => {
		const a = valueFor(left);
		const b = valueFor(right);
		const comparison = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "en-US", { numeric: true });
		return comparison * (editor.sortAscending ? 1 : -1);
	});
}
