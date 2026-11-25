"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { ButterAgentSelectorGallery } from "./butter-agent-selector-gallery";
import { ButterGalleryWorkItem } from "./butter-gallery-work-item";

/** Where AI suggestions surface: the global Rovo review panel, a dropdown (the agent selector), or inline beside the details. */
export type ButterAiSuggestionsView = "global" | "dropdown" | "inline";

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
				<div className="my-auto flex w-80 max-w-full shrink-0 flex-col items-center gap-2">
					<h1 className="sr-only">AI suggestions in the agent selector</h1>
					<ButterAgentSelectorGallery cloudOnly label="Agent selector with AI suggestions" />
				</div>
			</div>
		);
	}
	return <ButterGalleryWorkItem key={view} aiSuggestionSurface={view === "inline" ? "inline" : "global"} open={open} onClose={onClose} showAiSuggestions />;
}
