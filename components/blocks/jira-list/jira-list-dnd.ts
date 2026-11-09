import { cn } from "@/lib/utils";

import type {
	JiraListAgentSessionDropIntent,
	JiraListInsertionPosition,
} from "@/components/blocks/jira-list/jira-list-types";
import {
	getInsertionFromRowZone,
	getRowZone,
	JIRA_LIST_ROW_ZONE_BAND,
} from "./jira-list-row-zone.js";

export {
	getInsertionFromRowZone,
	getRowZone,
	JIRA_LIST_ROW_ZONE_BAND,
};

export interface JiraListInsertionTarget {
	issueKey: string;
	position: JiraListInsertionPosition;
}

export type JiraListRowZone = "before" | "drag" | "after";
export type JiraListColumnBoundaryIndex = number;

export interface JiraListRowTarget {
	issueKey: string;
	zone: JiraListRowZone;
}

export function getColumnBoundaryIndex(
	columnOffset: number,
	columnWidth: number,
	columnIndex: number,
): JiraListColumnBoundaryIndex {
	if (columnOffset < columnWidth / 2) {
		return columnIndex;
	}

	return columnIndex + 1;
}

export function getAgentSessionInsertionTarget(
	intent: JiraListAgentSessionDropIntent | undefined,
): JiraListInsertionTarget | null {
	return intent?.kind === "create"
		? {
			issueKey: intent.insertion.relativeToIssueKey,
			position: intent.insertion.position,
		}
		: null;
}

export function isAgentSessionAttachTarget(
	intent: JiraListAgentSessionDropIntent | undefined,
	issueKey: string,
): boolean {
	return intent?.kind === "attach" && intent.issueKey === issueKey;
}

/**
 * Which part of the row a cell is. Row-wide treatments are assembled from
 * separate boxes, and the sticky checkbox cell paints its background through a
 * `::before` overlay, so its treatment has to target the pseudo-element.
 */
export type JiraListRowCellSlot = "sticky" | "body";

/**
 * Row-wide attach affordance for an incoming agent session.
 *
 * Deliberately the whole row rather than the Agent sessions cell alone: that
 * column is often scrolled out of view, and a single lit cell reads as "this
 * field" when the drop actually lands on the work item.
 *
 * The deeper `selected-hovered` tone, not plain `selected`: an armed drop
 * target has to stay legible on a row that is already checkbox-selected, and
 * cells are independent boxes, so a shared tint is the only treatment that
 * spans them without assembling an outline per cell.
 */
export function getAgentSessionAttachCellClassName(
	isTarget: boolean,
	slot: JiraListRowCellSlot = "body",
): string | undefined {
	if (!isTarget) {
		return undefined;
	}

	return slot === "sticky"
		? "before:bg-bg-selected-hovered!"
		: "bg-bg-selected-hovered!";
}

/**
 * One-shot acknowledgement after a session drop. Created rows are deliberately
 * left unchecked, so this flash is what says "here it is" — and it is the same
 * signal whether the row was created or attached to.
 */
export function getRowFlashCellClassName(
	isFlashing: boolean,
	slot: JiraListRowCellSlot = "body",
): string | undefined {
	if (!isFlashing) {
		return undefined;
	}

	return slot === "sticky" ? "before:jira-list-row-flash" : "jira-list-row-flash";
}

export function getDragInsertionPosition(
	isDropTarget: boolean,
	draggingIndex: number,
	dragOverIndex: number,
): JiraListInsertionPosition | undefined {
	if (!isDropTarget) {
		return undefined;
	}

	return draggingIndex < dragOverIndex ? "after" : "before";
}

export function getBodyCellClassName({
	isEditing = false,
	isSelected,
	align = "left",
}: Readonly<{
	isEditing?: boolean;
	isSelected: boolean;
	align?: "left" | "center";
}>) {
	return cn(
		"relative h-10 px-3 py-0 align-middle whitespace-nowrap transition-colors",
		align === "center" && "text-center",
		isEditing
			? "bg-surface transition-none"
			: isSelected
				? "bg-bg-selected"
				: "bg-surface group-hover/row:bg-bg-neutral-subtle-hovered group-focus-within/row:bg-bg-neutral-subtle-hovered",
	);
}

export function isInsertionTarget(
	target: JiraListInsertionTarget | null,
	issueKey: string,
	position: JiraListInsertionPosition,
): boolean {
	return target?.issueKey === issueKey && target.position === position;
}

export function getInsertionLineClassName(
	position: JiraListInsertionPosition | undefined,
): string | undefined {
	if (position === "before") {
		return "after:pointer-events-none after:absolute after:-top-px after:-inset-x-px after:z-30 after:h-0.5 after:bg-border-selected";
	}

	if (position === "after") {
		return "after:pointer-events-none after:absolute after:-bottom-px after:-inset-x-px after:z-30 after:h-0.5 after:bg-border-selected";
	}

	return undefined;
}

export function getRowAnchorName(instanceId: string, rowIndex: number): string {
	return `--jira-list-${instanceId}-row-${rowIndex}`;
}

export function getColumnAnchorName(instanceId: string, columnIndex: number): string {
	return `--jira-list-${instanceId}-column-${columnIndex}`;
}
