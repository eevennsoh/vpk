import {
	useState,
	type ComponentProps,
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddIcon from "@atlaskit/icon/core/add";
import DragHandleVerticalIcon from "@atlaskit/icon/core/drag-handle-vertical";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
	getRowAnchorName,
	isInsertionTarget,
	type JiraListInsertionTarget,
	type JiraListRowTarget,
} from "@/components/blocks/jira-list/jira-list-dnd";
import type {
	JiraListInsertion,
	JiraListInsertionPosition,
	JiraListRowData,
} from "@/components/blocks/jira-list/jira-list-types";

export function RowBoundaryCreateControls({
	activeTarget,
	hoveredTarget,
	instanceId,
	onCreate,
	onFocusedTargetChange,
	onHoveredTargetChange,
	overlayRef,
	rows,
}: Readonly<{
	activeTarget: JiraListInsertionTarget | null;
	hoveredTarget: JiraListRowTarget | null;
	instanceId: string;
	onCreate?: (insertion: JiraListInsertion) => void;
	onFocusedTargetChange: (target: JiraListInsertionTarget | null) => void;
	onHoveredTargetChange: (target: JiraListInsertionTarget | null) => void;
	overlayRef: (element: HTMLDivElement | null) => void;
	rows: readonly JiraListRowData[];
}>) {
	const renderControl = (
		row: JiraListRowData,
		rowIndex: number,
		position: JiraListInsertionPosition,
	) => {
		const isActive = isInsertionTarget(activeTarget, row.issueKey, position);
		const isVisible = (
			hoveredTarget?.issueKey === row.issueKey && hoveredTarget.zone === position
		) || isActive;
		const insertAtIndex = position === "before" ? rowIndex : rowIndex + 1;
		const target = { issueKey: row.issueKey, position };

		return (
			<Tooltip key={`${row.issueKey}-${position}`}>
				<TooltipTrigger
					render={
						<Button
							aria-label={`Create work item ${position} ${row.issueKey}`}
							className={cn(
								"fixed z-30 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-surface-overlay! text-icon-subtle opacity-0 transition-none hover:bg-surface-overlay-hovered! active:bg-surface-overlay-pressed! focus-visible:pointer-events-auto focus-visible:bg-surface-overlay! focus-visible:opacity-100",
								isVisible && "pointer-events-auto opacity-100",
							)}
							data-insertion-position={position}
							onBlur={() => onFocusedTargetChange(null)}
							onClick={() => onCreate?.({
								insertAtIndex,
								position,
								relativeToIssueKey: row.issueKey,
							})}
							onFocus={() => onFocusedTargetChange(target)}
							onPointerEnter={() => onHoveredTargetChange(target)}
							onPointerLeave={() => onHoveredTargetChange(null)}
							onPointerMove={(event) => event.stopPropagation()}
							size="icon"
							style={{
								left: "anchor(left)",
								positionAnchor: getRowAnchorName(instanceId, rowIndex),
								top: position === "before" ? "anchor(top)" : "anchor(bottom)",
							}}
							variant="outline"
						/>
					}
				>
					<Icon render={<AddIcon label="" size="small" />} />
				</TooltipTrigger>
				<TooltipContent side="right">Create</TooltipContent>
			</Tooltip>
		);
	};

	return (
		<div
			className="pointer-events-none contents"
			data-testid="jira-list-row-boundary-overlay"
			ref={overlayRef}
		>
			{onCreate
				? rows.flatMap((row, rowIndex) => [
						renderControl(row, rowIndex, "before"),
						renderControl(row, rowIndex, "after"),
					])
				: null}
		</div>
	);
}

export function JiraListSortableRow({
	children,
	handleOverlayElement,
	instanceId,
	isDropTarget,
	isHandleVisible,
	onMoveRow,
	row,
	rowIndex,
	rowCount,
	agentSessionDropEnabled,
	...rowProps
}: Readonly<{
	agentSessionDropEnabled?: boolean;
	children: ReactNode;
	handleOverlayElement: HTMLDivElement | null;
	instanceId: string;
	isDropTarget: boolean;
	isHandleVisible: boolean;
	onMoveRow?: (issueKey: string, targetIndex: number) => void;
	row: JiraListRowData;
	rowIndex: number;
	rowCount: number;
}> & Omit<ComponentProps<typeof TableRow>, "children">) {
	const [isHandleFocused, setIsHandleFocused] = useState(false);
	const [isHandleHovered, setIsHandleHovered] = useState(false);
	const {
		attributes,
		isDragging,
		listeners,
		setActivatorNodeRef,
		setNodeRef,
		transform,
		transition,
	} = useSortable({ disabled: !onMoveRow, id: row.issueKey });
	const showHandle = isHandleVisible || isHandleFocused || isHandleHovered || isDragging;

	const handleKeyboardMove = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		const direction = event.key === "ArrowUp" ? -1 : 1;
		const targetIndex = Math.min(Math.max(rowIndex + direction, 0), rowCount - 1);
		if (targetIndex !== rowIndex) {
			onMoveRow?.(row.issueKey, targetIndex);
		}
	};

	const dragHandle = (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						{...attributes}
						{...listeners}
						aria-label="Drag to reorder"
						className={cn(
							"fixed z-30 size-5 -translate-x-full -translate-y-1/2 cursor-grab touch-none bg-transparent! text-icon-subtle opacity-0 transition-opacity duration-fast after:absolute after:-inset-0.5 hover:bg-transparent! active:cursor-grabbing active:bg-transparent! focus-visible:bg-transparent! focus-visible:opacity-100",
							showHandle && "pointer-events-auto opacity-100",
						)}
						data-testid={`jira-list-drag-handle-${row.issueKey}`}
						onBlur={() => setIsHandleFocused(false)}
						onFocus={() => setIsHandleFocused(true)}
						onKeyDownCapture={handleKeyboardMove}
						onPointerEnter={() => setIsHandleHovered(true)}
						onPointerLeave={() => setIsHandleHovered(false)}
						ref={setActivatorNodeRef}
						size="icon"
						style={{
							left: "anchor(left)",
							positionAnchor: getRowAnchorName(instanceId, rowIndex),
							top: "anchor(center)",
						}}
						variant="ghost"
					/>
				}
			>
				<Icon render={<DragHandleVerticalIcon label="" size="small" />} />
			</TooltipTrigger>
			<TooltipContent side="right">Drag to reorder</TooltipContent>
		</Tooltip>
	);

	return (
		<>
			<TableRow
				{...rowProps}
				className={cn(
					rowProps.className,
					isDragging && "z-30 opacity-80 shadow-lg [&>td]:bg-bg-selected",
				)}
				data-board-agent-session-drop-zone={agentSessionDropEnabled ? "list-row" : undefined}
				data-issue-key={agentSessionDropEnabled ? row.issueKey : undefined}
				data-list-row-index={agentSessionDropEnabled ? rowIndex : undefined}
				data-dragging={isDragging || undefined}
				data-drop-target={isDropTarget || undefined}
				ref={setNodeRef}
				style={{
					...rowProps.style,
					transform: CSS.Transform.toString(transform),
					transition,
				}}
			>
				{children}
			</TableRow>
			{handleOverlayElement && onMoveRow ? createPortal(dragHandle, handleOverlayElement) : null}
		</>
	);
}
