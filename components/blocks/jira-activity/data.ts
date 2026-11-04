import type { JiraActivityActor, JiraActivityEntry } from "./jira-activity-types";

// Cast: two humans, two AI agents, and one connected app (GitHub) — so the feed
// documents work done chronologically by both people and agents.
const ANTHONY: JiraActivityActor = {
	id: "anthony",
	name: "Anthony Chen",
	kind: "person",
	avatarSrc: "/avatar-human/anthony-chen.png",
};

const VENN: JiraActivityActor = {
	id: "venn",
	name: "Venn",
	kind: "person",
	avatarSrc: "/avatar-user/venn/venn.png",
};

const TRIAGE_AGENT: JiraActivityActor = {
	id: "triage",
	name: "Triage assistant",
	kind: "agent",
	avatarSrc: "/avatar-agent-new/blue/auto-fix.svg",
};

const ROVO_DEV: JiraActivityActor = {
	id: "rovo-dev",
	name: "Rovo",
	kind: "agent",
	vpkLogo: "rovo",
};

const PROGRESS_TRACKER: JiraActivityActor = {
	id: "progress-tracker",
	name: "Progress tracker",
	kind: "agent",
	avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
};

const GITHUB: JiraActivityActor = {
	id: "github",
	name: "GitHub",
	kind: "app",
	brandName: "github",
};

/** The signed-in viewer — powers the header avatar group and both composers. */
export const JIRA_ACTIVITY_CURRENT_USER: JiraActivityActor = VENN;

const AUTOMATION_TAG = { text: "Automation" } as const;

export const JIRA_ACTIVITY_ENTRIES: readonly JiraActivityEntry[] = [
	{
		id: "created",
		kind: "event",
		actor: ANTHONY,
		timestamp: "15min ago",
		segments: [{ type: "text", text: "created the issue" }],
	},
	{
		id: "labelled",
		kind: "event",
		actor: TRIAGE_AGENT,
		icon: "label",
		timestamp: "14min ago",
		segments: [
			{ type: "text", text: "added " },
			{ type: "label", text: "Bug", color: "red" },
			{ type: "text", text: " and " },
			{ type: "label", text: "UI Polish", color: "green" },
		],
	},
	{
		id: "sla",
		kind: "event",
		actor: ROVO_DEV,
		icon: "sla",
		timestamp: "14min ago",
		segments: [
			{ type: "text", text: "set the SLA to 1w " },
			{ type: "tag", ...AUTOMATION_TAG },
		],
	},
	{
		id: "moved-todo",
		kind: "event",
		actor: VENN,
		icon: "status",
		timestamp: "11min ago",
		segments: [
			{ type: "text", text: "moved from " },
			{ type: "lozenge", text: "Triage" },
			{ type: "transition-arrow" },
			{ type: "lozenge", text: "Todo" },
		],
	},
	{
		id: "assigned",
		kind: "event",
		actor: VENN,
		icon: "assigned",
		timestamp: "11min ago",
		segments: [
			{ type: "text", text: "self-assigned the issue and set priority to " },
			{ type: "priority", text: "Medium" },
		],
	},
	{
		// Human activity snapshot: a person's comment card with a stacked
		// avatar/name/timestamp header. It carries seeded reactions so the demo
		// shows both an unreacted pill and one the current viewer has pressed.
		id: "human-flag",
		kind: "comment",
		actor: VENN,
		timestamp: "10min ago",
		body: [
			{
				type: "text",
				text: "Flagging that this only reproduces on threads with a trailing reply input — let's confirm the fix holds in dark mode before we close it out.",
			},
		],
		reactions: [
			{ emoji: "👍️", actorIds: [ANTHONY.id, JIRA_ACTIVITY_CURRENT_USER.id] },
			{ emoji: "🎉", actorIds: [ANTHONY.id] },
		],
	},
	{
		id: "root-cause",
		kind: "comment",
		actor: PROGRESS_TRACKER,
		timestamp: "6min ago",
		tag: { text: "Waiting for you", color: "yellow" },
		body: [
			{ type: "text", text: "Likely root cause is the unconditional " },
			{ type: "code", text: "isLast" },
			{ type: "text", text: " calculation in " },
			{ type: "link", text: "ThreadedComments.tsx" },
			{
				type: "text",
				text: ": the final visible reply receives the card's 8px bottom radius even when ",
			},
			{ type: "code", text: "ThreadedCommentsReplyInput" },
			{ type: "text", text: " continues below it. Because " },
			{ type: "link", text: "useHighlightStyle.ts" },
			{
				type: "text",
				text: " draws the selection as an inset box-shadow, that radius produces the free-floating rounded blue corners shown in the screenshot.",
			},
		],
		collapsible: {
			label: "Investigation",
			content: [
				{
					type: "text",
					text: "Reproduced on the Todo board with a two-reply thread. Toggling ",
				},
				{ type: "code", text: "isLast" },
				{
					type: "text",
					text: " to account for a trailing reply input removes the stray corners; verified against ",
				},
				{ type: "link", text: "useHighlightStyle.ts" },
				{ type: "text", text: " in light and dark themes." },
			],
		},
		replies: [],
		sessionItem: {
			id: "performance-benchmarking",
			title: "Conduct performance benchmarking",
			state: "needs-input",
			agent: {
				name: "Progress tracker",
				avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
			},
			branch: "rovo/perf-27-benchmarks",
			elapsedSeconds: 360,
			prStatus: "created",
		},
	},
	{
		id: "delegated",
		kind: "event",
		actor: ROVO_DEV,
		icon: "delegated",
		timestamp: "6min ago",
		segments: [
			{ type: "text", text: "self-delegated the issue " },
			{ type: "tag", ...AUTOMATION_TAG },
		],
	},
	{
		id: "changed-files",
		kind: "changed-files",
		actor: PROGRESS_TRACKER,
		timestamp: "5min",
		summary: "Changed 2 files",
		description:
			"Adjusted the threaded comment radius logic so the final visible reply only rounds its bottom corners when no reply input follows.",
		branch: "#78672",
		sessionItem: {
			id: "performance-benchmarking-outputs",
			title: "Conduct performance benchmarking",
			state: "complete",
			agent: {
				name: "Progress tracker",
				avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
			},
			branch: "rovo/perf-27-benchmarks",
			elapsedSeconds: 300,
			completedSecondsAgo: 5 * 60,
		},
		outputs: [
			{
				id: "audience-engagement-report",
				title: "Audience Engagement Report",
				source: "Confluence page",
				owner: "Vitafleet Team",
				iconName: "globe",
			},
			{
				id: "chat-summary",
				title: "Chat summary title",
				source: "A snippet of the chat summary",
				iconName: "ai-chat",
			},
		],
	},
	{
		id: "moved-progress",
		kind: "event",
		actor: ROVO_DEV,
		icon: "in-progress",
		timestamp: "6min ago",
		segments: [
			{ type: "text", text: "moved from " },
			{ type: "lozenge", text: "Todo" },
			{ type: "transition-arrow" },
			{ type: "lozenge", text: "In Progress", variant: "information" },
			{ type: "text", text: " " },
			{ type: "tag", ...AUTOMATION_TAG },
		],
	},
	{
		id: "linked",
		kind: "event",
		actor: GITHUB,
		icon: "pull-request",
		timestamp: "2min ago",
		segments: [],
		pullRequest: {
			number: 1847,
			title: "Fix threaded comment highlight bottom corners",
			status: "Open",
			additions: 148,
			deletions: 37,
			authorName: "Venn",
			repository: "acme/storefront",
			branch: "fix/comment-highlight",
			targetBranch: "main",
			createdAtMs: Date.UTC(2026, 4, 12, 13, 40),
			updatedAtMs: Date.UTC(2026, 4, 12, 13, 58),
		},
	},
];
