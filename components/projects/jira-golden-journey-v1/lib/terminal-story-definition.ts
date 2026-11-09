import type { TerminalBeat } from "./terminal-demo-state";

export interface TerminalStoryDefinition {
	readonly beats: readonly TerminalBeat[];
	/** Defaults to the original Jira + Claude split presenter. */
	readonly layout?: "dual-pane" | "claude-only";
	readonly initialHint: string;
	readonly finishedHint: string;
	readonly getIssueUrl: (issueKey: string) => string;
	readonly frameAriaLabel: string;
	readonly dashboard: Readonly<{
		title: string;
		workspace: string;
		footerHints: string;
		shellPrompt: string;
	}>;
	readonly claude: Readonly<{
		cwd: string;
	}>;
	readonly statusBar: Readonly<{
		sessionName: string;
		singleWindowLabel: string;
		splitWindowLabel: string;
		clock: string;
	}>;
}
