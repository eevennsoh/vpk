"use client";

// oxlint-disable react-doctor/no-noninteractive-tabindex -- These surfaces intentionally receive keyboard focus for application-style keyboard handling or card-level shortcuts.
// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { LayoutGroup, motion, useReducedMotion, type Transition } from "motion/react";
import AiAgentAddIcon from "@atlaskit/icon-lab/core/ai-agent-add";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import AddIcon from "@atlaskit/icon/core/add";

import { type AgentSessionColumnProps } from "@/components/blocks/agent-session-column";
import {
	JiraIssue,
	type JiraIssueAgentActivityLayout,
} from "@/components/blocks/jira-issue";
import {
	mapAgentToMentionItem,
	mapSkillToMentionItem,
} from "@/components/blocks/editor-palette/data/mention-sources";
import { WorkItemAgentSelector } from "@/components/blocks/jira-work-item/experimental-v3/components/work-item-agent-selector";
import { DEFAULT_PINNED_SPACE_AGENT_IDS } from "@/components/blocks/jira-work-item/experimental-v3/lib/work-item-picker-options";
import { JiraToolbar } from "@/components/blocks/jira-toolbar";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getMentionChildItems } from "@/components/ui-custom/rich-text-editor";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	BoardColumnResizeButton,
	CollapsedBoardColumn,
} from "../experimental/components/collapsed-board-column";
import { InFlowAgentSessionColumn } from "../experimental/components/in-flow-agent-session-column";
import { BOARD_COLUMN_ACTION_REVEAL } from "../experimental/lib/board-column-action-reveal";
import {
	EMPTY_COLLAPSED_BOARD_COLUMNS,
	getBoardColumnOuterWidthPx,
	isBoardColumnCollapsed,
	toggleCollapsedBoardColumn,
	BOARD_COLUMN_WIDTH_PX,
	type CollapsedBoardColumns,
} from "../experimental/lib/board-column-collapse";

import type {
	JiraKanbanAgentData,
	JiraKanbanCardData,
	JiraKanbanCardMoveAnimation,
	JiraKanbanCardSelectModifiers,
	JiraKanbanColumnData,
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
 * Experimental v2 Jira Kanban board.
 *
 * A standalone fork of `components/blocks/jira-kanban/index.tsx` that starts
 * identical to the default variant and is free to diverge from it. The data
 * contracts (`JiraKanban*` types, `state.ts`, `jira-kanban-data.ts`) stay
 * shared so both variants remain interchangeable inside an owning surface.
 */
export interface ExperimentalV2JiraKanbanProps extends JiraKanbanProps {
	agentActivityLayout?: JiraIssueAgentActivityLayout;
	/**
	 * Sessions that never became work items, pinned as a column to the
	 * left of the board. Omit to render only Jira status columns.
	 */
	agentSessionColumn?: AgentSessionColumnProps;
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

const JIRA_KANBAN_CARD_MOVE: Transition = { duration: 0.6, ease: [0.4, 0, 0, 1] }; // duration-slowest + ease-in-out
const JIRA_KANBAN_CARD_DEPART: Transition = { duration: 0.4, ease: [0.6, 0, 0.8, 0.6] }; // duration-slower + ease-in

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

function getJiraKanbanCardScale(
	phase: JiraKanbanCardMoveAnimation["phase"] | undefined,
): number {
	if (phase === "arriving") return 0.9;
	if (phase === "departing") return 0.96;
	return 1;
}

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

function getAgentInitials(name: string): string {
	return name
		.split(/\s+/u)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function getCardAssigneeAvatarShape(card: JiraKanbanCardData) {
	if (card.avatarShape) {
		return card.avatarShape;
	}
	return card.avatarSrc?.startsWith("/avatar-agent/") ? "hexagon" as const : undefined;
}

function AgentAvatar({ agent, className }: Readonly<{ agent: JiraKanbanAgentData; className?: string }>) {
	return (
		<Avatar className={className} label={agent.name} shape="hexagon" size="sm">
			{agent.brandName ? (
				<LogoThirdParty borderless label="" name={agent.brandName} size="xxsmall" />
			) : (
				<>
					<AvatarImage alt="" src={agent.avatarSrc} />
					<AvatarFallback>{getAgentInitials(agent.name)}</AvatarFallback>
				</>
			)}
		</Avatar>
	);
}

function AgentStack({ agents }: Readonly<{ agents: readonly JiraKanbanAgentData[] }>) {
	const visibleAgents = agents.slice(0, 2);
	const overflowCount = Math.max(0, agents.length - visibleAgents.length);
	const label = agents.map((agent) => agent.name).join(", ");

	if (agents.length === 0) {
		return null;
	}

	return (
		<AvatarGroup className="-space-x-1.5 *:data-[slot=avatar]:ring-0!" label={`Assigned agents: ${label}`}>
			{visibleAgents.map((agent) => (
				<AgentAvatar agent={agent} key={agent.id} />
			))}
			{overflowCount > 0 ? (
				<Avatar aria-label={`${overflowCount} more assigned agents`} shape="hexagon" size="sm">
					<AvatarFallback className="bg-bg-neutral-bold text-[10px] font-semibold text-text-inverse">
						+{overflowCount}
					</AvatarFallback>
				</Avatar>
			) : null}
		</AvatarGroup>
	);
}

function ColumnAgentAssignment({
	agents,
	assignedAgentIds,
	columnTitle,
	onCreateAgent,
	onToggleAgent,
}: Readonly<{
	agents: readonly JiraKanbanAgentData[];
	assignedAgentIds: readonly string[];
	columnTitle: string;
	onCreateAgent: (columnTitle: string) => void;
	onToggleAgent: (agentId: string) => void;
}>) {
	const [open, setOpen] = useState(false);
	const [pinnedAgentIds, setPinnedAgentIds] = useState<readonly string[]>(DEFAULT_PINNED_SPACE_AGENT_IDS);
	const [query, setQuery] = useState("");
	const assignedAgents = useMemo(
		() => assignedAgentIds.map((id) => agents.find((agent) => agent.id === id)).filter((agent): agent is JiraKanbanAgentData => Boolean(agent)),
		[agents, assignedAgentIds],
	);
	const hasAssignedAgents = assignedAgents.length > 0;
	const triggerLabel = hasAssignedAgents
		? `Manage agents for ${columnTitle}`
		: `Add agent to ${columnTitle}`;

	const handleCreateAgent = () => {
		setOpen(false);
		setQuery("");
		onCreateAgent(columnTitle);
	};

	const handleBrowseAgents = () => {
		setOpen(false);
		setQuery("");
	};

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setQuery("");
		}
	};

	return (
		<div className="flex min-w-0 shrink-0 items-center">
			<DropdownMenu open={open} onOpenChange={handleOpenChange}>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger render={<span className="inline-flex" />}>
							<DropdownMenuTrigger
								render={
									<Button
										aria-label={triggerLabel}
										className={cn(
											"opacity-0 transition-opacity group-hover/board-column:opacity-100 group-focus-within/board-column:opacity-100",
											hasAssignedAgents && "h-8 min-w-0 gap-1 px-1.5",
											(hasAssignedAgents || open) && "opacity-100",
										)}
										data-assigned={hasAssignedAgents || undefined}
										data-open={open || undefined}
										size={hasAssignedAgents ? "default" : "icon-compact"}
										variant="ghost"
									/>
								}
							>
								{hasAssignedAgents ? (
									<>
										<AgentStack agents={assignedAgents} />
										<Icon className="ml-0.5 text-icon-subtle group-aria-expanded/button:text-icon-selected" render={<ChevronDownIcon label="" size="small" />} />
									</>
								) : (
									<Icon
										className="text-icon-subtle group-aria-expanded/button:text-icon-selected"
										label="Add agent"
										render={<AiAgentAddIcon label="" />}
									/>
								)}
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<TooltipContent>{hasAssignedAgents ? "Manage agents" : "Add agent"}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<DropdownMenuContent
					align="end"
					className="max-h-none w-[360px] overflow-hidden p-0"
					positionerClassName="z-[502]"
					sideOffset={8}
				>
					<WorkItemAgentSelector
						agents={agents}
						onAgentToggle={onToggleAgent}
						onBrowseAgents={handleBrowseAgents}
						onCreateAgent={handleCreateAgent}
						onPinnedAgentIdsChange={setPinnedAgentIds}
						onQueryChange={setQuery}
						pinnedAgentIds={pinnedAgentIds}
						query={query}
						selectedAgentIds={assignedAgentIds}
					/>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function BoardColumn({
	agents,
	assignedAgentIds,
	children,
	chrome,
	columnChrome,
	count,
	onCollapse,
	onCreateAgent,
	onToggleAgent,
	title,
}: Readonly<{
	agents?: readonly JiraKanbanAgentData[];
	assignedAgentIds: readonly string[];
	children: ReactNode;
	chrome: KanbanColumnChromeStyles;
	columnChrome: KanbanColumnChrome;
	count: number;
	onCollapse: () => void;
	onCreateAgent?: (columnTitle: string) => void;
	onToggleAgent?: (agentId: string) => void;
	title: string;
}>) {
	const showAgentAssignment = Boolean(agents?.length && onCreateAgent && onToggleAgent);
	const { ref: cardListRef, showBottomScrollMask, showTopScrollMask } = useHasVerticalOverflow<HTMLDivElement>();
	const cardListScrollMaskStyle = useMemo(
		() => buildScrollMaskStyle({
			fadeBottom: showBottomScrollMask,
			fadeSize: "3rem",
			fadeTop: showTopScrollMask,
			scrollbarWidth: 0,
		}),
		[showBottomScrollMask, showTopScrollMask],
	);

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
						<ColumnAgentAssignment
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

			<div
				ref={cardListRef}
				className="min-w-0"
				style={{
					flexGrow: 1,
					overflowY: "auto",
					display: "flex",
					flexDirection: "column",
					gap: token("space.100"),
					...cardListScrollMaskStyle,
					...chrome.cardList,
				}}
			>
				{children}
			</div>

			<div className="w-full" style={{ paddingBlock: token("space.050"), ...chrome.footer }}>
				<Button
					aria-label={`Create in ${title}`}
					className={cn(
						"w-full",
						"pointer-events-none opacity-0 transition-opacity duration-normal ease-out-practical",
						"group-hover/board-column:pointer-events-auto group-hover/board-column:opacity-100",
						"group-has-[:focus-visible]/board-column:pointer-events-auto group-has-[:focus-visible]/board-column:opacity-100",
						"motion-reduce:transition-none",
					)}
					size="compact"
					variant="outline"
				>
					<Icon render={<AddIcon label="" size="small" />} />
				</Button>
			</div>
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

function getCommonSelectedCardStatus(
	columns: readonly JiraKanbanColumnData[],
	selectedCardCodes: ReadonlySet<string>,
): string | null {
	let commonStatus: string | null = null;
	let foundSelectedCard = false;

	for (const column of columns) {
		for (const card of column.cards) {
			if (!selectedCardCodes.has(card.code)) {
				continue;
			}
			if (!foundSelectedCard) {
				commonStatus = column.title;
				foundSelectedCard = true;
				continue;
			}
			if (commonStatus !== column.title) {
				return null;
			}
		}
	}

	return foundSelectedCard ? commonStatus : null;
}

export function ExperimentalV2JiraKanban({
	activeCardCode,
	agentActivityLayout = "merged",
	agentSessionColumn,
	agents,
	animateCardMoves = false,
	ariaLabel = "Experimental v2 Jira kanban columns. Scroll horizontally to review all statuses.",
	assignedAgentIdsByColumn = {},
	boardColumns,
	cardMoveAnimation,
	collapsedColumns: controlledCollapsedColumns,
	columnChrome = DEFAULT_KANBAN_COLUMN_CHROME,
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
	onCardAgentDoneRunReview,
	onCardAgentDoneRunView,
	onCreateAgent,
	onCollapsedColumnsChange,
	onToggleColumnAgent,
	paddingBottom = token("space.150"),
	paddingTop = token("space.150"),
	selectionToolbar,
}: Readonly<ExperimentalV2JiraKanbanProps>) {
	const chrome = resolveKanbanColumnChrome(columnChrome);
	const scrollportPaddingTop = withKanbanDropRingClipGutter(paddingTop, chrome).paddingTop;
	const untrackedPaddingTop = withKanbanDropContentGutter(paddingTop, chrome).paddingTop;
	const cardLayoutGroupId = useId();
	const shouldReduceMotion = useReducedMotion();
	const shouldAnimateCardMoves = animateCardMoves && !shouldReduceMotion;
	const dragImageRef = useRef<HTMLDivElement | null>(null);
	const [uncontrolledCollapsedColumns, setUncontrolledCollapsedColumns] = useState(
		EMPTY_COLLAPSED_BOARD_COLUMNS,
	);
	const collapsedColumns = controlledCollapsedColumns ?? uncontrolledCollapsedColumns;
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

	const handleToggleColumnCollapsed = (columnTitle: string) => {
		const nextCollapsedColumns = toggleCollapsedBoardColumn(collapsedColumns, columnTitle);
		// Only own the state when the host has not claimed it, so a controlled
		// host stays the single source of truth.
		if (controlledCollapsedColumns === undefined) {
			setUncontrolledCollapsedColumns(nextCollapsedColumns);
		}
		onCollapsedColumnsChange?.(nextCollapsedColumns);
	};

	return (
		<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
			<div className="flex min-h-0 min-w-0 flex-1 items-stretch">
				{agentSessionColumn ? (
					<InFlowAgentSessionColumn
						agentSessionColumn={agentSessionColumn}
						columnFrame={chrome.headerFrame}
						paddingBottom={paddingBottom}
						paddingTop={untrackedPaddingTop}
						sessionFlyoutsSuspended={draggedCardCode !== null}
						untrackedDropArmed={false}
					/>
				) : null}
				<section
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
					<div className="flex min-h-full w-max min-w-full items-stretch ps-6">
						<div className="flex min-h-full flex-1 items-stretch gap-2">
						{boardColumns.map((column) => (
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
								chrome={chrome}
								columnChrome={columnChrome}
								count={column.cards.length}
								onCollapse={handleCollapseColumn}
								onCreateAgent={onCreateAgent}
								onToggleAgent={
									onToggleColumnAgent
										? (agentId) => onToggleColumnAgent(column.title, agentId)
										: undefined
								}
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
											<motion.div
												animate={
													shouldAnimateCardMoves
														? { scale: getJiraKanbanCardScale(cardMovePhase) }
														: undefined
												}
												className="w-full min-w-0 max-w-[280px]"
												initial={false}
												style={cardMovePhase ? { willChange: "transform" } : undefined}
												transition={cardMovePhase === "departing" ? JIRA_KANBAN_CARD_DEPART : JIRA_KANBAN_CARD_MOVE}
											>
											<JiraIssue
												active={isActive}
												chrome={chrome.cardChrome}
												summary={card.title}
												issueKey={card.code}
												tags={card.tags}
												priority={card.priority}
												pullRequestNumber={card.pullRequestNumber}
												pullRequestPreview={card.pullRequestPreview}
												pullRequestStatus={card.pullRequestStatus}
												assigneeAvatarLabel={card.assignee?.name}
												assigneeAvatarSrc={card.avatarSrc}
												assigneeAvatarShape={getCardAssigneeAvatarShape(card)}
												assigneeUnassignedKind={card.avatarUnassignedKind}
												assigneePulse={card.avatarPulse}
												agentActivities={card.agentActivities}
												agentActivityLayout={agentActivityLayout}
												agentActivityMode={card.agentActivityMode}
												agentDoneRuns={card.agentDoneRuns}
												generativeAction={{
													agents: generativeActionAgents,
													onSubmit: (request) => {
														void onCardGenerativeActionSubmit?.(request, card, column.title);
													},
													skills: generativeActionSkills,
												}}
												onAgentActivityOpenChange={
													onCardAgentActivityOpenChange
														? (open) => onCardAgentActivityOpenChange(open, card, column.title)
														: undefined
												}
												onAgentActivityViewChat={
													onCardAgentActivityViewChat
														? (activity) => onCardAgentActivityViewChat(activity, card, column.title)
														: undefined
												}
												onAgentDoneRunReview={
													onCardAgentDoneRunReview
														? (run) => onCardAgentDoneRunReview(run, card, column.title)
														: undefined
												}
												onAgentDoneRunView={
													onCardAgentDoneRunView
														? (run) => onCardAgentDoneRunView(run, card, column.title)
														: undefined
												}
												dragging={isCardBeingDragged || isSelectedCardBeingDragged}
												selected={isSelected}
												onClick={handleClick}
												onDragStart={(event) => handleCardDragStartInternal(card, column.title, event)}
												onDragEnd={handleCardDragEndInternal}
											/>
											</motion.div>
										</motion.div>
									);
								})}
							</BoardColumn>
							)}
						</BoardColumnShell>
						))}
						</div>
						<div aria-hidden className="w-6 shrink-0" />
					</div>
				</LayoutGroup>
				</section>
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
			</div>
	);
}
