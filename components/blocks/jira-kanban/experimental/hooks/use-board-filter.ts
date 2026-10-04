"use client";

import { useCallback, useMemo, useState } from "react";

import {
	clearBoardFilterField,
	countBoardFilterSelections,
	EMPTY_BOARD_FILTER_DAYS,
	EMPTY_BOARD_FILTER_VALUE_SELECTIONS,
	toggleBoardFilterValue,
	type BoardFilterDaysSelection,
	type BoardFilterFieldId,
	type BoardFilterValueFieldId,
	type BoardFilterValueSelections,
} from "../lib/board-filter";

export interface BoardFilterModel {
	days: BoardFilterDaysSelection;
	open: boolean;
	selectedCount: number;
	selectedFieldId: BoardFilterFieldId;
	selectedValueIdsByField: BoardFilterValueSelections;
}

export interface BoardFilterActions {
	clearAll: () => void;
	clearField: (fieldId: BoardFilterFieldId) => void;
	setAssigneeIds: (assigneeIds: Set<string>) => void;
	setDays: (days: BoardFilterDaysSelection) => void;
	setOpen: (open: boolean) => void;
	setSelectedFieldId: (fieldId: BoardFilterFieldId) => void;
	toggleValue: (fieldId: BoardFilterValueFieldId, valueId: string) => void;
}

interface BoardFilterSelection {
	values: BoardFilterValueSelections;
	days: BoardFilterDaysSelection;
}

const EMPTY_BOARD_FILTER_SELECTION: BoardFilterSelection = {
	values: EMPTY_BOARD_FILTER_VALUE_SELECTIONS,
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
	const { values: selectedValueIdsByField, days } = selectionsByScope[scopeKey] ?? EMPTY_BOARD_FILTER_SELECTION;
	const updateSelection = useCallback((update: (current: BoardFilterSelection) => BoardFilterSelection) => {
		setSelectionsByScope((current) => ({
			...current,
			[scopeKey]: update(current[scopeKey] ?? EMPTY_BOARD_FILTER_SELECTION),
		}));
	}, [scopeKey]);
	const setDays = useCallback((nextDays: BoardFilterDaysSelection) => {
		updateSelection((current) => ({ ...current, days: nextDays }));
	}, [updateSelection]);

	const selectedCount = countBoardFilterSelections(selectedValueIdsByField, days);
	const selectedAssigneeIds = useMemo(
		() => new Set(selectedValueIdsByField.assignee),
		[selectedValueIdsByField.assignee],
	);

	const toggleValue = useCallback((fieldId: BoardFilterValueFieldId, valueId: string) => {
		if (fieldId === "assignee") onAssigneeChange?.();
		updateSelection((current) => ({ ...current, values: toggleBoardFilterValue(current.values, fieldId, valueId) }));
	}, [onAssigneeChange, updateSelection]);

	const setAssigneeIds = useCallback((assigneeIds: Set<string>) => {
		onAssigneeChange?.();
		updateSelection((current) => ({
			...current,
			values: { ...current.values, assignee: [...assigneeIds] },
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
			values: clearBoardFilterField(current.values, EMPTY_BOARD_FILTER_DAYS, fieldId).values,
		}));
	}, [onAssigneeChange, setDays, updateSelection]);

	const clearAll = useCallback(() => {
		onAssigneeChange?.();
		updateSelection(() => EMPTY_BOARD_FILTER_SELECTION);
	}, [onAssigneeChange, updateSelection]);

	return {
		actions: {
			clearAll,
			clearField,
			setAssigneeIds,
			setDays,
			setOpen,
			setSelectedFieldId,
			toggleValue,
		},
		model: {
			days,
			open,
			selectedCount,
			selectedFieldId,
			selectedValueIdsByField,
		},
		selectedAssigneeIds,
	};
}
