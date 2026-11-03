"use client";

import { useEffect, useState } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";

import { FADE_OUT } from "./constants";
import type { CardExit } from "./suggestion-card";
import type { Deck, SwipeDirection } from "./use-deck";

/**
 * Which way the popover's cards are laid out, and the bookkeeping that makes the switch continuous: the list keeps
 * its order while open, decided cards gathering into the stack stay drawn (hidden behind the last sheet) until they
 * have landed, and every card that leaves is told how to go.
 */
export function useDeckView(feed: SuggestionFeed, deck: Deck) {
	const [listed, setListed] = useState(false);
	const [listBase, setListBase] = useState<readonly SuggestionFieldId[]>([]);
	const [gathering, setGathering] = useState<readonly SuggestionFieldId[]>([]);
	const [exitKind, setExitKind] = useState<CardExit | null>(null);
	const [returning, setReturning] = useState<{ ids: readonly SuggestionFieldId[]; direction: SwipeDirection } | null>(null);

	// A re-run's finds join the list at the top; everything else keeps its place, decided cards folding in place.
	const listIds = [...feed.review.suggestions.filter((suggestion) => !listBase.includes(suggestion.id)).map((suggestion) => suggestion.id), ...listBase];

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
		setListBase([...deck.order, ...deck.reviewed].map((suggestion) => suggestion.id));
		setGathering([]);
		setListed(true);
	};

	const collapse = () => {
		const pending = listIds.filter((id) => feed.review.decisionOf(id) === "pending");
		deck.reform(pending);
		if (pending.length > 0) setGathering(listIds.filter((id) => feed.review.decisionOf(id) !== "pending"));
		// Nothing left to stack: the decided rows dissolve as they gather, and the caught-up state takes their place.
		else setExitKind("fade");
		setListed(false);
	};

	/** Undo in the stack: the card (or a bulk decision's cards) comes back from the side it left by. */
	const undo = () => {
		const last = deck.lastDecision;
		if (!last) return;
		setReturning({ ids: last.ids, direction: last.decision });
		deck.undo();
	};

	return { listed, listIds, gathering, exitKind: exitKind ?? deck.exitDirection, returning, unpack, collapse, undo, release };
}
