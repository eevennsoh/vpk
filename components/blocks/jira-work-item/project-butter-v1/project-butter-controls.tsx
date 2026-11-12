"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PROJECT_BUTTER_PRESENTATIONS, type ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter-v1/presentation";

export function ProjectButterControls({
	empty,
	onEmptyChange,
	onPresentationChange,
	onSuggestionChange,
	selectedPresentation,
	suggestion,
}: Readonly<{
	empty: boolean;
	onEmptyChange: (empty: boolean) => void;
	onPresentationChange: (presentation: ProjectButterPresentation) => void;
	onSuggestionChange: (suggestion: boolean) => void;
	/** Omit for launch buttons; supply for the settings selection. */
	selectedPresentation?: ProjectButterPresentation;
	suggestion: boolean;
}>) {
	const emptyId = useId();
	const suggestionId = useId();
	return (
		<div className="flex flex-wrap items-center gap-6">
			<div aria-label="Screen size" className="flex flex-wrap gap-2" role="group">
				{PROJECT_BUTTER_PRESENTATIONS.map((option) => (
					<Button aria-pressed={selectedPresentation === undefined ? undefined : selectedPresentation === option.value} key={option.value} onClick={() => onPresentationChange(option.value)} type="button" variant={selectedPresentation === option.value ? "default" : "outline"}>
						{option.label}
					</Button>
				))}
			</div>
			<div className="flex items-center gap-3 text-sm text-text"><label htmlFor={emptyId}>Empty</label><Switch checked={empty} id={emptyId} label="Empty" onCheckedChange={onEmptyChange} /></div>
			<div className="flex items-center gap-3 text-sm text-text"><label htmlFor={suggestionId}>Suggestion</label><Switch checked={suggestion} id={suggestionId} label="Suggestion" onCheckedChange={onSuggestionChange} /></div>
		</div>
	);
}
