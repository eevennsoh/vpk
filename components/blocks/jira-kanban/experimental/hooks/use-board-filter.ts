"use client";

import { useCallback, useMemo, useState } from "react";
import type { JiraFilterCondition } from "@/components/blocks/jira-filter";

import {
	countBoardFilterSelections,
	BOARD_FILTER_VALUE_FIELD_IDS,
	BOARD_FILTER_DAYS_PRESETS,
	EMPTY_BOARD_FILTER_DAYS,
	EMPTY_BOARD_FILTER_VALUE_SELECTIONS,
	toggleBoardFilterValue,
	type BoardFilterDaysSelection,
	type BoardFilterFieldId,
	type BoardFilterValueFieldId,
	type BoardFilterValueSelections,
} from "../lib/board-filter";

export interface BoardFilterModel {
	conditions: readonly JiraFilterCondition[];
	days: BoardFilterDaysSelection;
	open: boolean;
	selectedCount: number;
	selectedFieldId: BoardFilterFieldId;
	selectedValueIdsByField: BoardFilterValueSelections;
}

export interface BoardFilterActions {
	setConditions: (conditions: JiraFilterCondition[]) => void;
	clearAll: () => void;
	clearField: (fieldId: BoardFilterFieldId) => void;
	setAssigneeIds: (assigneeIds: Set<string>) => void;
	setDays: (days: BoardFilterDaysSelection) => void;
	setOpen: (open: boolean) => void;
	setSelectedFieldId: (fieldId: BoardFilterFieldId) => void;
	toggleValue: (fieldId: BoardFilterValueFieldId, valueId: string) => void;
}

interface BoardFilterSelection {
	days: BoardFilterDaysSelection;
	conditions: readonly JiraFilterCondition[];
}

export const BOARD_JIRA_FIELD_IDS: Record<BoardFilterValueFieldId, string> = {
	assignee: "assignee", parent: "epic", sprint: "sprint", project: "project",
	status: "status", "work-type": "type", labels: "label",
};

function toValueSelections(conditions: readonly JiraFilterCondition[]): BoardFilterValueSelections {
	return BOARD_FILTER_VALUE_FIELD_IDS.reduce((values, field) => ({
		...values,
		[field]: conditions.find((condition) => condition.field === BOARD_JIRA_FIELD_IDS[field] && condition.operator === "is")?.values ?? [],
	}), EMPTY_BOARD_FILTER_VALUE_SELECTIONS);
}

const EMPTY_BOARD_FILTER_SELECTION: BoardFilterSelection = {
	conditions: [],
	days: EMPTY_BOARD_FILTER_DAYS,
};

export function useBoardFilter({
	onAssigneeChange,
	scopeKey = "default",
}: Readonly<{
	onAssigneeChange?: () => void;
	/** Retain independent selections when one board switches between datasets. */
	scopeKey?: string;
}> = {}): {
	actions: BoardFilterActions;
	model: BoardFilterModel;
	selectedAssigneeIds: Set<string>;
} {
	const [open, setOpen] = useState(false);
	const [selectedFieldId, setSelectedFieldId] = useState<BoardFilterFieldId>("assignee");
	const [selectionsByScope, setSelectionsByScope] = useState<Record<string, BoardFilterSelection>>({});
	const { days, conditions } = selectionsByScope[scopeKey] ?? EMPTY_BOARD_FILTER_SELECTION;
	const selectedValueIdsByField = useMemo(() => toValueSelections(conditions), [conditions]);
	const updateSelection = useCallback((update: (current: BoardFilterSelection) => BoardFilterSelection) => {
		setSelectionsByScope((current) => ({
			...current,
			[scopeKey]: update(current[scopeKey] ?? EMPTY_BOARD_FILTER_SELECTION),
		}));
	}, [scopeKey]);
	const setDays = useCallback((nextDays: BoardFilterDaysSelection) => {
		updateSelection((current) => ({ ...current, days: nextDays }));
	}, [updateSelection]);

	const selectedCount = Math.max(countBoardFilterSelections(selectedValueIdsByField, days), conditions.reduce((count, condition) => count + condition.values.length, 0));
	const selectedAssigneeIds = useMemo(
		() => new Set(selectedValueIdsByField.assignee),
		[selectedValueIdsByField.assignee],
	);

	const toggleValue = useCallback((fieldId: BoardFilterValueFieldId, valueId: string) => {
		if (fieldId === "assignee") onAssigneeChange?.();
		updateSelection((current) => ({
			...current,
			conditions: [
				...current.conditions.filter((condition) => condition.field !== BOARD_JIRA_FIELD_IDS[fieldId]),
				{ field: BOARD_JIRA_FIELD_IDS[fieldId], operator: "is", values: toggleBoardFilterValue(toValueSelections(current.conditions), fieldId, valueId)[fieldId] },
			],
		}));
	}, [onAssigneeChange, updateSelection]);

	const setAssigneeIds = useCallback((assigneeIds: Set<string>) => {
		onAssigneeChange?.();
		updateSelection((current) => ({
			...current,
			conditions: [
				...current.conditions.filter((condition) => condition.field !== "assignee"),
				...(assigneeIds.size ? [{ field: "assignee", operator: "is" as const, values: [...assigneeIds] }] : []),
			],
		}));
	}, [onAssigneeChange, updateSelection]);

	const clearField = useCallback((fieldId: BoardFilterFieldId) => {
		if (fieldId === "days") {
			setDays(EMPTY_BOARD_FILTER_DAYS);
			return;
		}
		if (fieldId === "assignee") onAssigneeChange?.();
		updateSelection((current) => ({
			...current,
			conditions: current.conditions.filter((condition) => condition.field !== BOARD_JIRA_FIELD_IDS[fieldId]),
		}));
	}, [onAssigneeChange, setDays, updateSelection]);

	const clearAll = useCallback(() => {
		onAssigneeChange?.();
		updateSelection(() => EMPTY_BOARD_FILTER_SELECTION);
	}, [onAssigneeChange, updateSelection]);
	const setConditions = useCallback((next: JiraFilterCondition[]) => {
		onAssigneeChange?.();
		updateSelection((current) => ({
			...current,
			conditions: next,
			days: { preset: BOARD_FILTER_DAYS_PRESETS.find((preset) => next.some((condition) => condition.field === "days" && condition.operator === "is" && condition.values.includes(preset))) ?? null },
		}));
	}, [onAssigneeChange, updateSelection]);

	return {
		actions: {
			setConditions,
			clearAll,
			clearField,
			setAssigneeIds,
			setDays,
			setOpen,
			setSelectedFieldId,
			toggleValue,
		},
		model: {
			conditions,
			days,
			open,
			selectedCount,
			selectedFieldId,
			selectedValueIdsByField,
		},
		selectedAssigneeIds,
	};
}
