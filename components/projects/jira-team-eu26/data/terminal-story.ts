import type { TerminalBeat } from "@/components/projects/jira-golden-journeys-v1/lib/terminal-demo-state";
import type { TerminalStoryDefinition } from "@/components/projects/jira-golden-journeys-v1/lib/terminal-story-definition";

const JIRA_TEAM_EU26_BASE_URL = "https://jira-team-eu26.atlassian.net";

export const JIRA_TEAM_EU26_RESUME_PROMPT =
	"cd /Users/venn/dev/payments/.worktrees/pay-101-adapter && claude --resume 338eaaca-62da-4dcb-925b-f2c5f16be5a8";

export function getJiraTeamEu26IssueUrl(issueKey: string): string {
	return `${JIRA_TEAM_EU26_BASE_URL}/browse/${encodeURIComponent(issueKey)}`;
}

export const JIRA_TEAM_EU26_TERMINAL_BEATS: readonly TerminalBeat[] = [
	{
		id: "paste-resume-prompt",
		trigger: "click",
		hint: "→ next: restore the prior conversation",
		steps: [
			{
				kind: "paste",
				pane: "right",
				text: JIRA_TEAM_EU26_RESUME_PROMPT,
			},
			{ kind: "submit", pane: "right" },
			{ kind: "set-working", pane: "right", working: true },
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ Session · ", tone: "brand" }, { text: "restored local Claude session for PAY-101" }],
					[{ text: "  ⎿ Worktree · ", tone: "dim" }, { text: ".worktrees/pay-101-adapter" }],
					[{ text: "  ⎿ Conversation · ", tone: "dim" }, { text: "38 messages · Ee Venn Soh · last active Mon 17 Aug 07:48" }],
				],
			},
		],
	},
	{
		id: "restore-session",
		trigger: "key",
		hint: "→ next: reveal the work produced outside Jira",
		steps: [
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ Context · ", tone: "brand" }, { text: "PAY-101 · Inventory every v1 call site and name an owner" }],
					[{ text: "  Maya · ", tone: "dim" }, { text: "Should we keep LegacyGatewayAdapter as a compatibility shim?" }],
					[{ text: "  Claude · ", tone: "dim" }, { text: "We agreed to delete the adapter, not wrap it." }],
					[{ text: "  ⎿ Decision · ", tone: "dim" }, { text: "61 call sites across four services; PAY-102 must prove deletion before ports begin" }],
					[{ text: "  ⎿ Risk · ", tone: "dim" }, { text: "v1 still owns retry semantics for 3-D Secure" }],
				],
			},
		],
	},
	{
		id: "show-generated-artifacts",
		trigger: "key",
		hint: "PAY-101 context restored · session ready",
		steps: [
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ Git · ", tone: "brand" }, { text: "commit 8c2f4e1 · map 61 v1 call sites and owners" }],
					[{ text: "⏺ GitHub · ", tone: "brand" }, { text: "PR #1839 merged · Map v1 call sites · +312 lines" }],
					[{ text: "⏺ Artifact · ", tone: "brand" }, { text: "Payments SDK v2 — migration scope" }],
					[{ text: "⏺ Artifact · ", tone: "brand" }, { text: "#payments-migration — keep or delete the adapter" }],
					[{ text: "⏺ Artifact · ", tone: "brand" }, { text: "Lane assignments, humans and agents" }],
					[{ text: "✓ ", tone: "success" }, { text: "Local work is visible again and ready to continue" }],
				],
			},
			{ kind: "set-working", pane: "right", working: false },
		],
	},
];

export const JIRA_TEAM_EU26_TERMINAL_STEP_COUNT =
	JIRA_TEAM_EU26_TERMINAL_BEATS.length + 1;

export const JIRA_TEAM_EU26_TERMINAL_STORY = {
	beats: JIRA_TEAM_EU26_TERMINAL_BEATS,
	layout: "claude-only",
	initialHint: "click the terminal to paste the copied PAY-101 resume prompt",
	finishedHint: "PAY-101 context restored · session ready",
	getIssueUrl: getJiraTeamEu26IssueUrl,
	frameAriaLabel: "Paste the copied resume prompt for PAY-101",
	dashboard: {
		title: "Jira work item",
		workspace: "Jira Team EU26 · PAY-101",
		footerHints: "↑↓ to browse · enter to inspect in Jira",
		shellPrompt: "~/dev/payments $",
	},
	claude: {
		cwd: "~/dev/payments/.worktrees/pay-101-adapter",
	},
	statusBar: {
		sessionName: "pay-101-adapter",
		singleWindowLabel: "0:claude*",
		splitWindowLabel: "0:jira 1:claude*",
		clock: "08:12",
	},
} as const satisfies TerminalStoryDefinition;
