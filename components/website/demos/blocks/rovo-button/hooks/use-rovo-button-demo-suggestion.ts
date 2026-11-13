"use client";

import { useCallback, useMemo, useState } from "react";
import type { FloatingRovoButtonSuggestion } from "@/components/blocks/rovo-button";

type DemoSuggestionState = "hidden" | "visible" | "accepted";

export interface RovoButtonDemoSuggestion {
	suggestion: FloatingRovoButtonSuggestion | null;
	/** Replays the nudge from the top, even if one is already on screen. */
	show: () => void;
	hide: () => void;
}

/**
 * Demo-only proactive nudge. Each `show()` bumps a run counter so the suggestion
 * gets a fresh key and re-plays its entrance animation.
 */
export function useRovoButtonDemoSuggestion(): RovoButtonDemoSuggestion {
	const [state, setState] = useState<DemoSuggestionState>("hidden");
	const [run, setRun] = useState(0);

	const show = useCallback(() => {
		setRun((currentRun) => currentRun + 1);
		setState("visible");
	}, []);

	const hide = useCallback(() => setState("hidden"), []);
	const accept = useCallback(() => setState("accepted"), []);

	const suggestion = useMemo<FloatingRovoButtonSuggestion | null>(() => {
		if (state === "hidden") {
			return null;
		}

		return {
			id: `rovo-button-proactive-suggestion-demo-${run}-${state}`,
			label: state === "accepted" ? "Suggestion accepted" : "Summarize RFP requirements",
			ariaLabel: state === "accepted"
				? "Proactive suggestion accepted"
				: "Accept proactive suggestion",
			onSelect: accept,
			onDismiss: hide,
		};
	}, [accept, hide, run, state]);

	return useMemo(() => ({ suggestion, show, hide }), [hide, show, suggestion]);
}
