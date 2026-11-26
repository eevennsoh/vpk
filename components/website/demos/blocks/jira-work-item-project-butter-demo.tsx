"use client";

import { useId, useState } from "react";
import { ProjectButterControls } from "@/components/blocks/jira-work-item/project-butter/project-butter-controls";
import type { ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { ProjectButterChatWorkItem } from "@/components/website/demos/blocks/project-butter-chat-work-item";
import { Switch } from "@/components/ui/switch";

export function ProjectButterDemo() {
	const [activePresentation, setActivePresentation] = useState<ProjectButterPresentation | null>(null);
	const [empty, setEmpty] = useState(false);
	const [suggestion, setSuggestion] = useState(false);
	const [showAgentReplyProgress, setShowAgentReplyProgress] = useState(false);
	const progressId = useId();
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
			<div className="flex items-center gap-3 text-sm text-text"><label htmlFor={progressId}>Agent reply loading state</label><Switch checked={showAgentReplyProgress} id={progressId} label="Agent reply loading state" onCheckedChange={setShowAgentReplyProgress} /></div>
			{activePresentation ? (
				<div className="absolute inset-0">
					<ProjectButterChatWorkItem initialExperimentalPreset={empty ? "empty" : "filled"} initialIssueOpen onIssueClose={() => setActivePresentation(null)} projectButterPresentation={activePresentation} projectButterSuggestion={suggestion} projectButterShowAgentReplyProgress={showAgentReplyProgress} />
				</div>
			) : null}
		</div>
	);
}
