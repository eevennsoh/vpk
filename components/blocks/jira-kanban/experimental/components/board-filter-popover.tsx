"use client";

import { useEffect, useMemo } from "react";
import { JiraFilter, type JiraFilterField } from "@/components/blocks/jira-filter";
import type { JiraKanbanAssigneeData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban/index";
import { BOARD_FILTER_DAYS_OPTIONS, BOARD_FILTER_FIELD_LABELS, BOARD_FILTER_OPTIONS } from "../data/board-filter-options";
import { BOARD_JIRA_FIELD_IDS, type BoardFilterActions, type BoardFilterModel } from "../hooks/use-board-filter";
import { BOARD_FILTER_VALUE_FIELD_IDS } from "../lib/board-filter";
import { boardJiraFilterFields } from "../lib/board-jira-filter";

export function BoardFilterPopover({
	actions, assignees, columns, compact = false, model, surfaceLabel = "board",
}: Readonly<{
	actions: BoardFilterActions;
	assignees: readonly JiraKanbanAssigneeData[];
	columns: readonly JiraKanbanColumnData[];
	compact?: boolean;
	model: BoardFilterModel;
	surfaceLabel?: string;
}>) {
	const { setOpen } = actions;
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() !== "f" || !event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
			if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a, [contenteditable='true'], [role='menuitem'], [role='combobox']")) return;
			event.preventDefault();
			setOpen(!model.open);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [model.open, setOpen]);
	const fields = useMemo((): JiraFilterField[] => [...BOARD_FILTER_VALUE_FIELD_IDS.filter((field) => !["status", "work-type", "labels"].includes(field)).map((field) => ({
		id: BOARD_JIRA_FIELD_IDS[field],
		label: BOARD_FILTER_FIELD_LABELS[field],
		multiple: true,
		options: field === "assignee"
			? assignees.map((assignee) => ({ value: assignee.id, label: assignee.name }))
			: BOARD_FILTER_OPTIONS[field].map((option) => ({ value: option.id, label: option.description ? `${option.label} (${option.description})` : option.label })),
	})), ...boardJiraFilterFields(columns), {
		id: "days", label: "Filter by days", options: BOARD_FILTER_DAYS_OPTIONS.filter((option) => option.id !== "custom").map((option) => ({ value: option.id, label: option.label })),
	}], [assignees, columns]);

	return <JiraFilter variant="project-butter" fields={fields} value={model.conditions}
		onChange={actions.setConditions} open={model.open} onOpenChange={setOpen}
		compact={compact} triggerLabel={`Filter ${surfaceLabel}`} />;
}
