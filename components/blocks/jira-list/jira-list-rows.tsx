import {
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
	type ComponentProps,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { DragOverlay, useDndMonitor } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "motion/react";
import AddIcon from "@atlaskit/icon/core/add";
import DragHandleVerticalIcon from "@atlaskit/icon/core/drag-handle-vertical";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motionDuration, motionEase } from "@/lib/motion";
import { createJiraLinkingCardGlow } from "@/components/blocks/jira-linking/card-glow";
import type { JiraListGripHover } from "@/components/blocks/jira-list/use-jira-list-row-hover";

import {
	getRowAnchorName,
	isInsertionTarget,
	type JiraListInsertionTarget,
} from "@/components/blocks/jira-list/jira-list-dnd";
import type {
	JiraListInsertion,
	JiraListInsertionPosition,
	JiraListRowData,
	JiraListRowFlash,
} from "@/components/blocks/jira-list/jira-list-types";

function rowWidthAnchor(instanceId: string, rowIndex: number) {
	return `${getRowAnchorName(instanceId, rowIndex)}-width`;
}

export function JiraListDragOverlay() {
	const [preview, setPreview] = useState<{ row: HTMLTableRowElement; widths: number[]; width: number } | null>(null);
	useDndMonitor({
		onDragStart: ({ active }) => {
			const source = active.data.current?.rowRef?.current as HTMLTableRowElement | null | undefined;
			if (!source) return;
			const row = source.cloneNode(true) as HTMLTableRowElement;
			row.removeAttribute("style");
			row.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
			for (const cell of row.cells) {
				cell.className = cell.className.split(" ").filter((name) => !name.startsWith("after:")).join(" ");
				cell.classList.add("before:bg-transparent!");
				cell.style.setProperty("position", "static", "important");
				cell.style.setProperty("background", "var(--ds-background-selected)", "important");
			}
			setPreview({ row, widths: Array.from(source.cells, (cell) => cell.getBoundingClientRect().width), width: source.getBoundingClientRect().width });
		},
		onDragCancel: () => setPreview(null),
		onDragEnd: () => setPreview(null),
	});
	if (typeof document === "undefined") return null;
	return createPortal(
		<DragOverlay dropAnimation={null} zIndex={100}>
			{preview ? <table aria-hidden inert className="pointer-events-none table-fixed border-separate border-spacing-0" data-testid="jira-list-drag-preview" style={{ width: preview.width }}>
				<colgroup>{preview.widths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
				<tbody ref={(body) => { if (body && body.firstChild !== preview.row) body.replaceChildren(preview.row); }} />
			</table> : null}
		</DragOverlay>, document.body,
	);
}

function RowHoverGrip({ gripHover, instanceId, rows }: Readonly<{
	gripHover: JiraListGripHover;
	instanceId: string;
	rows: readonly Pick<JiraListRowData, "issueKey">[];
}>) {
	const issueKey = useSyncExternalStore(gripHover.subscribe, gripHover.getSnapshot, () => null);
	const rowIndex = rows.findIndex((row) => row.issueKey === issueKey);
	const reduceMotion = useReducedMotion();
	if (rowIndex < 0) return null;
	return (
		<motion.span
			aria-hidden
			className="pointer-events-none fixed z-30 grid size-5 -translate-x-full -translate-y-1/2 place-items-center text-icon-subtle"
			data-testid="jira-list-hover-grip"
			data-grip-issue-key={issueKey}
			layout={reduceMotion ? false : "position"}
			layoutDependency={rowIndex}
			style={{ left: "anchor(left)", positionAnchor: getRowAnchorName(instanceId, rowIndex), top: "anchor(center)" }}
			transition={{ duration: motionDuration.normal, ease: motionEase.outPractical }}
		>
			<Icon render={<DragHandleVerticalIcon label="" size="small" />} />
		</motion.span>
	);
}

export function RowBoundaryCreateControls({
	activeTarget,
	gripHover,
	instanceId,
	onCreate,
	onFocusedTargetChange,
	onHoveredTargetChange,
	overlayRef,
	rows,
	showHoverGrip = false,
	onPointerLeave,
}: Readonly<{
	activeTarget: JiraListInsertionTarget | null;
	gripHover: JiraListGripHover;
	instanceId: string;
	onCreate?: (insertion: JiraListInsertion) => void;
	onFocusedTargetChange: (target: JiraListInsertionTarget | null) => void;
	onHoveredTargetChange: (target: JiraListInsertionTarget | null) => void;
	overlayRef: (element: HTMLDivElement | null) => void;
	rows: readonly Pick<JiraListRowData, "issueKey">[];
	showHoverGrip?: boolean;
	onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
}>) {
	const renderControl = (
		row: Pick<JiraListRowData, "issueKey">,
		rowIndex: number,
		position: JiraListInsertionPosition,
	) => {
		const isActive = isInsertionTarget(activeTarget, row.issueKey, position);
		const insertAtIndex = position === "before" ? rowIndex : rowIndex + 1;
		const target = { issueKey: row.issueKey, position };

		return (
			<Tooltip key={`${row.issueKey}-${position}`}>
				<TooltipTrigger
					render={
						<Button
							aria-label={`Create work item ${position} ${row.issueKey}`}
							className={cn(
								"group/create-gap fixed z-30 h-3 -translate-y-1/2 rounded-none border-0 bg-transparent! p-0 text-icon-subtle opacity-0 transition-none data-[row-boundary-target]:pointer-events-auto focus-visible:pointer-events-auto focus-visible:opacity-100",
								isActive && "pointer-events-auto opacity-100",
							)}
							data-insertion-position={position}
							data-insertion-issue-key={row.issueKey}
							onBlur={() => onFocusedTargetChange(null)}
							onClick={() => {
								onFocusedTargetChange(null);
								onHoveredTargetChange(null);
								onCreate?.({ insertAtIndex, position, relativeToIssueKey: row.issueKey });
							}}
							onFocus={() => onFocusedTargetChange(target)}
							onPointerEnter={() => onHoveredTargetChange(target)}
							onPointerLeave={(event) => {
								if (event.relatedTarget instanceof Element && event.relatedTarget.closest("[data-jira-list-work-row]")) return;
								onHoveredTargetChange(null);
							}}
							onPointerMove={(event) => event.stopPropagation()}
							size="icon"
							style={{
								left: "anchor(left)",
								positionAnchor: getRowAnchorName(instanceId, rowIndex),
								top: position === "before" ? "anchor(top)" : "anchor(bottom)",
								width: `anchor-size(${rowWidthAnchor(instanceId, rowIndex)} width)`,
							}}
							variant="outline"
						/>
					}
				>
					<span className="absolute left-0 top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface-overlay group-hover/create-gap:bg-surface-overlay-hovered group-active/create-gap:bg-surface-overlay-pressed group-focus-visible/create-gap:border-ring">
						<Icon render={<AddIcon label="" size="small" />} />
					</span>
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
			onPointerLeave={onPointerLeave}
		>
			{showHoverGrip ? <RowHoverGrip gripHover={gripHover} instanceId={instanceId} rows={rows} /> : null}
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
	glow,
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
	glow?: JiraListRowFlash;
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
	const rowRef = useRef<HTMLTableRowElement | null>(null);
	const {
		attributes,
		isDragging,
		listeners,
		setActivatorNodeRef,
		setNodeRef,
		transform,
		transition,
	} = useSortable({ data: { rowRef }, disabled: !onMoveRow, id: row.issueKey });
	const setRowRef = useCallback((node: HTMLTableRowElement | null) => {
		rowRef.current = node;
		setNodeRef(node);
	}, [setNodeRef]);
	useLayoutEffect(() => {
		const tableRow = rowRef.current;
		const cell = tableRow?.cells.item(0);
		if (!glow || !tableRow || !cell || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const effects = createJiraLinkingCardGlow({ haloRoot: cell, backdropRoot: cell, color: glow.color ?? "var(--ds-border-focused)", contained: true, direction: "left-to-right" });
		const backdrop = cell.querySelector<HTMLElement>("[data-jira-linking-glow-backdrop]:last-child");
		if (backdrop) { backdrop.style.width = `${tableRow.getBoundingClientRect().width}px`; backdrop.style.zIndex = "20"; }
		for (const effect of effects) effect.animation.onfinish = effect.restore;
		return () => { for (const effect of effects) { effect.animation.cancel(); effect.restore(); } };
	}, [glow]);
	const showHandle = isHandleVisible || isHandleFocused || isHandleHovered || isDragging;
	const grip = <Icon render={<DragHandleVerticalIcon label="" size="small" />} />;

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
							"fixed z-30 size-5 -translate-x-full -translate-y-1/2 cursor-grab touch-none bg-transparent! text-icon-subtle opacity-0 after:absolute after:-inset-0.5 data-[row-drag-target]:pointer-events-auto hover:bg-transparent! active:cursor-grabbing active:bg-transparent! focus-visible:bg-transparent! focus-visible:opacity-100",
							showHandle && "pointer-events-auto opacity-100",
						)}
						data-testid={`jira-list-drag-handle-${row.issueKey}`}
						data-jira-list-drag-key={row.issueKey}
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
				{isHandleVisible && !isDragging ? <span className="inline-flex opacity-0 group-focus-visible/button:opacity-100">{grip}</span> : grip}
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
					isDragging && "opacity-0",
				)}
				data-board-agent-session-drop-zone={agentSessionDropEnabled ? "list-row" : undefined}
				data-issue-key={agentSessionDropEnabled ? row.issueKey : undefined}
				data-list-row-index={agentSessionDropEnabled ? rowIndex : undefined}
				data-dragging={isDragging || undefined}
				data-jira-list-work-row=""
				data-drop-target={isDropTarget || undefined}
				onPointerDown={(event) => {
					rowProps.onPointerDown?.(event);
					if (!event.defaultPrevented && !(event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']"))) {
						listeners?.onPointerDown?.(event);
					}
				}}
				ref={setRowRef}
				style={{
					...rowProps.style,
					anchorName: [rowProps.style?.anchorName, rowWidthAnchor(instanceId, rowIndex)].filter(Boolean).join(", "),
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
