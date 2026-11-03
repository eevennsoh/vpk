"use client";

import { cn } from "@/lib/utils";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { SourceMark } from "./source-mark";
import { joinTitles, type ProvenanceSource } from "./sources";

interface SourceCardProps {
	source: ProvenanceSource;
	/** Pending suggestions this source supports. */
	supports: readonly WorkItemSuggestion[];
	lit: boolean;
	dimmed: boolean;
	pinned: boolean;
	onTogglePin: () => void;
}

/** One evidence source. Pressing it pins the map to the suggestions it supports. */
export function SourceCard({ source, supports, lit, dimmed, pinned, onTogglePin }: Readonly<SourceCardProps>) {
	const supportText = supports.length > 0 ? `Supports ${joinTitles(supports.map((item) => item.label.toLowerCase()))}` : "No pending suggestions";
	return (
		<button
			aria-label={`${source.title}, ${source.place}. ${supportText}.`}
			aria-pressed={pinned}
			className={cn(
				"group/source relative flex w-full items-center gap-2.5 rounded-lg border bg-surface px-2.5 py-2 text-left outline-none transition-[border-color,opacity] duration-normal ease-out-practical focus-visible:ring-2 focus-visible:ring-border-focused focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
				lit ? "border-border-selected" : "border-border hover:border-border-bold",
				pinned ? "bg-bg-selected" : null,
				dimmed ? "opacity-60" : "opacity-100",
			)}
			data-prov-source={source.id}
			onClick={onTogglePin}
			type="button"
		>
			<span className="shrink-0"><SourceMark kind={source.kind} size="xsmall" /></span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="text-xs/4 font-medium text-text">{source.title}</span>
				<span className="text-[11px]/4 text-text-subtlest">{source.place} · {source.meta}</span>
			</span>
		</button>
	);
}
