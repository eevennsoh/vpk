"use client";

import { useEffect } from "react";

import { TerminalStage } from "@/components/projects/jira-golden-journeys-v1/components/terminal-stage";
import type { TerminalDemoController } from "@/components/projects/jira-golden-journeys-v1/hooks/use-terminal-demo";

export interface JiraTeamEu26TerminalStoryProps {
	controller: TerminalDemoController;
	promptCopied?: boolean;
	resetKey?: number | string;
	theme?: "dark" | "light";
}

export function JiraTeamEu26TerminalStory({
	controller,
	promptCopied = false,
	resetKey,
	theme = "dark",
}: Readonly<JiraTeamEu26TerminalStoryProps>): React.ReactElement {
	const { restart } = controller;

	useEffect(() => {
		restart();
	}, [resetKey, restart]);

	return (
		<div
			className="relative left-1/2 h-full min-h-0 w-[100cqw] -translate-x-1/2 bg-surface"
			data-pr-number="1839"
			data-prompt-copied={promptCopied ? "true" : "false"}
			data-restored-session="PAY-101"
			data-restored-artifacts={controller.state.finished ? "available" : "pending"}
			data-story-complete={controller.state.finished ? "true" : "false"}
			data-color-mode={theme}
			data-subtree-theme=""
			data-theme={`${theme}:${theme} spacing:spacing typography:typography shape:shape`}
		>
			<p className="sr-only" aria-live="polite">
				{controller.state.finished
					? "PAY-101 session restored. The prior conversation, worktree, commit, PR #1839, and generated artifacts are available."
					: promptCopied
						? "Copied resume prompt ready for the uncaptured PAY-101 Claude session."
						: "Resume prompt not copied yet. Return to Learn and choose Resume on the PAY-101 Claude session."}
			</p>
			<TerminalStage controller={controller} />
		</div>
	);
}
