"use client";

// oxlint-disable react-doctor/no-noninteractive-tabindex -- These surfaces intentionally receive keyboard focus for application-style keyboard handling or card-level shortcuts.
// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { SessionColumnSlot, SessionColumnDropMarker } from "./components/session-column-placement";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { type AgentSessionColumnProps } from "@/components/blocks/agent-session-column";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { resolveAgentSessionWorkItemKey } from "@/components/blocks/agent-session/agent-session-work-item";
import {
	type JiraIssueAgentActivityLayout,
	type JiraIssueAgentActivityIndicatorRenderer,
	type JiraIssueChrome,
	type JiraIssueGenerativeActionConfig,
	type JiraIssueGenerativeActionPresentation,
	type JiraIssueIconScale,
} from "@/components/blocks/jira-issue";
import type { JiraIssueAgentSessionRef } from "@/components/blocks/jira-issue/agent-session-transfer";
import type { JiraLinkingVariant } from "@/components/blocks/jira-linking";
import { JiraSessionFlyoutSuspensionProvider } from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import {
	mapAgentToMentionItem,
	mapSkillToMentionItem,
} from "@/components/blocks/editor-palette/data/mention-sources";
import { JiraToolbar } from "@/components/blocks/jira-toolbar";
import { getMentionChildItems } from "@/components/ui-custom/rich-text-editor";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { BoardColumnAgentAssignment } from "./components/board-column-agent-assignment";
import {
	BoardColumnResizeButton,
	CollapsedBoardColumn,
} from "./components/collapsed-board-column";
import { BoardColumnCreateAction } from "./components/create-work-item-drop-zone";
import { CreatedCardArrivalMotion } from "./components/created-card-arrival-motion";
import { BoardColumnCardList } from "./components/board-column-card-list";
import { ExclusiveCreateWellProximityProvider } from "./components/create-work-item-exclusive-proximity-context";
import { InFlowAgentSessionColumn } from "./components/in-flow-agent-session-column";
import {
	useCreatedCardArrivalCompletion,
	type JiraKanbanCreatedCardArrival,
} from "./hooks/use-created-card-arrival";
import { BOARD_COLUMN_ACTION_REVEAL } from "./lib/board-column-action-reveal";
import { getCommonSelectedCardStatus } from "./lib/board-selection-status";
import { JIRA_KANBAN_CARD_MOVE } from "./lib/card-motion";
import {
	EMPTY_COLLAPSED_BOARD_COLUMNS,
	getBoardColumnOuterWidthPx,
	isBoardColumnCollapsed,
	toggleCollapsedBoardColumn,
	resolveBoardColumnRowPaddingInlineStart,
	BOARD_COLUMN_WIDTH_PX,
	type CollapsedBoardColumns,
} from "./lib/board-column-collapse";
import { ExperimentalJiraKanbanCard } from "./experimental-jira-kanban-card";
import { SessionFusionOverlay } from "./components/session-fusion-overlay";
import {
	bindBoardProximitySessionActions,
	resolveBoardUntrackedIssueKey,
	resolveSessionBoardLinkHoverPreview,
	resolveVisibleFocusedIssueKey,
	scrollBoardIssueIntoView,
} from "./lib/board-untracked-sessions";
import {
	useBoardAgentSessionDrag,
	type BoardAgentSessionDrag,
} from "./use-board-agent-session-drag";

import type {
	JiraKanbanAgentData,
	JiraKanbanCardData,
	JiraKanbanCardSelectModifiers,
	JiraKanbanProps,
} from "../index";
import {
	DEFAULT_KANBAN_COLUMN_CHROME,
	resolveKanbanColumnChrome,
	setKanbanColumnDropArmed,
	withKanbanDropContentGutter,
	withKanbanDropRingClipGutter,
	type KanbanColumnChrome,
	type KanbanColumnChromeStyles,
} from "../column-chrome";

/**
 * Experimental Jira Kanban board.
 *
 * A standalone fork of `components/blocks/jira-kanban/index.tsx` that starts
 * identical to the default variant and is free to diverge from it. The data
 * contracts (`JiraKanban*` types, `state.ts`, `jira-kanban-data.ts`) stay
 * shared so both variants remain interchangeable inside an owning surface.
 */
export interface ExperimentalJiraKanbanProps extends JiraKanbanProps {
	agentActivityLayout?: JiraIssueAgentActivityLayout;
	/** One-shot card entrance requested by the host after creating cards from sessions. */
	createdCardArrival?: JiraKanbanCreatedCardArrival;
	/** Called once after the final card in the current arrival finishes entering. */
	onCreatedCardArrivalComplete?: (arrivalId: number) => void;
	/**
	 * Replaces each status column's resting create button with a visible drop
	 * target while an agent session is being dragged. The owning route supplies
	 * the copy so this shared board stays variation-agnostic.
	 */
	createWorkItemDropZoneLabel?: string;
	/**
	 * Trailing scroll inset in px, added to the scrollable content rather than to
	 * the scrollport.
	 *
	 * A floating side panel is `absolute`, so board content is *meant* to pass
	 * underneath it. But at maximum scroll the trailing column's edge lands flush
	 * with the scrollport's edge — permanently under the panel, with no scroll
	 * left to pull it clear. Padding the content extends the scroll extent by the
	 * panel's width, so the column still slides under the panel while scrolling
	 * and can still be scrolled fully into view. Padding the *scrollport* would
	 * reserve dead space instead and defeat the overlay.
	 */
	scrollEndInset?: number;
	/** Detached sessions keyed by the Jira card they should remain beneath. */
	detachedAgentSessionsByCard?: Readonly<Record<string, readonly AgentSessionItem[]>>;
	/**
	 * Which decoration plays when a session is linked to a card. Defaults to the
	 * metaball `fuse`; `glow` collapses one cohort chip into the card and lets
	 * the card's own halo and backdrop pulse acknowledge it.
	 *
	 * Only read when this board owns its drag hook. A host that injects
	 * {@link boardAgentSessionDrag} passes the variant to that hook instead, so
	 * the armed release and the effect that plays it cannot disagree.
	 */
	agentSessionLinkingVariant?: JiraLinkingVariant;
	onCardAgentSessionUnlink?: (
		session: JiraIssueAgentSessionRef,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void;
	/**
	 * Dashed "Drag here to unlink" well under a card. Defaults on. A host can
	 * keep chin drag and click-unlink without mounting that well.
	 */
	showAgentSessionUnlinkWell?: boolean;
	onCardAgentSessionLink?: (
		session: AgentSessionItem,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void;
	onCardAssignedAgentIdsChange?: (issueKey: string, agentIds: readonly string[]) => void;
	onCardAgentSessionMove?: (session: JiraIssueAgentSessionRef, sourceCard: JiraKanbanCardData, targetCard: JiraKanbanCardData, sourceColumnTitle: string, targetColumnTitle: string) => void;
	/** Chooses where card agent and skill actions are presented. */
	cardGenerativeActionPresentation?: JiraIssueGenerativeActionPresentation;
	/** Route-owned Browse/Create capabilities for card agent and skill pickers. */
	cardGenerativeActionFooterActions?: Pick<
		JiraIssueGenerativeActionConfig,
		"onBrowseAgents" | "onBrowseSkills" | "onCreateAgent" | "onCreateSkill"
	>;
	/** Compact keeps 12px glyphs. Comfortable is experimental v2 (16px icons, 24px avatars). */
	iconScale?: JiraIssueIconScale;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	/** Nested subtask cards inherit the parent chrome unless set. */
	subtaskChrome?: JiraIssueChrome;
	/**
	 * Sessions that never became work items, pinned as a column to the
	 * left of the board. Omit to render only Jira status columns.
	 */
	agentSessionColumn?: AgentSessionColumnProps;
	/**
	 * Untracked sessions when the in-flow column is omitted (panel mode).
	 * Keeps the board drag hook able to resolve a drop onto an issue.
	 */
	untrackedSessions?: readonly AgentSessionItem[];
	/**
	 * Hovered Untracked session id from a host-owned column. Lights the board
	 * twin when the in-flow column lives outside this tree so it can survive
	 * a Board/List switch.
	 */
	proximityHighlightedSessionId?: string | null;
	/** Resolved suggested Jira key from a host-owned Agent Session column. */
	proximityHighlightedWorkItemKey?: string | null;
	/**
	 * Whether hovering a session previews a suggested Jira card (and the
	 * reverse). Defaults on. A host can omit the preview without deleting
	 * the shared hover wiring other playgrounds still use.
	 */
	suggestSessionBoardLinkOnHover?: boolean;
	/**
	 * Injected board-session drag API. The page supplies this when the
	 * floating panel also needs `untrackedBinding`; omit to let the board
	 * own the hook (standalone demos).
	 */
	boardAgentSessionDrag?: BoardAgentSessionDrag;
	/**
	 * Capture actions for board-adjacent Untracked sessions. Independent of
	 * {@link agentSessionColumn} so proximity rows still work when the column
	 * is omitted. Gate Link / Create / Subtask with `actionableSessionIds`.
	 */
	proximityAgentSession?: {
		actionableSessionIds?: ReadonlySet<string>;
		capturedItemIds?: ReadonlySet<string>;
		onCreateWorkItem?: AgentSessionColumnProps["onCreateWorkItem"];
		onLinkWorkItem?: AgentSessionColumnProps["onLinkWorkItem"];
		onSubtasks?: AgentSessionColumnProps["onSubtasks"];
		showUntrackedWorkFooter?: AgentSessionColumnProps["showUntrackedWorkFooter"];
	};
	/**
	 * Which columns are collapsed, when the host wants to own that.
	 *
	 * Collapse is a viewer's deliberate choice, so it has to outlive anything
	 * that unmounts this board — switching to the list or Pulse view and back is
	 * a temporary view switch, not a reason to re-expand every column. A host
	 * that renders the board in such a branch should lift this state above the
	 * branch. Omit both props to let the board keep it locally.
	 */
	collapsedColumns?: CollapsedBoardColumns;
	/** Called with the next collapsed set when a column is collapsed or expanded. */
	onCollapsedColumnsChange?: (collapsedColumns: CollapsedBoardColumns) => void;
}

/**
 * Collapsing a column repositions everything to its right, so the width change
 * uses the bold in-place transition profile (`duration-medium` + `ease-in-out`).
 * The drag-target ring keeps its own interaction profile.
 */
const BOARD_COLUMN_SHELL_TRANSITION = [
	"min-width var(--duration-medium) var(--ease-in-out)",
	"max-width var(--duration-medium) var(--ease-in-out)",
	"border-color var(--duration-normal) var(--ease-out-practical)",
	"outline-color var(--duration-normal) var(--ease-out-practical)",
].join(", ");
function orderPickerItems<T extends Readonly<{ id: string }>>(
	items: readonly T[],
	pinnedIds: readonly string[] | undefined,
): readonly T[] {
	if (!pinnedIds?.length) return items;
	const pinnedIdSet = new Set(pinnedIds);
	return [
		...items.filter((item) => pinnedIdSet.has(item.id)),
		...items.filter((item) => !pinnedIdSet.has(item.id)),
	];
}

function BoardColumn({
	agents,
	assignedAgentIds,
	cardInsertion,
	children,
	chrome,
	columnChrome,
	count,
	createdCardArrival,
	createWorkItemDropZoneLabel,
	onCollapse,
	onCreateAgent,
	onToggleAgent,
	sessionDragTransaction,
	title,
}: Readonly<{
	agents?: readonly JiraKanbanAgentData[];
	assignedAgentIds: readonly string[];
	cardInsertion: BoardAgentSessionDrag["cardInsertion"];
	children: ReactNode;
	chrome: KanbanColumnChromeStyles;
	columnChrome: KanbanColumnChrome;
	count: number;
	createdCardArrival?: JiraKanbanCreatedCardArrival;
	createWorkItemDropZoneLabel?: string;
	onCollapse: () => void;
	onCreateAgent?: (columnTitle: string) => void;
	onToggleAgent?: (agentId: string) => void;
	sessionDragTransaction: BoardAgentSessionDrag["transaction"];
	title: string;
}>) {
	const showAgentAssignment = Boolean(agents?.length && onCreateAgent && onToggleAgent);
	const insertionArmed = cardInsertion?.columnTitle === title;
	const isEmptyColumn = count === 0;
	const createAction = <BoardColumnCreateAction
		dropZoneLabel={createWorkItemDropZoneLabel}
		placement={isEmptyColumn ? "top" : "bottom"}
		reveal={isEmptyColumn ? "always" : "column-hover"}
		sessionDragTransaction={sessionDragTransaction}
		title={title}
	/>;
	return (
		<div
			className={cn("group/board-column min-w-0 overflow-visible", chrome.columnClassName)}
			data-kanban-column-chrome={columnChrome}
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				// Pin the layout width so the column never reflows while the shell
				// animates back open from the collapsed pill.
				minWidth: `${BOARD_COLUMN_WIDTH_PX}px`,
				height: "100%",
				borderRadius: token("radius.xlarge"),
				...chrome.dropContentPadding,
			}}
		>
			<div
				className="flex min-w-0 items-center justify-between gap-2"
				style={{ paddingBottom: token("space.100"), ...chrome.header }}
			>
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="truncate text-xs font-medium leading-4 text-text-subtle">
						{title}
					</span>
					<span className="shrink-0 text-xs font-normal text-text-subtlest">
						{count}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-0.5">
					{showAgentAssignment && agents && onCreateAgent && onToggleAgent ? (
						<BoardColumnAgentAssignment
							agents={agents}
							assignedAgentIds={assignedAgentIds}
							columnTitle={title}
							onCreateAgent={onCreateAgent}
							onToggleAgent={onToggleAgent}
						/>
					) : null}
					<BoardColumnResizeButton
						className={cn(
							BOARD_COLUMN_ACTION_REVEAL,
							"group-hover/board-column:pointer-events-auto group-hover/board-column:opacity-100",
							"group-has-[:focus-visible]/board-column:pointer-events-auto group-has-[:focus-visible]/board-column:opacity-100",
						)}
						collapsed={false}
						onToggle={onCollapse}
						title={title}
					/>
				</div>
			</div>
			<BoardColumnCardList
				chrome={chrome}
				columnTitle={title}
				count={count}
				createdCardArrival={createdCardArrival}
				insertionArmed={insertionArmed}
				isEmpty={isEmptyColumn}
			>
				{children}
			</BoardColumnCardList>

			<div style={{ order: isEmptyColumn ? 0 : 1, ...(!isEmptyColumn ? chrome.footer : {}) }}>{createAction}</div>
		</div>
	);
}

function BoardColumnShell({
	children,
	chrome,
	collapsed,
	columnChrome,
	count,
	onDragLeave,
	onDragOver,
	onDrop,
	onToggleCollapsed,
	title,
}: Readonly<{
	/** Receives the collapse handler so the column header can render the control. */
	children: (onCollapse: () => void) => ReactNode;
	chrome: KanbanColumnChromeStyles;
	collapsed: boolean;
	columnChrome: KanbanColumnChrome;
	count: number;
	onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
	onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
	onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
	onToggleCollapsed: () => void;
	title: string;
}>) {
	const shouldReduceMotion = useReducedMotion();
	// The column keeps its full layout width while the shell animates, so the
	// overflow has to be clipped for the duration of the width transition. Doing
	// it any longer would clip the 4px focus rings on the cards inside.
	const [isResizing, setIsResizing] = useState(false);
	const outerWidth = `${getBoardColumnOuterWidthPx(collapsed)}px`;

	const handleToggleCollapsed = () => {
		if (!shouldReduceMotion) {
			setIsResizing(true);
		}
		onToggleCollapsed();
	};

	const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
		if (event.target === event.currentTarget && event.propertyName === "max-width") {
			setIsResizing(false);
		}
	};

	return (
		<div
			data-jira-kanban-column={title}
			data-kanban-column-chrome={columnChrome}
			data-collapsed={collapsed || undefined}
			className={cn(
				chrome.dropShellClassName,
				"min-w-0",
				collapsed || isResizing ? "overflow-hidden" : "overflow-visible",
			)}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			onTransitionEnd={handleTransitionEnd}
			style={{
				flex: "1 1 0",
				minWidth: outerWidth,
				maxWidth: outerWidth,
				borderRadius: token("radius.xlarge"),
				transition: shouldReduceMotion ? "none" : BOARD_COLUMN_SHELL_TRANSITION,
			}}
		>
			{collapsed ? (
				<div style={{ paddingTop: chrome.dropContentPadding?.paddingTop }}>
					<CollapsedBoardColumn
						chrome={chrome.collapsed}
						count={count}
						headerFrame={chrome.headerFrame}
						onExpand={handleToggleCollapsed}
						title={title}
					/>
				</div>
			) : (
				children(handleToggleCollapsed)
			)}
		</div>
	);
}

function ExperimentalJiraKanbanView({
	activeCardCode,
	agentActivityLayout = "merged",
	agentSessionColumn,
	agents,
	animateCardMoves = false,
	ariaLabel = "Experimental Jira kanban columns. Scroll horizontally to review all statuses.",
	assignedAgentIdsByColumn = {},
	scrollEndInset = 0,
	boardColumns,
	cardGenerativeActionPresentation = "sparkle",
	cardGenerativeActionFooterActions,
	cardMoveAnimation,
	iconScale = "compact",
	collapsedColumns: controlledCollapsedColumns,
	columnChrome = DEFAULT_KANBAN_COLUMN_CHROME,
	createdCardArrival,
	createWorkItemDropZoneLabel,
	detachedAgentSessionsByCard,
	draggedCardCode = null,
	selectedCardCodes,
	onCardClick,
	onCardSelect,
	onCardDragEnd,
	onCardDragStart,
	onCardDrop,
	onCardGenerativeActionSubmit,
	onCardAgentActivityOpenChange,
	onCardAgentActivityViewChat,
	onCardAssignedAgentIdsChange,
	onCardAgentSessionLink,
	onCardAgentSessionMove,
	onCardAgentSessionUnlink,
	showAgentSessionUnlinkWell = true,
	onCardAgentDoneRunReview,
	onCardAgentDoneRunView,
	onCreateAgent,
	onCreatedCardArrivalComplete,
	onCollapsedColumnsChange,
	onToggleColumnAgent,
	boardSessionDrag,
	proximityAgentSession,
	proximityHighlightedSessionId = null,
	proximityHighlightedWorkItemKey,
	suggestSessionBoardLinkOnHover = true,
	renderAgentActivityIndicator,
	paddingBottom = token("space.150"),
	paddingTop = token("space.150"),
	selectionToolbar,
	captureBoardSessionDragRoot = true,
	subtaskChrome,
	untrackedSessions,
}: Readonly<ExperimentalJiraKanbanProps> & {
	boardSessionDrag: BoardAgentSessionDrag;
	captureBoardSessionDragRoot?: boolean;
}) {
	const chrome = resolveKanbanColumnChrome(columnChrome);
	const scrollportPaddingTop = withKanbanDropRingClipGutter(paddingTop, chrome).paddingTop;
	const untrackedPaddingTop = withKanbanDropContentGutter(paddingTop, chrome).paddingTop;
	const columnRowPaddingInlineStart = chrome.dropContentPadding
		? `calc(${token("space.300")} - 2px - ${chrome.dropContentPadding.paddingInline})`
		: token("space.300");
	const cardLayoutGroupId = useId();
	const shouldReduceMotion = useReducedMotion();
	const shouldAnimateCardMoves = animateCardMoves && !shouldReduceMotion;
	const boardScrollportRef = useRef<HTMLElement | null>(null);
	const dragImageRef = useRef<HTMLDivElement | null>(null);
	const handleCreatedCardArrivalComplete = useCreatedCardArrivalCompletion(
		onCreatedCardArrivalComplete,
	);
	const [uncontrolledCollapsedColumns, setUncontrolledCollapsedColumns] = useState(
		EMPTY_COLLAPSED_BOARD_COLUMNS,
	);
	const [focusedIssueKey, setFocusedIssueKey] = useState<string | null>(null);
	const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
	const [hoveredColumnSessionId, setHoveredColumnSessionId] = useState<string | null>(null);
	const { highlightedSessionId, hoveredIssueKey } = resolveSessionBoardLinkHoverPreview({
		boardColumns,
		columnSessions: agentSessionColumn?.items,
		enabled: suggestSessionBoardLinkOnHover,
		hoveredColumnSessionId,
		hoveredSessionId,
		proximityHighlightedSessionId,
		proximityHighlightedWorkItemKey,
		resolveColumnWorkItemKey: agentSessionColumn
			? (item) => resolveAgentSessionWorkItemKey(
				item,
				agentSessionColumn.getSuggestedWorkItemKey,
				agentSessionColumn.getSuggestedWorkItemKeys,
			)
			: undefined,
		untrackedSessions,
	});
	const spotlightIssueKey = resolveVisibleFocusedIssueKey(focusedIssueKey, boardColumns);
	const collapsedColumns = controlledCollapsedColumns ?? uncontrolledCollapsedColumns;
	const resolvedColumnRowPaddingInlineStart = resolveBoardColumnRowPaddingInlineStart(columnRowPaddingInlineStart, boardColumns[0]?.title, Boolean(chrome.dropContentPadding), collapsedColumns);
	const selectedCount = selectedCardCodes?.size ?? 0;
	const selectedStatus = selectedCardCodes
		? getCommonSelectedCardStatus(boardColumns, selectedCardCodes)
		: null;
	const generativeActionAgents = useMemo(
		() => selectionToolbar?.agents
			? getMentionChildItems(
					{
						subagent: orderPickerItems(
							selectionToolbar.agents,
							selectionToolbar.defaultPinnedAgentIds,
						).map(mapAgentToMentionItem),
					},
					"subagent",
				)
			: undefined,
		[selectionToolbar?.agents, selectionToolbar?.defaultPinnedAgentIds],
	);
	const generativeActionSkills = useMemo(
		() => selectionToolbar?.skills
			? getMentionChildItems(
					{
						skill: orderPickerItems(
							selectionToolbar.skills,
							selectionToolbar.defaultPinnedSkillIds,
						).map(mapSkillToMentionItem),
					},
					"skill",
				)
			: undefined,
		[selectionToolbar?.defaultPinnedSkillIds, selectionToolbar?.skills],
	);

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- the drag preview node is measured/allocated against the live DOM.
	const handleColumnDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
		setKanbanColumnDropArmed(event.currentTarget, chrome, true);
	};

	const handleColumnDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
		setKanbanColumnDropArmed(event.currentTarget, chrome, false);
	};

	const handleColumnDrop = (event: React.DragEvent<HTMLDivElement>, targetColumnTitle: string) => {
		event.preventDefault();
		setKanbanColumnDropArmed(event.currentTarget, chrome, false);
		onCardDrop?.(targetColumnTitle);
	};

	// Cache the multi-drag preview DOM node once on mount. Previously this node
	// was allocated synchronously inside `dragstart`, adding DOM work to the long
	// task that starts a drag, and could leak if the user pressed Escape to
	// cancel (the cached ref was only cleared by `dragend`).
	useEffect(() => {
		if (typeof document === "undefined") {
			return;
		}
		const node = document.createElement("div");
		node.setAttribute("aria-hidden", "true");
		node.style.position = "fixed";
		node.style.top = "-1000px";
		node.style.left = "-1000px";
		node.style.width = "104px";
		node.style.height = "56px";
		node.style.pointerEvents = "none";

		const label = document.createElement("span");
		label.style.position = "absolute";
		label.style.top = "18px";
		label.style.left = "6px";
		label.style.padding = "6px 12px";
		label.style.borderRadius = "6px";
		label.style.background = "var(--ds-background-neutral-bold)";
		label.style.color = "var(--ds-text-inverse)";
		label.style.font = "var(--ds-font-body-small)";
		label.style.boxShadow = "var(--ds-shadow-overlay)";
		node.appendChild(label);

		document.body.appendChild(node);
		dragImageRef.current = node;

		return () => {
			node.remove();
			dragImageRef.current = null;
		};
	}, []);
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	const handleCardDragStartInternal = (
		card: JiraKanbanCardData,
		columnTitle: string,
		event: React.DragEvent<HTMLButtonElement>,
	) => {
		const isMultiDrag = Boolean(selectedCardCodes?.has(card.code) && selectedCardCodes.size > 1);
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.dropEffect = "move";
		event.dataTransfer.setData("text/plain", card.code);
		if (isMultiDrag && selectedCardCodes && dragImageRef.current) {
			const labelNode = dragImageRef.current.firstChild;
			if (labelNode) {
				labelNode.textContent = `${selectedCardCodes.size} items`;
			}
			event.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
		}
		onCardDragStart?.(card, columnTitle);
	};

	const handleCardDragEndInternal = () => {
		onCardDragEnd?.();
	};

	// Assigning an agent from a card's own menu still earns Glow's halo, but
	// skips the travelling-chip collapse a session drop uses.
	const handleCardGenerativeActionSubmit = boardSessionDrag
		.withAssignedAgentLink(onCardGenerativeActionSubmit);

	const handleSessionView = (item: AgentSessionItem) => {
		const nextKey = resolveVisibleFocusedIssueKey(
			resolveBoardUntrackedIssueKey(item),
			boardColumns,
		);
		setFocusedIssueKey(nextKey);
		if (nextKey) {
			scrollBoardIssueIntoView(boardScrollportRef.current, nextKey);
		}
		agentSessionColumn?.onView?.(item);
	};

	// Hovering an Untracked card lights its twin beside the work item it already
	// names. Both surfaces render the same session ids — the column holds every
	// untracked session, the board holds the subset naming an issue on it — so an
	// id match is the whole relationship test, and a session with no board
	// relationship simply has no row to light. Preview only: the click spotlight
	// above still owns focus, scroll, and dimming.
	const handleSessionHover = (item: AgentSessionItem | null) => {
		if (suggestSessionBoardLinkOnHover) {
			setHoveredSessionId(item?.id ?? null);
		}
		agentSessionColumn?.onItemHover?.(item);
	};
	const handleColumnSessionHover = (item: AgentSessionItem | null) => {
		if (suggestSessionBoardLinkOnHover) {
			setHoveredColumnSessionId(item?.id ?? null);
		}
		agentSessionColumn?.onItemHover?.(item);
	};

	const handleSessionSelectionChange = (itemId: string | null) => {
		// Card deselect is not a view. Clear the session-driven spotlight so
		// status columns drop `opacity-40` instead of staying veiled.
		if (itemId === null) {
			setFocusedIssueKey(null);
		}
		agentSessionColumn?.onSelectedItemIdChange?.(itemId);
	};

	const handleToggleColumnCollapsed = (columnTitle: string) => {
		const nextCollapsedColumns = toggleCollapsedBoardColumn(collapsedColumns, columnTitle);
		// Only own the state when the host has not claimed it, so a controlled
		// host stays the single source of truth.
		if (controlledCollapsedColumns === undefined) {
			setUncontrolledCollapsedColumns(nextCollapsedColumns);
		}
		onCollapsedColumnsChange?.(nextCollapsedColumns);
	};
	const sessionFlyoutsSuspended = boardSessionDrag.transaction !== null || draggedCardCode !== null;
	const untrackedDropArmed = boardSessionDrag.transaction?.target?.kind === "untracked";

	return (
		<div
			ref={captureBoardSessionDragRoot ? boardSessionDrag.boardRootRef : undefined}
			className="relative flex min-h-0 min-w-0 flex-1 flex-col"
			data-board-agent-session-dragging={boardSessionDrag.transaction !== null || undefined}
			data-board-agent-session-origin={boardSessionDrag.transaction?.origin.kind}
		>
			<div className="flex min-h-0 min-w-0 flex-1 items-stretch">
				{agentSessionColumn ? (
					<InFlowAgentSessionColumn
						agentSessionColumn={{
							...agentSessionColumn,
							highlightedItemId: highlightedSessionId,
							onItemHover: handleColumnSessionHover,
							onSelectedItemIdChange: handleSessionSelectionChange,
							onView: handleSessionView,
							sessionDrag: boardSessionDrag.enablement.transferable
								? boardSessionDrag.untrackedBinding
								: agentSessionColumn.sessionDrag,
						}}
						columnFrame={chrome.headerFrame}
						paddingBottom={paddingBottom}
						paddingTop={untrackedPaddingTop}
						sessionFlyoutsSuspended={sessionFlyoutsSuspended}
						untrackedDropArmed={untrackedDropArmed}
					/>
				) : null}
				<JiraSessionFlyoutSuspensionProvider suspended>
				<section
					ref={boardScrollportRef}
					data-jira-kanban-scrollport=""
					tabIndex={0}
					aria-label={ariaLabel}
					className="flex min-h-0 min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					style={{
						flex: 1,
						paddingTop: scrollportPaddingTop,
						paddingBottom,
						overflowX: "auto",
						overflowY: "hidden",
						minHeight: 0,
					}}
				>
				<LayoutGroup id={cardLayoutGroupId}>
						<div
							className="flex min-h-full w-max min-w-full items-stretch"
							style={{ paddingInlineStart: resolvedColumnRowPaddingInlineStart }}
						>
						<ExclusiveCreateWellProximityProvider>
						<div className="flex min-h-full flex-1 items-stretch gap-2">
						<SessionColumnDropMarker index={0} />
						{boardColumns.map((column, columnIndex) => (
						<Fragment key={column.title}>
						<BoardColumnShell
							chrome={chrome}
							collapsed={isBoardColumnCollapsed(collapsedColumns, column.title)}
							columnChrome={columnChrome}
							count={column.cards.length}
							key={column.title}
							onDragOver={handleColumnDragOver}
							onDragLeave={handleColumnDragLeave}
							onDrop={(event) => handleColumnDrop(event, column.title)}
							onToggleCollapsed={() => handleToggleColumnCollapsed(column.title)}
							title={column.title}
						>
							{(handleCollapseColumn) => (
							<BoardColumn
								agents={agents}
								assignedAgentIds={assignedAgentIdsByColumn[column.title] ?? []}
								cardInsertion={boardSessionDrag.cardInsertion}
								chrome={chrome}
								columnChrome={columnChrome}
								count={column.cards.length}
								createdCardArrival={createdCardArrival?.columnTitle === column.title
									? createdCardArrival
									: undefined}
								createWorkItemDropZoneLabel={createWorkItemDropZoneLabel}
								onCollapse={handleCollapseColumn}
								onCreateAgent={onCreateAgent}
								onToggleAgent={
									onToggleColumnAgent
										? (agentId) => onToggleColumnAgent(column.title, agentId)
										: undefined
								}
								sessionDragTransaction={boardSessionDrag.transaction}
								title={column.title}
							>
								{column.cards.map((card, cardIndex) => {
									const isActive = activeCardCode === card.code;
									const isSelected = selectedCardCodes?.has(card.code) ?? false;
									const isCardBeingDragged = draggedCardCode === card.code;
									const isMultiSelection = (selectedCardCodes?.size ?? 0) > 1;
									const isSelectedCardBeingDragged = Boolean(draggedCardCode && isMultiSelection && isSelected);
									const cardMovePhase = cardMoveAnimation?.cardCode === card.code
										? cardMoveAnimation.phase
										: undefined;
									const shouldAnimateCardPosition = shouldAnimateCardMoves && cardMovePhase === undefined;
									const detachedAgentSessions = detachedAgentSessionsByCard?.[card.code] ?? [];
										const proximityActions = bindBoardProximitySessionActions({
										actionableSessionIds: proximityAgentSession?.actionableSessionIds,
										capturedItemIds: proximityAgentSession?.capturedItemIds,
										onCreateWorkItem: proximityAgentSession?.onCreateWorkItem,
										onLinkWorkItem: proximityAgentSession?.onLinkWorkItem,
										onSubtasks: proximityAgentSession?.onSubtasks,
											sessions: detachedAgentSessions,
										});
										const {
											control: agentSessionDragControl,
											detachedBinding: detachedSessionDragBinding,
											dropTarget: cardDropTarget,
										} = boardSessionDrag.getCardDragState(card, column.title);
										const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
										const modifiers: JiraKanbanCardSelectModifiers = {
											shiftKey: event.shiftKey,
											metaOrCtrlKey: event.metaKey || event.ctrlKey,
										};
										if (modifiers.shiftKey || modifiers.metaOrCtrlKey) {
											event.preventDefault();
											onCardSelect?.(card.code, column.title, cardIndex, modifiers);
											return;
										}
										onCardClick?.(card.title, card.code, card, column.title);
									};
									return (
										<motion.div
											key={card.code}
											className="w-full min-w-0 max-w-[280px]"
											layout={shouldAnimateCardPosition ? "position" : false}
											layoutId={shouldAnimateCardPosition ? `jira-kanban-card-${card.code}` : undefined}
											style={shouldAnimateCardPosition ? { willChange: "transform" } : undefined}
											transition={JIRA_KANBAN_CARD_MOVE}
										>
											<CreatedCardArrivalMotion
												arrival={createdCardArrival?.columnTitle === column.title
													? createdCardArrival
													: undefined}
												cardCode={card.code}
												cardCount={column.cards.length}
												cardIndex={cardIndex}
												cardInsertion={boardSessionDrag.cardInsertion}
												cardMovePhase={cardMovePhase}
												className={cn(
													spotlightIssueKey === card.code && "bg-bg-accent-blue-subtlest [&_[data-slot=jira-issue-agent-backdrop]]:bg-bg-accent-blue-subtlest",
													spotlightIssueKey !== null && spotlightIssueKey !== card.code && "opacity-40",
												)}
												columnTitle={column.title}
												dropTarget={cardDropTarget}
												onArrivalComplete={handleCreatedCardArrivalComplete}
												shouldAnimateCardMoves={shouldAnimateCardMoves}
											>
												<ExperimentalJiraKanbanCard
												active={isActive}
													agents={agents}
													agentActivityLayout={agentActivityLayout}
													agentLinkFlash={boardSessionDrag.linkFlash?.cardCode === card.code
														? boardSessionDrag.linkFlash.flash
														: undefined}
													agentSessionDragControl={agentSessionDragControl}
													agentSessionTargetHighlighted={hoveredIssueKey === card.code && spotlightIssueKey !== card.code}
												capturedItemIds={proximityActions.capturedItemIds}
												card={card}
												chrome={chrome.cardChrome}
												columnTitle={column.title}
													detachedAgentSessions={detachedAgentSessions}
													detachedSessionDrag={detachedSessionDragBinding}
												dragging={isCardBeingDragged || isSelectedCardBeingDragged}
												generativeActionAgents={generativeActionAgents}
												generativeActionFooterActions={cardGenerativeActionFooterActions}
												generativeActionPresentation={cardGenerativeActionPresentation}
												generativeActionSkills={generativeActionSkills}
												highlightedSessionId={highlightedSessionId}
												iconScale={iconScale}
												onAgentActivityOpenChange={onCardAgentActivityOpenChange}
												onAgentActivityViewChat={onCardAgentActivityViewChat}
												onAssignedAgentIdsChange={onCardAssignedAgentIdsChange}
												onAgentDoneRunReview={onCardAgentDoneRunReview}
												onAgentDoneRunView={onCardAgentDoneRunView}
												onClick={handleClick}
												onCreateWorkItem={proximityActions.onCreateWorkItem}
												onDragEnd={handleCardDragEndInternal}
												onDragStart={(event) => handleCardDragStartInternal(card, column.title, event)}
												onGenerativeActionSubmit={handleCardGenerativeActionSubmit}
											onLinkWorkItem={proximityActions.onLinkWorkItem}
											onItemHover={handleSessionHover}
											renderAgentActivityIndicator={renderAgentActivityIndicator}
											onSessionLink={onCardAgentSessionLink}
												onSessionUnlink={onCardAgentSessionUnlink}
												onSubtasks={proximityActions.onSubtasks}
												showUntrackedWorkFooter={proximityAgentSession?.showUntrackedWorkFooter}
												showUnlinkWell={showAgentSessionUnlinkWell}
												selected={isSelected}
												subtaskChrome={subtaskChrome}
											/>
											</CreatedCardArrivalMotion>
										</motion.div>
									);
								})}
							</BoardColumn>
							)}
						</BoardColumnShell>
						<SessionColumnDropMarker index={columnIndex + 1} />
						<SessionColumnSlot index={columnIndex + 1} />
						</Fragment>
						))}
						</div>
						</ExclusiveCreateWellProximityProvider>
						{/* Trailing gutter. It also absorbs `scrollEndInset`: the outer
						    `w-max min-w-full` box is clamped to the scrollport by its
						    min-width, so padding it moves nothing — the scroll extent
						    comes from this row's own children. Widening the spacer is
						    what lets the last column scroll clear of a floating panel. */}
						<div
							aria-hidden
							className="shrink-0"
							style={{ width: `calc(var(--spacing) * 6 + ${scrollEndInset}px)` }}
						/>
					</div>
				</LayoutGroup>
				</section>
				</JiraSessionFlyoutSuspensionProvider>
			</div>
				{selectionToolbar ? (
					<JiraToolbar
						agents={selectionToolbar.agents ?? agents ?? []}
						className={selectionToolbar.className}
						defaultPinnedAgentIds={selectionToolbar.defaultPinnedAgentIds}
						defaultPinnedSkillIds={selectionToolbar.defaultPinnedSkillIds}
						onAgentAssignmentChange={selectionToolbar.onAgentAssignmentChange}
						onBrowseAgents={selectionToolbar.onBrowseAgents}
						onClearSelection={selectionToolbar.onClearSelection}
						onCreateAgent={selectionToolbar.onCreateAgent}
						onDelete={selectionToolbar.onDelete}
						onEditFields={selectionToolbar.onEditFields}
						onMerge={selectionToolbar.onMerge}
						onStatusChange={selectionToolbar.onStatusChange}
						onWatchOptions={selectionToolbar.onWatchOptions}
						pinnedItemsLabel={selectionToolbar.pinnedItemsLabel}
						selectedAgentIds={selectionToolbar.selectedAgentIds}
						selectedCount={selectedCount}
						selectedStatus={selectedStatus}
						skills={selectionToolbar.skills}
						statusOptions={boardColumns.map((column) => column.title)}
					/>
				) : null}
			<SessionFusionOverlay
				members={boardSessionDrag.transaction?.cohort.members
					?? boardSessionDrag.fusionDrop?.members
					?? null}
				onFuseSettled={boardSessionDrag.onFusionSettled}
				proximity={boardSessionDrag.transaction?.proximity
					?? boardSessionDrag.fusionDrop?.proximity
					?? null}
				release={boardSessionDrag.fusionDrop?.release ?? null}
				variant={boardSessionDrag.linkingVariant}
			/>
		</div>
	);
}

function ExperimentalJiraKanbanOwned(props: Readonly<ExperimentalJiraKanbanProps>) {
	const boardSessionDrag = useBoardAgentSessionDrag({
		boardColumns: props.boardColumns,
		detachedSessionsByCard: props.detachedAgentSessionsByCard,
		linkingVariant: props.agentSessionLinkingVariant,
		onCreate: props.proximityAgentSession?.onCreateWorkItem,
		onLink: props.onCardAgentSessionLink,
		onMove: props.onCardAgentSessionMove,
		onUnlink: props.onCardAgentSessionUnlink,
		untrackedSessions: props.agentSessionColumn?.items ?? props.untrackedSessions,
	});
	return <ExperimentalJiraKanbanView {...props} boardSessionDrag={boardSessionDrag} />;
}

export function ExperimentalJiraKanban(props: Readonly<ExperimentalJiraKanbanProps>) {
	if (props.boardAgentSessionDrag) {
		return (
			<ExperimentalJiraKanbanView
				{...props}
				boardSessionDrag={props.boardAgentSessionDrag}
				captureBoardSessionDragRoot={false}
			/>
		);
	}
	return <ExperimentalJiraKanbanOwned {...props} />;
}
