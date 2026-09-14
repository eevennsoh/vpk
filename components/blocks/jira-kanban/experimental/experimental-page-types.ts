import type { ReactNode, Ref, RefObject } from "react";

import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraDropzoneBouncePlayback } from "@/components/blocks/jira-dropzone";
import type {
	JiraListAgentSessionDropIntent,
	JiraListInsertion,
} from "@/components/blocks/jira-list";
import type {
	JiraIssueAgentActivityLayout,
	JiraIssueChrome,
	JiraIssueGenerativeActionPresentation,
	JiraIssueIconScale,
} from "@/components/blocks/jira-issue";
import type {
	JiraKanbanAgentData,
	JiraKanbanAssigneeData,
	JiraKanbanCardData,
	JiraKanbanColumnData,
	JiraKanbanProps,
} from "../index";
import type { ExperimentalJiraKanbanProps } from "./experimental-jira-kanban";
import type { ExperimentalJiraKanbanView } from "./experimental-board-header";
import type { ExperimentalJiraKanbanMode } from "./pulse/components/pulse-mode-controls";
import type { PulseAgentSession, PulseLooseWork, PulseMember, PulseWorkItem } from "./pulse/types";

export interface ExperimentalJiraKanbanListRenderContext {
	agentSessionDropIntent?: JiraListAgentSessionDropIntent;
	/**
	 * True when Untracked is the in-flow column (Panel off). The list drops
	 * its leading inset so it sits on the same rhythm as board statuses.
	 */
	onTrailingContentUnderlapChange: (hasUnderlap: boolean) => void;
	scrollEndInset: number;
	trailingOverlayRef: RefObject<HTMLElement | null>;
}

export interface ExperimentalJiraKanbanPageHandle {
	/**
	 * Open Insights, mark the timeline viewed, and land on `snapshotId`.
	 * Omit the id to open at the top of the article, as the toggle does.
	 */
	openTimeline: (snapshotId?: string | null) => void;
}

export interface ExperimentalJiraKanbanPageProps {
	issueDragTransitions?: ExperimentalJiraKanbanProps["issueDragTransitions"];
	activeView?: ExperimentalJiraKanbanView;
	activeCardCode?: string;
	/** Extra local sessions discovered after the static Pulse fixture loaded. */
	additionalAgentSessions?: readonly PulseAgentSession[];
	/** Route-owned people used to attribute and render unattached sessions. */
	agentSessionMembers?: readonly PulseMember[];
	agentActivityLayout?: JiraIssueAgentActivityLayout;
	cardGenerativeActionFooterActions?: ExperimentalJiraKanbanProps["cardGenerativeActionFooterActions"];
	cardGenerativeActionPresentation?: JiraIssueGenerativeActionPresentation;
	/** Compact keeps 12px glyphs. Comfortable is experimental v2 (16px icons, 24px avatars). */
	iconScale?: JiraIssueIconScale;
	createWorkItemDropZoneLabel?: ExperimentalJiraKanbanProps["createWorkItemDropZoneLabel"];
	/**
	 * Bounce when a session lands in the create well. Defaults to `"once"` so
	 * other boards keep the gobble; jira-team-eu26 passes `"off"`.
	 */
	createWellBounce?: JiraDropzoneBouncePlayback;
	detachedAgentSessionsByCard?: ExperimentalJiraKanbanProps["detachedAgentSessionsByCard"];
	agentSessionAssigneeIdAliases?: Readonly<Record<string, string>>;
	/**
	 * Which decoration plays when an agent session is dragged from the sessions
	 * column onto a board card. Defaults to the metaball `fuse` so other boards
	 * keep the effect they have; jira-team-eu26 passes `glow`, which collapses
	 * one cohort chip into the card and acknowledges it with the card's own
	 * halo and backdrop pulse instead of the chin-row sweep.
	 */
	agentSessionLinkingVariant?: ExperimentalJiraKanbanProps["agentSessionLinkingVariant"];
	/**
	 * Whether hovering an unattached session previews a suggested Jira card
	 * (and the reverse twin highlight). Defaults on so other boards keep the
	 * relationship preview. jira-team-eu26 passes false: sessions stay
	 * independently inspectable without lighting a board card.
	 */
	suggestSessionBoardLinkOnHover?: boolean;
	/**
	 * Where untracked work lives on this board.
	 *
	 * `"column"` keeps it in flow, as a 280px column left of the status
	 * scrollport and of the work items list. `"panel"` lifts the same column
	 * into a floating side surface pinned to the trailing edge of the content
	 * region, which the board *and* the list scroll beneath. Either
	 * presentation survives a view switch.
	 *
	 * The choice is a prop rather than a read of the global variant store: this
	 * block stays generic and unit-testable, and the route that owns the store
	 * decides. Only one presentation ever mounts, so the two can never drift.
	 */
	agentSessionPresentation?: "column" | "panel";
	/**
	 * Enables deck depth, its end-state, unpinning, and cross-column repositioning
	 * for the in-flow session timeline. Defaults to true so existing boards retain
	 * their interaction model; routes can opt into the simpler flat timeline.
	 */
	advancedAgentSessionTimeline?: boolean;
	/**
	 * Whether the expanded in-flow session column can be resized by dragging or
	 * keyboard. Defaults to true so existing boards retain their width control.
	 */
	agentSessionColumnResizable?: boolean;
	/**
	 * Whether the unattached sessions column supports additive/range selection
	 * and multi-session drag cohorts. Defaults to true. `false` also disables
	 * single-select row chrome on that column.
	 */
	agentSessionMultiSelect?: boolean;
	agents?: readonly JiraKanbanAgentData[];
	ariaLabel?: string;
	boardColumns?: readonly JiraKanbanColumnData[];
	columnChrome?: JiraKanbanProps["columnChrome"];
	compactHeader?: boolean;
	defaultAgentSessionColumnCollapsed?: boolean;
	/**
	 * Whether Untracked sessions also sit next to related Jira cards.
	 *
	 * The View menu can still hide them after mount. The route owns the
	 * starting value so it can land on "attached sessions only" without this
	 * block reading a global store. Switching the default resets the menu
	 * back to that starting point.
	 */
	defaultShowUntracked?: boolean;
	headerAssignees?: readonly JiraKanbanAssigneeData[];
	insightsEnabled?: boolean;
	insightsDefaultAssigneeIds?: readonly string[];
	isInsightsWorkItemInteractive?: (workItem: PulseWorkItem) => boolean;
	isLooseWorkResumable?: (item: PulseLooseWork) => boolean;
	mode?: ExperimentalJiraKanbanMode;
	/** Newly discovered session ids that keep the shared arrival mark visible. */
	newAgentSessionIds?: ReadonlySet<string>;
	/** Reports hover or focus within the unattached sessions column. */
	onAgentSessionColumnInteractionChange?: (interacting: boolean) => void;
	onAgentSessionsReviewed?: (sessionIds?: readonly string[]) => void;
	onBoardColumnsChange?: (columns: readonly JiraKanbanColumnData[]) => void;
	onBoardAgentSessionCreate?: (
		session: AgentSessionItem,
		columnTitle: string,
		/**
		 * Slot within the column. Omitted by the create well, which appends;
		 * supplied when the session is dropped in the gap between two cards.
		 */
		insertAtIndex?: number,
		/**
		 * Type the viewer picked in the session menu's Create new tab. Omitted by
		 * the drag paths, which name no type, and the host defaults to a task.
		 */
		issueType?: JiraKanbanCardData["issueType"],
	) => string | undefined;
	onCardClick?: (card: JiraKanbanCardData, columnTitle: string) => void;
	onCardAgentActivityViewChat?: JiraKanbanProps["onCardAgentActivityViewChat"];
	onCardAssignedAgentIdsChange?: (issueKey: string, agentIds: readonly string[]) => void;
	onCardAgentDoneRunView?: JiraKanbanProps["onCardAgentDoneRunView"];
	onCardGenerativeActionSubmit?: JiraKanbanProps["onCardGenerativeActionSubmit"];
	onCardAgentSessionLink?: ExperimentalJiraKanbanProps["onCardAgentSessionLink"];
	onCardAgentSessionMove?: ExperimentalJiraKanbanProps["onCardAgentSessionMove"];
	onCardAgentSessionUnlink?: ExperimentalJiraKanbanProps["onCardAgentSessionUnlink"];
	/**
	 * Mint work items at a specific slot in a board column, with the dropped
	 * sessions already linked to them — the board twin of
	 * `onListAgentSessionCreate`. Omit it and the board draws no insertion line,
	 * because the gap affordance would have no capability behind it.
	 *
	 * The whole cohort arrives in one call, in drag order, so the host resolves
	 * the gap once instead of re-resolving it per session and reversing them.
	 */
	onListAgentSessionCreate?: (
		session: AgentSessionItem,
		insertion: JiraListInsertion,
	) => void;
	showAgentSessionUnlinkWell?: ExperimentalJiraKanbanProps["showAgentSessionUnlinkWell"];
	/** Nested subtask cards inherit the parent chrome unless set. */
	subtaskChrome?: JiraIssueChrome;
	onInsightsWorkItemClick?: (workItem: PulseWorkItem) => void;
	onModeChange?: (mode: ExperimentalJiraKanbanMode) => void;
	/**
	 * Reopen an unattached local session in its own agent. Omit it and the
	 * row's Continue-in action stays disabled — an enabled control with no
	 * host action would be a lie.
	 */
	onContinueLooseWork?: (item: PulseLooseWork) => void;
	onResumeLooseWork?: (item: PulseLooseWork) => void;
	onViewChange?: (view: ExperimentalJiraKanbanView) => void;
	/** Keep visited Board/List views warm; hidden effects are suspended. */
	retainWorkItemViews?: boolean;
	renderListContent?: (
		columns: readonly JiraKanbanColumnData[],
		context: ExperimentalJiraKanbanListRenderContext,
	) => ReactNode;
	renderAgentActivityIndicator?: ExperimentalJiraKanbanProps["renderAgentActivityIndicator"];
	showBoardContent?: boolean;
	showAgentSessionColumn?: boolean;
	/** Shows confidence rationale, actions, and status in untracked-session flyouts. Defaults to true. */
	showAgentSessionFlyoutFooter?: boolean;
	/**
	 * Whether the unattached sessions column shows Filter sessions.
	 * Defaults to true so other boards keep the current header. jira-team-eu26
	 * passes false.
	 */
	showAgentSessionFilter?: boolean;
	/**
	 * Whether an unattached session row offers the hover check that links it to
	 * its suggested work item. Defaults to true so other boards keep one-click
	 * linking. jira-team-eu26 passes false: that board no longer ships the
	 * feature, so the row shows no link affordance at all.
	 */
	showAgentSessionLinkAction?: boolean;
	/**
	 * Whether an unattached session's more menu offers Link work item.
	 * Defaults to true; routes can hide this manual path independently from
	 * drag-to-link and other linking capabilities.
	 */
	showAgentSessionLinkWorkItemMenuItem?: boolean;
	/**
	 * Whether the unattached sessions column shows the overflow (ellipsis)
	 * menu. Collapse remains when this is off. Defaults to true.
	 */
	showAgentSessionOverflow?: boolean;
	/**
	 * Controlled unread watermark, so an owner rendering its own insights
	 * affordance counts the same unread snapshots the toggle's badge does.
	 * Omit to let this page own it; `null` is a real value meaning "nothing
	 * viewed yet", so it cannot be spelled the same way as "uncontrolled".
	 */
	onTimelineLastViewedAtChange?: (lastViewedAt: string) => void;
	ref?: Ref<ExperimentalJiraKanbanPageHandle>;
	timelineLastViewedAt?: string | null;
	viewTabs?: ReactNode;
	/**
	 * Where the overflow ("…") control sits in the board header. The route
	 * owns the choice so it can park it on the far right without this block
	 * reading a global store.
	 */
	moreControlsPlacement?: "inline" | "end";
	/**
	 * Whether the overflow ("…") control mounts. Simple views omits it.
	 */
	showMoreControls?: boolean;
	/**
	 * Simple views reveals Column size, Hide done, and Show fields in View.
	 * Off (default mode) hides those items and locks their defaults.
	 */
	simpleViews?: boolean;
	/**
	 * Outline Customize control before More when both sit at the end.
	 * Display-only unless a later owner supplies a real configure capability.
	 */
	showCustomizeControl?: boolean;
	/** Focused Team EU26 header control count. Omit to keep the full View menu. */
	needsInputCount?: number;
}
