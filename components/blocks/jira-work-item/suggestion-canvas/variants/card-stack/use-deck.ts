"use client";

import { useEffect, useState } from "react";

import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";

import { ARRIVAL_MS, RECEIPT_MS } from "./constants";

export type SwipeDirection = "accept" | "dismiss";

/** How a card arrives: back from an undo (from the side it left), as a new suggestion, or already in place. */
export type CardEntrance = SwipeDirection | "new" | null;

interface DeckDecision {
	ids: readonly SuggestionFieldId[];
	decision: SwipeDirection;
}

/** A short confirmation of the latest decision, shown where the progress line normally sits. */
export interface DeckReceipt {
	key: number;
	decision: SwipeDirection;
	/** What was decided: one field's label, or "N suggestions" for a bulk action. */
	subject: string;
}

/** A re-run that just landed new cards behind the top one, until the reviewer reaches them or it times out. */
export interface DeckArrival {
	key: number;
	ids: readonly SuggestionFieldId[];
}

export interface Deck {
	/** Pending suggestions in deck order; the first is the top card. */
	order: readonly WorkItemSuggestion[];
	/** Decided suggestions, most recent decision first. */
	reviewed: readonly WorkItemSuggestion[];
	total: number;
	/** Which way the most recently decided cards leave. */
	exitDirection: SwipeDirection;
	entranceOf: (id: SuggestionFieldId) => CardEntrance;
	lastDecision: DeckDecision | null;
	receipt: DeckReceipt | null;
	arrival: DeckArrival | null;
	/** Move the latest arrivals to the top of the deck, in the order the agent found them. */
	reviewArrivalsFirst: () => void;
	decide: (id: SuggestionFieldId, decision: SwipeDirection) => void;
	decideAll: (decision: SwipeDirection) => void;
	/** Step back through the decision history, one decision (or one bulk action) at a time. */
	undo: () => void;
	/** Return one decided suggestion to the top of the deck, wherever it sits in the history. */
	restore: (id: SuggestionFieldId) => void;
	/** Plain-language summary of the last change, for a polite live region. */
	announcement: string;
}

function receiptSubject(labels: readonly string[]): string {
	return labels.length === 1 ? labels[0] : `${labels.length} suggestions`;
}

/**
 * Deck order and decision history over the shared review. Undo returns cards to the top of the deck
 * in the order they left, so the reviewer sees the card they just decided again.
 */
export function useDeck(feed: SuggestionFeed, onAccepted: (ids: readonly SuggestionFieldId[]) => void): Deck {
	const { review } = feed;
	const [history, setHistory] = useState<readonly DeckDecision[]>([]);
	const [front, setFront] = useState<readonly SuggestionFieldId[]>([]);
	const [exitDirection, setExitDirection] = useState<SwipeDirection>("accept");
	const [returning, setReturning] = useState<DeckDecision | null>(null);
	const [announcement, setAnnouncement] = useState("");
	const [receipt, setReceipt] = useState<DeckReceipt | null>(null);
	const [announcedRuns, setAnnouncedRuns] = useState(feed.runs.length);
	const [arrival, setArrival] = useState<DeckArrival | null>(null);

	useEffect(() => {
		if (!receipt) return undefined;
		const timer = window.setTimeout(() => setReceipt(null), RECEIPT_MS);
		return () => window.clearTimeout(timer);
	}, [receipt]);

	useEffect(() => {
		if (!arrival) return undefined;
		const timer = window.setTimeout(() => setArrival(null), ARRIVAL_MS);
		return () => window.clearTimeout(timer);
	}, [arrival]);

	if (announcedRuns !== feed.runs.length) {
		setAnnouncedRuns(feed.runs.length);
		const ids = feed.runs.at(-1)?.ids ?? [];
		setAnnouncement(ids.length === 0 ? "No new suggestions." : `${ids.length} new ${ids.length === 1 ? "suggestion" : "suggestions"} added to the back of the deck.`);
		setArrival((current) => (ids.length === 0 ? null : { key: (current?.key ?? 0) + 1, ids }));
	}

	const pending = review.pending;
	const order = [
		...front.flatMap((id) => pending.filter((suggestion) => suggestion.id === id)),
		...pending.filter((suggestion) => !front.includes(suggestion.id)),
	];
	const decidedIds = history.flatMap((entry) => entry.ids).toReversed();
	const reviewed = [...new Set(decidedIds)].flatMap((id) => review.suggestions.filter((suggestion) => suggestion.id === id && review.decisionOf(id) !== "pending"));
	const labelOf = (id: SuggestionFieldId) => review.suggestions.find((suggestion) => suggestion.id === id)?.label ?? id;

	const record = (entry: DeckDecision) => {
		setExitDirection(entry.decision);
		setReturning(null);
		setHistory((current) => [...current, entry]);
		setReceipt((current) => ({ key: (current?.key ?? 0) + 1, decision: entry.decision, subject: receiptSubject(entry.ids.map(labelOf)) }));
		if (entry.decision === "accept") onAccepted(entry.ids);
	};

	const decide = (id: SuggestionFieldId, decision: SwipeDirection) => {
		if (decision === "accept") review.accept(id);
		else review.dismiss(id);
		record({ ids: [id], decision });
		setAnnouncement(`${decision === "accept" ? "Accepted" : "Dismissed"} ${labelOf(id)}.`);
	};

	const decideAll = (decision: SwipeDirection) => {
		const ids = pending.map((suggestion) => suggestion.id);
		if (ids.length === 0) return;
		if (decision === "accept") review.acceptAll();
		else review.dismissAll();
		record({ ids, decision });
		setAnnouncement(`${decision === "accept" ? "Accepted" : "Dismissed"} ${ids.length} suggestions.`);
	};

	const bringBack = (entry: DeckDecision) => {
		for (const id of entry.ids) review.undo(id);
		setFront(entry.ids);
		setReturning(entry);
		setReceipt(null);
		setAnnouncement(`Restored ${entry.ids.length === 1 ? labelOf(entry.ids[0]) : `${entry.ids.length} suggestions`} to the deck.`);
	};

	const undo = () => {
		const last = history.at(-1);
		if (!last) return;
		setHistory((current) => current.slice(0, -1));
		bringBack(last);
	};

	const restore = (id: SuggestionFieldId) => {
		const entry = history.findLast((candidate) => candidate.ids.includes(id));
		if (!entry) return;
		setHistory((current) => current.map((candidate) => (candidate === entry ? { ...candidate, ids: candidate.ids.filter((other) => other !== id) } : candidate)).filter((candidate) => candidate.ids.length > 0));
		bringBack({ ids: [id], decision: entry.decision });
	};

	// The arrival note stands only while some of its cards still wait behind the top one.
	const behind = order.slice(1).map((suggestion) => suggestion.id);
	const waiting = arrival ? arrival.ids.filter((id) => behind.includes(id)) : [];
	const liveArrival = arrival && waiting.length > 0 ? { key: arrival.key, ids: waiting } : null;
	const reviewArrivalsFirst = () => {
		if (!liveArrival) return;
		setFront(liveArrival.ids);
		setReturning(null);
		setArrival(null);
		setAnnouncement(`${liveArrival.ids.length === 1 ? labelOf(liveArrival.ids[0]) : `${liveArrival.ids.length} new suggestions`} moved to the top of the deck.`);
	};

	const entranceOf = (id: SuggestionFieldId): CardEntrance => {
		if (returning?.ids.includes(id)) return returning.decision;
		return feed.newIds.has(id) ? "new" : null;
	};

	return {
		order,
		reviewed,
		total: review.suggestions.length,
		exitDirection,
		entranceOf,
		lastDecision: history.at(-1) ?? null,
		receipt,
		arrival: liveArrival,
		reviewArrivalsFirst,
		decide,
		decideAll,
		undo,
		restore,
		announcement,
	};
}
