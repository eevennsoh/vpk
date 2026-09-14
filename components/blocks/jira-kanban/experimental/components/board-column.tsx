"use client";

import type { ReactNode } from "react";
import ArrowDownIcon from "@atlaskit/icon/core/arrow-down";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
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
import { useBoardIssueDrop, type BoardIssueDragSource } from "../hooks/use-board-issue-drop";
import type { JiraKanbanCardDropTarget } from "../../card-drop";
import { BoardCardInsertionLine } from "./board-card-insertion-line";
import { Lozenge } from "@/components/ui/lozenge";

export function BoardColumn({
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
	issueDragSource,
	statuses,
	onIssueDrop,
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
	issueDragSource?: BoardIssueDragSource;
	statuses?: readonly string[];
	onIssueDrop?: (title: string, target?: JiraKanbanCardDropTarget) => void;
}>) {
	const issueDrop = useBoardIssueDrop({ source: issueDragSource, title, statuses, onDrop: onIssueDrop });
	const isTransitionSource = issueDrop.active?.columnTitle === title;
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
				data-transitioning={isTransitionSource || undefined}
				className={cn(
					"flex min-w-0 items-center gap-2",
					isTransitionSource ? "justify-center text-center" : "justify-between",
				)}
				style={{ paddingBottom: token("space.100"), ...chrome.header }}
			>
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="truncate text-xs font-medium leading-4 text-text-subtle">
						{issueDrop.header}
					</span>
					{isTransitionSource ? null : (
						<span className="shrink-0 text-xs font-normal text-text-subtlest">
							{count}
						</span>
					)}
				</div>
				{isTransitionSource ? null : (
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
			</div>
			<div ref={issueDrop.rootRef} {...issueDrop.handlers} className="relative flex min-h-0 flex-1 flex-col" data-issue-drop-entered={issueDrop.current?.entered ? issueDrop.current.status : undefined}>
				<div
					aria-hidden={issueDrop.choosing || undefined}
					inert={issueDrop.choosing || undefined}
					className={cn("flex min-h-0 flex-1 flex-col", issueDrop.choosing ? "pointer-events-none opacity-0" : null)}
				>
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
				{issueDrop.offeringChoices || issueDrop.current?.entered ? (
					<div className={cn("absolute inset-0 z-20 flex flex-col overflow-hidden rounded-lg border-2 border-border-selected bg-bg-selected", !issueDrop.choosing ? "opacity-0" : null)} aria-hidden={!issueDrop.choosing || undefined} role="group" aria-label={`Choose a status in ${title}`}>
						{issueDrop.choices.map((status) => (
							<div
								key={status}
								data-issue-status-zone={status}
								className={cn("flex min-h-0 flex-1 flex-col items-center justify-center gap-2 border-border-selected text-sm text-text last:border-t-2", issueDrop.current?.status === status ? "bg-bg-selected-hovered" : null)}
							>
								<span>Transition to</span>
								<Icon
									aria-hidden
									className="text-icon-subtle"
									data-issue-transition-arrow=""
									render={<ArrowDownIcon color="currentColor" label="" size="small" />}
								/>
								<Lozenge variant="information">{status}</Lozenge>
							</div>
						))}
					</div>
				) : null}
				{!issueDrop.choosing && issueDrop.current?.lineTop !== undefined ? (
					<div className="pointer-events-none absolute inset-x-1 z-30" style={{ top: issueDrop.current.lineTop }} data-issue-drop-before={issueDrop.current.beforeCardCode ?? "end"}>
						<BoardCardInsertionLine position="before" seam="edge" marker="circle" />
					</div>
				) : null}
			</div>
			{issueDrop.current?.entered ? <span className="sr-only" role="status">{`${issueDrop.header}. Choose a position, then release to move. Escape cancels.`}</span> : null}
		</div>
	);
}
