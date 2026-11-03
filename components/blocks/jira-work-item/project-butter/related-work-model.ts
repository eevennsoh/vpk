// Pure related-work rules. Kept free of `@/` value imports so node:test can load it directly.
import type { ProjectButterRelatedKind } from "@/components/blocks/jira-work-item/project-butter/related-model";

type PerKind<T> = Readonly<Record<ProjectButterRelatedKind, T>>;

export interface RelatedGroupVisibilityInput {
	/** Item counts per group. */
	counts: PerKind<number>;
	/** Whether each group's inline composer is open (an add was requested). */
	composerOpen: PerKind<boolean>;
	/** Groups dismissed from their empty state for this session. */
	dismissed: readonly ProjectButterRelatedKind[];
	/** The Empty preset, where groups appear only once requested or filled. */
	empty: boolean;
	/** Butter hides child work under a Subtask parent unless every group is empty. */
	parentIsSubtask?: boolean;
}

export interface RelatedGroupVisibility {
	shown: PerKind<boolean>;
	/** Non-empty preset with nothing related: every shown group renders its empty state row. */
	allEmpty: boolean;
	/** Number of shown groups; the Related work heading appears at 2 or more. */
	count: number;
}

/** Mirrors the reference showRelated* rules (App.jsx). */
export function relatedGroupVisibility({ counts, composerOpen, dismissed, empty, parentIsSubtask = false }: RelatedGroupVisibilityInput): RelatedGroupVisibility {
	const allEmpty = !empty && counts.attachments === 0 && counts.children === 0 && counts.linked === 0;
	const show = (kind: ProjectButterRelatedKind) => {
		// A dismissed group comes back once it has content or an add is requested.
		if (dismissed.includes(kind) && counts[kind] === 0 && !composerOpen[kind]) return false;
		if (kind === "children" && parentIsSubtask && !allEmpty) return false;
		return counts[kind] > 0 || allEmpty || composerOpen[kind];
	};
	const shown = { attachments: show("attachments"), children: show("children"), linked: show("linked") };
	return { shown, allEmpty, count: Number(shown.attachments) + Number(shown.children) + Number(shown.linked) };
}

export interface RelatedSummaryItem {
	kind: ProjectButterRelatedKind;
	count: number;
	label: string;
}

const SUMMARY_NOUNS: PerKind<readonly [string, string]> = {
	attachments: ["attachment", "attachments"],
	children: ["subitem", "subitems"],
	linked: ["linked work item", "linked work items"],
};

/** Collapsed Related work summary: real counts for shown groups, zero counts omitted. */
export function relatedSummaryItems(counts: PerKind<number>, shown: PerKind<boolean>): RelatedSummaryItem[] {
	return (["attachments", "children", "linked"] as const)
		.filter((kind) => shown[kind] && counts[kind] > 0)
		.map((kind) => ({ kind, count: counts[kind], label: `${counts[kind]} ${SUMMARY_NOUNS[kind][counts[kind] === 1 ? 0 : 1]}` }));
}

export interface RelatedListWindow<T> {
	shown: readonly T[];
	hiddenCount: number;
	/** Index of the last shown row when more rows are hidden below it (gets the text fade). */
	fadedIndex: number | null;
	/** Whether the Show N more / Show less pill renders. */
	showToggle: boolean;
}

/** Card pagination: 5 rows, or 4 while the composer takes a slot; everything when expanded. */
export function relatedListWindow<T>(items: readonly T[], { expanded, composerOpen, pageSize = 5 }: Readonly<{ expanded: boolean; composerOpen: boolean; pageSize?: number }>): RelatedListWindow<T> {
	const limit = composerOpen ? pageSize - 1 : pageSize;
	const shown = expanded ? items : items.slice(0, limit);
	const hiddenCount = items.length - shown.length;
	return {
		shown,
		hiddenCount,
		fadedIndex: hiddenCount > 0 && shown.length > 0 ? shown.length - 1 : null,
		showToggle: hiddenCount > 0 || (expanded && items.length > pageSize),
	};
}
