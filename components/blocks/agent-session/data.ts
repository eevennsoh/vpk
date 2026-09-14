import { getRovoAgentProfile } from "@/app/data/directory/agents";
import type { AgentListAgent } from "@/components/blocks/agent-list";

import type { AgentSessionItem } from "./agent-session-types";

const CLAUDE_AGENT = {
	brandName: "claude",
	id: "claude",
	kind: "agent",
	name: "Claude",
} as const satisfies AgentListAgent;

const CURSOR_AGENT = {
	brandName: "cursor",
	id: "cursor",
	kind: "agent",
	name: "Cursor",
} as const satisfies AgentListAgent;

function createRovoAgent(): AgentListAgent {
	const profile = getRovoAgentProfile("rovo-dev");
	return {
		id: profile.id,
		kind: "agent",
		name: "Rovo",
		vpkLogo: "rovo",
	};
}

const GITHUB_REPOSITORY = "acme/storefront";
const GITHUB_TARGET_BRANCH = "main";

/** Shared GitHub PR author used by the catalog pull-request Smart Link. */
const GITHUB_PR_AUTHOR = {
	name: "eevensoh",
	src: "/avatar-user/venn/venn.png",
} as const;

/**
 * Local coding sessions for the catalog demo. Pulse maps the same shape from
 * its loose-work fixtures; this list is the block's own sample data.
 */
export const AGENT_SESSION_ITEMS: readonly AgentSessionItem[] = [
	{
		id: "lw-scope-thread",
		title: "The adapter keep-or-delete argument still lives in a local Claude session",
		shortTitle: "Keep or delete the adapter",
		state: "complete",
		agent: CLAUDE_AGENT,
		host: "local",
		prStatus: "created",
		invokedBy: {
			avatarSrc: "/avatar-user/ting-chen/color/asow-teamwork-blue.png",
			name: "Priya Raman",
		},
		machineName: "Priya’s MacBook",
		timeLabel: "Last week",
		toolCalls: [
			"Reading the relevant files.",
			"Editing the shared implementation.",
			"Running the focused tests.",
		],
		sessionDetails: {
			additions: 86,
			branch: "feature/shop-4821-guest-checkout",
			deletions: 21,
			files: 6,
			host: "local",
			issueKey: "PAY-101",
			issueStatus: "Done",
			issueSummary: "The adapter keep-or-delete argument still lives in a local Claude session",
			pullRequestAuthor: GITHUB_PR_AUTHOR,
			pullRequestDescription:
				"## Summary - Add experimental-v2 pull requests panel with phase sorting, plus activity filtering and guest checkout for the storefront.",
			pullRequestNumber: 1306,
			pullRequestTitle: "Add guest checkout to the storefront",
			pullRequestUrl: "https://github.com/acme/storefront/pull/1306",
			repository: GITHUB_REPOSITORY,
			targetBranch: GITHUB_TARGET_BRANCH,
			worktreePath: ".worktrees/pay-101-adapter",
		},
	},
	{
		id: "lw-kickoff-killswitch-session",
		title: "Kill switch as a prerequisite still lives in a local Cursor session",
		shortTitle: "Kill switch as port gate",
		state: "complete",
		agent: CURSOR_AGENT,
		host: "local",
		prStatus: "merged",
		invokedBy: {
			avatarSrc: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
			name: "Jordan Okafor",
		},
		machineName: "Work Laptop",
		timeLabel: "18m ago",
		toolCalls: [
			"Searching the codebase for affected paths.",
			"Updating the shared implementation.",
			"Checking the change against tests.",
		],
		sessionDetails: {
			additions: 148,
			branch: "fix/comment-highlight",
			deletions: 37,
			files: 12,
			host: "local",
			issueKey: "PAY-121",
			issueStatus: "In review",
			issueSummary: "Kill switch as a prerequisite still lives in a local Cursor session",
			pullRequestAuthor: {
				name: "Maya Chen",
				src: "/avatar-user/olivia-yang/color/asow-service-yellow.png",
			},
			pullRequestDescription:
				"## Summary - Flatten the threaded comment highlight so bottom corners no longer clip against the composer.",
			pullRequestNumber: 1847,
			pullRequestTitle: "Fix threaded comment highlight bottom corners",
			pullRequestUrl: "https://github.com/acme/storefront/pull/1847",
			repository: GITHUB_REPOSITORY,
			targetBranch: GITHUB_TARGET_BRANCH,
			worktreePath: ".worktrees/pay-121-kill-switch",
		},
	},
	{
		id: "lw-night-suite-session",
		title: "Overnight contract-suite session never captured on PAY-113",
		shortTitle: "3-D Secure suite run",
		state: "complete",
		agent: createRovoAgent(),
		host: "local",
		prStatus: "failed",
		invokedBy: {
			avatarSrc: "/avatar-user/chloe-lee/color/asow-dev-lime.png",
			name: "Maya Ferreira",
		},
		machineName: "MBP-M4-MAX",
		timeLabel: "Yesterday",
		toolCalls: [
			"Reading the linked work item context.",
			"Updating the delivery details.",
			"Checking the latest status.",
		],
		sessionDetails: {
			additions: 214,
			branch: "fix/pay-113-3ds-contract-suite",
			deletions: 48,
			files: 9,
			host: "local",
			issueKey: "PAY-113",
			issueStatus: "Done",
			issueSummary: "Overnight contract-suite session never captured on PAY-113",
			pullRequestAuthor: {
				name: "Maya Ferreira",
				src: "/avatar-user/chloe-lee/color/asow-dev-lime.png",
			},
			pullRequestDescription:
				"## Summary - Stabilize the overnight 3-D Secure contract suite so PAY-113 can merge without flaking assertions.",
			pullRequestNumber: 1852,
			pullRequestTitle: "Stabilize the 3-D Secure contract suite",
			pullRequestUrl: "https://github.com/acme/storefront/pull/1852",
			repository: GITHUB_REPOSITORY,
			targetBranch: GITHUB_TARGET_BRANCH,
			worktreePath: ".worktrees/pay-113-contract-suite",
		},
	},
	{
		id: "lw-no-pr-session",
		title: "Investigate the checkout telemetry gap before opening a pull request",
		shortTitle: "Trace checkout telemetry",
		state: "complete",
		agent: CLAUDE_AGENT,
		host: "local",
		invokedBy: {
			avatarSrc: "/avatar-user/venn/venn.png",
			name: "Venn",
		},
		machineName: "Telemetry MacBook",
		timeLabel: "7m ago",
		toolCalls: [
			"Searching the checkout telemetry events.",
			"Reading the relevant logs.",
			"Tracing the gap through the code.",
		],
		sessionDetails: {
			host: "local",
			issueKey: "PAY-128",
			issueStatus: "In progress",
			issueSummary: "Investigate the checkout telemetry gap before opening a pull request",
			worktreePath: ".worktrees/pay-128-telemetry",
		},
	},
];

/**
 * Cloud sessions for the catalog demo.
 *
 * Deliberately a separate list from {@link AGENT_SESSION_ITEMS}, which the Agent
 * Session Column and the Pulse rail also render: those surfaces are about local
 * work the viewer can resume, and flipping their fixtures to cloud would change
 * what those demos are demonstrating. These exercise the other menu — Rename,
 * Delete — plus the lifecycle states the long density can show.
 */
export const AGENT_SESSION_CLOUD_ITEMS: readonly AgentSessionItem[] = [
	{
		agent: CLAUDE_AGENT,
		host: "cloud",
		id: "cloud-suspension-refactor",
		invokedBy: {
			avatarSrc: "/avatar-user/ting-chen/color/asow-teamwork-blue.png",
			name: "Priya Raman",
		},
		prStatus: "created",
		sessionDetails: {
			additions: 132,
			branch: "feature/pay-204-off-road-damping",
			deletions: 24,
			files: 7,
			host: "cloud",
			issueKey: "PAY-204",
			issueStatus: "In progress",
			issueSummary: "Refactor active air suspension dampening logic for off-road mode",
			pullRequestAuthor: GITHUB_PR_AUTHOR,
			pullRequestNumber: 124,
			pullRequestTitle: "Cargo retract",
			pullRequestUrl: "https://github.com/acme/storefront/pull/124",
			repository: GITHUB_REPOSITORY,
			targetBranch: GITHUB_TARGET_BRANCH,
		},
		shortTitle: "Off-road damping",
		state: "running",
		timeLabel: "2m",
		title: "Refactor active air suspension dampening logic for off-road mode",
		toolCalls: [
			"Reading the suspension control paths.",
			"Adjusting the dampening logic.",
			"Running the off-road mode tests.",
		],
	},
	{
		agent: {
			brandName: "canva",
			id: "canva",
			kind: "agent",
			name: "Canva",
		},
		host: "cloud",
		id: "cloud-suspension-roadmap",
		invokedBy: {
			avatarSrc: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
			name: "Jordan Okafor",
		},
		sessionDetails: {
			host: "cloud",
			issueKey: "PAY-206",
			issueStatus: "In progress",
			issueSummary: "Active air suspension roadmap",
		},
		shortTitle: "Suspension roadmap",
		state: "needs-input",
		timeLabel: "2m",
		title: "Active air suspension roadmap",
		toolCalls: [
			"Reviewing the current roadmap layout.",
			"Updating the design hierarchy.",
			"Preparing the latest design export.",
		],
	},
	{
		agent: {
			brandName: "figma",
			id: "figma",
			kind: "agent",
			name: "Figma",
		},
		host: "cloud",
		id: "cloud-figma-with-austin",
		invokedBy: {
			avatarSrc: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
			name: "Austin Lee",
		},
		sessionDetails: {
			host: "cloud",
			issueKey: "PAY-209",
			issueStatus: "Done",
			issueSummary: "Figma with Austin",
		},
		shortTitle: "Figma with Austin",
		state: "complete",
		timeLabel: "29d",
		title: "Figma with Austin",
		toolCalls: [
			"Inspecting the current design frame.",
			"Comparing the component styles.",
			"Preparing the latest asset export.",
		],
	},
];

/** One active session in the Jira issue activity-row footprint. */
export const AGENT_SESSION_ATTACHED_WORKING_ITEMS: readonly AgentSessionItem[] = [
	{
		agent: {
			avatarSrc: "/avatar-agent/teamwork-agents/decision-director.svg",
			id: "review-agent",
			kind: "agent",
			name: "Review Agent",
		},
		host: "cloud",
		id: "PAY-112:review-agent",
		role: "owner",
		sessionDetails: {
			host: "cloud",
			issueKey: "PAY-112",
			issueSummary: "Confirm the sandbox key retention window before replay",
		},
		state: "running",
		timeLabel: "8m",
		title: "Working",
	},
];

/** Several active sessions merged into one attached activity row. */
export const AGENT_SESSION_ATTACHED_MULTI_WORKING_ITEMS: readonly AgentSessionItem[] = [
	{
		agent: CLAUDE_AGENT,
		host: "local",
		id: "PAY-112:claude",
		role: "owner",
		sessionDetails: {
			host: "local",
			issueKey: "PAY-112",
			issueSummary: "Confirm the sandbox key retention window before replay",
		},
		state: "running",
		timeLabel: "12m",
		title: "Working",
	},
	{
		agent: CURSOR_AGENT,
		host: "cloud",
		id: "PAY-112:cursor",
		invokedBy: {
			avatarSrc: "/avatar-user/ting-chen/color/asow-teamwork-blue.png",
			name: "Priya Raman",
		},
		role: "viewer",
		sessionDetails: {
			host: "cloud",
			issueKey: "PAY-112",
			issueSummary: "Confirm the sandbox key retention window before replay",
		},
		state: "running",
		timeLabel: "Yesterday",
		title: "Working",
	},
	{
		agent: createRovoAgent(),
		host: "cloud",
		id: "PAY-112:rovo",
		role: "owner",
		sessionDetails: {
			host: "cloud",
			issueKey: "PAY-112",
			issueSummary: "Confirm the sandbox key retention window before replay",
		},
		state: "running",
		timeLabel: "3h",
		title: "Working",
	},
];

/** One attached session blocked on a reply. */
export const AGENT_SESSION_ATTACHED_NEEDS_INPUT_ITEMS: readonly AgentSessionItem[] = [
	{
		agent: CLAUDE_AGENT,
		host: "cloud",
		id: "PAY-112:needs-input",
		sessionDetails: {
			host: "cloud",
			issueKey: "PAY-112",
			issueSummary: "Confirm the sandbox key retention window before replay",
		},
		state: "needs-input",
		timeLabel: "36s",
		title: "Needs input",
	},
];

/** A completed attached session with the shared success treatment. */
export const AGENT_SESSION_ATTACHED_FINISHED_ITEMS: readonly AgentSessionItem[] = [
	{
		agent: {
			brandName: "figma",
			id: "figma",
			kind: "agent",
			name: "Figma",
		},
		host: "cloud",
		id: "PAY-112:figma",
		sessionDetails: {
			host: "cloud",
			issueKey: "PAY-112",
			issueSummary: "Confirm the sandbox key retention window before replay",
		},
		state: "complete",
		timeLabel: "Last week",
		title: "Finished",
	},
];

export const AGENT_SESSION_ATTACHED_ITEMS = AGENT_SESSION_ATTACHED_WORKING_ITEMS;

/**
 * Candidate work items per session, keyed by session id.
 *
 * A session rarely maps to exactly one work item — the same local thread often
 * touches the ticket it started from plus the neighbours it turned out to
 * affect. The untracked-work flyout offers the first key.
 */
export const AGENT_SESSION_MULTI_LINK_KEYS: Readonly<Record<string, readonly string[]>> = {
	"lw-scope-thread": ["PAY-101", "PAY-121", "PAY-104"],
	"lw-kickoff-killswitch-session": ["PAY-121", "PAY-101"],
	"lw-night-suite-session": ["PAY-113", "PAY-105"],
};
