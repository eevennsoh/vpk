import type { JiraListAssignedAgent, JiraListInsertion, JiraListIssueType, JiraListPerson, JiraListPriority, JiraListProps, JiraListStatusOption } from "@/components/blocks/jira-list/jira-list-types";
import type { JiraWorkItemGroup } from "@/components/blocks/jira-list/jira-list-grouping";

export const BACKLOG_STATUS_OPTIONS: readonly JiraListStatusOption[] = [
	{ status: "To do", statusVariant: "neutral" },
	{ status: "In progress", statusVariant: "information" },
	{ status: "In review", statusVariant: "warning" },
	{ status: "Done", statusVariant: "success" },
];
export type JiraBacklogStatus = JiraListStatusOption["status"];

export interface JiraBacklogItem {
	id: string;
	issueKey: string;
	summary: string;
	issueType: JiraListIssueType;
	priority: JiraListPriority;
	status: JiraBacklogStatus;
	assignee?: JiraListPerson;
	agentSessions?: readonly JiraListAssignedAgent[];
	parentIssueKey?: string;
	indentLevel?: number;
	hasChildren?: boolean;
	isExpanded?: boolean;
}

export interface JiraBacklogInlineCreate {
	sectionId: string;
	insertion?: JiraListInsertion;
	parentIssueKey?: string;
	summary: string;
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

export interface JiraBacklogProps extends Pick<JiraListProps, "agentCatalog" | "onAssignedAgentIdsChange" | "onAssignedAgentSelect" | "statusOptions"> {
	sprints: readonly JiraBacklogSection[];
	backlog: readonly JiraBacklogItem[];
	showToolbar?: boolean;
	visibleIssueKeys?: ReadonlySet<string>;
	groups?: readonly JiraWorkItemGroup[];
	sprintBoundary?: {
		sprintId: string;
		onMove: (move: JiraBacklogSprintMove) => void;
	};
	people?: readonly JiraListPerson[];
	onIssueClick?: (item: JiraBacklogItem) => void;
	onStatusChange?: (id: string, status: JiraBacklogStatus) => void;
	onAssigneeChange?: (id: string, person: JiraListPerson | undefined) => void;
	onSelectionChange?: (ids: ReadonlySet<string>) => void;
	onCreate?: (draft: JiraBacklogInlineCreate) => string | void;
	onReorder?: (sectionId: string, issueKeys: readonly string[]) => void;
	onSprintAction?: (sectionId: string) => void;
}
