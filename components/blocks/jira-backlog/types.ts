import type { JiraListAssignedAgent, JiraListIssueType, JiraListPerson, JiraListPriority, JiraListProps } from "@/components/blocks/jira-list/jira-list-types";

export const BACKLOG_STATUSES = ["To do", "In progress", "In review", "Done"] as const;
export type JiraBacklogStatus = (typeof BACKLOG_STATUSES)[number];

export interface JiraBacklogItem {
	id: string;
	issueKey: string;
	summary: string;
	issueType: JiraListIssueType;
	priority: JiraListPriority;
	status: JiraBacklogStatus;
	assignee?: JiraListPerson;
	agentSessions?: readonly JiraListAssignedAgent[];
}

export interface JiraBacklogSection {
	id: string;
	title: string;
	dateLabel?: string;
	items: readonly JiraBacklogItem[];
}

export interface JiraBacklogSprintMove {
	sprintId: string;
	itemIds: readonly string[];
	destination: "sprint" | "backlog";
}

export interface JiraBacklogProps extends Pick<JiraListProps, "agentCatalog" | "onAssignedAgentIdsChange" | "onAssignedAgentSelect"> {
	sprints: readonly JiraBacklogSection[];
	backlog: readonly JiraBacklogItem[];
	sprintBoundary?: {
		sprintId: string;
		onMove: (move: JiraBacklogSprintMove) => void;
	};
	people?: readonly JiraListPerson[];
	onIssueClick?: (item: JiraBacklogItem) => void;
	onStatusChange?: (id: string, status: JiraBacklogStatus) => void;
	onAssigneeChange?: (id: string, person: JiraListPerson | undefined) => void;
	onSelectionChange?: (ids: ReadonlySet<string>) => void;
	onCreate?: (sectionId: string) => void;
	onSprintAction?: (sectionId: string) => void;
}
