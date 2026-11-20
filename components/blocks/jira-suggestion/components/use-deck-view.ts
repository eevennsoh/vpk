"use client";

import { useEffect, useState } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";

import { FADE_OUT } from "./constants";
import type { CardExit } from "./suggestion-card";
import type { Deck, SwipeDirection } from "./use-deck";

/**
 * Which way the popover's cards are laid out, and the bookkeeping that makes the switch continuous: the list keeps
 * its order while open, decided cards gathering into the stack stay drawn (hidden behind the last sheet) until they
 * have landed, and every card that leaves is told how to go.
 */
export function useDeckView(feed: SuggestionFeed, deck: Deck, floatingView?: "stack" | "list") {
	const [listBase, setListBase] = useState<readonly SuggestionFieldId[] | null>(null);
	const [gathering, setGathering] = useState<readonly SuggestionFieldId[]>([]);
	const [exitKind, setExitKind] = useState<CardExit | null>(null);
	const [returning, setReturning] = useState<{ ids: readonly SuggestionFieldId[]; direction: SwipeDirection } | null>(null);

	// A re-run's finds join the list at the top. Pending cards and decisions from the current review keep their place.
	const visibleIds = [...deck.order, ...deck.reviewed].map((suggestion) => suggestion.id);
	if (floatingView === "list" && listBase === null) setListBase(visibleIds);
	else if (floatingView === "stack" && listBase !== null) setListBase(null);
	const listIds = [...visibleIds.filter((id) => !listBase?.includes(id)), ...(listBase ?? []).filter((id) => visibleIds.includes(id))];

	/** A decided card has landed behind the last sheet and faded there: removing it now is invisible. */
	const release = (id: SuggestionFieldId) => {
		setExitKind("silent");
		setGathering((current) => (current.includes(id) ? current.filter((other) => other !== id) : current));
	};

	// A non-swipe exit only applies to the cards removed alongside it; later removals are swipes again.
	useEffect(() => {
		if (exitKind == null) return undefined;
		const timer = window.setTimeout(() => setExitKind(null), FADE_OUT.duration * 1000 * 2);
		return () => window.clearTimeout(timer);
	}, [exitKind]);

	const unpack = () => {
		setListBase(visibleIds);
		setGathering([]);
	};

	const collapse = () => {
		const pending = listIds.filter((id) => feed.review.decisionOf(id) === "pending");
		deck.reform(pending);
		if (pending.length > 0) setGathering(listIds.filter((id) => feed.review.decisionOf(id) !== "pending"));
		// Nothing left to stack: the decided rows dissolve as they gather, and the caught-up state takes their place.
		else setExitKind("fade");
		setListBase(null);
	};

	/** Undo in the stack: the card (or a bulk decision's cards) comes back from the side it left by. */
	const undo = () => {
		const last = deck.lastDecision;
		if (!last) return;
		setReturning({ ids: last.ids, direction: last.decision });
		deck.undo();
	};

	const bulkAccept = deck.lastDecision?.bulk && deck.lastDecision.decision === "accept";
	return { listed: listBase !== null, listIds, gathering, exitKind: exitKind ?? (bulkAccept ? "silent" : deck.exitDirection), returning, unpack, collapse, undo, release };
}
