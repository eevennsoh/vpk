"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import type { ProvenanceEdge, ProvenanceSourceId } from "./sources";

export type ProvenanceFocus =
	| { kind: "row"; id: SuggestionFieldId; transient: boolean }
	| { kind: "source"; id: ProvenanceSourceId; transient: boolean }
	| { kind: "none" };

export interface ProvenanceHighlight {
	focus: ProvenanceFocus;
	/** Edges drawn at full strength. Only pending suggestions keep their connectors. */
	activeEdges: readonly ProvenanceEdge[];
	/** Edges for pending suggestions, drawn as a faint resting map. */
	pendingEdges: readonly ProvenanceEdge[];
	isRowLit: (id: SuggestionFieldId) => boolean;
	isSourceLit: (id: ProvenanceSourceId) => boolean;
	/** True while something is lit, so the rest of the map can recede. */
	dimsOthers: boolean;
	pinnedSource: ProvenanceSourceId | null;
	/** The row whose "why" popover is open keeps the map, even after the pointer moves into the popover. */
	setWhyRow: (id: SuggestionFieldId | null) => void;
	togglePinnedSource: (id: ProvenanceSourceId) => void;
}

/**
 * Resolves which suggestion or source the map is about right now. Pointer hover is transient and wins;
 * keyboard focus and source pins persist; with nothing chosen, the first pending suggestion is the
 * resting selection so the map always tells one story at a time instead of drawing every curve.
 */
export function useProvenanceHighlight(review: SuggestionReview, edges: readonly ProvenanceEdge[], mapRef: RefObject<HTMLElement | null>): ProvenanceHighlight {
	const [hoverRow, setHoverRow] = useState<SuggestionFieldId | null>(null);
	const [whyRow, setWhyRow] = useState<SuggestionFieldId | null>(null);
	const [focusRow, setFocusRow] = useState<SuggestionFieldId | null>(null);
	const [hoverSource, setHoverSource] = useState<ProvenanceSourceId | null>(null);
	const [pinnedSource, setPinnedSource] = useState<ProvenanceSourceId | null>(null);

	const { decisionOf, pending } = review;

	// Delegated listeners: pointer and focus only steer the decorative map, so rows stay plain list items
	// and every real action lives on the buttons inside them.
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		const closest = (target: EventTarget | null, attribute: "provRow" | "provSource") => {
			const selector = attribute === "provRow" ? "[data-prov-row]" : "[data-prov-source]";
			const element = target instanceof Element ? target.closest<HTMLElement>(selector) : null;
			return element?.dataset[attribute] ?? null;
		};
		const onOver = (event: PointerEvent) => {
			setHoverRow(closest(event.target, "provRow") as SuggestionFieldId | null);
			setHoverSource(closest(event.target, "provSource") as ProvenanceSourceId | null);
		};
		const onLeave = () => {
			setHoverRow(null);
			setHoverSource(null);
		};
		const onFocusIn = (event: FocusEvent) => {
			const row = closest(event.target, "provRow") as SuggestionFieldId | null;
			if (row) setFocusRow(row);
		};
		map.addEventListener("pointerover", onOver);
		map.addEventListener("pointerleave", onLeave);
		map.addEventListener("focusin", onFocusIn);
		return () => {
			map.removeEventListener("pointerover", onOver);
			map.removeEventListener("pointerleave", onLeave);
			map.removeEventListener("focusin", onFocusIn);
		};
	}, [mapRef]);

	return useMemo(() => {
		const isPending = (id: SuggestionFieldId) => decisionOf(id) === "pending";
		const pendingEdges = edges.filter((edge) => isPending(edge.suggestionId));
		const restingRow = focusRow != null && isPending(focusRow) ? focusRow : pending[0]?.id;

		let focus: ProvenanceFocus = { kind: "none" };
		if (whyRow != null && isPending(whyRow)) focus = { kind: "row", id: whyRow, transient: true };
		else if (hoverRow != null && isPending(hoverRow)) focus = { kind: "row", id: hoverRow, transient: true };
		else if (hoverSource != null) focus = { kind: "source", id: hoverSource, transient: true };
		else if (pinnedSource != null) focus = { kind: "source", id: pinnedSource, transient: false };
		else if (restingRow != null) focus = { kind: "row", id: restingRow, transient: false };

		const activeEdges = focus.kind === "row"
			? pendingEdges.filter((edge) => edge.suggestionId === focus.id)
			: focus.kind === "source"
				? pendingEdges.filter((edge) => edge.sourceId === focus.id)
				: [];
		const litRows = new Set<SuggestionFieldId>(activeEdges.map((edge) => edge.suggestionId));
		const litSources = new Set<ProvenanceSourceId>(activeEdges.map((edge) => edge.sourceId));
		if (focus.kind === "row") litRows.add(focus.id);
		if (focus.kind === "source") litSources.add(focus.id);

		return {
			focus,
			activeEdges,
			pendingEdges,
			isRowLit: (id) => litRows.has(id),
			isSourceLit: (id) => litSources.has(id),
			dimsOthers: focus.kind !== "none",
			pinnedSource,
			setWhyRow,
			togglePinnedSource: (id) => setPinnedSource((current) => (current === id ? null : id)),
		};
	}, [decisionOf, edges, focusRow, hoverRow, hoverSource, pending, pinnedSource, whyRow]);
}
