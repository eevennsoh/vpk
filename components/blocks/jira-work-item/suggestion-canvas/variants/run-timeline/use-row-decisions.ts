"use client";

import { useEffect, useRef, type MouseEvent, type RefObject } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import { motionDuration } from "@/lib/motion";

/**
 * A pointer decision holds the row's controls still for one beat, the same beat the footer's swap uses.
 * A double-click on ✓ cannot Undo itself, a double-click on Undo cannot re-accept, and a second click cannot land
 * on whichever row slid up under the pointer. Keyboard activation (click detail 0) is never held.
 */
const REPEAT_GUARD_MS = motionDuration.slower * 1000;

type Action = "accept" | "dismiss" | "undo";
type FocusTarget = "accept" | "undo" | "panel";

const TARGET_SELECTOR: Record<Exclude<FocusTarget, "panel">, (id: SuggestionFieldId) => string> = {
	accept: (id) => `[data-block=pending][data-field="${id}"] [data-accept]`,
	undo: (id) => `[data-block=receipt][data-field="${id}"] [data-undo]`,
};

/**
 * Runs row decisions for the panel: guards repeat clicks, and hands focus on when the pressed button folds away.
 * Keyboard users land on the control that reverses what they did (Undo after a decision, Accept after an Undo).
 * Pointer users land on the panel itself, so no tooltip or pressed tint wakes up under the cursor.
 */
export function useRowDecisions(panelRef: RefObject<HTMLElement | null>, actions: Readonly<Record<Action, (id: SuggestionFieldId) => void>>) {
	const lastPointerDecision = useRef(Number.NEGATIVE_INFINITY);
	const handoff = useRef<{ id: SuggestionFieldId; target: FocusTarget } | null>(null);

	// Runs after every commit; the row that will hold focus mounts in the same commit as the decision.
	useEffect(() => {
		const pending = handoff.current;
		const panel = panelRef.current;
		if (!pending || !panel) return;
		handoff.current = null;
		const next = pending.target === "panel" ? panel : panel.querySelector<HTMLElement>(TARGET_SELECTOR[pending.target](pending.id));
		next?.focus({ preventScroll: true });
	});

	return (action: Action, id: SuggestionFieldId, event: MouseEvent<HTMLButtonElement>) => {
		const pointer = event.detail > 0;
		if (pointer) {
			const now = performance.now();
			if (event.detail > 1 || now - lastPointerDecision.current < REPEAT_GUARD_MS) return;
			lastPointerDecision.current = now;
		}
		const active = document.activeElement;
		const keyboard = !pointer || (active instanceof HTMLElement && active.matches(":focus-visible"));
		if (panelRef.current?.contains(active)) {
			handoff.current = { id, target: keyboard ? (action === "undo" ? "accept" : "undo") : "panel" };
		}
		actions[action](id);
	};
}
