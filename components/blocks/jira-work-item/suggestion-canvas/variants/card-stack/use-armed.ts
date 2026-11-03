"use client";

import { useEffect, useState } from "react";
import type { MotionValue } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

import type { SwipeDirection } from "./use-deck";

/** Which decision releasing the grabbed card now would commit, re-rendering only when that changes. */
export function useArmed(grab: { id: SuggestionFieldId; progress: MotionValue<number> } | null): SwipeDirection | null {
	const [armed, setArmed] = useState<{ id: SuggestionFieldId; direction: SwipeDirection } | null>(null);
	useEffect(() => {
		if (!grab) return undefined;
		return grab.progress.on("change", (value) => {
			const direction = value >= 1 ? "accept" : value <= -1 ? "dismiss" : null;
			setArmed((current) => (current?.direction === direction && current?.id === grab.id ? current : direction ? { id: grab.id, direction } : null));
		});
	}, [grab]);
	return grab && armed?.id === grab.id ? armed.direction : null;
}
