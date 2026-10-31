"use client";

import { useMemo } from "react";

import type { WorkItemData, WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";
import type { PriorityValue } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editor-data";
import { TEAM_EU26_DESCRIPTION } from "@/components/blocks/jira-work-item/team-eu26/data/high-confidence-work-item";
import { TEAM_EU26_PEOPLE } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu26-vita-one";
import { PROJECT_BUTTER_ATTACHMENTS, type ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { createProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import { PROJECT_BUTTER_CHILD_ITEMS, PROJECT_BUTTER_LINKED_ITEMS } from "@/components/blocks/jira-work-item/project-butter/related-data";
import type { ProjectButterRelatedItem } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { useProjectButterItemState } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-item-state";

function createContent(preset: JiraWorkItemPreset, workItem?: WorkItemData) {
	const empty = preset === "empty" || preset === "blank";
	const description = empty ? "" : workItem ? workItem.description ?? "" : TEAM_EU26_DESCRIPTION;
	const attachments: readonly ProjectButterAttachment[] = empty || workItem ? [] : PROJECT_BUTTER_ATTACHMENTS;
	const assignee: WorkItemPerson = workItem?.assignee ?? TEAM_EU26_PEOPLE.automatic;
	const priority: PriorityValue = workItem?.priority ?? (empty ? "Medium" : "High");
	const reporter: WorkItemPerson | null = workItem ? workItem.reporter ?? null : TEAM_EU26_PEOPLE.elena;
	const activityFocusId: string | null = null;
	const dueDate: Date | undefined = workItem ? workItem.dueDate ? new Date(workItem.dueDate) : undefined : empty ? undefined : new Date("2026-05-25T00:00:00.000Z");
	const relatedWork: { children: readonly ProjectButterRelatedItem[]; linked: readonly ProjectButterRelatedItem[] } = { children: empty || workItem ? [] : PROJECT_BUTTER_CHILD_ITEMS, linked: empty || workItem ? [] : PROJECT_BUTTER_LINKED_ITEMS };
	return {
		relatedWork, activityEntries: workItem ? [] : createProjectButterActivity(empty), activityFocusId,
		dueDate, reporter, watching: false, flagged: false, attachments, assignee,
		commentDraft: "", description, descriptionDraft: description, editingDescription: false,
		priority, sortByName: false, status: workItem?.status ?? (empty ? "To do" : "In progress"),
	};
}

type ProjectButterContentState = Omit<ReturnType<typeof createContent>, "activityFocusId" | "reporter"> & { activityFocusId: string | null; reporter: WorkItemPerson | null };

export function useProjectButterContent(preset: JiraWorkItemPreset, workItem?: WorkItemData) {
	const initialState = useMemo<ProjectButterContentState>(() => createContent(preset, workItem), [preset, workItem]);
	const { state, fieldSetter } = useProjectButterItemState(workItem?.code ?? "reference", initialState);
	const actions = useMemo(() => ({
		setRelatedWork: fieldSetter("relatedWork"), setActivityEntries: fieldSetter("activityEntries"),
		setActivityFocusId: fieldSetter("activityFocusId"), setDueDate: fieldSetter("dueDate"), setReporter: fieldSetter("reporter"),
		setWatching: fieldSetter("watching"), setFlagged: fieldSetter("flagged"), setAttachments: fieldSetter("attachments"),
		setAssignee: fieldSetter("assignee"), setCommentDraft: fieldSetter("commentDraft"), setDescription: fieldSetter("description"),
		setDescriptionDraft: fieldSetter("descriptionDraft"), setEditingDescription: fieldSetter("editingDescription"),
		setPriority: fieldSetter("priority"), setSortByName: fieldSetter("sortByName"), setStatus: fieldSetter("status"),
	}), [fieldSetter]);
	return { ...state, ...actions };
}

export type ProjectButterContent = ReturnType<typeof useProjectButterContent>;
