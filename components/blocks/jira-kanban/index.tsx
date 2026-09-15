"use client";

// oxlint-disable react-doctor/no-noninteractive-tabindex -- These surfaces intentionally receive keyboard focus for application-style keyboard handling or card-level shortcuts.
// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LayoutGroup, motion, useReducedMotion, type Transition } from "motion/react";
import AiAgentAddIcon from "@atlaskit/icon-lab/core/ai-agent-add";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import AddIcon from "@atlaskit/icon/core/add";

import {
	JiraIssue,
	type JiraIssueAgentActivity,
	type JiraIssueAgentActivityMode,
	type JiraIssueCompletedAgentRun,
	type JiraIssueGenerativeActionRequest,
	type JiraIssuePriority,
	type JiraIssuePullRequestPreview,
	type JiraIssuePullRequestStatus,
	type JiraIssueTag,
} from "@/components/blocks/jira-issue";
import {
	mapAgentToMentionItem,
	mapSkillToMentionItem,
} from "@/components/blocks/editor-palette/data/mention-sources";
import { AgentSelector } from "@/components/blocks/agent-selector";
import type { JiraKanbanCardDropTarget } from "./card-drop";
import { JiraToolbar } from "@/components/blocks/jira-toolbar";
import type { SkillsDirectorySkill } from "@/app/data/directory";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarImage,
	type AvatarProps,
	type AvatarUnassignedKind,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getMentionChildItems } from "@/components/ui-custom/rich-text-editor";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	DEFAULT_KANBAN_COLUMN_CHROME,
	resolveKanbanColumnChrome,
	setKanbanColumnDropArmed,
	withKanbanDropRingClipGutter,
	type KanbanColumnChrome,
	type KanbanColumnChromeStyles,
} from "./column-chrome";

export type { KanbanColumnChrome };

export type JiraKanbanPriority = JiraIssuePriority;

export type JiraKanbanCardTag = JiraIssueTag;

const JIRA_KANBAN_CARD_MOVE: Transition = { duration: 0.6, ease: [0.4, 0, 0, 1] }; // duration-slowest + ease-in-out
const JIRA_KANBAN_CARD_DEPART: Transition = { duration: 0.4, ease: [0.6, 0, 0.8, 0.6] }; // duration-slower + ease-in

export interface JiraKanbanAssigneeData {
	id: string;
	name: string;
	avatarSrc: string;
}

export interface JiraKanbanCardData {
	/** Workflow status when a board column groups several statuses. */
	status?: string;
	title: string;
	code: string;
	tags: JiraKanbanCardTag[];
	priority: JiraKanbanPriority;
	avatarSrc?: string;
	avatarShape?: NonNullable<AvatarProps["shape"]>;
	avatarUnassignedKind?: AvatarUnassignedKind;
	avatarPulse?: boolean;
	assignee?: JiraKanbanAssigneeData;
	dueDate?: string;
	issueType?: "epic" | "task" | "story" | "subtask" | "bug";
	agentActivities?: readonly JiraIssueAgentActivity[];
	agentActivityMode?: JiraIssueAgentActivityMode;
	agentDoneRuns?: readonly JiraIssueCompletedAgentRun[];
	pullRequestNumber?: number;
	pullRequestPreview?: JiraIssuePullRequestPreview;
	pullRequestStatus?: JiraIssuePullRequestStatus;
}

export interface JiraKanbanColumnData {
	/** Workflow destinations grouped into this column. Defaults to its title. */
	statuses?: readonly string[];
	title: string;
	count: number;
	cards: JiraKanbanCardData[];
}

export interface JiraKanbanAgentData {
	id: string;
	name: string;
	byline: string;
	avatarSrc?: string;
	/** When set, renders the upstream `@atlassian/logo-third-party` mark (3P brands). */
	brandName?: ThirdPartyLogoName;
}

export interface JiraKanbanCardSelectModifiers {
	shiftKey: boolean;
	metaOrCtrlKey: boolean;
}

export interface JiraKanbanCardMoveAnimation {
	cardCode: string;
	phase: "departing" | "arriving";
}

function getJiraKanbanCardScale(
	phase: JiraKanbanCardMoveAnimation["phase"] | undefined,
): number {
	if (phase === "arriving") return 0.9;
	if (phase === "departing") return 0.96;
	return 1;
}

export interface JiraKanbanSelectionToolbarConfig {
	agents?: readonly JiraKanbanAgentData[];
	className?: string;
	defaultPinnedAgentIds?: readonly string[];
	defaultPinnedSkillIds?: readonly string[];
	onAgentAssignmentChange: (agentId: string, assigned: boolean) => void;
	onBrowseAgents?: () => void;
	onClearSelection: () => void;
	onCreateAgent?: () => void;
	onDelete?: () => void;
	onEditFields?: () => void;
	onMerge?: () => void;
	onStatusChange: (status: string) => void;
	onWatchOptions?: () => void;
	pinnedItemsLabel?: string;
	selectedAgentIds?: readonly string[];
	skills?: readonly SkillsDirectorySkill[];
}

export interface JiraKanbanProps {
	boardColumns: readonly JiraKanbanColumnData[];
	agents?: readonly JiraKanbanAgentData[];
	animateCardMoves?: boolean;
	assignedAgentIdsByColumn?: Readonly<Record<string, readonly string[]>>;
	ariaLabel?: string;
	cardMoveAnimation?: JiraKanbanCardMoveAnimation;
	/**
	 * Expanded column backdrop. `"default"` is the sunken well. `"simple"`
	 * is no well. Omit for `"default"`.
	 *
	 * Do not pass a Properties checkbox boolean. Parse at the host.
	 */
	columnChrome?: KanbanColumnChrome;
	columnHeaderPaddingBlock?: CSSProperties["paddingBlock"];
	draggedCardCode?: string | null;
	activeCardCode?: string;
	selectedCardCodes?: ReadonlySet<string>;
	onCardClick?: (title: string, code: string, card: JiraKanbanCardData, columnTitle: string) => void;
	onCardSelect?: (
		code: string,
		columnTitle: string,
		indexInColumn: number,
		modifiers: JiraKanbanCardSelectModifiers,
	) => void;
	onCardDragStart?: (card: JiraKanbanCardData, sourceColumnTitle: string) => void;
	onCardDrop?: (targetColumnTitle: string, target?: JiraKanbanCardDropTarget) => void;
	onCardDragEnd?: () => void;
	onCardGenerativeActionSubmit?: (
		request: JiraIssueGenerativeActionRequest,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void | Promise<void>;
	onCardAgentActivityOpenChange?: (
		open: boolean,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void;
	onCardAgentActivityViewChat?: (
		activity: JiraIssueAgentActivity,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void;
	onCardAgentDoneRunReview?: (
		run: JiraIssueCompletedAgentRun,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void;
	onCardAgentDoneRunView?: (
		run: JiraIssueCompletedAgentRun,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void;
	onCreateAgent?: (columnTitle: string) => void;
	onToggleColumnAgent?: (columnTitle: string, agentId: string) => void;
	paddingBottom?: CSSProperties["paddingBottom"];
	paddingTop?: CSSProperties["paddingTop"];
	selectionToolbar?: JiraKanbanSelectionToolbarConfig;
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

function AgentAvatar({ agent, className }: Readonly<{ agent: JiraKanbanAgentData; className?: string }>) {
	if (agent.brandName) {
		return (
			<Avatar className={className} label={agent.name} shape="hexagon" size="sm">
				<LogoThirdParty borderless label="" name={agent.brandName} size="xxsmall" />
			</Avatar>
		);
	}
	return (
		<Avatar className={className} label={agent.name} shape="hexagon" size="sm">
			<AvatarImage alt="" src={agent.avatarSrc} />
			<AvatarFallback>{getAgentInitials(agent.name)}</AvatarFallback>
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
											hasAssignedAgents ? "h-8 min-w-0 gap-1 px-1.5" : "size-8",
											(hasAssignedAgents || open) && "opacity-100",
										)}
										data-assigned={hasAssignedAgents || undefined}
										data-open={open || undefined}
										size={hasAssignedAgents ? "default" : "icon"}
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
					<AgentSelector
						agents={agents}
						selectedAgentIds={assignedAgentIds}
						onBrowseAgents={handleBrowseAgents}
						onCreateAgent={handleCreateAgent}
						onQueryChange={setQuery}
						onAgentToggle={onToggleAgent}
						query={query}
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
	headerPaddingBlock,
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
	headerPaddingBlock: CSSProperties["paddingBlock"];
	onCreateAgent?: (columnTitle: string) => void;
	onToggleAgent?: (agentId: string) => void;
	title: string;
}>) {
	const showAgentAssignment = Boolean(agents?.length && onCreateAgent && onToggleAgent);

	return (
		<div
			className={cn("group/board-column", chrome.columnClassName)}
			data-kanban-column-chrome={columnChrome}
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				borderRadius: token("radius.xlarge"),
				...chrome.dropContentPadding,
			}}
		>
			<div
				style={{ ...chrome.header, paddingBottom: headerPaddingBlock }}
			>
				<div className={cn("flex min-w-0 items-center gap-2", showAgentAssignment && "justify-between")}>
					<div className="flex min-w-0 items-center gap-2">
						<span
							className="truncate"
							style={{
								font: token("font.body.small"),
								fontWeight: token("font.weight.medium"),
								color: token("color.text.subtle"),
							}}
						>
							{title.toUpperCase()}
						</span>
						<Badge>{count}</Badge>
					</div>
					{showAgentAssignment && agents && onCreateAgent && onToggleAgent ? (
						<ColumnAgentAssignment
							agents={agents}
							assignedAgentIds={assignedAgentIds}
							columnTitle={title}
							onCreateAgent={onCreateAgent}
							onToggleAgent={onToggleAgent}
						/>
					) : null}
				</div>
			</div>

			<div
				style={{
					flexGrow: 1,
					overflowY: "auto",
					display: "flex",
					flexDirection: "column",
					gap: token("space.050"),
					...chrome.cardList,
				}}
			>
				{children}
			</div>

			<div className="w-full" style={{ paddingBlock: token("space.050"), ...chrome.footer }}>
				<Button className="w-full justify-start gap-2 rounded-lg" size="default" variant="ghost">
					<Icon render={<AddIcon label="" size="small" />} />
					Create
				</Button>
			</div>
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

export function JiraKanban({
	activeCardCode,
	agents,
	animateCardMoves = false,
	ariaLabel = "Jira kanban columns. Scroll horizontally to review all statuses.",
	assignedAgentIdsByColumn = {},
	boardColumns,
	cardMoveAnimation,
	columnChrome = DEFAULT_KANBAN_COLUMN_CHROME,
	columnHeaderPaddingBlock = token("space.100"),
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
	onToggleColumnAgent,
	paddingBottom = token("space.150"),
	paddingTop = token("space.150"),
	selectionToolbar,
}: Readonly<JiraKanbanProps>) {
	const chrome = resolveKanbanColumnChrome(columnChrome);
	const scrollportPaddingTop = withKanbanDropRingClipGutter(paddingTop, chrome).paddingTop;
	const cardLayoutGroupId = useId();
	const shouldReduceMotion = useReducedMotion();
	const shouldAnimateCardMoves = animateCardMoves && !shouldReduceMotion;
	const dragImageRef = useRef<HTMLDivElement | null>(null);
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

	return (
		<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
			<section
				tabIndex={0}
				aria-label={ariaLabel}
				className="flex min-h-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
				style={{
					flex: 1,
					paddingTop: scrollportPaddingTop,
					paddingBottom,
					paddingInline: token("space.200"),
					overflowX: "auto",
					overflowY: "hidden",
					minHeight: 0,
				}}
			>
				<LayoutGroup id={cardLayoutGroupId}>
					<div className="flex min-h-full items-stretch gap-2" style={{ minWidth: "100%" }}>
						{boardColumns.map((column) => (
						<div
							data-jira-kanban-column={column.title}
							key={column.title}
							className={chrome.dropShellClassName}
							onDragOver={handleColumnDragOver}
							onDragLeave={handleColumnDragLeave}
							onDrop={(event) => handleColumnDrop(event, column.title)}
							style={{ flex: "1 1 0", minWidth: "280px", borderRadius: token("radius.xlarge") }}
						>
							<BoardColumn
								agents={agents}
								assignedAgentIds={assignedAgentIdsByColumn[column.title] ?? []}
								chrome={chrome}
								columnChrome={columnChrome}
								count={column.cards.length}
								headerPaddingBlock={columnHeaderPaddingBlock}
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
											className="w-full"
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
												assigneeAvatarShape={card.avatarShape}
												assigneeUnassignedKind={card.avatarUnassignedKind}
												assigneePulse={card.avatarPulse}
												agentActivities={card.agentActivities}
												agentActivityMode={card.agentActivityMode}
												agentDoneRuns={card.agentDoneRuns}
												generativeAction={
													onCardGenerativeActionSubmit
														? {
															agents: generativeActionAgents,
															onSubmit: (request) =>
																onCardGenerativeActionSubmit(request, card, column.title),
															skills: generativeActionSkills,
														}
														: undefined
												}
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
						</div>
						))}
					</div>
				</LayoutGroup>
				</section>
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
