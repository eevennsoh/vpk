import { useId, useState } from "react";
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { getInlineDraftParent, handleInlineDraftKey } from "@/components/blocks/jira-list/jira-list-inline-draft";
import { JiraListInlineDraftEditor, JiraListInlineDraftRow } from "@/components/blocks/jira-list/jira-list-inline-draft-editor";
import type { JiraListInsertion } from "@/components/blocks/jira-list/jira-list-types";
import type { JiraBacklogInlineCreate, JiraBacklogItem } from "./types";

type Draft = Omit<JiraBacklogInlineCreate, "sectionId"> & { createdIssueKeys?: readonly string[] };

export function useBacklogRowEditing(sectionId: string, onDraftChange: (sectionId: string | null) => void, onCreate?: (draft: JiraBacklogInlineCreate) => string | void) {
	const instanceId = useId().replaceAll(":", "");
	const [draft, setDraft] = useState<Draft | null>(null);
	const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set());
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	function toggleExpanded(issueKey: string) {
		setExpandedKeys((current) => {
			const next = new Set(current);
			if (!next.delete(issueKey)) next.add(issueKey);
			return next;
		});
	}

	function toggleAll(parentKeys: ReadonlySet<string>, collapse: boolean) {
		setExpandedKeys((current) => {
			const next = new Set(current);
			for (const key of parentKeys) {
				if (collapse) next.delete(key);
				else next.add(key);
			}
			return next;
		});
	}

	function submit() {
		if (!draft || !draft.summary.trim() || !onCreate) return;
		const { createdIssueKeys, ...createDraft } = draft;
		const issueKey = onCreate({ ...createDraft, sectionId, summary: draft.summary.trim() });
		const parent = draft.parentIssueKey;
		if (parent) setExpandedKeys((current) => new Set([...current, parent]));
		const nextDraft: Draft | null = issueKey && draft.insertion ? {
			...draft,
			createdIssueKeys: [...(createdIssueKeys ?? []), issueKey],
			insertion: { relativeToIssueKey: issueKey, position: "after", insertAtIndex: draft.insertion.insertAtIndex + 1 },
			summary: "",
		} : null;
		setDraft(nextDraft);
		if (!nextDraft) onDraftChange(null);
	}

	return {
		instanceId, sensors, draft, expandedKeys, toggleAll, toggleExpanded, submit,
		begin: (insertion?: JiraListInsertion) => { onDraftChange(sectionId); setDraft({ insertion, summary: "" }); },
		cancel: () => { onDraftChange(null); setDraft(null); },
		setSummary: (summary: string) => setDraft((current) => current ? { ...current, summary } : current),
		setParent: (parentIssueKey: string | undefined) => setDraft((current) => current ? { ...current, parentIssueKey } : current),
	};
}

export function reorderBacklogRows(rows: readonly JiraBacklogItem[], issueKey: string, targetIndex: number) {
	const sourceIndex = rows.findIndex((row) => row.issueKey === issueKey);
	const source = rows[sourceIndex];
	const target = rows[targetIndex];
	if (!source || !target || sourceIndex === targetIndex) return undefined;
	if (source.parentIssueKey !== target.parentIssueKey) return undefined;
	return arrayMove([...rows], sourceIndex, targetIndex).map((row) => row.issueKey);
}

export function BacklogInlineDraftRow({ draft, previous, onChange, onParentChange, onSubmit, onCancel }: Readonly<{
	draft: Draft;
	previous?: JiraBacklogItem;
	onChange: (summary: string) => void;
	onParentChange: (parent: string | undefined) => void;
	onSubmit: () => void;
	onCancel: () => void;
}>) {
	return (
		<JiraListInlineDraftRow
			animateEntry={!draft.createdIssueKeys?.length}
			firstCellClassName={draft.createdIssueKeys?.length ? "h-auto rounded-bl-xl bg-surface-sunken px-0" : "h-auto rounded-l-xl bg-surface-sunken px-0"}
			editorCellClassName={draft.createdIssueKeys?.length ? "h-auto rounded-br-xl bg-surface-sunken ps-1" : "h-auto rounded-r-xl bg-surface-sunken ps-1"}
			colSpan={5}
		>
				<JiraListInlineDraftEditor
					canIndent={Boolean(draft.parentIssueKey || getInlineDraftParent(previous))}
					issueType="task"
					onCancel={onCancel}
					onChange={onChange}
					onKeyDown={(event) => handleInlineDraftKey(event, {
						parent: draft.parentIssueKey, previous, onParentChange, onSubmit, onCancel,
					})}
					onSubmit={onSubmit}
					parentIssueKey={draft.parentIssueKey}
					summary={draft.summary}
				/>
		</JiraListInlineDraftRow>
	);
}
