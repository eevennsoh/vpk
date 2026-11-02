"use client";

import { useMemo, type SetStateAction } from "react";

import type { WorkItemData, WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";
import type { PriorityValue } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editor-data";
import { TEAM_EU26_DESCRIPTION } from "@/components/blocks/jira-work-item/team-eu26/data/high-confidence-work-item";
import { TEAM_EU26_PEOPLE } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu26-vita-one";
import {
	PROJECT_BUTTER_ATTACHMENTS,
	type ProjectButterAttachment,
} from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { createProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import {
	PROJECT_BUTTER_CHILD_ITEMS,
	PROJECT_BUTTER_LINKED_ITEMS,
} from "@/components/blocks/jira-work-item/project-butter/related-data";
import type { ProjectButterRelatedItem } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { useProjectButterItemState } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-item-state";
import { createProjectButterRelatedEditorState } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { createProjectButterDetailFields } from "@/components/blocks/jira-work-item/project-butter/details-model";
import { createProjectButterStatusOptions } from "@/components/blocks/jira-work-item/project-butter/status-model";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import {
	createProjectButterSessions,
	type ProjectButterSessionItem,
} from "@/components/blocks/jira-work-item/project-butter/data";
import {
	projectButterSessionInvocation,
	type ProjectButterActivityView,
	type ProjectButterActivitySort,
} from "@/components/blocks/jira-work-item/project-butter/activity-feed-model";
import type { ProjectButterReferenceChange } from "@/components/blocks/jira-work-item/project-butter/reference-model";
import { appendProjectButterAudit } from "@/components/blocks/jira-work-item/project-butter/content-audit";

function createContent(
	preset: JiraWorkItemPreset,
	workItem?: WorkItemData,
	initialSessions?: readonly ProjectButterSessionItem[],
) {
	const empty = preset === "empty" || preset === "blank";
	const description = empty ? "" : workItem ? (workItem.description ?? "") : TEAM_EU26_DESCRIPTION;
	const attachments: readonly ProjectButterAttachment[] =
		empty || workItem ? [] : PROJECT_BUTTER_ATTACHMENTS;
	const assignee: WorkItemPerson = workItem?.assignee ?? TEAM_EU26_PEOPLE.automatic;
	const priority: PriorityValue = workItem?.priority ?? (empty ? "Medium" : "High");
	const reporter: WorkItemPerson | null = workItem
		? (workItem.reporter ?? null)
		: { name: "Planner agent", avatarUrl: projectButterPersonAvatar("Annie Cook") };
	const activityFocusId: string | null = null;
	const dueDate: Date | undefined = workItem
		? workItem.dueDate
			? new Date(workItem.dueDate)
			: undefined
		: empty
			? undefined
			: new Date("2026-05-25T00:00:00.000Z");
	const relatedWork: {
		children: readonly ProjectButterRelatedItem[];
		linked: readonly ProjectButterRelatedItem[];
	} = {
		children: empty || workItem ? [] : PROJECT_BUTTER_CHILD_ITEMS,
		linked: empty || workItem ? [] : PROJECT_BUTTER_LINKED_ITEMS,
	};
	const status = workItem?.status ?? (empty ? "To do" : "In progress");
	const sessions = empty
		? []
		: (initialSessions ?? (workItem ? [] : createProjectButterSessions(preset)));
	const activityView: ProjectButterActivityView = "Activity";
	const activitySort: ProjectButterActivitySort = "newest";
	const replyDrafts: Readonly<Record<string, string>> = {};
	const auditChanges: Readonly<Record<string, ProjectButterReferenceChange>> = {};
	return {
		attachmentComposerOpen: false,
		activityView,
		activitySort,
		replyDrafts,
		auditChanges,
		summary: workItem?.title ?? "Redesign onboarding flow for new users",
		statusOptions: createProjectButterStatusOptions(status),
		detailFields: createProjectButterDetailFields(empty, workItem),
		relatedEditor: createProjectButterRelatedEditorState(),
		relatedWork,
		activityEntries: [
			...(workItem ? [] : createProjectButterActivity(empty)),
			...sessions
				.filter((session) => session.state !== "needs-input")
				.map(projectButterSessionInvocation),
		].sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0)),
		activityFocusId,
		dueDate,
		reporter,
		watching: false,
		flagged: false,
		attachments,
		assignee,
		commentDraft: "",
		description,
		descriptionDraft: description,
		editingDescription: false,
		priority,
		status,
	};
}

type ProjectButterContentState = Omit<
	ReturnType<typeof createContent>,
	"activityFocusId" | "reporter" | "activityView" | "activitySort"
> & {
	activityFocusId: string | null;
	reporter: WorkItemPerson | null;
	activityView: ProjectButterActivityView;
	activitySort: ProjectButterActivitySort;
};

export function useProjectButterContent(
	preset: JiraWorkItemPreset,
	workItem?: WorkItemData,
	initialSessions?: readonly ProjectButterSessionItem[],
) {
	const initialState = useMemo<ProjectButterContentState>(
		() => createContent(preset, workItem, initialSessions),
		[preset, workItem, initialSessions],
	);
	const { state, fieldSetter, updateState } = useProjectButterItemState(
		workItem?.code ?? "reference",
		initialState,
	);
	const actions = useMemo(() => {
		function audited<K extends keyof ProjectButterContentState>(
			field: K,
			label: string,
			describe: (value: ProjectButterContentState[K]) => string,
		) {
			return (update: SetStateAction<ProjectButterContentState[K]>) => {
				const id = crypto.randomUUID();
				const createdAtMs = Date.now();
				updateState((previous) => {
					const value =
						typeof update === "function"
							? (update as (value: ProjectButterContentState[K]) => ProjectButterContentState[K])(
									previous[field],
								)
							: update;
					const before = describe(previous[field]);
					const after = describe(value);
					const next = { ...previous, [field]: value };
					return before === after
						? next
						: appendProjectButterAudit(next, { id, createdAtMs, label, before, after });
				});
			};
		}
		return {
			recordAudit: (label: string, before: string, after: string) => {
				const id = crypto.randomUUID();
				const createdAtMs = Date.now();
				updateState((current) =>
					appendProjectButterAudit(current, { id, createdAtMs, label, before, after }),
				);
			},
			setAttachmentComposerOpen: fieldSetter("attachmentComposerOpen"),
			setActivityView: fieldSetter("activityView"),
			setActivitySort: fieldSetter("activitySort"),
			setReplyDrafts: fieldSetter("replyDrafts"),
			setSummary: audited("summary", "Summary", (value) => value),
			setStatusOptions: fieldSetter("statusOptions"),
			setDetailFields: audited(
				"detailFields",
				"Details",
				({ order: _order, hidden: _hidden, ...values }) => JSON.stringify(values, null, 2),
			),
			setRelatedEditor: fieldSetter("relatedEditor"),
			setRelatedWork: audited("relatedWork", "Related work", (value) =>
				[...value.children, ...value.linked]
					.map(
						(item) =>
							`${item.key} ${item.summary} · ${item.status} · ${item.priority} · ${item.assignee}`,
					)
					.join("\n"),
			),
			setActivityEntries: fieldSetter("activityEntries"),
			setActivityFocusId: fieldSetter("activityFocusId"),
			setDueDate: audited(
				"dueDate",
				"Due Date",
				(value) => value?.toISOString().slice(0, 10) ?? "",
			),
			setReporter: audited("reporter", "Reporter", (value) => value?.name ?? ""),
			setWatching: fieldSetter("watching"),
			setFlagged: fieldSetter("flagged"),
			setAttachments: audited("attachments", "Attachments", (value) =>
				value.map((item) => item.name).join("\n"),
			),
			setAssignee: audited("assignee", "Assignee", (value) => value.name),
			setCommentDraft: fieldSetter("commentDraft"),
			setDescription: audited("description", "Description", (value) => value),
			setDescriptionDraft: fieldSetter("descriptionDraft"),
			setEditingDescription: fieldSetter("editingDescription"),
			setPriority: audited("priority", "Priority", (value) => value),
			setStatus: audited("status", "Status", (value) => value),
		};
	}, [fieldSetter, updateState]);
	return { ...state, ...actions };
}

export type ProjectButterContent = ReturnType<typeof useProjectButterContent>;
