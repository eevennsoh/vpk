"use client";

import { useCallback, useMemo, useReducer } from "react";
import type {
	FloatingRovoButtonInsightRow,
	FloatingRovoButtonInsightsConfig,
	FloatingRovoButtonInsightsStage,
} from "@/components/blocks/rovo-button";
import {
	ROVO_BUTTON_DEMO_INSIGHTS_INITIAL_STATE,
	reduceRovoButtonDemoInsights,
	selectRovoButtonDemoInsightsCount,
	selectRovoButtonDemoInsightsOverflowCount,
	selectRovoButtonDemoInsightsRows,
} from "../data/rovo-button-demo-insights";

/**
 * Demo-only daily digest. The stage is controlled so dismiss and open are both
 * observable, and the read watermark lives in a pure reducer so "dismiss reads
 * nothing" cannot rot into "dismiss clears the badge".
 */
export function useRovoButtonDemoInsights(): FloatingRovoButtonInsightsConfig {
	const [state, dispatch] = useReducer(
		reduceRovoButtonDemoInsights,
		ROVO_BUTTON_DEMO_INSIGHTS_INITIAL_STATE,
	);

	const handleStageChange = useCallback(
		(stage: FloatingRovoButtonInsightsStage) => dispatch({ type: "stage-change", stage }),
		[],
	);
	const handleDismiss = useCallback(() => dispatch({ type: "dismiss" }), []);
	const handlePrimaryAction = useCallback(() => dispatch({ type: "open-all" }), []);

	const rows = useMemo<readonly FloatingRovoButtonInsightRow[]>(
		() => selectRovoButtonDemoInsightsRows(state).map((row) => ({
			...row,
			onSelect: () => dispatch({ type: "select-row", rowId: row.id }),
		})),
		[state],
	);

	return useMemo<FloatingRovoButtonInsightsConfig>(() => ({
		id: "rovo-button-daily-insights-demo",
		count: selectRovoButtonDemoInsightsCount(state),
		rows,
		overflowCount: selectRovoButtonDemoInsightsOverflowCount(state),
		spaceName: "Jira Design",
		stage: state.stage,
		onStageChange: handleStageChange,
		onPrimaryAction: handlePrimaryAction,
		onDismiss: handleDismiss,
	}), [handleDismiss, handlePrimaryAction, handleStageChange, rows, state]);
}
