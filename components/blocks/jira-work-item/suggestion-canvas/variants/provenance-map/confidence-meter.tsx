import { cn } from "@/lib/utils";

import type { SuggestionConfidence } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

const FILLED: Readonly<Record<SuggestionConfidence, number>> = { high: 3, medium: 2 };
const LABEL: Readonly<Record<SuggestionConfidence, string>> = { high: "High", medium: "Medium" };
const BAR_HEIGHTS = ["h-1.5", "h-2", "h-2.5"] as const;

/** Rising three-bar meter with a word beside it, so confidence never relies on the bars alone. */
export function ConfidenceMeter({ confidence, wording = "short", className }: Readonly<{ confidence: SuggestionConfidence; wording?: "short" | "full"; className?: string }>) {
	const filled = FILLED[confidence];
	return (
		<span className={cn("inline-flex items-center gap-1.5 text-xs text-text-subtlest", className)}>
			<span aria-hidden="true" className="flex items-end gap-0.5">
				{BAR_HEIGHTS.map((height, index) => (
					<span className={cn("w-[3px] rounded-full", height, index < filled ? "bg-icon-subtle" : "bg-bg-neutral-hovered")} key={height} />
				))}
			</span>
			<span>{LABEL[confidence]}<span className={wording === "full" ? undefined : "sr-only"}> confidence</span></span>
		</span>
	);
}

export function confidenceLabel(confidence: SuggestionConfidence): string {
	return `${LABEL[confidence]} confidence`;
}
