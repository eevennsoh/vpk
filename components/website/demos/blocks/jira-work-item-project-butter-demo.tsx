"use client";

import { useState } from "react";
import JiraWorkItem from "@/components/blocks/jira-work-item";
import { ProjectButterControls } from "@/components/blocks/jira-work-item/project-butter/project-butter-controls";
import type { ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter/presentation";

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
					<JiraWorkItem initialExperimentalPreset={empty ? "empty" : "filled"} initialIssueOpen onIssueClose={() => setActivePresentation(null)} projectButterPresentation={activePresentation} projectButterSuggestion={suggestion} variant="project-butter" />
				</div>
			) : null}
		</div>
	);
}
