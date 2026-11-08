"use client";

import { useMemo, type SetStateAction } from "react";

import type { WorkItemData, WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import type { JiraActivityActor } from "@/components/blocks/jira-activity";
import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";
import type { PriorityValue } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editor-data";
import { TEAM_EU26_DESCRIPTION } from "@/components/blocks/jira-work-item/team-eu26/data/high-confidence-work-item";
import { TEAM_EU26_PEOPLE } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu26-vita-one";
import {
	PROJECT_BUTTER_ATTACHMENTS,
	type ProjectButterAttachment,
} from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { createProjectButterActivity, PROJECT_BUTTER_ACTIVITY_EPOCH, PROJECT_BUTTER_CURRENT_USER } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import {
	PROJECT_BUTTER_CHILD_ITEMS,
	PROJECT_BUTTER_LINKED_ITEMS,
} from "@/components/blocks/jira-work-item/project-butter/related-data";
import type { ProjectButterRelatedItem, ProjectButterRelatedKind } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { createProjectButterAttachmentEditor } from "@/components/blocks/jira-work-item/project-butter/attachment-model";
import { useProjectButterItemState } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-item-state";
import { createProjectButterRelatedEditorState } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { createProjectButterDetailFields } from "@/components/blocks/jira-work-item/project-butter/details-model";
import { createProjectButterStatusOptions } from "@/components/blocks/jira-work-item/project-butter/status-model";
import { PROJECT_BUTTER_UNASSIGNED } from "@/components/blocks/jira-work-item/project-butter/people";
import {
	createProjectButterSessions,
	type ProjectButterSessionItem,
} from "@/components/blocks/jira-work-item/project-butter/data";
import {
	PROJECT_BUTTER_ACTIVITY_FILTERS_ALL,
	projectButterSessionInvocation,
	type ProjectButterActivityFilters,
	type ProjectButterActivityView,
	type ProjectButterActivitySort,
} from "@/components/blocks/jira-work-item/project-butter/activity-feed-model";
import type { ProjectButterReferenceChange } from "@/components/blocks/jira-work-item/project-butter/reference-model";
import { appendProjectButterAudit, projectButterDetailChanges, updateProjectButterSuggestionAudit } from "@/components/blocks/jira-work-item/project-butter/content-audit";
import {
	projectButterPlaceholderAttachments,
	projectButterPlaceholderComments,
	projectButterPlaceholderDetails,
	projectButterPlaceholderRelated,
	projectButterPlaceholderReporter,
	type ProjectButterPlaceholderMap,
} from "@/components/blocks/jira-work-item/project-butter/placeholder-fill";

function createContent(
	preset: JiraWorkItemPreset,
	workItem?: WorkItemData,
	initialSessions?: readonly ProjectButterSessionItem[],
	placeholders?: ProjectButterPlaceholderMap,
	defaultReporter?: WorkItemPerson,
	defaultAssignee?: WorkItemPerson,
) {
	const empty = preset === "empty" || preset === "blank";
	const placeholder = empty || !placeholders || !workItem?.code ? undefined : placeholders[workItem.code];
	const description = empty
		? ""
		: workItem?.description
			? workItem.description
			: placeholder
				? placeholder.description
				: workItem
					? ""
					: TEAM_EU26_DESCRIPTION;
	const attachments: readonly ProjectButterAttachment[] = empty
		? []
		: placeholder
			? projectButterPlaceholderAttachments(placeholder)
			: workItem
				? []
				: PROJECT_BUTTER_ATTACHMENTS;
	const assignedPerson = workItem?.assignee ?? (!workItem && !empty ? defaultAssignee : undefined);
	const assignee: WorkItemPerson = !assignedPerson || assignedPerson.name === "Automatic" ? PROJECT_BUTTER_UNASSIGNED : assignedPerson;
	const priority: PriorityValue = workItem?.priority ?? (empty ? "Medium" : "High");
	const reporterPlaceholder = workItem?.code ? placeholders?.[workItem.code] : undefined;
	const reporter: WorkItemPerson = workItem?.reporter
		?? (reporterPlaceholder ? projectButterPlaceholderReporter(reporterPlaceholder) : defaultReporter ?? TEAM_EU26_PEOPLE.annie);
	const activityFocusId: string | null = null;
	const dueDate: Date | undefined = workItem
		? workItem.dueDate
			? new Date(workItem.dueDate)
			: undefined
		: empty
			? undefined
			: new Date("2026-05-25T00:00:00.000Z");
	const related = placeholder ? projectButterPlaceholderRelated(placeholder) : undefined;
	const relatedWork: {
		children: readonly ProjectButterRelatedItem[];
		linked: readonly ProjectButterRelatedItem[];
	} = {
		children: related ? related.children : empty || workItem ? [] : PROJECT_BUTTER_CHILD_ITEMS,
		linked: related ? related.linked : empty || workItem ? [] : PROJECT_BUTTER_LINKED_ITEMS,
	};
	const detailFields = createProjectButterDetailFields(empty, workItem);
	const status = workItem?.status ?? (empty ? "To do" : "In progress");
	const sessions = empty
		? []
		: (initialSessions ?? (workItem ? [] : createProjectButterSessions(preset)));
	const activityView: ProjectButterActivityView = "Activity";
	const activitySort: ProjectButterActivitySort = "newest";
	const activityFilters: ProjectButterActivityFilters = PROJECT_BUTTER_ACTIVITY_FILTERS_ALL;
	const replyDrafts: Readonly<Record<string, string>> = {};
	/** Top-level comments pinned to the head of the feed, most recently pinned first. */
	const pinnedCommentIds: readonly string[] = [];
	const auditChanges: Readonly<Record<string, ProjectButterReferenceChange>> = {};
	const relatedDismissed: readonly ProjectButterRelatedKind[] = [];
	return {
		suggestionAudit: null as { label: string; mode: "accept" | "undo" } | null,
		attachmentEditor: createProjectButterAttachmentEditor(),
		/** Related work heading open state. Add requests force it open. */
		relatedSectionOpen: true,
		/** Groups hidden for the session through their empty-state Dismiss button. */
		relatedDismissed,
		activityView,
		activitySort,
		activityFilters,
		replyDrafts,
		pinnedCommentIds,
		auditChanges,
		summary: workItem?.title ?? "Redesign onboarding flow for new users",
		statusOptions: createProjectButterStatusOptions(status),
		detailFields: placeholder ? projectButterPlaceholderDetails(detailFields, placeholder) : detailFields,
		relatedEditor: createProjectButterRelatedEditorState(),
		relatedWork,
		activityEntries: [
			...(workItem?.code === "PAY-999" ? createProjectButterActivity(true).map((entry) => ({
				...entry,
				actor: { id: `butter-person-${reporter.name}`, name: reporter.name, kind: "person" as const, avatarSrc: reporter.avatarUrl },
				createdAtMs: PROJECT_BUTTER_ACTIVITY_EPOCH - 60_000,
			})) : []),
			...(placeholder
				? projectButterPlaceholderComments(placeholder)
				: workItem
					? []
					: createProjectButterActivity(empty)),
			...sessions.flatMap(projectButterSessionInvocation),
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
	placeholders?: ProjectButterPlaceholderMap,
	defaultReporter?: WorkItemPerson,
	activityContext?: Readonly<{ currentUser?: WorkItemPerson; showAuditInActivity?: boolean; defaultAssignee?: WorkItemPerson }>,
) {
	const person = activityContext?.currentUser;
	const currentUser = useMemo<JiraActivityActor>(() => person ? { id: `butter-person-${person.name}`, name: person.name, kind: "person", avatarSrc: person.avatarUrl } : PROJECT_BUTTER_CURRENT_USER, [person]);
	const initialState = useMemo<ProjectButterContentState>(
		() => createContent(preset, workItem, initialSessions, placeholders, defaultReporter, activityContext?.defaultAssignee),
		[activityContext?.defaultAssignee, defaultReporter, initialSessions, placeholders, preset, workItem],
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
					if (before === after) return next;
					const change = { id, createdAtMs, label, before, after };
					return previous.suggestionAudit?.label === label
						? updateProjectButterSuggestionAudit(next, change, currentUser, previous.suggestionAudit.mode)
						: appendProjectButterAudit(next, change, currentUser);
				});
			};
		}
		return {
			beginSuggestionAudit: (label: string, mode: "accept" | "undo") => {
				if (activityContext?.showAuditInActivity) updateState((current) => ({ ...current, suggestionAudit: { label, mode } }));
			},
			endSuggestionAudit: () => {
				if (activityContext?.showAuditInActivity) updateState((current) => ({ ...current, suggestionAudit: null }));
			},
			recordAudit: (label: string, before: string, after: string) => {
				const id = crypto.randomUUID();
				const createdAtMs = Date.now();
				updateState((current) =>
					appendProjectButterAudit(current, { id, createdAtMs, label, before, after }, currentUser),
				);
			},
			recordSessionInvocation: (session: ProjectButterSessionItem, autoAssignTo?: WorkItemPerson) => {
				const [added, entry] = projectButterSessionInvocation(session);
				const id = crypto.randomUUID();
				const createdAtMs = Date.now();
				updateState((previous) => {
					if (previous.activityEntries.some((item) => item.id === entry.id)) return { ...previous, activityView: "Activity" };
					const next = { ...previous, activityView: "Activity" as const, activityEntries: [...previous.activityEntries, added, entry] };
					return autoAssignTo && (previous.assignee.name === "Unassigned" || previous.assignee.name === "Automatic")
						? appendProjectButterAudit({ ...next, assignee: autoAssignTo }, { id, createdAtMs, label: "Assignee", before: "Unassigned", after: autoAssignTo.name, action: `automatically assigned this work item to ${autoAssignTo.name}` }, currentUser)
						: next;
				});
			},
			setAttachmentEditor: fieldSetter("attachmentEditor"),
			setRelatedSectionOpen: fieldSetter("relatedSectionOpen"),
			setRelatedDismissed: fieldSetter("relatedDismissed"),
			/**
			 * The one add path for header +, empty-mode quick actions, empty states and Shift+A/C/K.
			 * Opens Related work, un-dismisses the group, opens its composer (closing a display popover)
			 * and bumps its createSignal so a repeat press refocuses the input instead of toggling.
			 */
			openRelatedAdd: (kind: ProjectButterRelatedKind) => {
				updateState((previous) => ({
					...previous,
					relatedSectionOpen: true,
					relatedDismissed: previous.relatedDismissed.filter((candidate) => candidate !== kind),
					...(kind === "attachments"
						? { attachmentEditor: { ...previous.attachmentEditor, composerOpen: true, createSignal: previous.attachmentEditor.createSignal + 1 } }
						: { relatedEditor: { ...previous.relatedEditor, [kind]: { ...previous.relatedEditor[kind], composerOpen: true, editingId: null, displayOptionsOpen: false, createSignal: previous.relatedEditor[kind].createSignal + 1 } } }),
				}));
			},
			setActivityView: fieldSetter("activityView"),
			setActivitySort: fieldSetter("activitySort"),
			setActivityFilters: fieldSetter("activityFilters"),
			setReplyDrafts: fieldSetter("replyDrafts"),
			toggleCommentPin: (id: string) => {
				updateState((previous) => ({
					...previous,
					pinnedCommentIds: previous.pinnedCommentIds.includes(id)
						? previous.pinnedCommentIds.filter((candidate) => candidate !== id)
						: [id, ...previous.pinnedCommentIds],
				}));
			},
			setSummary: audited("summary", "Summary", (value) => value),
			setStatusOptions: fieldSetter("statusOptions"),
			syncStoryPoints: (storyPoints: string) => {
				updateState((previous) => previous.detailFields.storyPoints === storyPoints
					? previous
					: { ...previous, detailFields: { ...previous.detailFields, storyPoints } });
			},
			setDetailFields: (update: SetStateAction<ProjectButterContentState["detailFields"]>) => {
				const id = crypto.randomUUID();
				const createdAtMs = Date.now();
				updateState((previous) => {
					const detailFields = typeof update === "function" ? update(previous.detailFields) : update;
					return projectButterDetailChanges(previous.detailFields, detailFields).reduce((next, change, index) => {
						const audit = { ...change, id: `${id}-${index}`, createdAtMs };
						return previous.suggestionAudit?.label === change.label
							? updateProjectButterSuggestionAudit(next, audit, currentUser, previous.suggestionAudit.mode)
							: appendProjectButterAudit(next, audit, currentUser);
					}, { ...previous, detailFields });
				});
			},
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
	}, [activityContext?.showAuditInActivity, currentUser, fieldSetter, updateState]);
	return { ...state, currentUser, defaultAssignee: activityContext?.defaultAssignee, showAuditInActivity: activityContext?.showAuditInActivity ?? false, assignee: state.assignee.name === "Automatic" ? PROJECT_BUTTER_UNASSIGNED : state.assignee, ...actions };
}

export type ProjectButterContent = ReturnType<typeof useProjectButterContent>;
