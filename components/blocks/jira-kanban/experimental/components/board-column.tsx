"use client";

import type { CSSProperties, ReactNode } from "react";
import ArrowRightIcon from "@atlaskit/icon/core/arrow-right";
import { Icon } from "@/components/ui/icon";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { JiraDropzoneCopyReveal } from "@/components/blocks/jira-dropzone/jira-dropzone-copy-reveal";
import type { JiraKanbanAgentData } from "@/components/blocks/jira-kanban/index";
import type { KanbanColumnChrome, KanbanColumnChromeStyles } from "@/components/blocks/jira-kanban/column-chrome";
import type { BoardAgentSessionDrag } from "../use-board-agent-session-drag";
import type { JiraKanbanCreatedCardArrival } from "../hooks/use-created-card-arrival";
import { BOARD_COLUMN_WIDTH_PX } from "../lib/board-column-collapse";
import { BOARD_COLUMN_ACTION_REVEAL } from "../lib/board-column-action-reveal";
import { BoardColumnAgentAssignment } from "./board-column-agent-assignment";
import { BoardColumnResizeButton } from "./collapsed-board-column";
import { BoardColumnCreateAction } from "./create-work-item-drop-zone";
import { BoardColumnCardList } from "./board-column-card-list";
import { BoardIssueTransitionOverlay } from "./board-issue-transition-overlay";
import { useBoardIssueDrop, type BoardIssueDragSource } from "../hooks/use-board-issue-drop";
import { useBoardColumnDropRing, useCreateDropzoneHeight } from "../hooks/use-create-dropzone-height";
import type { JiraKanbanCardDropTarget } from "@/components/blocks/jira-kanban/card-drop";
import type { AgentSessionWorkItemDraft } from "@/components/blocks/agent-session";

type BoardIssueDropState = ReturnType<typeof useBoardIssueDrop>;

function BoardColumnHeader({
	headerAccessory,
	agents,
	assignedAgentIds,
	count,
	dropFeedbackInset,
	headerStyle,
	issueDrop,
	issueMoveVisual,
	onCollapse,
	onCreateAgent,
	onToggleAgent,
	title,
}: Readonly<{
	headerAccessory?: ReactNode;
	agents?: readonly JiraKanbanAgentData[];
	assignedAgentIds: readonly string[];
	count: number;
	dropFeedbackInset?: CSSProperties["paddingInline"];
	headerStyle?: CSSProperties;
	issueDrop: BoardIssueDropState;
	issueMoveVisual: boolean;
	onCollapse: () => void;
	onCreateAgent?: (columnTitle: string) => void;
	onToggleAgent?: (agentId: string) => void;
	title: string;
}>) {
	const isTransitioning = Boolean(issueDrop.active && (issueMoveVisual || issueDrop.active.columnTitle === title));
	const transition = typeof issueDrop.header === "string" ? null : issueDrop.header;
	const headerLabel = typeof issueDrop.header === "string" ? issueDrop.header : "";
	const transitionPrefix = transition?.source;
	const destination = transition?.destination ?? "";
	const transitionSource = transition ? <>
		<span data-board-column-transition-prefix="" className="shrink-0 whitespace-pre">{transition.source}</span>
		<Icon aria-hidden className="mx-1 shrink-0 text-icon-subtle" data-board-column-transition-arrow="" render={<ArrowRightIcon color="currentColor" label="" size="small" />} />
	</> : null;
	const showAgentAssignment = Boolean(agents?.length && onCreateAgent && onToggleAgent);
	const dropHovered = issueDrop.current?.entered && issueDrop.current.surface === "header";
	return (
		<div
			data-slot="board-column-header"
			data-transitioning={isTransitioning || undefined}
			data-issue-drop-hovered={dropHovered || undefined}
			{...issueDrop.handlers}
			className={cn(
				"relative isolate flex min-w-0 items-center gap-2",
				!issueMoveVisual && isTransitioning ? "justify-center" : "justify-between",
			)}
			style={{ ...headerStyle, paddingBottom: headerStyle?.paddingBottom ?? token("space.100") }}
		>
			{dropHovered ? <div
				aria-hidden
				data-board-column-title-drop-feedback=""
				className={cn(buttonVariants({ variant: "ghost" }), "pointer-events-none absolute -z-10 bg-bg-neutral-subtle-hovered")}
				style={{ inset: dropFeedbackInset ?? 0, height: "auto" }}
			/> : null}
			{/* Match the compact controls' row height when pickup replaces them with transition copy. */}
			<div className={cn("flex min-h-6 min-w-0 flex-1 items-center text-xs font-medium leading-4 text-text-subtle", !issueMoveVisual && isTransitioning ? "justify-center" : null)}>
				{issueMoveVisual ? <JiraDropzoneCopyReveal
					contentKey={transitionPrefix ?? headerLabel}
					dataPrefix="board-column-header"
					mode="cycle"
					revealed={isTransitioning}
					alignment="start"
					resting={<span className="inline-flex min-w-0 items-center gap-1.5">
						<span className="truncate">{title}</span>
						{isTransitioning ? null : <span data-board-column-count="" className="shrink-0 font-normal text-text-subtlest">{count}</span>}
					</span>}
				>{transitionPrefix ? (
					<span className="inline-flex w-full min-w-0 items-center">
						{transitionSource}
						<span className="min-w-0 flex-1">
							<JiraDropzoneCopyReveal
								contentKey={destination}
								dataPrefix="board-column-destination"
								mode="cycle"
								revealed={Boolean(destination)}
								resting={null}
								alignment="start"
							>{destination}</JiraDropzoneCopyReveal>
						</span>
					</span>
				) : headerLabel}</JiraDropzoneCopyReveal> : (
					<span className="inline-flex min-w-0 items-center gap-1.5">
						{transition ? <span className="inline-flex min-w-0 items-center">{transitionSource}<span className="truncate">{destination}</span></span> : <span className="truncate">{headerLabel}</span>}
						{isTransitioning ? null : <span data-board-column-count="" className="shrink-0 font-normal text-text-subtlest">{count}</span>}
					</span>
				)}
			</div>
			{isTransitioning ? null : (
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
			)}
			{headerAccessory}
		</div>
	);
}

export function BoardColumn({
	headerAccessory,
	agents,
	assignedAgentIds,
	cardInsertion,
	children,
	chrome,
	columnChrome,
	columnSizing = "fill",
	count,
	createdCardArrival,
	createWorkItemDropZoneLabel,
	onCollapse,
	onCreateAgent,
	onCreateWorkItem,
	onToggleAgent,
	sessionDragTransaction,
	title,
	issueDragSource,
	issueMoveVisual = true,
	statuses,
	onIssueDrop,
}: Readonly<{
	headerAccessory?: ReactNode;
	agents?: readonly JiraKanbanAgentData[];
	assignedAgentIds: readonly string[];
	cardInsertion: BoardAgentSessionDrag["cardInsertion"];
	children: ReactNode;
	chrome: KanbanColumnChromeStyles;
	columnChrome: KanbanColumnChrome;
	columnSizing?: "fill" | "content";
	count: number;
	createdCardArrival?: JiraKanbanCreatedCardArrival;
	createWorkItemDropZoneLabel?: string;
	onCollapse: () => void;
	onCreateAgent?: (columnTitle: string) => void;
	onCreateWorkItem?: (columnTitle: string, draft: AgentSessionWorkItemDraft) => void;
	onToggleAgent?: (agentId: string) => void;
	sessionDragTransaction: BoardAgentSessionDrag["transaction"];
	title: string;
	issueDragSource?: BoardIssueDragSource;
	issueMoveVisual?: boolean;
	statuses?: readonly string[];
	onIssueDrop?: (title: string, target?: JiraKanbanCardDropTarget) => void;
}>) {
	const issueDrop = useBoardIssueDrop({ source: issueDragSource, title, statuses, onDrop: onIssueDrop, moveVisual: issueMoveVisual });
	const insertionArmed = cardInsertion?.columnTitle === title;
	const isEmptyColumn = count === 0;
	// The moved source can unmount before dragend; settled columns must clear their drag paint.
	useBoardColumnDropRing(issueDrop.rootRef, chrome, Boolean(issueDrop.current?.entered && issueDrop.current.surface !== "position"));
	const { minimumHeight: choiceHeight } = useCreateDropzoneHeight(issueMoveVisual && issueDrop.choosing && columnSizing === "content", "bottom", columnSizing, issueDrop.rootRef);
	const createAction = <BoardColumnCreateAction
		columnSizing={columnSizing}
		dropZoneLabel={createWorkItemDropZoneLabel}
		onCreateWorkItem={onCreateWorkItem ? (draft) => onCreateWorkItem(title, draft) : undefined}
		placement="bottom"
		sessionDragTransaction={sessionDragTransaction}
		title={title}
	/>;
	return (
		<>
		<div
			className={cn("relative z-10 min-h-0 min-w-0 overflow-visible", chrome.columnClassName, columnSizing === "content" ? "bg-transparent" : null)}
			data-jira-kanban-column-content=""
			data-kanban-column-chrome={columnChrome}
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				// Pin the layout width so the column never reflows while the shell
				// animates back open from the collapsed pill.
				minWidth: `${BOARD_COLUMN_WIDTH_PX}px`,
				height: columnSizing === "fill" ? "100%" : undefined,
				borderRadius: token("radius.xlarge"),
				...chrome.dropContentPadding,
			}}
		>
			<BoardColumnHeader
					headerAccessory={headerAccessory}
					agents={agents}
					assignedAgentIds={assignedAgentIds}
					count={count}
					dropFeedbackInset={chrome.footer.paddingInline}
					headerStyle={chrome.header}
					issueDrop={issueDrop}
					issueMoveVisual={issueMoveVisual}
					onCollapse={onCollapse}
					onCreateAgent={onCreateAgent}
					onToggleAgent={onToggleAgent}
					title={title}
				/>
			<div
				ref={issueDrop.rootRef}
				{...issueDrop.handlers}
				className={cn("relative flex min-h-0 flex-col", columnSizing === "fill" ? "flex-1" : null)}
				// Fixed status targets reuse the create well's reserved magnetic clearance.
				style={{
					height: issueMoveVisual && issueDrop.choosing && columnSizing === "content" ? `calc(${choiceHeight}px + ${token("space.100")} - ${token("border.width")})` : undefined,
					minHeight: !issueMoveVisual && issueDrop.offeringChoices ? `${issueDrop.choices.length * 8}rem` : undefined,
				}}
				data-issue-status-choices={issueDrop.choosing || undefined}
				data-issue-drop-entered={issueDrop.current?.entered ? issueDrop.current.status : undefined}
			>
				<div
					aria-hidden={issueDrop.choosing || undefined}
					inert={issueDrop.choosing || undefined}
					className={cn("flex min-h-0 flex-col", columnSizing === "fill" ? "flex-1" : null, issueDrop.choosing ? "pointer-events-none opacity-0" : null)}
				>
					<BoardColumnCardList
						chrome={chrome}
						columnTitle={title}
						columnSizing={columnSizing}
						count={count}
						createdCardArrival={createdCardArrival}
						insertionArmed={insertionArmed}
						isEmpty={isEmptyColumn}
						isSessionDragging={sessionDragTransaction !== null}
						onCreateWorkItem={onCreateWorkItem ? (draft) => onCreateWorkItem(title, draft) : undefined}
					>
						{children}
					</BoardColumnCardList>

					<div style={chrome.footer}>{createAction}</div>
				</div>
				<BoardIssueTransitionOverlay issueDrop={issueDrop} title={title} moveVisual={issueMoveVisual} />
			</div>
			{issueDrop.current?.entered ? <span className="sr-only" role="status">{`${issueDrop.header}. ${issueDrop.current.surface === "position" ? "Release to move to this position." : "Release to move to the top of this column."} Escape cancels.`}</span> : null}
		</div>
		{columnSizing === "content" && issueDrop.active && !issueDrop.choosing ? (
			// Ordinary columns keep this target behind their header and card stack.
			// A latched status choice retains its stable overlay while the body returns.
			<div aria-hidden data-issue-drop-hit-area="" className={cn("absolute inset-0", issueDrop.offeringChoices ? "z-20" : "z-0")} {...issueDrop.handlers} />
		) : null}
		</>
	);
}
