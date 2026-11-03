"use client";

import { useState } from "react";

import { createIssueCohortDeckLayers, type IssueCohortGatherLayer } from "@/components/blocks/jira-kanban/experimental/lib/issue-cohort-gather";

import { REAR_SHEETS } from "./constants";

/**
 * The rear sheets' poses, rolled like Jira's kanban bulk-selection deck. A fresh roll each time the stack forms
 * (on mount, and whenever `formation` changes), always unlike the previous one, so the stack never settles into
 * uniform slivers.
 */
export function useDeckLayers(formation: string): readonly IssueCohortGatherLayer[] {
	const [state, setState] = useState(() => ({ formation, layers: createIssueCohortDeckLayers(Math.random, [], REAR_SHEETS) }));
	if (state.formation !== formation) {
		const layers = createIssueCohortDeckLayers(Math.random, state.layers, REAR_SHEETS);
		setState({ formation, layers });
		return layers;
	}
	return state.layers;
}
