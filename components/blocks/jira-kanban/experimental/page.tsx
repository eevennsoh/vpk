"use client";

import dynamic from "next/dynamic";
import { useAgentSessionReview } from "@/components/blocks/jira-kanban/experimental/hooks/use-agent-session-review";
import { RetainedView } from "@/components/projects/shared/components/mount-on-first-use";
import {
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
} from "react";

import { useOptionalRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import {
	resolveAgentSessionWorkItemKey,
	type AgentSessionItem,
	type AgentSessionWorkItemDraft,
} from "@/components/blocks/agent-session";
import {
	JiraDropzoneField,
	useJiraDropzoneReceive,
	type FlightProfile,
	type SessionDropReceipt,
} from "@/components/blocks/jira-dropzone";
import type { JiraListInsertion } from "@/components/blocks/jira-list";
import {
	AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX,
	type AgentSessionColumnProps,
} from "@/components/blocks/agent-session-column";
import { JiraSessionFlyoutSuspensionProvider } from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import type {
	JiraKanbanCardData,
	JiraKanbanCardSelectModifiers,
	JiraKanbanColumnData,
} from "../index";
import { resolveKanbanColumnChrome, withKanbanDropContentGutter } from "../column-chrome";
import { createJiraKanbanColumns } from "../jira-kanban-data";
import {
	AGENT_SESSION_PANEL_WIDTH_PX,
	AgentSessionPanel,
} from "./components/agent-session-panel";
import { InFlowAgentSessionColumn } from "./components/in-flow-agent-session-column";
import { BoardFilterPopover } from "./components/board-filter-popover";
import {
	ALL_BOARD_AGENT_SESSION_STATE_IDS,
	type BoardAgentFilterId,
	type BoardAgentSessionStateId,
} from "./data/board-view-options";
import {
	ExperimentalJiraKanban,
	type ExperimentalJiraKanbanProps,
} from "./experimental-jira-kanban";
import {
	EMPTY_COLLAPSED_BOARD_COLUMNS,
	type CollapsedBoardColumns,
} from "./lib/board-column-collapse";
import { useBoardAgentSessionDrag } from "./use-board-agent-session-drag";
import { SessionColumnPlacementProvider } from "./components/session-column-placement";
import {
	collectBoardIssueKeys,
	groupBoardUntrackedSessions,
	selectBoardUntrackedSessions,
} from "./lib/board-untracked-sessions";
import {
	locateBoardUntrackedTarget,
	useBoardUntrackedTriage,
} from "./lib/board-untracked-triage";
import {
	BOARD_HEADER_TAB_STRIP_BOTTOM_PX,
	ExperimentalJiraKanbanBoardHeader,
} from "./experimental-board-header";
import type { ExperimentalJiraKanbanPageProps } from "./experimental-page-types";
import { useBoardCreatedCardArrival } from "./hooks/use-created-card-arrival";
import { useBoardMenuWorkItem } from "./hooks/use-board-menu-work-item";
import { useAgentFilterDisplay } from "./hooks/use-agent-filter-display";
import { useBoardFilter, type BoardFilterActions } from "./hooks/use-board-filter";
import {
	isExperimentalJiraListContent,
	useAgentSessionLooseWork,
} from "./hooks/use-page-content-model";
import {
	BOARD_FILTER_DEMO_NOW_ISO,
	filterPulseTimelineByDays,
} from "./lib/board-filter";
import {
	fillBoardFacepileAssignees,
	mergeBoardFilterAssignees,
	toInsightsAssigneeIds,
	toPulseMemberAssigneeIds,
	toPulseMemberId,
} from "./lib/pulse-roster-filter";
import {
	countUnviewedTimelineSnapshots,
	EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
	markTimelineViewed,
} from "./lib/timeline-activity";
import {
	PulseModeToggle,
	PulseRosterFacepile,
	type ExperimentalJiraKanbanMode,
} from "./pulse/components/pulse-mode-controls";
import { PULSE_TIMELINE } from "./pulse/data/pulse-timeline";
import {
	appendPulseAnswer,
	resolvePulseScopeFromSelections,
	toPulseAnswer,
	toPulseScopeKey,
	toPulseSuggestedQuestions,
} from "./pulse/data/pulse-scopes";
import { scopeTimelineToWorkItemKeys } from "./pulse/hooks/use-pulse-timeline";
import {
	filterPulseLooseWorkByMember,
	isPulseLooseWorkOnViewerMachine,
	toPulseSessionHandlers,
	toPulseSessionItems,
} from "./pulse/lib/pulse-sessions";
import type { PulseAnswer } from "./pulse/types";
import {
	createJiraKanbanSelectionState,
	getCommonJiraKanbanAgentIds,
	getJiraKanbanAssignees,
	moveJiraKanbanCardsToColumn,
	selectJiraKanbanCard,
	updateJiraKanbanCardAgentAssignment,
} from "../state";
import { BOARD_AGENTS } from "@/components/projects/jira/data/board-agents";
import { BOARD_COLUMNS } from "@/components/projects/jira/data/board-data";

export type {
	ExperimentalJiraKanbanListRenderContext,
	ExperimentalJiraKanbanPageHandle,
	ExperimentalJiraKanbanPageProps,
} from "./experimental-page-types";

const ExperimentalPulse = dynamic(() => import("./pulse/experimental-pulse").then((module) => module.ExperimentalPulse));

const DEFAULT_CREATED_COLUMN_AGENT_ID = "readiness-checker";
const CREATE_WELL_BOUNCE_OFF_PROFILE: Partial<FlightProfile> = { impact: null };
const PULSE_MEMBER_IDS = new Set(PULSE_TIMELINE.members.map((member) => member.id));
const EMPTY_PROXIMITY_SESSIONS: Readonly<Record<string, readonly AgentSessionItem[]>> = {};

/**
 * Extra trailing inset for the viewport FAB. `0` while the rail is
 * collapsed (original corner); the expanded panel width when it is not.
 * The launcher is portalled to `document.body`, so `:root` is the common
 * ancestor. The same name is set on the board root.
 */
const UNTRACKED_PANEL_WIDTH_CSS_VAR = "--untracked-panel-width";

/** Stable identity, so an unscoped article does not re-render on every tick. */
const EMPTY_ANSWERS: readonly PulseAnswer[] = [];

interface DraggedCardState {
	card: JiraKanbanCardData;
	sourceColumnTitle: string;
}

export default function ExperimentalJiraKanbanPage({
	createWellBounce = "once",
	...props
}: ExperimentalJiraKanbanPageProps) {
	return (
		<JiraDropzoneField
			profile={createWellBounce === "off" ? CREATE_WELL_BOUNCE_OFF_PROFILE : undefined}
		>
			<ExperimentalJiraKanbanPageContent
				{...props}
				createWellBounce={createWellBounce}
			/>
		</JiraDropzoneField>
	);
}

function ExperimentalJiraKanbanPageContent({
	activeView = "board",
	activeCardCode,
	additionalAgentSessions,
	agentSessionMembers = PULSE_TIMELINE.members,
	agentActivityLayout,
	cardGenerativeActionFooterActions,
	cardGenerativeActionPresentation, iconScale,
	createWellBounce = "once",
	createWorkItemDropZoneLabel,
	defaultAgentSessionColumnCollapsed = false,
	defaultShowUntracked = true,
	detachedAgentSessionsByCard,
	agentSessionAssigneeIdAliases,
	agentSessionLinkingVariant = "fuse",
	suggestSessionBoardLinkOnHover = true,
	agentSessionPresentation = "column",
	advancedAgentSessionTimeline = true,
	agentSessionColumnResizable = true,
	agentSessionMultiSelect = true,
	agents = BOARD_AGENTS,
	ariaLabel = "Experimental RFP board columns. Scroll horizontally to review all statuses.",
	boardColumns: controlledBoardColumns,
	columnChrome,
	compactHeader = false,
	headerAssignees,
	insightsEnabled = true,
	insightsDefaultAssigneeIds,
	isInsightsWorkItemInteractive,
	isLooseWorkResumable = isPulseLooseWorkOnViewerMachine,
	mode: controlledMode,
	newAgentSessionIds,
	onAgentSessionColumnInteractionChange,
	onAgentSessionsReviewed,
	onBoardAgentSessionCreate,
	onBoardColumnsChange,
	onCardClick,
	onCardAgentActivityViewChat,
	onCardAssignedAgentIdsChange,
	onCardAgentDoneRunView,
	onCardGenerativeActionSubmit,
	onCardAgentSessionLink,
	onCardAgentSessionMove,
	onCardAgentSessionUnlink,
	onListAgentSessionCreate,
	showAgentSessionUnlinkWell = true, subtaskChrome,
	onInsightsWorkItemClick,
	onModeChange,
	onContinueLooseWork,
	onResumeLooseWork,
	onViewChange,
	renderListContent,
	retainWorkItemViews = false,
	renderAgentActivityIndicator,
	onTimelineLastViewedAtChange,
	ref,
	showAgentSessionColumn = false,
	showAgentSessionFlyoutFooter = true,
	showAgentSessionFilter = true,
	showAgentSessionLinkAction = true,
	showAgentSessionOverflow = true,
	showBoardContent = true,
	timelineLastViewedAt: controlledTimelineLastViewedAt,
	viewTabs,
	moreControlsPlacement,
	showMoreControls,
	showCustomizeControl,
	needsInputCount,
	simpleViews,
}: Readonly<ExperimentalJiraKanbanPageProps>) {
	const [localBoardColumns, setLocalBoardColumns] = useState<JiraKanbanColumnData[]>(
		() => createJiraKanbanColumns(BOARD_COLUMNS),
	);
	const boardColumns = controlledBoardColumns ?? localBoardColumns;
	const updateBoardColumns = useCallback((
		updater: (columns: readonly JiraKanbanColumnData[]) => readonly JiraKanbanColumnData[],
	) => {
		const nextColumns = updater(boardColumns);
		if (controlledBoardColumns !== undefined) {
			onBoardColumnsChange?.(nextColumns);
			return;
		}

		setLocalBoardColumns([...nextColumns]);
	}, [boardColumns, controlledBoardColumns, onBoardColumnsChange]);
	const [columnAgentAssignments, setColumnAgentAssignments] = useState<Record<string, string[]>>({});
	const [localMode, setLocalMode] = useState<ExperimentalJiraKanbanMode>("board");
	const mode = controlledMode ?? localMode;
	const isPulse = insightsEnabled && mode === "pulse";
	const updateMode = useCallback((nextMode: ExperimentalJiraKanbanMode) => {
		if (controlledMode === undefined) {
			setLocalMode(nextMode);
		}
		onModeChange?.(nextMode);
	}, [controlledMode, onModeChange]);
	// Which insight the article should open on. Written only by
	// `handleOpenTimeline`, so the toggle's plain open clears it back to the top
	// and a deep link cannot survive into the next visit.
	const [pulseFocusSnapshotId, setPulseFocusSnapshotId] = useState<string | null>(null);
	const rovoChat = useOptionalRovoChatControls();
	// Commitments live above the mode switch: Pulse unmounts when it is toggled
	// off, and a requested action or a captured note is something the reader
	// decided, not view state that may quietly reset with the subtree.
	const [requestedActionIds, setRequestedActionIds] = useState<ReadonlySet<string>>(() => new Set<string>());
	const [capturedLooseWorkIds, setCapturedLooseWorkIds] = useState<ReadonlySet<string>>(() => new Set<string>());
	const [archivedLooseWorkIds, setArchivedLooseWorkIds] = useState<ReadonlySet<string>>(() => new Set<string>());
	// Owned here rather than inside the board: switching to the list or Pulse
	// view unmounts `ExperimentalJiraKanban`, and a viewer's collapse choices are
	// a deliberate setting that must outlive a temporary view switch.
	// Collapsed is the panel's ONLY axis. The docked rail is persistent: it is
	// always on the board's trailing edge, and the viewer expands it to the panel
	// or collapses it back to the 32px notch rail. There is deliberately no
	// closed state — nothing outside the rail could bring it back.
	const {
		agentSessionColumnCollapsed,
		handleAgentSessionColumnCollapsedChange,
		handleUntrackedItemHover,
		untrackedHoveredSession,
	} = useAgentSessionReview(
		defaultAgentSessionColumnCollapsed,
		suggestSessionBoardLinkOnHover,
		onAgentSessionsReviewed,
	);
	const untrackedHoveredSessionId = untrackedHoveredSession?.id ?? null;
	const [agentSessionPanelWidthPx, setAgentSessionPanelWidthPx] = useState(AGENT_SESSION_PANEL_WIDTH_PX);
	const agentSessionPanelRef = useRef<HTMLDivElement | null>(null);
	const [listContentUnderlapsPanel, setListContentUnderlapsPanel] = useState(false);
	const [collapsedColumns, setCollapsedColumns] = useState(EMPTY_COLLAPSED_BOARD_COLUMNS);
	const [focusedCollapsedColumns, setFocusedCollapsedColumns] = useState<CollapsedBoardColumns | null>(
		null,
	);
	const [agentFilterId, setAgentFilterId] = useState<BoardAgentFilterId | null>(null);
	const [showUntracked, setShowUntracked] = useState(defaultShowUntracked);
	const [appliedShowUntrackedDefault, setAppliedShowUntrackedDefault] = useState(defaultShowUntracked);
	const [shownSessionStateIds, setShownSessionStateIds] = useState(
		() => new Set<BoardAgentSessionStateId>(ALL_BOARD_AGENT_SESSION_STATE_IDS),
	);
	if (defaultShowUntracked !== appliedShowUntrackedDefault) {
		setAppliedShowUntrackedDefault(defaultShowUntracked);
		setShowUntracked(defaultShowUntracked);
	}
	const handleRequestAction = useCallback((action: { id: string }) => {
		setRequestedActionIds((current) => new Set(current).add(action.id));
	}, []);
	const handleCaptureLooseWork = useCallback((item: { id: string }) => {
		setCapturedLooseWorkIds((current) => new Set(current).add(item.id));
	}, []);
	const handleArchiveLooseWork = useCallback((item: { id: string }) => {
		setArchivedLooseWorkIds((current) => new Set(current).add(item.id));
	}, []);
	// Questions are stored per scope rather than cleared when the scope changes.
	// An answer about Sprint 24 read as a reply to a question asked of PAY-90
	// would be a lie the page told by omission, and keying the record is how
	// that is prevented without an effect that resets state behind the reader.
	const [answersByScope, setAnswersByScope] = useState<Readonly<Record<string, readonly PulseAnswer[]>>>({});
	const [draggedCard, setDraggedCard] = useState<DraggedCardState | null>(null);
	const [selection, setSelection] = useState(createJiraKanbanSelectionState);
	const [assignedAgentIdsByCard, setAssignedAgentIdsByCard] = useState<Record<string, string[]>>({});
	const resetAssigneeScopedBoardState = useCallback(() => {
		setSelection(createJiraKanbanSelectionState());
		setDraggedCard(null);
		setFocusedCollapsedColumns(null);
	}, []);
	const boardFilter = useBoardFilter({ onAssigneeChange: resetAssigneeScopedBoardState });
	const selectedAssigneeIds = boardFilter.selectedAssigneeIds;
	const [localTimelineLastViewedAt, setLocalTimelineLastViewedAt] = useState<string | null>(() => (
		insightsEnabled && controlledMode === "pulse"
			? markTimelineViewed(PULSE_TIMELINE)
			: EXPERIMENTAL_BOARD_LAST_VIEWED_AT
	));
	// `??` would swallow a controlled `null`, which means "nothing viewed yet"
	// and makes every snapshot unread — a real value here, unlike `boardColumns`,
	// where only `undefined` is ever passed.
	const timelineLastViewedAt = controlledTimelineLastViewedAt !== undefined
		? controlledTimelineLastViewedAt
		: localTimelineLastViewedAt;
	const markTimelineAsViewed = useCallback(() => {
		const nextViewedAt = markTimelineViewed(PULSE_TIMELINE);
		if (controlledTimelineLastViewedAt !== undefined) {
			onTimelineLastViewedAtChange?.(nextViewedAt);
			return;
		}

		setLocalTimelineLastViewedAt(nextViewedAt);
	}, [controlledTimelineLastViewedAt, onTimelineLastViewedAtChange]);
	// The one way into Insights. Every step belongs together: opening the
	// article is what "reading" means here, so the badge must clear in the same
	// gesture, and every caller — the toggle, the board filter's scope pick, and
	// the route's floating nudge through the ref handle below — goes through
	// here.
	const handleOpenTimeline = useCallback((snapshotId: string | null = null) => {
		if (!insightsEnabled) return;

		setPulseFocusSnapshotId(snapshotId);
		markTimelineAsViewed();
		const nextAssigneeIds = insightsDefaultAssigneeIds === undefined
			? toInsightsAssigneeIds(selectedAssigneeIds, PULSE_MEMBER_IDS)
			: new Set(insightsDefaultAssigneeIds);
		boardFilter.actions.setAssigneeIds(nextAssigneeIds);
		updateMode("pulse");
	}, [boardFilter.actions, insightsDefaultAssigneeIds, insightsEnabled, markTimelineAsViewed, selectedAssigneeIds, updateMode]);
	useImperativeHandle(ref, () => ({
		openTimeline: (snapshotId: string | null = null) => handleOpenTimeline(snapshotId),
	}), [handleOpenTimeline]);
	// Choosing an epic or a sprint is a request to read the brief, and the brief
	// only exists in Insights. Without this, picking one from the board filter
	// recomputes the scope and leaves the reader on the board looking at
	// columns — the feature silently doing nothing.
	//
	// It hangs off the filter's own actions rather than an effect on `scope`:
	// the mode change is caused by the reader's click, and deriving it from
	// state afterwards would also fire when a scope is restored on mount.
	// Parent and Sprint go through handleOpenTimeline so scoped entry gets the
	// same Venn default as the Insights toggle.
	const filterActions = useMemo((): BoardFilterActions => ({
		...boardFilter.actions,
		toggleValue: (fieldId, valueId) => {
			boardFilter.actions.toggleValue(fieldId, valueId);
			if (insightsEnabled && (fieldId === "parent" || fieldId === "sprint")) {
				handleOpenTimeline();
			}
		},
	}), [boardFilter.actions, handleOpenTimeline, insightsEnabled]);
	// Insights reads Parent and Sprint off the same filter the board reads its
	// own fields off. One control, one selection model — the scope is derived
	// here rather than owned separately, so the popover and the article cannot
	// disagree about what the page is showing.
	const scope = useMemo(
		() => resolvePulseScopeFromSelections(boardFilter.model.selectedValueIdsByField),
		[boardFilter.model.selectedValueIdsByField],
	);
	const scopeKey = toPulseScopeKey(scope);
	const answers = answersByScope[scopeKey] ?? EMPTY_ANSWERS;
	const handleAsk = useCallback((question: string) => {
		setAnswersByScope((current) => {
			const resolved = resolvePulseScopeFromSelections(boardFilter.model.selectedValueIdsByField);
			const key = toPulseScopeKey(resolved);
			return {
				...current,
				[key]: appendPulseAnswer(
					current[key] ?? EMPTY_ANSWERS,
					toPulseAnswer(question, resolved, toPulseSuggestedQuestions(resolved)),
				),
			};
		});
	}, [boardFilter.model.selectedValueIdsByField]);
	const assignees = useMemo(
		() => fillBoardFacepileAssignees(
			getJiraKanbanAssignees(boardColumns),
			headerAssignees ?? [],
		),
		[boardColumns, headerAssignees],
	);
	const filterAssignees = useMemo(
		() => isPulse
			? mergeBoardFilterAssignees(assignees, PULSE_TIMELINE.members)
			: assignees,
		[assignees, isPulse],
	);
	// Pulse faces are a shorthand for Filter → assignee. The roster reads the
	// same field the popover writes, so the Filter button is pressed whenever
	// a human or agent face is selected.
	const pulseMemberId = toPulseMemberId(selectedAssigneeIds, PULSE_MEMBER_IDS);
	const agentSessionMemberIds = useMemo(
		() => new Set(agentSessionMembers.map((member) => member.id)),
		[agentSessionMembers],
	);
	const agentSessionMemberId = toPulseMemberId(
		selectedAssigneeIds,
		agentSessionMemberIds,
		agentSessionAssigneeIdAliases,
	);
	const {
		displayedAgentSessionColumnCollapsed,
		displayedCollapsedColumns,
		displayedShowUntracked,
		filteredBoardColumns,
	} = useAgentFilterDisplay({
		agentFilterId,
		boardColumns,
		focusedCollapsedColumns,
		selectedAssigneeIds,
		viewerAgentSessionColumnCollapsed: agentSessionColumnCollapsed,
		viewerCollapsedColumns: collapsedColumns,
		viewerShowUntracked: showUntracked,
		viewerShownSessionStateIds: shownSessionStateIds,
	});
	// Days first, then scope. Both narrow the same timeline and both come from
	// the same control, so they compose rather than competing: a sprint scope
	// inside a "last 3 days" window is a legitimate thing to ask for.
	const pulseTimeline = useMemo(
		() => scopeTimelineToWorkItemKeys(
			filterPulseTimelineByDays(
				PULSE_TIMELINE,
				boardFilter.model.days,
				new Date(BOARD_FILTER_DEMO_NOW_ISO),
			),
			scope === null ? null : new Set(scope.workItemKeys),
		),
		[boardFilter.model.days, scope],
	);
	const timelineUnreadCount = countUnviewedTimelineSnapshots(
		PULSE_TIMELINE.snapshots,
		timelineLastViewedAt,
	);
	const agentSessionLooseWork = useAgentSessionLooseWork(additionalAgentSessions, pulseTimeline.looseWork);
	const agentSessionItems = useMemo(
		() => toPulseSessionItems(
			filterPulseLooseWorkByMember(agentSessionLooseWork, agentSessionMemberId),
			agentSessionMembers,
			PULSE_TIMELINE.workItems,
		),
		[agentSessionLooseWork, agentSessionMemberId, agentSessionMembers],
	);
	const untrackedAgentSessionItems = useMemo(
		() => selectBoardUntrackedSessions({
			archivedItemIds: archivedLooseWorkIds,
			capturedItemIds: capturedLooseWorkIds,
			detachedByCard: detachedAgentSessionsByCard,
			sessions: agentSessionItems,
		}),
		[agentSessionItems, archivedLooseWorkIds, capturedLooseWorkIds, detachedAgentSessionsByCard],
	);
	const agentSessionHandlers = useMemo(
		() => toPulseSessionHandlers({
			isLooseWorkResumable,
			looseWork: agentSessionLooseWork,
			onCapture: handleCaptureLooseWork,
			onContinue: onContinueLooseWork,
			onResume: onResumeLooseWork,
		}),
		[
			handleCaptureLooseWork,
			agentSessionLooseWork,
			isLooseWorkResumable,
			onContinueLooseWork,
			onResumeLooseWork,
		],
	);
	const {
		createdCardArrival,
		handleComplete: handleCreatedCardArrivalComplete,
		handleCreate: handleBoardAgentSessionCreate,
	} = useBoardCreatedCardArrival({
		captureSession: agentSessionHandlers.onCreateWorkItem,
		onCreate: onBoardAgentSessionCreate,
	});
	const proximityActionableSessionIds = useMemo(
		() => new Set(agentSessionItems.map((session) => session.id)),
		[agentSessionItems],
	);
	const handleCardAgentSessionLink: ExperimentalJiraKanbanProps["onCardAgentSessionLink"] = (
		session,
		card,
		columnTitle,
	) => {
		setCapturedLooseWorkIds((current) => {
			if (current.has(session.id)) {
				return current;
			}
			return new Set(current).add(session.id);
		});
		onCardAgentSessionLink?.(session, card, columnTitle);
	};
	const untrackedTriage = useBoardUntrackedTriage({
		boardColumns: filteredBoardColumns,
		onArchive: handleArchiveLooseWork,
		onCreateWorkItem: handleCaptureLooseWork,
		onLink: onCardAgentSessionLink ? handleCardAgentSessionLink : undefined,
	});
	const handleUntrackedLinkWorkItem = (
		item: AgentSessionItem,
		workItemKey?: string,
	) => {
		const key = workItemKey ?? resolveAgentSessionWorkItemKey(item);
		const target = key === undefined
			? undefined
			: locateBoardUntrackedTarget(filteredBoardColumns, key)
				?? untrackedTriage.locateTarget(item, key);
		if (target === undefined) {
			return;
		}
		untrackedTriage.attach(item, target);
		boardSessionDrag.armSessionLink(target.card.code, item);
	};
	const boardMenuWorkItem = useBoardMenuWorkItem({
		boardColumns: filteredBoardColumns,
		hostCreate: onBoardAgentSessionCreate === undefined ? undefined : (item, draft) => {
			const cardCode = handleBoardAgentSessionCreate(
				{ ...item, title: draft.summary },
				filteredBoardColumns[0]?.title ?? "To do",
				undefined, draft.issueType, // no slot: the menu appends, unlike a gap drop
			);
			if (cardCode !== undefined) boardSessionDrag.armSessionLink(cardCode, item);
		},
		hostLink: onCardAgentSessionLink === undefined ? undefined : handleUntrackedLinkWorkItem,
		onCapture: handleCaptureLooseWork,
		updateBoardColumns,
	});
	// One config keeps the in-flow column and floating panel on the same data and handlers.
	const agentSessionColumnConfig: AgentSessionColumnProps | undefined = showAgentSessionColumn ? {
		capturedItemIds: capturedLooseWorkIds,
		// Controlled so View → Agents can expand or collapse Untracked without
		// fighting the column's own post-mount state.
		collapsed: displayedAgentSessionColumnCollapsed,
		hasScrollingEffect: true,
		items: untrackedAgentSessionItems,
		multiSelect: agentSessionMultiSelect,
		newItemIds: newAgentSessionIds,
		onCollapsedChange: handleAgentSessionColumnCollapsedChange,
		onInteractionChange: onAgentSessionColumnInteractionChange,
		onItemHover: handleUntrackedItemHover,
		...agentSessionHandlers,
		onCreateWorkItemFromDraft: boardMenuWorkItem.onCreateWorkItemFromDraft,
		onLinkWorkItem: boardMenuWorkItem.onLinkWorkItem,
		showFilter: showAgentSessionFilter,
		showLinkAction: showAgentSessionLinkAction,
		showOverflow: showAgentSessionOverflow,
		showUntrackedWorkFooter: showAgentSessionFlyoutFooter,
		triage: untrackedTriage,
		workItemOptions: boardMenuWorkItem.workItemOptions,
	} : undefined;
	const untrackedHoveredWorkItemKey = untrackedHoveredSession === null
		? null
		: resolveAgentSessionWorkItemKey(
			untrackedHoveredSession,
			agentSessionColumnConfig?.getSuggestedWorkItemKey,
			agentSessionColumnConfig?.getSuggestedWorkItemKeys,
		) ?? null;
	const isListContent = isExperimentalJiraListContent(activeView, renderListContent);
	// Insights replaces the whole content region with an article; a floating
	// untracked-work surface over prose is chrome with nothing to attach to.
	const showPulseContent = isPulse && !isListContent;
	const showAgentSessionPanel = agentSessionPresentation === "panel"
		&& agentSessionColumnConfig !== undefined
		&& showBoardContent
		&& !showPulseContent;
	const showInFlowAgentSessionColumn = agentSessionPresentation === "column"
		&& agentSessionColumnConfig !== undefined;
	const columnChromeStyles = resolveKanbanColumnChrome(columnChrome);
	// The panel is absolute, so board content passes *under* it by design. But at
	// maximum scroll the trailing column would land flush with the scrollport's
	// edge and stay under the panel with no scroll left to free it. Extending the
	// scrollable content by the panel's own width keeps the pass-under behavior
	// and still lets the last column be scrolled fully clear.
	const boardScrollEndInset = showAgentSessionPanel
		? (displayedAgentSessionColumnCollapsed
			? AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX
			: agentSessionPanelWidthPx)
		: 0;
	// Scroll inset and FAB inset are different numbers. The last column still
	// needs the 32px rail reserved; the viewport FAB does not — collapsed is
	// the original 24px corner (`0` extra). Only the expanded panel pushes it.
	// First paint follows `defaultAgentSessionColumnCollapsed`.
	const untrackedPanelFabInsetPx = showAgentSessionPanel && !displayedAgentSessionColumnCollapsed
		? agentSessionPanelWidthPx
		: 0;
	// The floating Rovo button is portalled to `document.body`, so it cannot
	// inherit this variable from the board. Publish on `:root` (and the board
	// root below). Always write the current value so a leftover 360px from a
	// previous expand cannot stick through a collapsed first paint.
	useLayoutEffect(() => {
		const root = document.documentElement;
		root.style.setProperty(UNTRACKED_PANEL_WIDTH_CSS_VAR, `${untrackedPanelFabInsetPx}px`);
		return () => {
			root.style.removeProperty(UNTRACKED_PANEL_WIDTH_CSS_VAR);
		};
	}, [untrackedPanelFabInsetPx]);
	const boardIssueKeys = useMemo(
		() => collectBoardIssueKeys(filteredBoardColumns),
		[filteredBoardColumns],
	);
	const proximityAgentSessionsByCard = useMemo(
		() => displayedShowUntracked
			? groupBoardUntrackedSessions({
				archivedItemIds: archivedLooseWorkIds,
				boardIssueKeys,
				capturedItemIds: capturedLooseWorkIds,
				detachedByCard: detachedAgentSessionsByCard,
				sessions: agentSessionItems,
			})
			: EMPTY_PROXIMITY_SESSIONS,
		[
			agentSessionItems,
			archivedLooseWorkIds,
			boardIssueKeys,
			capturedLooseWorkIds,
			detachedAgentSessionsByCard,
			displayedShowUntracked,
		],
	);
	const selectedAgentIds = useMemo(
		() => getCommonJiraKanbanAgentIds(assignedAgentIdsByCard, selection.selectedCardCodes),
		[assignedAgentIdsByCard, selection.selectedCardCodes],
	);

	const handleCardSelect = (
		cardCode: string,
		columnTitle: string,
		indexInColumn: number,
		modifiers: JiraKanbanCardSelectModifiers,
	) => {
		setSelection((current) => selectJiraKanbanCard(current, filteredBoardColumns, {
			cardCode,
			columnTitle,
			indexInColumn,
			modifiers,
		}));
	};

	// An owning workspace uses a plain click for activation, so clear any bulk
	// selection before opening it. Shift/⌘ clicks bypass this handler in
	// `JiraKanban` and continue through `onCardSelect` for range/toggle selection.
	// The standalone block keeps its original plain-click selection behavior.
	const handleCardClick = (
		_title: string,
		cardCode: string,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => {
		if (onCardClick) {
			setSelection(createJiraKanbanSelectionState());
			onCardClick(card, columnTitle);
			return;
		}

		const indexInColumn = filteredBoardColumns
			.find((column) => column.title === columnTitle)
			?.cards.findIndex((card) => card.code === cardCode) ?? 0;
		handleCardSelect(cardCode, columnTitle, indexInColumn, {
			metaOrCtrlKey: false,
			shiftKey: false,
		});
	};

	const handleCardDragStart = (card: JiraKanbanCardData, sourceColumnTitle: string) => {
		if (!selection.selectedCardCodes.has(card.code)) {
			setSelection(createJiraKanbanSelectionState());
		}
		setDraggedCard({ card, sourceColumnTitle });
	};

	const handleCardDrop = (targetColumnTitle: string) => {
		if (!draggedCard || draggedCard.sourceColumnTitle === targetColumnTitle) {
			setDraggedCard(null);
			return;
		}

		const isMultiDrag = selection.selectedCardCodes.has(draggedCard.card.code)
			&& selection.selectedCardCodes.size > 1;
		const draggedCardCodes = isMultiDrag
			? [...selection.selectedCardCodes]
			: [draggedCard.card.code];

		updateBoardColumns((prevColumns) => {
			const movableCardCodes = draggedCardCodes.filter((cardCode) => prevColumns.some((column) => (
				column.title !== targetColumnTitle && column.cards.some((card) => card.code === cardCode)
			)));
			return moveJiraKanbanCardsToColumn(prevColumns, movableCardCodes, targetColumnTitle);
		});

		if (isMultiDrag) {
			setSelection(createJiraKanbanSelectionState());
		}
		setDraggedCard(null);
	};

	const handleCardDragEnd = () => {
		setDraggedCard(null);
	};

	const handleListAgentSessionCreate = (
		session: AgentSessionItem,
		insertion: JiraListInsertion,
	) => {
		setCapturedLooseWorkIds((current) => {
			if (current.has(session.id)) {
				return current;
			}
			return new Set(current).add(session.id);
		});
		onListAgentSessionCreate?.(session, insertion);
	};

	const handleCardAgentSessionMove: ExperimentalJiraKanbanProps["onCardAgentSessionMove"] = (
		session,
		sourceCard,
		targetCard,
		sourceColumnTitle,
		targetColumnTitle,
	) => {
		onCardAgentSessionMove?.(
			session,
			sourceCard,
			targetCard,
			sourceColumnTitle,
			targetColumnTitle,
		);
	};

	const handleCardAgentSessionUnlink: ExperimentalJiraKanbanProps["onCardAgentSessionUnlink"] = (
		session,
		card,
		columnTitle,
	) => {
		setCapturedLooseWorkIds((current) => {
			if (!current.has(session.id)) {
				return current;
			}
			const next = new Set(current);
			next.delete(session.id);
			return next;
		});
		onCardAgentSessionUnlink?.(session, card, columnTitle);
	};

	const handleAssigneeFilterChange = (assigneeIds: Set<string>) => {
		boardFilter.actions.setAssigneeIds(assigneeIds);
	};

	// Same contract as the assignee filter: the focus row takes cards off the
	// board, and bulk status, agent assignment, and multi-drag all read the raw
	// selection rather than what is on screen. A selection that outlives the
	// change would silently move or reassign cards the viewer can no longer see.
	const handleAgentFilterChange = (nextAgentFilterId: BoardAgentFilterId | null) => {
		setSelection(createJiraKanbanSelectionState());
		setDraggedCard(null);
		setFocusedCollapsedColumns(null);
		setAgentFilterId(nextAgentFilterId);
	};

	const handleCollapsedColumnsChange = (nextCollapsedColumns: CollapsedBoardColumns) => {
		if (agentFilterId === null) {
			setCollapsedColumns(nextCollapsedColumns);
			return;
		}
		setFocusedCollapsedColumns(nextCollapsedColumns);
	};

	const handlePulseMemberChange = (memberId: string | null) => {
		handleAssigneeFilterChange(toPulseMemberAssigneeIds(memberId));
	};

	const handleSelectedCardsStatusChange = (targetColumnTitle: string) => {
		updateBoardColumns((currentColumns) => moveJiraKanbanCardsToColumn(
			currentColumns,
			[...selection.selectedCardCodes],
			targetColumnTitle,
		));
	};

	const handleSelectedCardsAgentAssignmentChange = (agentId: string, assigned: boolean) => {
		setAssignedAgentIdsByCard((currentAssignments) => updateJiraKanbanCardAgentAssignment(
			currentAssignments,
			selection.selectedCardCodes,
			agentId,
			assigned,
		));
	};

	const handleToggleColumnAgent = (columnTitle: string, agentId: string) => {
		setColumnAgentAssignments((prevAssignments) => {
			const assignedAgentIds = prevAssignments[columnTitle] ?? [];
			const hasAgent = assignedAgentIds.includes(agentId);
			const nextAgentIds = hasAgent
				? assignedAgentIds.filter((assignedAgentId) => assignedAgentId !== agentId)
				: [...assignedAgentIds, agentId];

			return {
				...prevAssignments,
				[columnTitle]: nextAgentIds,
			};
		});
	};

	const handleCreateColumnAgent = (columnTitle: string) => {
		setColumnAgentAssignments((prevAssignments) => {
			const assignedAgentIds = prevAssignments[columnTitle] ?? [];

			if (assignedAgentIds.includes(DEFAULT_CREATED_COLUMN_AGENT_ID)) {
				return prevAssignments;
			}

			return {
				...prevAssignments,
				[columnTitle]: [...assignedAgentIds, DEFAULT_CREATED_COLUMN_AGENT_ID],
			};
		});
	};

	const receiveCreateWellRaw = useJiraDropzoneReceive();
	const receiveCreateWell = useCallback((receipt: SessionDropReceipt) => (
		receiveCreateWellRaw({ ...receipt, bounce: createWellBounce })
	), [createWellBounce, receiveCreateWellRaw]);
	const boardSessionDrag = useBoardAgentSessionDrag({
		boardColumns: filteredBoardColumns,
		detachedSessionsByCard: proximityAgentSessionsByCard,
		linkingVariant: agentSessionLinkingVariant,
		onCreate: onBoardAgentSessionCreate ? handleBoardAgentSessionCreate : undefined,
		// Same create path as the well, with a slot. Each cohort member advances
		// the index, and the refs behind `handleBoardAgentSessionCreate` grow with
		// every call, so the sessions land in drag order rather than reversed.
		onBoardGapCreate: onBoardAgentSessionCreate
			? (sessions, insertion) => sessions.forEach((session, memberIndex) => (
				handleBoardAgentSessionCreate(
					session,
					insertion.columnTitle,
					insertion.insertAtIndex + memberIndex,
				)
			))
			: undefined,
		onCreateWellReceive: receiveCreateWell,
		onListCreate: onListAgentSessionCreate ? handleListAgentSessionCreate : undefined,
		onLink: onCardAgentSessionLink ? handleCardAgentSessionLink : undefined,
		onMove: onCardAgentSessionMove ? handleCardAgentSessionMove : undefined,
		onUnlink: onCardAgentSessionUnlink ? handleCardAgentSessionUnlink : undefined,
		untrackedSessions: agentSessionColumnConfig?.items,
	});

	return (
		<div
			className="relative flex h-full min-h-[640px] flex-col bg-surface"
			ref={boardSessionDrag.boardRootRef}
			style={{ [UNTRACKED_PANEL_WIDTH_CSS_VAR]: `${untrackedPanelFabInsetPx}px` } as CSSProperties}
		>
			<ExperimentalJiraKanbanBoardHeader
				activeView={activeView}
				assignees={assignees}
				compact={compactHeader}
				controlsInsetEnd={boardScrollEndInset}
				onSelectedAssigneeIdsChange={handleAssigneeFilterChange}
				onShownSessionStateIdsChange={setShownSessionStateIds}
				onShowUntrackedChange={setShowUntracked}
				agentFilterId={agentFilterId}
				onAgentFilterIdChange={handleAgentFilterChange}
				needsInputCount={needsInputCount}
				onViewChange={renderListContent ? onViewChange : undefined}
				searchPlaceholder={`Search ${activeView}`}
				selectedAssigneeIds={selectedAssigneeIds}
				showBoardControls={showBoardContent}
				shownSessionStateIds={shownSessionStateIds}
				showUntracked={showUntracked}
				facepile={isPulse ? (
					<PulseRosterFacepile
						members={PULSE_TIMELINE.members}
						onSelectedMemberIdChange={handlePulseMemberChange}
						selectedMemberId={pulseMemberId}
					/>
				) : undefined}
				filterControl={
					<BoardFilterPopover
						actions={filterActions}
						assignees={filterAssignees}
						compact={compactHeader}
						model={boardFilter.model}
						surfaceLabel={activeView}
					/>
				}
				modeToggle={insightsEnabled ? (
					<PulseModeToggle
						active={isPulse}
						onToggle={() => {
							if (isPulse) {
								rovoChat?.closeChat();
								updateMode("board");
								return;
							}
							handleOpenTimeline();
						}}
						unreadCount={isPulse ? 0 : timelineUnreadCount}
					/>
				) : undefined}
				surfaceLabel={activeView}
				viewTabs={viewTabs}
				moreControlsPlacement={moreControlsPlacement}
				showMoreControls={showMoreControls}
				showCustomizeControl={showCustomizeControl}
				simpleViews={simpleViews}
			/>
			{showBoardContent ? (showPulseContent ? (
				<ExperimentalPulse
					answers={answers}
					capturedLooseWorkIds={capturedLooseWorkIds}
					initialSnapshotId={pulseFocusSnapshotId}
					isLooseWorkResumable={isLooseWorkResumable}
					isWorkItemInteractive={isInsightsWorkItemInteractive}
					onAsk={handleAsk}
					onCaptureLooseWork={handleCaptureLooseWork}
					onRequestAction={handleRequestAction}
					onResumeLooseWork={onResumeLooseWork}
					onSelectedMemberIdChange={handlePulseMemberChange}
					onWorkItemClick={onInsightsWorkItemClick}
					requestedActionIds={requestedActionIds}
					scope={scope}
					selectedMemberId={pulseMemberId}
					timeline={pulseTimeline}
				/>
			) : (
				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
					<SessionColumnPlacementProvider
						enabled={advancedAgentSessionTimeline && !isListContent && showInFlowAgentSessionColumn && Boolean(agentSessionColumnConfig)}
						titles={filteredBoardColumns.map((column) => column.title)}
					>
						{showInFlowAgentSessionColumn && agentSessionColumnConfig ? (
							<InFlowAgentSessionColumn
								advancedTimeline={advancedAgentSessionTimeline}
								resizable={agentSessionColumnResizable}
								agentSessionColumn={{
									...agentSessionColumnConfig,
									draggingIds: boardSessionDrag.draggingIds,
									highlightedItemId: suggestSessionBoardLinkOnHover
										? untrackedHoveredSessionId
										: undefined,
									sessionDrag: boardSessionDrag.untrackedBinding,
								}}
								className="pb-4 md:pb-5"
								columnFrame={columnChromeStyles.headerFrame}
								paddingTop={withKanbanDropContentGutter(0, columnChromeStyles).paddingTop}
								sessionFlyoutsSuspended={boardSessionDrag.transaction !== null}
								untrackedDropArmed={boardSessionDrag.transaction?.target?.kind === "untracked"}
							/>
						) : null}
						<RetainedView active={isListContent} retain={retainWorkItemViews}>
							{retainWorkItemViews || isListContent ? (
								renderListContent?.(filteredBoardColumns, {
									agentSessionDropIntent: boardSessionDrag.listDropIntent,
									onTrailingContentUnderlapChange: setListContentUnderlapsPanel,
									scrollEndInset: boardScrollEndInset,
									trailingOverlayRef: agentSessionPanelRef,
								})
							) : null}
						</RetainedView>
						<RetainedView active={!isListContent} retain={retainWorkItemViews}>
							<ExperimentalJiraKanban
								activeCardCode={activeCardCode}
								agentActivityLayout={agentActivityLayout}
								boardAgentSessionDrag={boardSessionDrag}
								untrackedSessions={agentSessionColumnConfig?.items}
								proximityHighlightedSessionId={suggestSessionBoardLinkOnHover
									? untrackedHoveredSessionId
									: null}
								proximityHighlightedWorkItemKey={suggestSessionBoardLinkOnHover
									? untrackedHoveredWorkItemKey
									: null}
								suggestSessionBoardLinkOnHover={suggestSessionBoardLinkOnHover}
								scrollEndInset={boardScrollEndInset}
								proximityAgentSession={{
									actionableSessionIds: proximityActionableSessionIds,
									capturedItemIds: capturedLooseWorkIds,
									onCreateWorkItem: agentSessionHandlers.onCreateWorkItem,
									onLinkWorkItem: agentSessionHandlers.onLinkWorkItem,
									onSubtasks: agentSessionHandlers.onSubtasks,
									showUntrackedWorkFooter: showAgentSessionFlyoutFooter,
								}}
								agents={agents}
								ariaLabel={ariaLabel}
								assignedAgentIdsByColumn={columnAgentAssignments}
								boardColumns={filteredBoardColumns}
								cardGenerativeActionFooterActions={cardGenerativeActionFooterActions}
								cardGenerativeActionPresentation={cardGenerativeActionPresentation} iconScale={iconScale}
								collapsedColumns={displayedCollapsedColumns}
								columnChrome={columnChrome}
								createdCardArrival={createdCardArrival ?? undefined}
								createWorkItemDropZoneLabel={onBoardAgentSessionCreate
									? createWorkItemDropZoneLabel
									: undefined}
								detachedAgentSessionsByCard={proximityAgentSessionsByCard}
								onCollapsedColumnsChange={handleCollapsedColumnsChange}
								onCreatedCardArrivalComplete={handleCreatedCardArrivalComplete}
								draggedCardCode={draggedCard?.card.code ?? null}
								selectedCardCodes={selection.selectedCardCodes}
								onCardClick={handleCardClick}
								onCardAgentActivityViewChat={onCardAgentActivityViewChat}
								onCardAssignedAgentIdsChange={onCardAssignedAgentIdsChange}
								onCardAgentDoneRunView={onCardAgentDoneRunView}
								onCardGenerativeActionSubmit={onCardGenerativeActionSubmit}
								onCardAgentSessionLink={onCardAgentSessionLink
									? handleCardAgentSessionLink
									: undefined}
								onCardAgentSessionMove={onCardAgentSessionMove
									? handleCardAgentSessionMove
									: undefined}
								onCardAgentSessionUnlink={onCardAgentSessionUnlink
									? handleCardAgentSessionUnlink
									: undefined}
								showAgentSessionUnlinkWell={showAgentSessionUnlinkWell} subtaskChrome={subtaskChrome}
								onCardSelect={handleCardSelect}
								onCardDragStart={handleCardDragStart}
								onCardDrop={handleCardDrop}
								onCardDragEnd={handleCardDragEnd}
								onCreateAgent={handleCreateColumnAgent}
								onToggleColumnAgent={handleToggleColumnAgent}
								renderAgentActivityIndicator={renderAgentActivityIndicator}
								paddingTop={0}
								selectionToolbar={{
									onAgentAssignmentChange: handleSelectedCardsAgentAssignmentChange,
									onClearSelection: () => setSelection(createJiraKanbanSelectionState()),
									onStatusChange: handleSelectedCardsStatusChange,
									selectedAgentIds,
								}}
							/>
						</RetainedView>
					</SessionColumnPlacementProvider>
				</div>
			)) : null}
			{/* Docked rail: last child so it stacks above list column controls at the same z. */}
			{showAgentSessionPanel && agentSessionColumnConfig ? (
				<JiraSessionFlyoutSuspensionProvider
					suspended={boardSessionDrag.transaction !== null}
				>
					<AgentSessionPanel
						agentSessionColumn={{
							...agentSessionColumnConfig,
							draggingIds: boardSessionDrag.draggingIds,
							sessionDrag: boardSessionDrag.untrackedBinding,
						}}
						collapsed={displayedAgentSessionColumnCollapsed}
						onCollapsedChange={handleAgentSessionColumnCollapsedChange}
						onExpandedWidthChange={setAgentSessionPanelWidthPx}
						ref={agentSessionPanelRef}
						sessionDragging={boardSessionDrag.transaction !== null}
						showLeadingScrollFade={isListContent && listContentUnderlapsPanel}
						topInset={BOARD_HEADER_TAB_STRIP_BOTTOM_PX}
						untrackedDropArmed={boardSessionDrag.transaction?.target?.kind === "untracked"}
					/>
				</JiraSessionFlyoutSuspensionProvider>
			) : null}
		</div>
	);
}
