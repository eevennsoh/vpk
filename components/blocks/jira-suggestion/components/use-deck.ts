"use client";

import { useEffect, useState } from "react";

import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";

import { RECEIPT_MS } from "./constants";

export type SwipeDirection = "accept" | "dismiss";

interface DeckDecision {
	ids: readonly SuggestionFieldId[];
	decision: SwipeDirection;
	bulk?: boolean;
}

/** A short confirmation of the latest change, shown where the progress line normally sits. */
export interface DeckReceipt {
	key: number;
	kind: SwipeDirection | "nothing-new";
	/** What was decided: one field's label, or "N suggestions" for a bulk action. Empty for "nothing new". */
	subject: string;
}

export interface Deck {
	/** Pending suggestions in deck order; the first is the top card. */
	order: readonly WorkItemSuggestion[];
	/** Decided suggestions, most recent decision first. */
	reviewed: readonly WorkItemSuggestion[];
	total: number;
	/** Which way the most recently decided card leaves. */
	exitDirection: SwipeDirection;
	lastDecision: DeckDecision | null;
	/** How many decisions (a bulk action counts once) Undo can still step back through. */
	undoDepth: number;
	receipt: DeckReceipt | null;
	decide: (id: SuggestionFieldId, decision: SwipeDirection) => void;
	decideAll: (decision: SwipeDirection) => void;
	/** Step back through the decision history, one decision (or one bulk action) at a time. */
	undo: () => void;
	/** Return one decided suggestion to pending, wherever it sits in the history. */
	restore: (id: SuggestionFieldId) => void;
	/** Re-form the stack from the list: these pending suggestions first, in this order, with a freshly rolled fan. */
	reform: (ids: readonly SuggestionFieldId[]) => void;
	/** Bumps whenever the deck should re-form: a new top card, a re-run landing, the list gathering back. */
	formation: string;
	/** Everything was decided, then a check from there found nothing new. */
	quietCheck: boolean;
	/** What Undo would bring back, named: "Undo dismissing Due date", "Undo accepting 6 suggestions". */
	undoLabel: string | null;
	/** Plain-language summary of the last change, for a polite live region. */
	announcement: string;
}

const subjectOf = (labels: readonly string[]) => (labels.length === 1 ? labels[0] : `${labels.length} suggestions`);
const undoLabelOf = (entry: DeckDecision, labelOf: (id: SuggestionFieldId) => string) =>
	`Undo ${entry.decision === "accept" ? "accepting" : "dismissing"} ${subjectOf(entry.ids.map(labelOf))}`;

/**
 * Deck order and decision history over the shared review. A re-run's finds go to the top of the deck, since the
 * reviewer just asked for them; undo returns cards to the top in the order they left.
 */
export function useDeck(feed: SuggestionFeed, onAccepted: (ids: readonly SuggestionFieldId[]) => void): Deck {
	const { review } = feed;
	const [history, setHistory] = useState<readonly DeckDecision[]>([]);
	const [front, setFront] = useState<readonly SuggestionFieldId[]>([]);
	const [exitDirection, setExitDirection] = useState<SwipeDirection>("accept");
	const [announcement, setAnnouncement] = useState("");
	const [receipt, setReceipt] = useState<DeckReceipt | null>(null);
	const [seenRuns, setSeenRuns] = useState(feed.runs.length);
	const [gathers, setGathers] = useState(0);
	const [emptied, setEmptied] = useState<number | null>(null);

	useEffect(() => {
		if (!receipt) return undefined;
		const timer = window.setTimeout(() => setReceipt(null), RECEIPT_MS);
		return () => window.clearTimeout(timer);
	}, [receipt]);

	const nextReceipt = (kind: DeckReceipt["kind"], subject: string) => setReceipt((current) => ({ key: (current?.key ?? 0) + 1, kind, subject }));

	if (seenRuns !== feed.runs.length) {
		setSeenRuns(feed.runs.length);
		const ids = feed.runs.at(-1)?.ids ?? [];
		if (ids.length === 0) {
			setAnnouncement("No new suggestions.");
			nextReceipt("nothing-new", "");
		} else {
			setFront(ids);
			setAnnouncement(`${ids.length} new ${ids.length === 1 ? "suggestion" : "suggestions"} on top of the stack.`);
		}
	}

	const pending = review.pending;
	const order = [
		...front.flatMap((id) => pending.filter((suggestion) => suggestion.id === id)),
		...pending.filter((suggestion) => !front.includes(suggestion.id)),
	];
	// The run count when the deck last emptied, so a check from the caught-up state that finds nothing can say so.
	const emptiedAt = order.length === 0 ? (emptied ?? feed.runs.length) : null;
	if (emptiedAt !== emptied) setEmptied(emptiedAt);
	const quietCheck = emptiedAt != null && feed.runs.length > emptiedAt && feed.runs.at(-1)?.ids.length === 0;
	const decidedIds = history.flatMap((entry) => entry.ids).toReversed();
	const reviewed = [...new Set(decidedIds)].flatMap((id) => review.suggestions.filter((suggestion) => suggestion.id === id && review.decisionOf(id) !== "pending"));
	const labelOf = (id: SuggestionFieldId) => review.suggestions.find((suggestion) => suggestion.id === id)?.label ?? id;

	const record = (entry: DeckDecision) => {
		setExitDirection(entry.decision);
		setHistory((current) => [...current, entry]);
		nextReceipt(entry.decision, subjectOf(entry.ids.map(labelOf)));
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
		record({ ids, decision, bulk: true });
		setAnnouncement(`${decision === "accept" ? "Accepted" : "Dismissed"} ${ids.length} suggestions.`);
	};

	const bringBack = (entry: DeckDecision) => {
		for (const id of entry.ids) review.undo(id);
		setFront(entry.ids);
		setReceipt(null);
		setAnnouncement(`Restored ${subjectOf(entry.ids.map(labelOf))}.`);
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

	return {
		order,
		reviewed,
		total: review.suggestions.length,
		exitDirection,
		lastDecision: history.at(-1) ?? null,
		undoDepth: history.length,
		receipt,
		decide,
		decideAll,
		undo,
		restore,
		reform: (ids) => {
			setFront(ids);
			setGathers((count) => count + 1);
		},
		formation: `${order[0]?.id ?? ""}:${feed.runs.length}:${order.length}:${gathers}`,
		quietCheck,
		undoLabel: history.length > 0 ? undoLabelOf(history[history.length - 1], labelOf) : null,
		announcement,
	};
}
