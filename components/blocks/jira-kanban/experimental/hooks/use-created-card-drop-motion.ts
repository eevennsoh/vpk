"use client";

import { useCallback, useLayoutEffect, useMemo, useState, type RefObject } from "react";
import { animateIssueSolitaireDrop } from "../lib/issue-solitaire-drop";
import type { JiraKanbanCreatedCardArrival } from "./use-created-card-arrival";

/** Both create targets reveal the final slots after their receipt's chip lands. */
export function useCreatedCardDropMotion({ arrival, boardRef, receiving, reducedMotion, onComplete }: Readonly<{
	arrival?: JiraKanbanCreatedCardArrival;
	boardRef: RefObject<HTMLElement | null>;
	receiving: boolean;
	reducedMotion: boolean;
	onComplete?: (id: number) => void;
}>) {
	const [inlineLandedId, setInlineLandedId] = useState<number>();
	const inlinePending = Boolean(arrival?.inlineDrop && !reducedMotion && inlineLandedId !== arrival.id);
	const onInlineLanded = useCallback(() => { if (arrival) setInlineLandedId(arrival.id); }, [arrival]);
	const resolveInlineLandingPoint = useCallback(() => {
		const code = arrival?.inlineDrop?.cardCodes[0];
		const issue = [...boardRef.current?.querySelectorAll<HTMLElement>("[data-issue-key]") ?? []]
			.find((node) => node.dataset.issueKey === code && node.dataset.boardColumnTitle === arrival?.columnTitle);
		const bounds = issue?.querySelector('[data-slot="jira-issue-surface"]')?.getBoundingClientRect();
		return bounds ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 } : null;
	}, [arrival, boardRef]);
	const presentedArrival = useMemo(() => arrival ? {
		...arrival,
		deferred: receiving,
		animatedCardCodes: [],
		...(inlinePending ? { pendingCardCodes: arrival.inlineDrop?.cardCodes } : {}),
	} : undefined, [arrival, inlinePending, receiving]);
	useLayoutEffect(() => {
		const root = boardRef.current;
		if (!arrival || receiving || inlinePending || !root) return;
		let cancelled = false;
		const stop = animateIssueSolitaireDrop(root, arrival.columnTitle, arrival.cardCodes, reducedMotion,
			() => { if (!cancelled) onComplete?.(arrival.id); }, arrival.glowColors ?? {});
		return () => { cancelled = true; stop(); };
	}, [arrival, boardRef, inlinePending, onComplete, receiving, reducedMotion]);
	return {
		arrival: presentedArrival,
		inlineFlight: inlinePending && arrival?.inlineDrop ? { drop: arrival.inlineDrop, onLanded: onInlineLanded, resolveLandingPoint: resolveInlineLandingPoint } : undefined,
	};
}
