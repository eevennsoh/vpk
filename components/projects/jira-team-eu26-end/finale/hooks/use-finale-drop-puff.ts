"use client";

import { useCallback, useEffect, useRef } from "react";

import { waitForFinaleDropLanding } from "@/components/projects/jira-team-eu26-end/finale/lib/finale-confetti-target";
import type { FinaleConfetti } from "@/components/projects/jira-team-eu26-end/finale/lib/play-finale-confetti";

/**
 * Puffs a small burst out from under the cards one drop brought into Done, on
 * the frame they touch down (see `waitForFinaleDropLanding`). Each drop waits
 * on its own: a quick second drop neither cancels nor delays the first's puff,
 * so each lands on its own cards, and neither holds up the finale. Unmounting
 * abandons every wait still pending; a landing that never settles is skipped.
 */
export function useFinaleDropPuff(confetti: FinaleConfetti): (codes: readonly string[]) => void {
	const waitsRef = useRef<Set<AbortController> | null>(null);
	useEffect(() => {
		const waits = new Set<AbortController>();
		waitsRef.current = waits;
		return () => {
			waitsRef.current = null;
			for (const wait of waits) wait.abort();
			waits.clear();
		};
	}, []);
	return useCallback((codes: readonly string[]) => {
		const waits = waitsRef.current;
		if (!waits || codes.length === 0) return;
		const wait = new AbortController();
		waits.add(wait);
		void waitForFinaleDropLanding(codes, wait.signal).then((landing) => {
			waits.delete(wait);
			if (landing && !wait.signal.aborted) confetti.play({ size: "small", landing });
		});
	}, [confetti]);
}
