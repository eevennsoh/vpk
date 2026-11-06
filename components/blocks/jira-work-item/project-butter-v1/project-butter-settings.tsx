"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProjectButterControls } from "@/components/blocks/jira-work-item/project-butter-v1/project-butter-controls";
import type { ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter-v1/presentation";

export function ProjectButterSettings({ empty, onClose, onEmptyChange, onPresentationChange, onSuggestionChange, open, presentation, suggestion }: Readonly<{
	empty: boolean;
	onClose: () => void;
	onEmptyChange: (empty: boolean) => void;
	onPresentationChange: (presentation: ProjectButterPresentation) => void;
	onSuggestionChange: (suggestion: boolean) => void;
	open: boolean;
	presentation: ProjectButterPresentation;
	suggestion: boolean;
}>) {
	return (
		<Dialog onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }} open={open}>
			<DialogContent className="z-[601]" overlayProps={{ className: "z-[600]", forceRender: true }} size="lg">
				<DialogTitle>Choose a work item experience</DialogTitle>
				<DialogDescription>Explore Project butter in full screen, a modal, or a side panel. Turn Empty on to preview a new work item, or Suggestion to review Teamwork Graph fills for empty fields.</DialogDescription>
				<div className="space-y-6">
					<div className="rounded-lg border border-border-selected bg-bg-selected p-4">
						<p className="mb-1 font-semibold text-text">Project butter</p>
						<p className="text-sm text-text-subtle">Starts from the GA experience. New changes go here.</p>
					</div>
					<ProjectButterControls empty={empty} onEmptyChange={onEmptyChange} onPresentationChange={onPresentationChange} onSuggestionChange={onSuggestionChange} selectedPresentation={presentation} suggestion={suggestion} />
				</div>
				<Button className="justify-self-end" onClick={onClose} type="button">View prototype</Button>
			</DialogContent>
		</Dialog>
	);
}
