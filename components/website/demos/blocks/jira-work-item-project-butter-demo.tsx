"use client";

import { useState } from "react";
import { ProjectButterControls } from "@/components/blocks/jira-work-item/project-butter/project-butter-controls";
import type { ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { ProjectButterChatWorkItem } from "@/components/website/demos/blocks/project-butter-chat-work-item";

export function ProjectButterDemo() {
	const [activePresentation, setActivePresentation] = useState<ProjectButterPresentation | null>(null);
	const [empty, setEmpty] = useState(false);
	const [suggestion, setSuggestion] = useState(false);
	return (
		<div className="relative flex min-h-[400px] flex-col items-center justify-center gap-6 p-6">
			<ProjectButterControls
				empty={empty}
				onEmptyChange={(next) => {
					setEmpty(next);
					if (next) setSuggestion(false);
				}}
				onPresentationChange={setActivePresentation}
				onSuggestionChange={(next) => {
					setSuggestion(next);
					if (next) setEmpty(false);
				}}
				suggestion={suggestion}
			/>
			{activePresentation ? (
				<div className="absolute inset-0">
					<ProjectButterChatWorkItem initialExperimentalPreset={empty ? "empty" : "filled"} initialIssueOpen onIssueClose={() => setActivePresentation(null)} projectButterPresentation={activePresentation} projectButterSuggestion={suggestion} />
				</div>
			) : null}
		</div>
	);
}
