"use client";

import type { CSSProperties, ReactNode } from "react";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { JiraDropzoneCopyReveal } from "@/components/blocks/jira-dropzone/jira-dropzone-copy-reveal";
import type { JiraKanbanAgentData } from "../../index";
import type { KanbanColumnChrome, KanbanColumnChromeStyles } from "../../column-chrome";
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
import type { JiraKanbanCardDropTarget } from "../../card-drop";
import type { AgentSessionWorkItemDraft } from "@/components/blocks/agent-session";

type BoardIssueDropState = ReturnType<typeof useBoardIssueDrop>;

function BoardColumnHeader({
	headerAccessory,
	agents,
	assignedAgentIds,
	count,
	headerStyle,
	issueDrop,
	onCollapse,
	onCreateAgent,
	onToggleAgent,
	title,
}: Readonly<{
	headerAccessory?: ReactNode;
	agents?: readonly JiraKanbanAgentData[];
	assignedAgentIds: readonly string[];
	count: number;
	headerStyle?: CSSProperties;
	issueDrop: BoardIssueDropState;
	onCollapse: () => void;
	onCreateAgent?: (columnTitle: string) => void;
	onToggleAgent?: (agentId: string) => void;
	title: string;
}>) {
	const isTransitioning = Boolean(issueDrop.active);
	const transitionPrefix = issueDrop.active && issueDrop.active.columnTitle !== title ? `${issueDrop.active.status} →` : null;
	const destination = transitionPrefix ? issueDrop.header.slice(transitionPrefix.length).trimStart() : "";
	const showAgentAssignment = Boolean(agents?.length && onCreateAgent && onToggleAgent);
	return (
		<div
			data-slot="board-column-header"
			data-transitioning={isTransitioning || undefined}
			className={cn(
				"flex min-w-0 items-center gap-2",
				"justify-between",
			)}
			style={{ paddingBottom: token("space.100"), ...headerStyle }}
		>
			{/* Match the compact controls' row height when pickup replaces them with transition copy. */}
			<div className="flex min-h-6 min-w-0 flex-1 items-center text-xs font-medium leading-4 text-text-subtle">
				<JiraDropzoneCopyReveal
					contentKey={transitionPrefix ?? issueDrop.header}
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
						<span data-board-column-transition-prefix="" className="shrink-0 whitespace-pre">{transitionPrefix}{" "}</span>
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
				) : issueDrop.header}</JiraDropzoneCopyReveal>
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
	statuses?: readonly string[];
	onIssueDrop?: (title: string, target?: JiraKanbanCardDropTarget) => void;
}>) {
	const issueDrop = useBoardIssueDrop({ source: issueDragSource, title, statuses, onDrop: onIssueDrop });
	const insertionArmed = cardInsertion?.columnTitle === title;
	const isEmptyColumn = count === 0;
	// The moved source can unmount before dragend; settled columns must clear their drag paint.
	useBoardColumnDropRing(issueDrop.rootRef, chrome, !issueDrop.active ? false : issueDrop.offeringChoices && issueDrop.current?.entered ? isEmptyColumn : undefined);
	const { minimumHeight: choiceHeight } = useCreateDropzoneHeight(issueDrop.choosing && columnSizing === "content", "bottom", columnSizing, issueDrop.rootRef);
	const createAction = <BoardColumnCreateAction
		columnSizing={columnSizing}
		dropZoneLabel={createWorkItemDropZoneLabel}
		onCreateWorkItem={onCreateWorkItem ? (draft) => onCreateWorkItem(title, draft) : undefined}
		placement="bottom"
		sessionDragTransaction={sessionDragTransaction}
		title={title}
	/>;
	return (
		<div
			className={cn("min-h-0 min-w-0 overflow-visible", chrome.columnClassName, columnSizing === "content" ? "bg-transparent" : null)}
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
					headerStyle={chrome.header}
					issueDrop={issueDrop}
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
				style={{ height: issueDrop.choosing && columnSizing === "content" ? `calc(${choiceHeight}px + ${token("space.100")} - ${token("border.width")})` : undefined }}
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
				<BoardIssueTransitionOverlay issueDrop={issueDrop} title={title} />
			</div>
			{columnSizing === "content" && issueDrop.offeringChoices && issueDrop.current?.entered ? (
				<div aria-hidden data-issue-drop-hit-area="" className="absolute inset-0 z-20" {...issueDrop.handlers} />
			) : null}
			{issueDrop.current?.entered ? <span className="sr-only" role="status">{`${issueDrop.header}. Choose a position, then release to move. Escape cancels.`}</span> : null}
		</div>
	);
}
