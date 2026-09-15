import type { ComponentProps, RefObject } from "react";

import type {
	AgentAssignmentAgent,
	AgentAssignmentStatusKind,
} from "@/components/blocks/agent-assignment";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type { JiraIssuePriority, JiraIssueTag } from "@/components/blocks/jira-issue";
import type { AvatarProps, AvatarUnassignedKind } from "@/components/ui/avatar";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import type { Lozenge } from "@/components/ui/lozenge";

export type JiraListPriority = JiraIssuePriority;
export type JiraListTag = JiraIssueTag;
export type JiraListIssueType = "epic" | "task" | "story" | "subtask" | "bug";
export type JiraListBaseColumnId =
	| "work"
	| "status"
	| "assignee"
	| "agentSessions"
	| "goals"
	| "priority"
	| "labels"
	| "dueDate"
	| "contributors";
export type JiraListColumnAnchorId = JiraListBaseColumnId | string;
export type JiraListInsertionPosition = "before" | "after";

export interface JiraListInsertion {
	insertAtIndex: number;
	position: JiraListInsertionPosition;
	relativeToIssueKey: string;
}

export interface JiraListPerson {
	id: string;
	name: string;
	avatarSrc?: string;
	avatarShape?: NonNullable<AvatarProps["shape"]>;
	avatarUnassignedKind?: AvatarUnassignedKind;
}

export interface JiraListGoal {
	text: string;
	emphasis?: "default" | "warning";
}

export interface JiraListAssignedAgent extends Pick<AgentAssignmentAgent, "invokedBy" | "role"> {
	id: string;
	name: string;
	byline?: string;
	avatarSrc?: string;
	brandName?: ThirdPartyLogoName;
	statusKind?: AgentAssignmentStatusKind;
	statusLabel: string;
}

export interface JiraListRowData {
	issueKey: string;
	summary: string;
	issueType: JiraListIssueType;
	priority: JiraListPriority;
	status: string;
	statusVariant?: ComponentProps<typeof Lozenge>["variant"];
	indentLevel?: number;
	hasChildren?: boolean;
	isExpanded?: boolean;
	assignee?: JiraListPerson;
	agentSessions?: readonly JiraListAssignedAgent[];
	goals?: readonly JiraListGoal[];
	labels?: readonly JiraListTag[];
	dueDate?: string;
	contributors?: readonly JiraListPerson[];
}

export interface JiraListStatusOption {
	status: string;
	statusVariant?: ComponentProps<typeof Lozenge>["variant"];
}

export interface JiraListExtraColumn {
	id: string;
	label: string;
	afterColumnId: JiraListColumnAnchorId;
	valuesByIssueKey?: Readonly<Record<string, string>>;
	widthClassName?: string;
}

export interface JiraListDraftWorkItem {
	assignee?: JiraListPerson;
	dueDate?: string;
	insertAtIndex: number | null;
	issueKeyLabel?: string;
	issueType?: JiraListIssueType;
	summary: string;
}

export type JiraListAgentSessionDropIntent =
	| { kind: "none" }
	| { kind: "attach"; issueKey: string }
	| { kind: "create"; insertion: JiraListInsertion };

/**
 * Rows to acknowledge with a one-shot background flash, plus the drop that
 * asked for it. Sessions dropped into the list create or join rows without
 * selecting them, so the flash is the only thing that points at the result.
 */
export interface JiraListRowFlash {
	readonly issueKeys: readonly string[];
	/** Bumped once per drop, so a repeat drop replays the acknowledgement. */
	readonly token: number;
}

export interface JiraListProps {
	rows: readonly JiraListRowData[];
	activeIssueKey?: string;
	ariaLabel?: string;
	className?: string;
	createLabel?: string;
	totalCountLabel?: string;
	visibleCount?: number;
	selectedIssueKeys?: ReadonlySet<string>;
	copiedIssueKey?: string | null;
	draftWorkItem?: JiraListDraftWorkItem | null;
	extraColumns?: readonly JiraListExtraColumn[];
	agentCatalog?: readonly AgentSelectorAgent[];
	statusOptions?: readonly JiraListStatusOption[];
	onAssignedAgentIdsChange?: (issueKey: string, agentIds: readonly string[]) => void;
	onAssignedAgentSelect?: (issueKey: string, agent: JiraListAssignedAgent) => void;
	onAgentAssign?: (issueKey: string, agent: AgentSelectorAgent) => void;
	/** Creates a work item. Omit to remove Create controls from the list. */
	onCreate?: (insertion?: JiraListInsertion) => void;
	onAddColumn?: (afterColumnId: JiraListColumnAnchorId) => void;
	onCopyLink?: (row: JiraListRowData) => void;
	onDraftWorkItemCancel?: () => void;
	onDraftWorkItemAssigneeChange?: (assignee: JiraListPerson | undefined) => void;
	onDraftWorkItemDueDateChange?: (dueDate: string | undefined) => void;
	onDraftWorkItemIssueTypeChange?: (issueType: JiraListIssueType) => void;
	onDraftWorkItemSubmit?: () => void;
	onDraftWorkItemSummaryChange?: (summary: string) => void;
	onIssueClick?: (row: JiraListRowData) => void;
	/** Activates an issue key. Omit to render issue keys as plain text. */
	onIssueKeyClick?: (row: JiraListRowData) => void;
	onMoveRow?: (issueKey: string, targetIndex: number) => void;
	/** Refreshes the list. Omit to remove the footer refresh action. */
	onRefresh?: () => void;
	onSelectAllRows?: (checked: boolean) => void;
	onSelectRow?: (issueKey: string, checked: boolean) => void;
	onStatusChange?: (issueKey: string, status: JiraListStatusOption) => void;
	onToggleExpand?: (issueKey: string) => void;
	agentSessionDropIntent?: JiraListAgentSessionDropIntent;
	/** One-shot acknowledgement for rows a dropped session created or joined. */
	rowFlash?: JiraListRowFlash;
	/**
	 * Scroll room after the table, used when a docked trailing surface overlaps
	 * the list viewport.
	 */
	scrollEndInset?: number;
	trailingOverlayRef?: RefObject<HTMLElement | null>;
	onTrailingContentUnderlapChange?: (hasUnderlap: boolean) => void;
}
