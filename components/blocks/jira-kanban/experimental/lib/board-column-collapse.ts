/**
 * Collapse state for experimental board columns.
 *
 * Columns are identified by title (the same key `assignedAgentIdsByColumn` and
 * the drag/drop handlers already use), so collapse survives re-renders and
 * re-orders, and a column that leaves and returns keeps the state the user set.
 */
export type CollapsedBoardColumns = ReadonlySet<string>;
export type BoardColumnWidth = "fixed" | "fluid";

export const EMPTY_COLLAPSED_BOARD_COLUMNS: CollapsedBoardColumns = new Set<string>();

/** Board column width in px, excluding the 2px transparent drop-target border. */
export const BOARD_COLUMN_WIDTH_PX = 276;

/** Collapsed pill width in px, excluding the 2px transparent drop-target border. */
export const BOARD_COLUMN_COLLAPSED_WIDTH_PX = 32;

/**
 * Restores the simple column's 4px content inset when the first column is
 * collapsed. The shell's existing 2px border supplies the rest of the 6px
 * chrome that expanded cards receive.
 */
export const BOARD_FIRST_COLLAPSED_COLUMN_INSET_PX = 4;

/** Outer width in px, including the 2px transparent drop-target border on both edges. */
export function getBoardColumnOuterWidthPx(isCollapsed: boolean): number {
	return (isCollapsed ? BOARD_COLUMN_COLLAPSED_WIDTH_PX : BOARD_COLUMN_WIDTH_PX) + 4;
}

/** Fluid expanded columns share remaining space; collapsed pills stay compact. */
export function resolveBoardColumnShellSizing(isCollapsed: boolean, columnWidth: BoardColumnWidth = "fixed") {
	const outerWidth = `${getBoardColumnOuterWidthPx(isCollapsed)}px`;
	return {
		flex: isCollapsed && columnWidth === "fluid" ? "0 0 auto" : "1 1 0",
		minWidth: outerWidth,
		maxWidth: columnWidth === "fluid" && !isCollapsed ? undefined : outerWidth,
	};
}

export function isBoardColumnCollapsed(
	collapsedColumns: CollapsedBoardColumns,
	columnTitle: string,
): boolean {
	return collapsedColumns.has(columnTitle);
}

export function resolveBoardColumnRowPaddingInlineStart(
	columnRowPaddingInlineStart: string,
	firstColumnTitle: string | undefined,
	hasDropContentPadding: boolean,
	collapsedColumns: CollapsedBoardColumns,
): string {
	if (
		!firstColumnTitle
		|| !hasDropContentPadding
		|| !isBoardColumnCollapsed(collapsedColumns, firstColumnTitle)
	) {
		return columnRowPaddingInlineStart;
	}

	return `calc(${columnRowPaddingInlineStart} + ${BOARD_FIRST_COLLAPSED_COLUMN_INSET_PX}px)`;
}

export function toggleCollapsedBoardColumn(
	collapsedColumns: CollapsedBoardColumns,
	columnTitle: string,
): CollapsedBoardColumns {
	const nextCollapsedColumns = new Set(collapsedColumns);
	if (!nextCollapsedColumns.delete(columnTitle)) {
		nextCollapsedColumns.add(columnTitle);
	}
	return nextCollapsedColumns;
}
