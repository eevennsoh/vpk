"use client";

import { useEffect, useMemo } from "react";
import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import { JiraFilter, type JiraFilterField, type JiraSavedFilter } from "@/components/blocks/jira-filter";
import type { JiraKanbanAssigneeData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban/index";
import { BOARD_FILTER_DAYS_OPTIONS, BOARD_FILTER_FIELD_LABELS, BOARD_FILTER_OPTIONS } from "../data/board-filter-options";
import { BOARD_JIRA_FIELD_IDS, type BoardFilterActions, type BoardFilterModel } from "../hooks/use-board-filter";
import { BOARD_FILTER_VALUE_FIELD_IDS } from "../lib/board-filter";
import { boardJiraFilterFields } from "../lib/board-jira-filter";

export function useBoardFilterFields(assignees: readonly JiraKanbanAssigneeData[], columns: readonly JiraKanbanColumnData[], assigneePeople?: readonly WorkItemPerson[], statusOptions?: readonly string[]): JiraFilterField[] {
	const peopleOptions = useMemo(() => {
		if (!assigneePeople) return assignees.map((person) => ({ value: person.id, label: person.name, avatarUrl: person.avatarSrc }));
		const boardPeople = new Map(columns.flatMap((column) => column.cards.flatMap((card) => card.assignee ? [[card.assignee.name, card.assignee] as const] : [])));
		const people: readonly WorkItemPerson[] = [...assigneePeople, ...[...boardPeople.values()].filter((person) => !assigneePeople.some((existing) => existing.name === person.name)).map((person) => ({ name: person.name, avatarUrl: person.avatarSrc }))];
		return people.map((person) => ({ value: person.name === "Unassigned" ? "unassigned" : assignees.find((item) => item.name === person.name)?.id ?? person.name, label: person.name, avatarUrl: person.avatarUrl }));
	}, [assignees, assigneePeople, columns]);
	return useMemo(() => [...BOARD_FILTER_VALUE_FIELD_IDS.filter((field) => !["status", "work-type", "labels"].includes(field)).map((field) => ({
		id: BOARD_JIRA_FIELD_IDS[field],
		label: BOARD_FILTER_FIELD_LABELS[field],
		multiple: true,
		options: field === "assignee"
			? peopleOptions
			: BOARD_FILTER_OPTIONS[field].map((option) => ({ value: option.id, label: option.description ? `${option.label} (${option.description})` : option.label, ...(field === "parent" || field === "sprint" ? { displayLabel: option.label } : {}) })),
	})), ...boardJiraFilterFields(columns, statusOptions), {
		id: "days", label: "Filter by days", options: BOARD_FILTER_DAYS_OPTIONS.filter((option) => option.id !== "custom").map((option) => ({ value: option.id, label: option.label })),
	}], [peopleOptions, columns, statusOptions]);
}

export function BoardFilterPopover({
	actions, assignees, assigneePeople, columns, compact = false, initialSavedFilters, model, statusOptions, surfaceLabel = "board",
}: Readonly<{
	actions: BoardFilterActions;
	assignees: readonly JiraKanbanAssigneeData[];
	assigneePeople?: readonly WorkItemPerson[];
	columns: readonly JiraKanbanColumnData[];
	compact?: boolean;
	initialSavedFilters?: readonly JiraSavedFilter[];
	model: BoardFilterModel;
	statusOptions?: readonly string[];
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
	const fields = useBoardFilterFields(assignees, columns, assigneePeople, statusOptions);

	return <JiraFilter variant="project-butter" fields={fields} initialSavedFilters={initialSavedFilters} value={model.conditions}
		onChange={actions.setConditions} open={model.open} onOpenChange={setOpen}
		compact={compact} triggerLabel={`Filter ${surfaceLabel}`} />;
}
