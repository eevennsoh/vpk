"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";

import { arrivalRunOf, pendingDeck } from "./stack-order";

/** A short beat after load before the first card offers itself. */
const FIRST_POP_MS = 700;
/** After a run delivers, the new cards slide into the deck first; then the top new one rises. */
const ARRIVAL_POP_MS = 650;
/** How long an ignored card stays up before settling back into the stack. */
const IDLE_PENDING_MS = 15000;
/** A decided card lingers just long enough to offer Undo, then clears. */
const IDLE_DECIDED_MS = 4500;
/** After an ignored card settles on its own, the stack offers once more after a long quiet spell, then stops. */
const REOFFER_MS = 60000;

export type HoldReason = "pointer" | "focus" | "why";

export interface StackPeek {
	poppedId: SuggestionFieldId | null;
	/** The most recently popped card, kept after it settles so its exit can tell a tuck from a decision. */
	lastId: SuggestionFieldId | null;
	/** Lift a card out of the stack. Only one card is ever up. */
	pop: (id: SuggestionFieldId) => void;
	/** Settle the card back into the stack. */
	tuck: () => void;
	/** Pause or resume the auto-tuck timer for one reason; any active reason holds the card up. */
	hold: (reason: HoldReason, active: boolean) => void;
	/** Drop every hold: the surface that was being engaged (hovered, focused) just went away. */
	release: () => void;
	/** Polite announcement for the latest autonomous change. */
	announcement: string;
	/** False under reduced motion: the stack never moves on its own, it only shows a static count. */
	autonomous: boolean;
}

/**
 * Schedules the stack's occasional invitations: one card rises after a short beat on load, again whenever a re-run
 * delivers new suggestions, and once more after a long idle spell if the first was ignored. Never steals focus;
 * hovering, focusing or reading the reasoning holds the card up.
 */
export function useStackPeek(feed: SuggestionFeed, listOpen: boolean): StackPeek {
	const reducedMotion = useReducedMotion() ?? false;
	const autonomous = !reducedMotion;
	const [card, setCard] = useState<{ id: SuggestionFieldId | null; up: boolean }>({ id: null, up: false });
	const poppedId = card.up ? card.id : null;
	const [holds, setHolds] = useState<ReadonlySet<HoldReason>>(new Set());
	const [announcement, setAnnouncement] = useState("");
	/** Set when an ignored card settled by itself; cleared by any deliberate interaction. Allows one re-offer. */
	const [idleTucks, setIdleTucks] = useState(0);
	const reoffered = useRef(false);
	const arrivalRun = arrivalRunOf(feed);
	const poppedDecided = poppedId != null && feed.review.decisionOf(poppedId) !== "pending";

	const pop = useCallback((id: SuggestionFieldId) => {
		setHolds(new Set());
		setCard({ id, up: true });
	}, []);
	const tuck = useCallback(() => {
		setHolds(new Set());
		setCard((current) => (current.up ? { ...current, up: false } : current));
	}, []);
	const hold = useCallback((reason: HoldReason, active: boolean) => {
		setHolds((current) => {
			if (current.has(reason) === active) return current;
			const next = new Set(current);
			if (active) next.add(reason);
			else next.delete(reason);
			return next;
		});
	}, []);

	const release = useCallback(() => setHolds(new Set()), []);

	const offer = useEffectEvent((preferNew: boolean) => {
		if (!autonomous || listOpen || holds.size > 0) return;
		const deck = pendingDeck(feed);
		const next = (preferNew ? deck.find((suggestion) => feed.newIds.has(suggestion.id)) : null) ?? deck[0];
		if (!next) return;
		pop(next.id);
		setAnnouncement(`${preferNew ? "New suggestion" : "Suggestion"} for ${next.label}: ${next.valueText}`);
	});

	useEffect(() => {
		const timer = window.setTimeout(() => offer(false), FIRST_POP_MS);
		return () => window.clearTimeout(timer);
	}, []);

	useEffect(() => {
		if (arrivalRun <= 1) return undefined;
		const timer = window.setTimeout(() => offer(true), ARRIVAL_POP_MS);
		return () => window.clearTimeout(timer);
	}, [arrivalRun]);

	const holding = holds.size > 0;
	useEffect(() => {
		if (poppedId == null || holding) return undefined;
		const timer = window.setTimeout(() => {
			if (!poppedDecided) setIdleTucks((count) => count + 1);
			tuck();
		}, poppedDecided ? IDLE_DECIDED_MS : IDLE_PENDING_MS);
		return () => window.clearTimeout(timer);
	}, [holding, poppedDecided, poppedId, tuck]);

	const reoffer = useEffectEvent(() => {
		if (reoffered.current) return;
		reoffered.current = true;
		offer(false);
	});
	useEffect(() => {
		if (idleTucks === 0 || poppedId != null || listOpen) return undefined;
		const timer = window.setTimeout(reoffer, REOFFER_MS);
		return () => window.clearTimeout(timer);
	}, [idleTucks, listOpen, poppedId]);

	return { poppedId: listOpen ? null : poppedId, lastId: card.id, pop, tuck, hold, release, announcement, autonomous };
}
