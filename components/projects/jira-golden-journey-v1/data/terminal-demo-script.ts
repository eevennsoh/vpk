import type { TerminalBeat, TerminalWorkItem } from "../lib/terminal-demo-state";
import type { TerminalStoryDefinition } from "../lib/terminal-story-definition";

export const JIRA_CLI_TITLE = "Teamwork Graph";
export const JIRA_CLI_WORKSPACE = "Jira Golden Journey v1 · work available to start";
export const JIRA_CLI_FOOTER_HINTS = "↑↓ to browse · enter to inspect in Jira";
export const TERMINAL_INITIAL_HINT = "click the terminal to browse available work";
export const TERMINAL_SHELL_PROMPT = "~/dev/jira-golden-journey-v1 $";

const JIRA_CLI_BASE_URL = "https://jira-golden-journey-v1.atlassian.net";
const REVIEW_HANDOFF_COMMAND = `claude -- 'Continue work on Jira work item "Add assignee focus mode" (JGP-247) in this local Claude session. Review feedback was sent from Jira. Address the inline comment below, run the relevant checks, and update the open pull request. Use the Atlassian MCP for any additional work item or review context.

# Jira Work Item Context
<JIRA_WORK_ITEM>
<title>Add assignee focus mode</title>
<key>JGP-247</key>
<description>Click an assignee to focus the board on their visible work while preserving keyboard navigation and accessible result counts.</description>
<project>
  <key>JGP</key>
</project>
<cloudId>7f8c0e4a-1b62-4fb8-a6d5-3c21e97a0247</cloudId>
<issueUrl>${JIRA_CLI_BASE_URL}/browse/JGP-247</issueUrl>
<reviewFeedback>
  <author>Carl</author>
  <inlineComment>Preserve Shift-selection against the visible filtered order. Calculate the range from filteredIssues, not the unfiltered board.</inlineComment>
</reviewFeedback>
</JIRA_WORK_ITEM>'`;

export function getJiraIssueUrl(issueKey: string): string {
	return `${JIRA_CLI_BASE_URL}/browse/${encodeURIComponent(issueKey)}`;
}

const AVAILABLE_WORK_ITEMS: readonly TerminalWorkItem[] = [
	{
		key: "JGP-247",
		title: "Add assignee focus mode",
		status: "backlog",
		summary: "Ready to start · design notes and acceptance criteria linked",
		age: "1d",
	},
	{
		key: "JGP-231",
		title: "Stabilize gallery snapshot coverage",
		status: "backlog",
		summary: "Flaky on one in five CI runs",
		age: "3d",
	},
	{
		key: "JGP-244",
		title: "Compress board illustration assets",
		status: "backlog",
		summary: "Lighthouse identified an LCP regression",
		age: "5d",
	},
	{
		key: "JGP-217",
		title: "Migrate date picker to ADS",
		status: "backlog",
		summary: "Ready after the picker API upgrade",
		age: "1w",
	},
];

/**
 * Carl's complete local-session story. Discovery, backlog browsing, issue
 * inspection, and context handoff are presented live. Delivery and post-review
 * work use deterministic snapshots on either side of the Kanban review.
 */
export const TERMINAL_DEMO_BEATS: readonly TerminalBeat[] = [
	{
		id: "split",
		trigger: "click",
		hint: "→ next: ask TwG what work is available",
		steps: [{ kind: "split" }],
	},
	{
		id: "start-work-typed",
		trigger: "key",
		hint: "→ next: load the backlog",
		steps: [{ kind: "type", pane: "left", text: "twg start-work" }],
	},
	{
		id: "backlog-loaded",
		trigger: "key",
		hint: "→ next: ask Claude what JGP-247 involves",
		steps: [
			{ kind: "submit", pane: "left" },
			{ kind: "pause", ms: 300 },
			{
				kind: "output",
				pane: "left",
				lines: [
					[
						{ text: "✓ ", tone: "success" },
						{ text: "Found 4 backlog items ready to start", tone: "bold" },
					],
					[{ text: "  Tip         ", tone: "dim" }, { text: "Ask Claude for context before selecting an item" }],
				],
			},
			{ kind: "show-dashboard" },
			{
				kind: "board",
				events: AVAILABLE_WORK_ITEMS.map((item) => ({ type: "add-item" as const, item })),
			},
		],
	},
	{
		id: "inspect-work",
		trigger: "key",
		hint: "→ next: select JGP-247",
		steps: [
			{
				kind: "type",
				pane: "right",
				text: "Explain JGP-247. Include the issue, linked design notes, and implementation risks.",
			},
			{ kind: "submit", pane: "right" },
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ Atlassian · ", tone: "brand" }, { text: "get Jira issue JGP-247" }],
					[{ text: "⏺ Search · ", tone: "brand" }, { text: "linked board-focus design notes and team decisions" }],
					[{ text: "  ⎿ Goal · ", tone: "dim" }, { text: "Click an assignee to focus the board on their visible work." }],
					[{ text: "  ⎿ Acceptance · ", tone: "dim" }, { text: "Clear focus, preserve keyboard navigation, announce result counts." }],
					[{ text: "  ⎿ Risk · ", tone: "dim" }, { text: "Range selection must follow the filtered rendered order." }],
					[{ text: "  ⎿ Team flow · ", tone: "dim" }, { text: "Focused tests → PR review → squash merge" }],
					[{ text: "✓ ", tone: "success" }, { text: "JGP-247 is scoped and ready to start" }],
				],
			},
		],
	},
	{
		id: "context-loaded",
		trigger: "key",
		hint: "→ next: Claude implements the task",
		steps: [
			{ kind: "type", pane: "right", text: "Start JGP-247 with TwG and implement it using that context." },
			{ kind: "submit", pane: "right" },
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ TwG · ", tone: "brand" }, { text: "twg start-work JGP-247" }],
					[{ text: "  ⎿ ", tone: "dim" }, { text: "Agent session created · Jira, docs, and team workflow connected" }],
					[{ text: "  ⎿ ", tone: "dim" }, { text: "Branch jgp-247-assignee-focus-mode ready" }],
				],
			},
			{ kind: "set-working", pane: "right", working: true },
			{
				kind: "board",
				events: [
					{ type: "move-item", key: "JGP-247", to: "working" },
					{ type: "set-summary", key: "JGP-247", summary: "Claude is implementing assignee focus mode", age: "now" },
				],
			},
		],
	},
	{
		id: "implementation",
		trigger: "key",
		hint: "PR #247 is ready · next: review in Jira",
		steps: [
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ Read · ", tone: "brand" }, { text: "Kanban board, facepile, and selection lifecycle owners" }],
					[{ text: "⏺ Search · ", tone: "brand" }, { text: "rg assignee filter, visibleCards, range selection" }],
					[{ text: "⏺ Edit · ", tone: "brand" }, { text: "added focused-assignee state and clear-focus action" }],
					[{ text: "⏺ Edit · ", tone: "brand" }, { text: "filtered the rendered board while preserving keyboard focus" }],
					[{ text: "⏺ Test · ", tone: "brand" }, { text: "added selection and screen-reader regression coverage" }],
					[{ text: "⏺ Bash · ", tone: "brand" }, { text: "node --test kanban-lifecycle.test.js · 7 passed" }],
					[{ text: "⏺ Bash · ", tone: "brand" }, { text: "pnpm run typecheck · passed" }],
					[{ text: "⏺ Git · ", tone: "brand" }, { text: "reviewed diff and created two focused commits" }],
					[{ text: "  ⎿ ", tone: "dim" }, { text: "4f7a2d1  feat(jira): add assignee focus mode" }],
					[{ text: "  ⎿ ", tone: "dim" }, { text: "a8c39be  test(jira): cover focused board selection" }],
					[{ text: "⏺ GitHub · ", tone: "brand" }, { text: "pushed branch and opened PR #247" }],
					[{ text: "✓ ", tone: "success" }, { text: "All checks passing · ready for your review" }],
				],
			},
			{ kind: "set-working", pane: "right", working: false },
			{
				kind: "board",
				events: [
					{ type: "move-item", key: "JGP-247", to: "done" },
					{ type: "set-summary", key: "JGP-247", summary: "PR #247 is ready for review", age: "now" },
					{ type: "set-pr", key: "JGP-247", number: 247, state: "open" },
				],
			},
		],
	},
	{
		id: "review-handoff",
		trigger: "key",
		hint: "→ next: Claude applies Carl's feedback",
		steps: [
			{
				kind: "type",
				pane: "right",
				text: REVIEW_HANDOFF_COMMAND,
			},
			{ kind: "submit", pane: "right" },
			{ kind: "set-working", pane: "right", working: true },
			{
				kind: "output",
				pane: "right",
				lines: [[{ text: "⏺ ", tone: "brand" }, { text: "Review context received · updating PR #247" }]],
			},
			{
				kind: "board",
				events: [
					{ type: "move-item", key: "JGP-247", to: "working" },
					{ type: "set-summary", key: "JGP-247", summary: "Applying Carl's inline review feedback", age: "now" },
				],
			},
		],
	},
	{
		id: "revision",
		trigger: "key",
		hint: "→ next: create a follow-up commit",
		steps: [
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ ", tone: "brand" }, { text: "Updated range selection to use the rendered filtered issue list" }],
					[{ text: "⏺ ", tone: "brand" }, { text: "Added regression coverage for Shift-select while filtered" }],
					[{ text: "✓ ", tone: "success" }, { text: "Focused tests passed · lint passed · typecheck passed" }],
				],
			},
			{ kind: "set-working", pane: "right", working: false },
			{
				kind: "board",
				events: [{ type: "set-summary", key: "JGP-247", summary: "Filtered range selection fixed; checks passing" }],
			},
		],
	},
	{
		id: "follow-up-commit",
		trigger: "key",
		hint: "→ next: merge PR #247",
		steps: [
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "  ⎿ ", tone: "dim" }, { text: "commit c91e42a  fix(jira): preserve range selection while filtered" }],
					[{ text: "✓ ", tone: "success" }, { text: "Pushed follow-up commit to PR #247" }],
				],
			},
			{
				kind: "board",
				events: [
					{ type: "move-item", key: "JGP-247", to: "done" },
					{ type: "set-summary", key: "JGP-247", summary: "Follow-up commit pushed · ready to merge" },
				],
			},
		],
	},
	{
		id: "merge",
		trigger: "key",
		hint: "local session complete · next: Jira shows Done",
		steps: [
			{ kind: "type", pane: "right", text: "The changes look good. Merge PR #247." },
			{ kind: "submit", pane: "right" },
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ ", tone: "brand" }, { text: "gh pr merge 247 --squash --delete-branch" }],
					[{ text: "✓ ", tone: "success" }, { text: "PR #247 merged into main" }],
					[{ text: "✓ ", tone: "success" }, { text: "JGP-247 moved to Done" }],
				],
			},
			{
				kind: "board",
				events: [
					{ type: "set-summary", key: "JGP-247", summary: "Merged to main", age: "now" },
					{ type: "set-pr", key: "JGP-247", number: 247, state: "merged" },
				],
			},
		],
	},
];

export const JIRA_GOLDEN_JOURNEY_V1_TERMINAL_STORY = {
	beats: TERMINAL_DEMO_BEATS,
	initialHint: TERMINAL_INITIAL_HINT,
	finishedHint: "demo complete · R to restart",
	getIssueUrl: getJiraIssueUrl,
	frameAriaLabel: "Split the terminal to open Jira",
	dashboard: {
		title: JIRA_CLI_TITLE,
		workspace: JIRA_CLI_WORKSPACE,
		footerHints: JIRA_CLI_FOOTER_HINTS,
		shellPrompt: TERMINAL_SHELL_PROMPT,
	},
	claude: {
		cwd: "~/dev/jira-golden-journey-v1",
	},
	statusBar: {
		sessionName: "jira-golden-journey-v1",
		singleWindowLabel: "0:claude*",
		splitWindowLabel: "0:twg 1:claude*",
		clock: "14:32",
	},
} as const satisfies TerminalStoryDefinition;
