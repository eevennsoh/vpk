"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { cn } from "@/lib/utils";

import { CardValue } from "./card-value";

export type CardHeights = Readonly<Partial<Record<SuggestionFieldId, number>>>;

/** A quiet discovery mark for a suggestion the latest re-run found. */
export function NewTag() {
	return (
		<span className="inline-flex h-4 shrink-0 items-center gap-1 rounded-sm bg-bg-discovery px-1 text-[11px] leading-4 font-semibold text-text-discovery">
			<span aria-hidden="true" className="size-1 rounded-full bg-icon-discovery" />
			New
		</span>
	);
}

export interface CardFaceProps {
	suggestion: WorkItemSuggestion;
	/** Found by the latest re-run and not yet seen. */
	isNew?: boolean;
	/** The label row. Defaults to the field label; the top card swaps in its swipe hints here. */
	label?: ReactNode;
	/** The bottom row: the Why affordance on the top card, an empty row of the same height elsewhere. */
	why?: ReactNode;
	className?: string;
}

/** One card's content: field label (with a New mark for fresh finds), the full value, and the Why row. */
export function CardFace({ suggestion, isNew = false, label, why, className }: Readonly<CardFaceProps>) {
	return (
		<div className={cn("flex flex-col gap-2.5 px-4 pt-3 pb-2.5", className)}>
			<div className="flex flex-col gap-1.5">
				<div className="flex min-h-5 items-center gap-2 text-xs font-medium">
					<span className="grid min-w-0 flex-1 items-center">
						{label ?? <span className="text-text-subtle">{suggestion.label}</span>}
					</span>
					{isNew ? <NewTag /> : null}
				</div>
				<CardValue value={suggestion.value} />
			</div>
			<div className="mt-auto flex h-6 items-center">{why}</div>
		</div>
	);
}

/**
 * Lays every suggestion out invisibly at card width and reports each one's natural height, so the top card can
 * size to its own content and animate between heights instead of padding every card to the tallest.
 */
export function CardMeasure({ suggestions, newIds, onHeights }: Readonly<{ suggestions: readonly WorkItemSuggestion[]; newIds: ReadonlySet<SuggestionFieldId>; onHeights: (heights: CardHeights) => void }>) {
	const ref = useRef<HTMLDivElement>(null);
	// The feed hands out a fresh set each render; re-measure only when its members change.
	const newKey = [...newIds].join(",");
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return undefined;
		let last = "";
		const measure = () => {
			const heights: Partial<Record<SuggestionFieldId, number>> = {};
			for (const child of element.children) {
				const id = (child as HTMLElement).dataset.id as SuggestionFieldId | undefined;
				const height = (child as HTMLElement).offsetHeight;
				if (id && height > 0) heights[id] = height;
			}
			const key = JSON.stringify(heights);
			if (key === last) return;
			last = key;
			onHeights(heights);
		};
		measure();
		const observer = new ResizeObserver(measure);
		for (const child of element.children) observer.observe(child);
		return () => observer.disconnect();
	}, [onHeights, suggestions, newKey]);
	return (
		<div aria-hidden="true" className="pointer-events-none invisible absolute inset-x-4 top-0 h-0" inert ref={ref}>
			{suggestions.map((suggestion) => (
				<div className="absolute inset-x-0 top-0" data-id={suggestion.id} key={suggestion.id}>
					<CardFace isNew={newIds.has(suggestion.id)} suggestion={suggestion} />
				</div>
			))}
		</div>
	);
}
