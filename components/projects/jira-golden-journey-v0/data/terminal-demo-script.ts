import type { TerminalBeat, TerminalWorkItem } from "../lib/terminal-demo-state";

export const JIRA_CLI_TITLE = "Jira CLI v0.4.2";
export const JIRA_CLI_WORKSPACE = "Agent Sessions Experience (ASX) · asx.atlassian.net";
export const JIRA_CLI_FOOTER_HINTS = "↑↓ to move · enter to open Jira";
export const TERMINAL_INITIAL_HINT = "click the terminal to open Jira";
export const TERMINAL_SHELL_PROMPT = "~/dev/asx $";

const JIRA_CLI_BASE_URL = "https://asx.atlassian.net";

export function getJiraIssueUrl(issueKey: string): string {
	return `${JIRA_CLI_BASE_URL}/browse/${encodeURIComponent(issueKey)}`;
}

/** Seeded backlog + done items, shown the moment the Jira dashboard appears (beat "connect"). */
const SEED_WORK_ITEMS: readonly TerminalWorkItem[] = [
	{
		key: "ASX-231",
		title: "Fix flaky gallery snapshot test",
		status: "backlog",
		summary: "Flaky on ~1 in 5 CI runs",
		age: "3d",
	},
	{
		key: "ASX-198",
		title: "Add dark mode toggle to settings",
		status: "backlog",
		summary: "Design reviewed, ready for build",
		age: "5d",
	},
	{
		key: "ASX-244",
		title: "Compress illustration assets",
		status: "backlog",
		summary: "Lighthouse flagged LCP regression",
		age: "1w",
	},
	{
		key: "ASX-217",
		title: "Migrate date-picker to design system",
		status: "backlog",
		summary: "Blocked on new picker API",
		age: "2w",
	},
	{
		key: "ASX-190",
		title: "Bump Node 22 in CI",
		status: "done",
		summary: "Merged to main",
		age: "2d",
		pr: { number: 482, state: "merged" },
	},
];

export const TERMINAL_DEMO_BEATS: readonly TerminalBeat[] = [
	{
		id: "split",
		trigger: "click",
		hint: "→ next: jira connect --space asx",
		steps: [{ kind: "split" }],
	},
	{
		id: "connect",
		trigger: "key",
		hint: "→ next: create a work item and start on it",
		steps: [
			{ kind: "type", pane: "left", text: "jira connect --space asx" },
			{ kind: "submit", pane: "left" },
			{ kind: "pause", ms: 300 },
			{
				kind: "output",
				pane: "left",
				lines: [
					[
						{ text: "Connecting to ", tone: "dim" },
						{ text: "asx.atlassian.net", tone: "bold" },
						{ text: "…", tone: "dim" },
					],
					[
						{ text: "✓ ", tone: "success" },
						{ text: "Connected · ", tone: "dim" },
						{ text: "Agent Sessions Experience (ASX)", tone: "bold" },
					],
				],
			},
			{ kind: "show-dashboard" },
			{
				kind: "board",
				events: SEED_WORK_ITEMS.map((item) => ({ type: "add-item" as const, item })),
			},
		],
	},
	{
		id: "create-item",
		trigger: "key",
		hint: "→ next: pick up ASX-231 from the backlog",
		steps: [
			{
				kind: "type",
				pane: "right",
				text: "Create a Jira work item for the card overflow bug on the Kanban stage, then start on it.",
			},
			{ kind: "submit", pane: "right" },
			{ kind: "pause", ms: 300 },
			{
				kind: "output",
				pane: "right",
				lines: [
					[
						{ text: "⏺ ", tone: "accent" },
						{ text: 'jira create --title "Fix card overflow on the Kanban stage"' },
					],
					[
						{ text: "  ⎿ ", tone: "dim" },
						{ text: "Created ", tone: "dim" },
						{ text: "ASX-247", tone: "bold" },
					],
					[{ text: "⏺ ", tone: "accent" }, { text: "jira start ASX-247" }],
				],
			},
			{
				kind: "board",
				events: [
					{
						type: "add-item",
						item: {
							key: "ASX-247",
							title: "Fix card overflow on the Kanban stage",
							status: "working",
							summary: "Reproducing the card overflow on the Kanban stage…",
							age: "now",
						},
					},
				],
			},
		],
	},
	{
		id: "pickup-backlog",
		trigger: "key",
		hint: "→ next: kick off the rest of the backlog in parallel",
		steps: [
			{
				kind: "type",
				pane: "right",
				text: "Pick up ASX-231 — the flaky gallery snapshot test — and figure out the flake.",
			},
			{ kind: "submit", pane: "right" },
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ ", tone: "accent" }, { text: "jira start ASX-231" }],
					[{ text: "  ⎿ ", tone: "dim" }, { text: "Session started", tone: "dim" }],
				],
			},
			{
				kind: "board",
				events: [
					{ type: "move-item", key: "ASX-231", to: "working" },
					{
						type: "set-summary",
						key: "ASX-231",
						summary: "Bisecting flaky retries in the gallery spec",
						age: "now",
					},
				],
			},
		],
	},
	{
		id: "parallel-dispatch",
		trigger: "key",
		hint: "→ next: Jira surfaces a question about ASX-198",
		steps: [
			{ kind: "type", pane: "right", text: "Kick off the rest of the backlog in parallel." },
			{ kind: "submit", pane: "right" },
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ ", tone: "accent" }, { text: "jira start ASX-198" }],
					[{ text: "⏺ ", tone: "accent" }, { text: "jira start ASX-244" }],
					[{ text: "⏺ ", tone: "accent" }, { text: "jira start ASX-217" }],
					[{ text: "  ⎿ ", tone: "dim" }, { text: "3 sessions started in parallel", tone: "dim" }],
				],
			},
			{
				kind: "board",
				events: [
					{ type: "move-item", key: "ASX-198", to: "working" },
					{ type: "set-summary", key: "ASX-198", summary: "Sketching system-preference detection", age: "now" },
					{ type: "move-item", key: "ASX-244", to: "working" },
					{ type: "set-summary", key: "ASX-244", summary: "Re-encoding illustrations to AVIF", age: "now" },
					{ type: "move-item", key: "ASX-217", to: "working" },
					{ type: "set-summary", key: "ASX-217", summary: "Swapping in the design-system DatePicker", age: "now" },
				],
			},
		],
	},
	{
		id: "needs-input",
		trigger: "key",
		hint: "→ next: reply to ASX-198",
		steps: [
			{
				kind: "board",
				events: [
					{ type: "move-item", key: "ASX-198", to: "needs-input" },
					{
						type: "set-summary",
						key: "ASX-198",
						summary: "Should dark mode follow system preference by default?",
						age: "now",
					},
				],
			},
		],
	},
	{
		id: "reply",
		trigger: "key",
		hint: "→ next: first PRs land",
		steps: [
			{ kind: "type", pane: "right", text: "ASX-198: yes — follow system preference, add a manual override" },
			{ kind: "submit", pane: "right" },
			{
				kind: "board",
				events: [
					{ type: "move-item", key: "ASX-198", to: "working" },
					{
						type: "set-summary",
						key: "ASX-198",
						summary: "Building manual override for dark mode preference",
						age: "now",
					},
				],
			},
		],
	},
	{
		id: "first-completions",
		trigger: "key",
		hint: "→ next: remaining sessions wrap up",
		steps: [
			{
				kind: "board",
				events: [
					{ type: "move-item", key: "ASX-247", to: "done" },
					{ type: "set-pr", key: "ASX-247", number: 512, state: "open" },
					{ type: "move-item", key: "ASX-244", to: "done" },
					{ type: "set-pr", key: "ASX-244", number: 513, state: "open" },
				],
			},
		],
	},
	{
		id: "second-completions",
		trigger: "key",
		hint: "→ next: summarize today's sessions",
		steps: [
			{
				kind: "board",
				events: [
					{ type: "move-item", key: "ASX-231", to: "done" },
					{ type: "set-pr", key: "ASX-231", number: 514, state: "open" },
					{ type: "move-item", key: "ASX-217", to: "done" },
					{ type: "set-pr", key: "ASX-217", number: 515, state: "open" },
					{ type: "move-item", key: "ASX-198", to: "done" },
					{ type: "set-pr", key: "ASX-198", number: 516, state: "open" },
				],
			},
		],
	},
	{
		id: "summary",
		trigger: "key",
		hint: "demo complete · press R to restart",
		steps: [
			{ kind: "type", pane: "right", text: "Summarize today's sessions." },
			{ kind: "submit", pane: "right" },
			{
				kind: "output",
				pane: "right",
				lines: [
					[{ text: "⏺ ", tone: "accent" }, { text: "jira report --today" }],
					[
						{ text: "  ⎿ ", tone: "dim" },
						{ text: "6 sessions run · 6 PRs opened · backlog cleared.", tone: "success" },
					],
				],
			},
		],
	},
];
