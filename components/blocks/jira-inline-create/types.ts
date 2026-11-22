import type { Ref } from "react";
import type { AgentSessionWorkItemDraft } from "@/components/blocks/agent-session";
import type { JiraKanbanAssigneeData, JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";

export interface JiraInlineCreateDraft extends AgentSessionWorkItemDraft {
	readonly parentIssueKey?: string;
	readonly tags?: readonly string[];
	readonly subtaskKeys?: readonly string[];
	readonly dueDate?: string;
	readonly priority?: JiraKanbanCardData["priority"];
	readonly assignee?: JiraKanbanCardData["assignee"];
}

export interface JiraInlineCreateProps {
	assignees?: readonly JiraKanbanAssigneeData[];
	columns: readonly JiraKanbanColumnData[];
	defaults?: Omit<JiraInlineCreateDraft, "summary" | "issueType">;
	issueKey: string;
	onCancel: () => void;
	onSave: (draft: JiraInlineCreateDraft) => void;
	ref?: Ref<HTMLFormElement>;
}
