"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { ButterAgentSelectorGallery } from "./butter-agent-selector-gallery";
import { ButterGalleryWorkItem } from "./butter-gallery-work-item";

/** Where AI suggestions surface: the global Rovo review panel, a dropdown (the agent selector), or inline beside the details. */
export type ButterAiSuggestionsView = "global" | "dropdown" | "inline";

/** How long the Dropdown tab shows the agent selector working out its recommendation. */
const RECOMMEND_AGENT_MS = 3000;
/** The agent the second Dropdown example last used, which is also the one it recommends. */
const LAST_USED_AGENT_ID = "claude-code";

const VIEWS: readonly { value: ButterAiSuggestionsView; label: string }[] = [
	{ value: "global", label: "Global" },
	{ value: "dropdown", label: "Dropdown" },
	{ value: "inline", label: "Inline" },
];

export function ButterAiSuggestionsControls({ view, onViewChange }: Readonly<{ view: ButterAiSuggestionsView; onViewChange: (view: ButterAiSuggestionsView) => void }>) {
	return (
		<ToggleGroup aria-label="AI suggestions surface" onValueChange={(values) => { const next = VIEWS.find((item) => item.value === values[0]); if (next) onViewChange(next.value); }} size="sm" value={[view]} variant="outline">
			{VIEWS.map((item) => <ToggleGroupItem key={item.value} value={item.value}>{item.label}</ToggleGroupItem>)}
		</ToggleGroup>
	);
}

/** The AI suggestions gallery item, in whichever surface its tabs select. */
export function ButterAiSuggestionsGallery({ view, open, onClose }: Readonly<{ view: ButterAiSuggestionsView; open: boolean; onClose: () => void }>) {
	if (view === "dropdown") {
		// The agent selector, where recommended agents can later be marked as AI suggested.
		return (
			<div className="pointer-events-none absolute inset-x-0 top-12 bottom-0 flex justify-center overflow-y-auto px-4 pt-4 pb-56">
				<div className="my-auto flex w-full flex-col items-center justify-center gap-6 md:flex-row md:items-start">
					<h1 className="sr-only">AI suggestions in the agent selector</h1>
					{/* Side by side: a fresh recommendation, and one that turns out to be the agent last used. */}
					<div className="flex w-80 max-w-full shrink-0 flex-col items-center gap-2">
						<h2 className="text-center text-xs font-semibold text-text-subtlest">New recommendation</h2>
						<ButterAgentSelectorGallery cloudOnly label="Agent selector with AI suggestions" recommendAfterMs={RECOMMEND_AGENT_MS} />
					</div>
					<div className="flex w-80 max-w-full shrink-0 flex-col items-center gap-2">
						<h2 className="text-center text-xs font-semibold text-text-subtlest">Recommended is last used</h2>
						<ButterAgentSelectorGallery cloudOnly label="Agent selector where the recommendation is the last used agent" recentAgentId={LAST_USED_AGENT_ID} recommendAfterMs={RECOMMEND_AGENT_MS} />
					</div>
				</div>
			</div>
		);
	}
	// Global reviews in the floating panel; Inline shows the first suggestion straight away above the details. Each tab
	// is its own instance, so switching replays it from the start.
	return <ButterGalleryWorkItem aiSuggestionSurface={view === "inline" ? "inline" : "floating"} key={view} open={open} onClose={onClose} showAiSuggestions />;
}
