import type { AgentSessionColumnFrame } from "@/components/blocks/agent-session-column/agent-session-column-frame";

/** `gap-2` between status column shells. */
export const STATUS_COLUMN_GAP_PX = 8;
/** `border-2` drop ring on each status shell. */
export const STATUS_COLUMN_DROP_BORDER_PX = 2;
/** Simple chrome content inset (`space.050`) inside the drop shell. */
export const SIMPLE_STATUS_COLUMN_CONTENT_INSET_PX = 4;
/** Untracked surface `translateX` into the page's 24px leading gutter. */
export const IN_FLOW_AGENT_SESSION_COLUMN_INSET_PX = 24;
/** `border-2` on the leading edge of the absolute Untracked surface. */
export const IN_FLOW_AGENT_SESSION_COLUMN_SURFACE_LEADING_BORDER_PX = 2;
/**
 * Embedded translate so the well's 1px rest stroke sits on the header's 24px
 * line. The drop-zone's 2px leading border would otherwise push the well
 * past Search board.
 */
export const IN_FLOW_AGENT_SESSION_COLUMN_EMBEDDED_OFFSET_PX =
	IN_FLOW_AGENT_SESSION_COLUMN_INSET_PX
	- IN_FLOW_AGENT_SESSION_COLUMN_SURFACE_LEADING_BORDER_PX;

/**
 * Width reserved when Untracked moves between status columns. The surface
 * content gains its 2px leading border plus the same 4px visual inset on both
 * sides, so the row's outer `gap-2` remains balanced around it.
 */
export function resolveInFlowAgentSessionColumnSlotWidthPx(
	columnWidthPx: number,
): number {
	return columnWidthPx
		+ IN_FLOW_AGENT_SESSION_COLUMN_SURFACE_LEADING_BORDER_PX
		+ SIMPLE_STATUS_COLUMN_CONTENT_INSET_PX * 2;
}

/**
 * Transparent chrome to the left of a status column's painted content
 * (caption/cards or sunken well). That strip reads as gutter.
 */
export function resolveStatusColumnLeadingChromePx(
	columnFrame: AgentSessionColumnFrame,
): number {
	switch (columnFrame) {
		case "caption":
			return STATUS_COLUMN_DROP_BORDER_PX + SIMPLE_STATUS_COLUMN_CONTENT_INSET_PX;
		case "enclosed":
			return STATUS_COLUMN_DROP_BORDER_PX;
		default: {
			const exhaustive: never = columnFrame;
			return exhaustive;
		}
	}
}

/**
 * Status-row `paddingInlineStart`. Simple subtracts its drop border and
 * content inset so expanded cards still sit on the 24px header line.
 */
export function resolveStatusColumnRowPaddingPx(
	columnFrame: AgentSessionColumnFrame,
): number {
	switch (columnFrame) {
		case "caption":
			return IN_FLOW_AGENT_SESSION_COLUMN_INSET_PX
				- STATUS_COLUMN_DROP_BORDER_PX
				- SIMPLE_STATUS_COLUMN_CONTENT_INSET_PX;
		case "enclosed":
			return IN_FLOW_AGENT_SESSION_COLUMN_INSET_PX;
		default: {
			const exhaustive: never = columnFrame;
			return exhaustive;
		}
	}
}

/**
 * Painted gutter between adjacent status columns: `gap-2` plus the trailing
 * chrome of one shell and the leading chrome of the next.
 */
export function resolveStatusColumnVisualGutterPx(
	columnFrame: AgentSessionColumnFrame,
): number {
	return STATUS_COLUMN_GAP_PX + resolveStatusColumnLeadingChromePx(columnFrame) * 2;
}

/**
 * Left footprint spacer that leaves `resolveStatusColumnVisualGutterPx` between
 * the Untracked well and the first status column's painted content.
 *
 * Untracked's well has no trailing drop/content chrome, so the shell gap is
 * the visual gutter minus the first status column's leading chrome. The
 * spacer then undoes the embedded translate, leading border, and the status
 * row inset.
 */
export function resolveInFlowAgentSessionColumnGapPx(
	columnFrame: AgentSessionColumnFrame,
): number {
	const leadingChromePx = resolveStatusColumnLeadingChromePx(columnFrame);
	const shellGapPx = resolveStatusColumnVisualGutterPx(columnFrame) - leadingChromePx;
	return shellGapPx
		- resolveStatusColumnRowPaddingPx(columnFrame)
		+ IN_FLOW_AGENT_SESSION_COLUMN_EMBEDDED_OFFSET_PX
		+ IN_FLOW_AGENT_SESSION_COLUMN_SURFACE_LEADING_BORDER_PX;
}

/** Offset from the Untracked well's right edge to the center of the visual gutter. */
export function resolveInFlowResizeHandleOffsetPx(
	columnFrame: AgentSessionColumnFrame,
): number {
	return resolveStatusColumnVisualGutterPx(columnFrame) / 2;
}
