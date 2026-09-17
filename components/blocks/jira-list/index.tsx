"use client";

import {
	Fragment,
	useCallback,
	useId,
	useMemo,
	useState,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	type RefCallback,
} from "react";
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import AddIcon from "@atlaskit/icon/core/add";
import AppSwitcherIcon from "@atlaskit/icon/core/app-switcher";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import { EditorPaletteAssigneePicker } from "@/components/blocks/editor-palette/page";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { ScrollMaskEdgeOverlay } from "@/components/visual/scroll-mask";
import {
	JiraListColumnActions,
	JiraListColumnBoundary,
} from "@/components/blocks/jira-list/jira-list-column-controls";
import { AvatarUnassigned } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type {
	JiraListIssueType,
	JiraListProps,
	JiraListRowData,
} from "@/components/blocks/jira-list/jira-list-types";

export type {
	JiraListAgentSessionDropIntent,
	JiraListAssignedAgent,
	JiraListBaseColumnId,
	JiraListColumnAnchorId,
	JiraListDraftWorkItem,
	JiraListExtraColumn,
	JiraListGoal,
	JiraListInsertion,
	JiraListInsertionPosition,
	JiraListIssueType,
	JiraListPerson,
	JiraListPriority,
	JiraListProps,
	JiraListRowData,
	JiraListRowFlash,
	JiraListStatusOption,
	JiraListTag,
} from "@/components/blocks/jira-list/jira-list-types";

export {
	NO_JIRA_LIST_ROW_FLASH,
	useJiraListRowFlashSource,
} from "@/components/blocks/jira-list/jira-list-row-flash";

import {
	getAgentSessionAttachCellClassName,
	getAgentSessionInsertionTarget,
	getBodyCellClassName,
	getColumnAnchorName,
	getColumnBoundaryIndex,
	getDragInsertionPosition,
	getInsertionLineClassName,
	getRowAnchorName,
	getRowFlashCellClassName,
	getRowZone,
	isAgentSessionAttachTarget,
	type JiraListColumnBoundaryIndex,
	type JiraListInsertionTarget,
	type JiraListRowTarget,
} from "@/components/blocks/jira-list/jira-list-dnd";
import { useJiraListRowFlashKeys } from "@/components/blocks/jira-list/jira-list-row-flash";
import { createJiraListBaseColumns } from "@/components/blocks/jira-list/jira-list-base-columns";
import {
	IssueTypeGlyph,
	JiraListAvatar,
	JiraListCellContent,
} from "@/components/blocks/jira-list/jira-list-cells";
import {
	getOrderedColumns,
	type JiraListColumnDefinition,
} from "@/components/blocks/jira-list/jira-list-column-model";
import {
	JiraListSortableRow,
	RowBoundaryCreateControls,
} from "@/components/blocks/jira-list/jira-list-rows";
import { useJiraListHorizontalUnderlap } from "@/components/blocks/jira-list/use-jira-list-horizontal-underlap";

const EMPTY_EXTRA_COLUMNS: NonNullable<JiraListProps["extraColumns"]> = [];
const EMPTY_STATUS_OPTIONS: NonNullable<JiraListProps["statusOptions"]> = [];

const ISSUE_TYPE_OPTIONS: readonly {
	label: string;
	value: JiraListIssueType;
}[] = [
	{ label: "Task", value: "task" },
	{ label: "Epic", value: "epic" },
	{ label: "Story", value: "story" },
	{ label: "Bug", value: "bug" },
	{ label: "Subtask", value: "subtask" },
];

const HEADER_CELL_CLASS =
	"h-10 border-b border-r border-border bg-surface-sunken px-3 py-0 text-left align-middle text-xs font-semibold text-text-subtle whitespace-nowrap";

interface JiraListTrailingEdgeLayout {
	draftRowIsLastColumn: boolean;
	frameTopBorderClassName?: string;
	headerCellClassName: string;
	lastBodyColumnIndex: number | null;
	lastHeaderCellClassName: string;
}

function getJiraListTrailingEdgeLayout(
	scrollEndInset: number,
	columnCount: number,
): JiraListTrailingEdgeLayout {
	if (scrollEndInset > 0) {
		return {
			draftRowIsLastColumn: false,
			headerCellClassName: cn(HEADER_CELL_CLASS, "border-t"),
			lastBodyColumnIndex: null,
			lastHeaderCellClassName: "rounded-tr-xl",
		};
	}

	return {
		draftRowIsLastColumn: true,
		frameTopBorderClassName: "border-t",
		headerCellClassName: HEADER_CELL_CLASS,
		lastBodyColumnIndex: columnCount - 1,
		lastHeaderCellClassName: "border-r-0",
	};
}

function getJiraListLastHeaderCellClassName(
	layout: JiraListTrailingEdgeLayout,
	columnIndex: number,
	columnCount: number,
): string | undefined {
	if (columnIndex !== columnCount - 1) {
		return undefined;
	}

	return layout.lastHeaderCellClassName;
}

function getJiraListColumnBoundaries(
	columns: readonly JiraListColumnDefinition[],
	insertionAnchorId: string,
) {
	return columns.flatMap((column, columnIndex) => {
		const endBoundary = {
			anchorLabel: column.label,
			anchorSide: "right" as const,
			boundaryIndex: columnIndex + 1,
			positionAnchor: getColumnAnchorName(insertionAnchorId, columnIndex),
			positionLabel: columnIndex === columns.length - 1
				? `after ${column.label}`
				: `between ${column.label} and ${columns[columnIndex + 1]?.label ?? ""}`,
		};

		if (columnIndex !== 0) {
			return [endBoundary];
		}

		return [
			{
				anchorLabel: column.label,
				anchorSide: "left" as const,
				boundaryIndex: columnIndex,
				positionAnchor: getColumnAnchorName(insertionAnchorId, columnIndex),
				positionLabel: `before ${column.label}`,
			},
			endBoundary,
		];
	});
}

export function JiraList({
	rows,
	activeIssueKey,
	ariaLabel = "Jira list view",
	className,
	createLabel = "Create",
	totalCountLabel = `${rows.length}`,
	visibleCount = rows.length,
	selectedIssueKeys = new Set<string>(),
	copiedIssueKey = null,
	draftWorkItem = null,
	extraColumns = EMPTY_EXTRA_COLUMNS,
	agentCatalog,
	addAgentLabel,
	statusOptions = EMPTY_STATUS_OPTIONS,
	onAssignedAgentIdsChange,
	onAssignedAgentSelect,
	onAgentAssign,
	onCreate,
	onCopyLink,
	onDraftWorkItemCancel,
	onDraftWorkItemAssigneeChange,
	onDraftWorkItemDueDateChange,
	onDraftWorkItemIssueTypeChange,
	onDraftWorkItemSubmit,
	onDraftWorkItemSummaryChange,
	onIssueClick,
	onIssueKeyClick,
	onMoveRow,
	onRefresh,
	onSelectAllRows,
	onSelectRow,
	onStatusChange,
	onToggleExpand,
	agentSessionDropIntent,
	rowFlash,
	onTrailingContentUnderlapChange,
	scrollEndInset = 0,
	trailingOverlayRef,
}: Readonly<JiraListProps>) {
	const insertionAnchorId = useId().replaceAll(":", "");
	const {
		ref: verticalOverflowRef,
		showBottomScrollMask,
		showTopScrollMask,
	} = useHasVerticalOverflow<HTMLDivElement>();
	const {
		ref: horizontalUnderlapRef,
	} = useJiraListHorizontalUnderlap<HTMLDivElement>(
		scrollEndInset,
		trailingOverlayRef,
		onTrailingContentUnderlapChange,
	);
	const tableScrollRef = useCallback<RefCallback<HTMLDivElement>>((node) => {
		verticalOverflowRef(node);
		horizontalUnderlapRef(node);
	}, [horizontalUnderlapRef, verticalOverflowRef]);
	const rowIds = useMemo(() => rows.map((row) => row.issueKey), [rows]);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const [isDueDateOpen, setIsDueDateOpen] = useState(false);
	const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
	const [hoveredRowTarget, setHoveredRowTarget] = useState<JiraListRowTarget | null>(null);
	const [hoveredColumnBoundaryIndex, setHoveredColumnBoundaryIndex] =
		useState<JiraListColumnBoundaryIndex | null>(null);
	const [hoveredCreateTarget, setHoveredCreateTarget] = useState<JiraListInsertionTarget | null>(null);
	const [focusedCreateTarget, setFocusedCreateTarget] = useState<JiraListInsertionTarget | null>(null);
	const [rowOverlayElement, setRowOverlayElement] = useState<HTMLDivElement | null>(null);
	const [draggingIssueKey, setDraggingIssueKey] = useState<string | null>(null);
	const [dragOverIssueKey, setDragOverIssueKey] = useState<string | null>(null);
	const [openCopyTooltipIssueKey, setOpenCopyTooltipIssueKey] = useState<string | null>(null);
	const sessionInsertionTarget = getAgentSessionInsertionTarget(agentSessionDropIntent);
	const flashingIssueKeys = useJiraListRowFlashKeys(rowFlash);
	const activeInsertionTarget = sessionInsertionTarget ?? focusedCreateTarget ?? hoveredCreateTarget;
	const draggingIndex = draggingIssueKey
		? rows.findIndex((row) => row.issueKey === draggingIssueKey)
		: -1;
	const dragOverIndex = dragOverIssueKey
		? rows.findIndex((row) => row.issueKey === dragOverIssueKey)
		: -1;
	const selectableRowCount = rows.length;
	const selectedRowCount = rows.filter((row) => selectedIssueKeys.has(row.issueKey)).length;
	const allRowsSelected = selectableRowCount > 0 && selectedRowCount === selectableRowCount;
	const someRowsSelected = selectedRowCount > 0 && !allRowsSelected;
	const isFooterDraft = Boolean(
		draftWorkItem && draftWorkItem.insertAtIndex === null,
	);
	const handleRowPointerMove = (
		event: ReactPointerEvent<HTMLTableRowElement>,
		row: JiraListRowData,
	) => {
		const rowBounds = event.currentTarget.getBoundingClientRect();
		const rowOffset = event.clientY - rowBounds.top;
		// Equal thirds keep boundary creation predictable while preserving a full
		// row-height center target for reordering.
		const zone = getRowZone(rowOffset, rowBounds.height);
		setHoveredRowTarget((currentTarget) => (
			currentTarget?.issueKey === row.issueKey && currentTarget.zone === zone
				? currentTarget
				: { issueKey: row.issueKey, zone }
		));
	};
	const handleColumnPointerMove = (
		event: ReactPointerEvent<HTMLTableCellElement>,
		columnIndex: number,
	) => {
		const columnBounds = event.currentTarget.getBoundingClientRect();
		const columnOffset = event.clientX - columnBounds.left;
		const boundaryIndex = getColumnBoundaryIndex(
			columnOffset,
			columnBounds.width,
			columnIndex,
		);
		setHoveredColumnBoundaryIndex((currentBoundaryIndex) => (
			currentBoundaryIndex === boundaryIndex ? currentBoundaryIndex : boundaryIndex
		));
	};
	const clearDragState = () => {
		setDraggingIssueKey(null);
		setDragOverIssueKey(null);
	};
	const handleDragStart = (event: DragStartEvent) => {
		setHoveredRowTarget(null);
		setDraggingIssueKey(String(event.active.id));
	};
	const handleDragOver = (event: DragOverEvent) => {
		setDragOverIssueKey(event.over ? String(event.over.id) : null);
	};
	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		clearDragState();
		if (!over || active.id === over.id) {
			return;
		}

		const targetIndex = rows.findIndex((row) => row.issueKey === String(over.id));
		if (targetIndex >= 0) {
			onMoveRow?.(String(active.id), targetIndex);
		}
	};
	const baseColumns = useMemo(() => createJiraListBaseColumns({
		agentCatalog,
		addAgentLabel,
		copiedIssueKey,
		onAgentAssign,
		onAssignedAgentIdsChange,
		onAssignedAgentSelect,
		onCopyLink,
		onIssueClick,
		onIssueKeyClick,
		onStatusChange,
		onToggleExpand,
		openCopyTooltipIssueKey,
		setOpenCopyTooltipIssueKey,
		statusOptions,
	}), [
		agentCatalog, addAgentLabel, copiedIssueKey, onAgentAssign, onAssignedAgentIdsChange,
		onAssignedAgentSelect, onCopyLink, onIssueClick, onIssueKeyClick,
		onStatusChange, onToggleExpand, openCopyTooltipIssueKey, statusOptions,
	]);
	const orderedColumns = useMemo(() => getOrderedColumns(baseColumns, extraColumns), [baseColumns, extraColumns]);
	const trailingEdgeLayout = getJiraListTrailingEdgeLayout(
		scrollEndInset,
		orderedColumns.length,
	);
	const columnBoundaries = getJiraListColumnBoundaries(
		orderedColumns,
		insertionAnchorId,
	);

	const handleDraftWorkItemKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			onDraftWorkItemSubmit?.();
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			onDraftWorkItemCancel?.();
		}
	};

	const selectedIssueType = draftWorkItem?.issueType ?? "task";
	const selectedDueDate = draftWorkItem?.dueDate
		? new Date(`${draftWorkItem.dueDate}T00:00:00`)
		: undefined;

	const renderIssueTypeControl = () => (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label={`Issue type: ${selectedIssueType}`}
						className="shrink-0 gap-1 px-2"
						size="compact"
						variant="ghost"
					/>
				}
			>
				<IssueTypeGlyph issueType={selectedIssueType} />
				<Icon className="text-icon-subtle" render={<ChevronDownIcon label="" size="small" />} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-48" side="top">
				{ISSUE_TYPE_OPTIONS.map((option) => (
					<DropdownMenuItem
						elemBefore={<IssueTypeGlyph issueType={option.value} />}
						key={option.value}
						onSelect={() => onDraftWorkItemIssueTypeChange?.(option.value)}
						selected={option.value === selectedIssueType}
					>
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);

	const renderFooterMetadataControls = () => (
		<>
			<Popover open={isDueDateOpen} onOpenChange={setIsDueDateOpen}>
				<PopoverTrigger
					render={
						<InputGroupButton
							aria-label={draftWorkItem?.dueDate ? `Due date: ${draftWorkItem.dueDate}` : "Set due date"}
							className="shrink-0"
							size={selectedDueDate ? "xs" : "icon-xs"}
						/>
					}
				>
					<Icon
						className={isDueDateOpen ? "text-icon-selected" : "text-icon-subtle"}
						render={<CalendarIcon label="" size="small" />}
					/>
					{selectedDueDate ? (
						<span className="hidden text-text-subtle xl:inline">
							{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(selectedDueDate)}
						</span>
					) : null}
				</PopoverTrigger>
				<PopoverContent align="end" className="w-auto p-2" side="top">
					<Calendar
						mode="single"
						onSelect={(date) => {
							onDraftWorkItemDueDateChange?.(
								date
									? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
									: undefined,
							);
							setIsDueDateOpen(false);
						}}
						selected={selectedDueDate}
					/>
				</PopoverContent>
			</Popover>
			<Popover open={isAssigneeOpen} onOpenChange={setIsAssigneeOpen}>
				<PopoverTrigger
					render={
						<InputGroupButton
							aria-label={draftWorkItem?.assignee ? `Assignee: ${draftWorkItem.assignee.name}` : "Set assignee"}
							className="shrink-0"
							size={draftWorkItem?.assignee ? "xs" : "icon-xs"}
						/>
					}
				>
					{draftWorkItem?.assignee ? (
						<JiraListAvatar person={draftWorkItem.assignee} />
					) : (
						<AvatarUnassigned aria-hidden="true" size="xs" />
					)}
					{draftWorkItem?.assignee ? (
						<span className="hidden max-w-28 truncate text-text-subtle xl:inline">
							{draftWorkItem.assignee.name}
						</span>
					) : null}
				</PopoverTrigger>
				<PopoverContent align="end" className="w-auto p-0" side="top">
					<EditorPaletteAssigneePicker
						onSelect={(item) => {
							onDraftWorkItemAssigneeChange?.({
								id: item.id,
								name: item.label,
								avatarShape: item.visual?.kind === "avatar" ? item.visual.shape : undefined,
								avatarSrc:
									item.visual?.kind === "avatar" || item.visual?.kind === "image"
										? item.visual.src
										: undefined,
								avatarUnassignedKind: item.category === "subagent" ? "agent" : undefined,
							});
							setIsAssigneeOpen(false);
						}}
					/>
				</PopoverContent>
			</Popover>
		</>
	);

	const renderDraftWorkItemEditor = (className?: string, showFooterControls = false) => (
		<div className={cn("flex min-w-0 items-center gap-2", className)}>
			{showFooterControls ? renderIssueTypeControl() : <IssueTypeGlyph issueType={selectedIssueType} />}
			<span
				className={cn(
					"shrink-0 text-[13px] font-semibold text-text-subtle",
					showFooterControls && "hidden sm:inline",
				)}
			>
				{draftWorkItem?.issueKeyLabel ?? "NEW"}
			</span>
			<label className="sr-only" htmlFor="jira-list-draft-summary">
				New work item summary
			</label>
			<InputGroup className="h-8 min-w-0 flex-1">
				<InputGroupInput
					autoFocus
					id="jira-list-draft-summary"
					onChange={(event) => onDraftWorkItemSummaryChange?.(event.target.value)}
					onKeyDown={handleDraftWorkItemKeyDown}
					placeholder="What needs to be done?"
					type="text"
					value={draftWorkItem?.summary ?? ""}
				/>
				{showFooterControls ? (
					<InputGroupAddon align="inline-end" className="gap-0.5">
						{renderFooterMetadataControls()}
					</InputGroupAddon>
				) : null}
			</InputGroup>
			<div className="ml-auto flex shrink-0 items-center gap-2">
				<Button
					className="px-2"
					disabled={!draftWorkItem?.summary.trim()}
					onClick={onDraftWorkItemSubmit}
					size="compact"
				>
					Create
				</Button>
				<Button
					className="px-2"
					onClick={onDraftWorkItemCancel}
					size="compact"
					variant="ghost"
				>
					Cancel
				</Button>
			</div>
		</div>
	);

	const renderDraftWorkItemRow = (insertAtIndex: number) => {
		if (draftWorkItem?.insertAtIndex !== insertAtIndex) {
			return null;
		}

		const isLastRow = insertAtIndex === rows.length;

		return (
			<TableRow
				className="group/row border-0 hover:bg-transparent focus-within:bg-transparent"
				data-state="draft"
				key={`jira-list-draft-${insertAtIndex}`}
			>
				<TableCell
					className={cn(
						getBodyCellClassName({ isLastRow, isSelected: false, align: "center" }),
						"sticky left-0 z-10 px-0",
					)}
				>
					<div className="flex items-center justify-center">
						<Icon
							className="text-icon-subtle"
							render={<AppSwitcherIcon label="" size="small" />}
						/>
					</div>
				</TableCell>
				<TableCell
					className={cn(
						getBodyCellClassName({
							isLastColumn: trailingEdgeLayout.draftRowIsLastColumn,
							isLastRow,
							isSelected: false,
						}),
						"px-2",
					)}
					colSpan={orderedColumns.length}
				>
					{renderDraftWorkItemEditor()}
				</TableCell>
			</TableRow>
		);
	};

	return (
		<section
			aria-label={ariaLabel}
			// The card hugs its rows and only scrolls once they outgrow the cap, so
			// the footer follows short content instead of stranding a gap above
			// itself. Callers that need it to fill a taller container must override
			// the cap with `max-h-full`, never a definite height like `h-full` — a
			// definite height hands the slack to the scrollport and reopens the gap.
			className={cn(
				"relative flex max-h-[640px] flex-col overflow-visible rounded-xl border-x border-b border-border bg-surface",
				trailingEdgeLayout.frameTopBorderClassName,
				className,
			)}
			data-testid="jira-list"
		>
			<div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
				{/* Positioned wrapper so the fades stay on the scrollport
				    edges instead of scrolling away with the rows. The footer
				    itself must stay unpositioned, because its centred
				    pagination is absolutely positioned against the card. */}
				<div className="relative flex min-h-0 flex-1 flex-col">
				<div
					className="min-h-0 flex-1 overflow-auto"
					data-testid="jira-list-table-scroll"
					ref={tableScrollRef}
				>
					<div
						className="flex min-w-full items-start"
						data-testid="jira-list-horizontal-content"
					>
					<DndContext
						collisionDetection={closestCenter}
						modifiers={[restrictToVerticalAxis]}
						onDragCancel={clearDragState}
						onDragEnd={handleDragEnd}
						onDragOver={handleDragOver}
						onDragStart={handleDragStart}
						sensors={sensors}
					>
					<Table
					className="min-w-[1570px] table-fixed border-separate border-spacing-0"
					containerClassName="min-w-[1570px] shrink-0 overflow-visible"
					>
					<colgroup>
						<col className="w-10" />
						{orderedColumns.map((column) => (
							<col className={column.widthClassName} key={column.id} />
						))}
					</colgroup>
					<TableHeader className="sticky top-0 z-20 bg-surface-sunken shadow-[inset_0_-1px_0_var(--ds-border)]">
						<TableRow className="border-0 hover:bg-transparent">
							<TableHead
								className={cn(
									trailingEdgeLayout.headerCellClassName,
									"sticky left-0 z-30 px-0",
								)}
							>
								<div className="flex items-center justify-center">
									<Checkbox
										aria-label="Select all work items"
										checked={allRowsSelected}
										disabled={selectableRowCount === 0}
										isIndeterminate={someRowsSelected}
										onCheckedChange={(checked) => onSelectAllRows?.(Boolean(checked))}
									/>
								</div>
							</TableHead>
							{orderedColumns.map((column, columnIndex) => {
								return (
									<TableHead
										className={cn(
											trailingEdgeLayout.headerCellClassName,
											column.align === "center" && "text-center",
											getJiraListLastHeaderCellClassName(
												trailingEdgeLayout,
												columnIndex,
												orderedColumns.length,
											),
											"relative overflow-visible",
										)}
										key={column.id}
										onPointerLeave={() => setHoveredColumnBoundaryIndex(null)}
										onPointerMove={(event) => handleColumnPointerMove(event, columnIndex)}
										style={{
											anchorName: getColumnAnchorName(insertionAnchorId, columnIndex),
										}}
									>
										<div className="group/column-header flex min-w-0 items-center gap-2">
											<div
												className={cn(
													"inline-flex min-w-0 items-center gap-1 truncate",
													column.align === "center" && "justify-center",
												)}
											>
												{column.headerContent ?? column.label}
											</div>
											<JiraListColumnActions label={column.label} />
										</div>
									</TableHead>
								);
							})}
						</TableRow>
					</TableHeader>
					<TableBody>
						<SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
							{rows.map((row, rowIndex) => {
								const isSelected = selectedIssueKeys.has(row.issueKey);
								const isActive = activeIssueKey === row.issueKey;
								const isHighlighted = isSelected || isActive;
								const isDropTarget = (
									dragOverIssueKey === row.issueKey
									&& draggingIssueKey !== row.issueKey
								);
								const dragInsertionPosition = getDragInsertionPosition(
									isDropTarget,
									draggingIndex,
									dragOverIndex,
								);
								const hoverInsertionPosition = (
									onCreate
									&& hoveredRowTarget?.issueKey === row.issueKey
									&& hoveredRowTarget.zone !== "drag"
								)
									? hoveredRowTarget.zone
									: undefined;
								const insertionLinePosition = activeInsertionTarget?.issueKey === row.issueKey
									? activeInsertionTarget.position
									: hoverInsertionPosition ?? dragInsertionPosition;
								const insertionLineClassName = getInsertionLineClassName(insertionLinePosition);
								const isSessionAttachTarget = isAgentSessionAttachTarget(
									agentSessionDropIntent,
									row.issueKey,
								);
								const isFlashing = flashingIssueKeys.has(row.issueKey);
								const isLastRow = rowIndex === rows.length - 1
									&& draftWorkItem?.insertAtIndex !== rows.length;

								return (
									<Fragment key={row.issueKey}>
										{renderDraftWorkItemRow(rowIndex)}
										<JiraListSortableRow
											agentSessionDropEnabled={agentSessionDropIntent !== undefined}
											aria-selected={isHighlighted || undefined}
											className="group/row border-0 hover:bg-transparent focus-within:bg-transparent data-[state=selected]:bg-transparent"
											data-active={isActive || undefined}
											data-state={isSelected ? "selected" : undefined}
											handleOverlayElement={rowOverlayElement}
											instanceId={insertionAnchorId}
											isDropTarget={isDropTarget}
											isHandleVisible={(
												hoveredRowTarget?.issueKey === row.issueKey
												&& hoveredRowTarget.zone === "drag"
											)}
											onMoveRow={onMoveRow}
											onPointerLeave={() => setHoveredRowTarget(null)}
											onPointerMove={(event) => handleRowPointerMove(event, row)}
											row={row}
											rowCount={rows.length}
											rowIndex={rowIndex}
										>
											<TableCell
												className={cn(
													getBodyCellClassName({
														isLastRow,
														isSelected: isHighlighted,
														align: "center",
													}),
													"sticky left-0 isolate overflow-visible bg-surface! px-0 before:pointer-events-none before:absolute before:inset-0 before:z-0 before:transition-colors",
													isHighlighted
														? "before:bg-bg-selected"
														: "before:bg-transparent group-hover/row:before:bg-bg-neutral-subtle-hovered group-focus-within/row:before:bg-bg-neutral-subtle-hovered",
													insertionLinePosition ? "z-30" : "z-10",
													insertionLineClassName,
													getRowFlashCellClassName(isFlashing, "sticky"),
													getAgentSessionAttachCellClassName(isSessionAttachTarget, "sticky"),
												)}
												data-insertion-line={insertionLinePosition}
												style={{ anchorName: getRowAnchorName(insertionAnchorId, rowIndex) }}
											>
												<div className="relative z-10 flex items-center justify-center">
													<Checkbox
														aria-label={`Select ${row.issueKey}`}
														checked={isSelected}
														onCheckedChange={(checked) => onSelectRow?.(row.issueKey, Boolean(checked))}
													/>
												</div>
											</TableCell>
											{orderedColumns.map((column, columnIndex) => (
												<TableCell
													className={cn(
														getBodyCellClassName({
															isSelected: isHighlighted,
															align: column.align,
															isLastColumn:
																columnIndex === trailingEdgeLayout.lastBodyColumnIndex,
															isLastRow,
														}),
														insertionLineClassName,
														getRowFlashCellClassName(isFlashing),
														getAgentSessionAttachCellClassName(isSessionAttachTarget),
													)}
													data-insertion-line={insertionLinePosition}
													key={column.id}
												>
													<JiraListCellContent column={column} row={row} />
												</TableCell>
											))}
										</JiraListSortableRow>
									</Fragment>
								);
							})}
						</SortableContext>
						{renderDraftWorkItemRow(rows.length)}
					</TableBody>
					</Table>
					</DndContext>
						<div
							aria-hidden
							className="shrink-0 self-stretch"
							data-testid="jira-list-scroll-end-inset"
							style={{ width: scrollEndInset }}
						/>
					</div>
				</div>
				{showTopScrollMask ? (
					<ScrollMaskEdgeOverlay
						className="top-10 z-20"
						data-testid="jira-list-scroll-fade-top"
						edge="top"
					/>
				) : null}
				{showBottomScrollMask ? (
					<ScrollMaskEdgeOverlay
						data-testid="jira-list-scroll-fade"
						edge="bottom"
					/>
				) : null}
				</div>
				<div
					className="sticky bottom-0 z-20 flex h-10 min-h-10 items-center gap-3 border-t border-border bg-surface px-2 py-1 text-[13px] shrink-0"
					data-footer-state={isFooterDraft ? "editing" : "default"}
					data-testid="jira-list-sticky-footer"
				>
					{isFooterDraft ? (
						<div className="min-w-0 flex-1" data-testid="jira-list-footer-draft">
							{renderDraftWorkItemEditor(undefined, true)}
						</div>
					) : (
						<>
							{onCreate ? (
								<div data-testid="jira-list-footer-controls">
									<Button
										className="-ml-2 text-text-subtle hover:text-text"
										onClick={() => onCreate()}
										size="default"
										variant="ghost"
									>
										<Icon className="text-icon-subtle" render={<AddIcon label="" size="small" />} />
										{createLabel}
									</Button>
								</div>
							) : null}
							<div
								className="absolute left-1/2 inline-flex -translate-x-1/2 items-center gap-1"
								data-testid="jira-list-footer-count"
							>
								<p className="text-sm font-medium text-text-subtle tabular-nums">
									{visibleCount} of {totalCountLabel}
								</p>
								{onRefresh ? (
									<Button
										aria-label="Refresh work items"
										onClick={onRefresh}
										size="icon"
										title="Refresh work items"
										variant="ghost"
									>
										<Icon render={<RefreshIcon label="" size="small" />} />
									</Button>
								) : null}
							</div>
						</>
					)}
				</div>
			</div>
			<div
				className="pointer-events-none contents"
				data-testid="jira-list-column-boundary-overlay"
			>
				{columnBoundaries.map((boundary) => (
					<JiraListColumnBoundary
						anchorLabel={boundary.anchorLabel}
						anchorSide={boundary.anchorSide}
						boundaryIndex={boundary.boundaryIndex}
						isTargeted={hoveredColumnBoundaryIndex === boundary.boundaryIndex}
						key={boundary.boundaryIndex}
						positionAnchor={boundary.positionAnchor}
						positionLabel={boundary.positionLabel}
					/>
				))}
			</div>
			{onCreate || onMoveRow ? (
				<RowBoundaryCreateControls
					activeTarget={activeInsertionTarget}
					hoveredTarget={hoveredRowTarget}
					instanceId={insertionAnchorId}
					onCreate={onCreate}
					onFocusedTargetChange={setFocusedCreateTarget}
					onHoveredTargetChange={setHoveredCreateTarget}
					overlayRef={setRowOverlayElement}
					rows={rows}
				/>
			) : null}
		</section>
	);
}
