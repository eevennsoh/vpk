import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";

// Reference: atlassian/prototyping, wiv-v2/main at 3a53253a, packages/prototypes/wiv-v2.
// Explore WIP session threads: wiv-v2/main at 091d9991 (App.jsx WIP seeded session starters).
/** A message in a session's Activity thread, offset in minutes from the invocation. */
export type ProjectButterSessionReply = Readonly<{ id: string; author: string; body: string; minutesAfter: number }>;
export type ProjectButterSessionItem = AgentSessionItem & {
	message: string;
	invokedAtMs?: number;
	prompt?: string;
	selfAssignedOnStart?: boolean;
	/** Thread replies seeded into Activity below the session's start comment. */
	activityReplies?: readonly ProjectButterSessionReply[];
};
export const PROJECT_BUTTER_SESSION_EPOCH = Date.UTC(2026, 10, 1, 15, 45);

export const PROJECT_BUTTER_SESSIONS: readonly ProjectButterSessionItem[] = [
	{
		id: "butter-coding",
		invokedAtMs: Date.UTC(2026, 4, 19, 9),
		title: "Draft billing flow PRD",
		agent: {
			id: "rovo-dev",
			name: "Jira Coding agent",
			avatarSrc: "/avatar-agent-new/lime/auto-dev.svg",
		},
		invokedBy: { name: "Annie Cook", avatarSrc: "/avatar-user/maia-ma/color/asow-dev-lime.png" },
		branch: "feature/VITA-1-onboarding-redesign",
		host: "cloud",
		state: "needs-input",
		timeLabel: "19 May",
		message: "I pulled the description, linked notes, and recent comments. Should I prioritise the MVP path or unblock design review before continuing?",
	},
	{
		id: "butter-scoping",
		invokedAtMs: PROJECT_BUTTER_SESSION_EPOCH - 14 * 60 * 60 * 1000,
		title: "Troubleshoot 403 API errors",
		agent: {
			id: "work-item-planner",
			name: "Jira Scoping agent",
			avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
		},
		invokedBy: { name: "Annie Cook", avatarSrc: "/avatar-user/maia-ma/color/asow-dev-lime.png" },
		branch: "feature/VITA-1-onboarding-redesign",
		host: "cloud",
		state: "running",
		timeLabel: "19 May",
		message: "I’m tracing the onboarding API requests and checking authentication permissions. I’ll share the findings and next steps here.",
	},
	{
		id: "butter-claude",
		invokedAtMs: PROJECT_BUTTER_SESSION_EPOCH - 2 * 60 * 1000,
		title: "Review Teamwork onboarding guide",
		agent: { id: "claude", name: "Claude", brandName: "claude" },
		invokedBy: { name: "Annie Cook", avatarSrc: "/avatar-user/maia-ma/color/asow-dev-lime.png" },
		host: "local",
		state: "needs-input",
		timeLabel: "2m ago",
		sessionDetails: { pullRequestNumber: 1839 },
		message: "I reviewed the onboarding guide in PR #1839. Should I focus on the first-run setup instructions or the returning-user journey?",
	},
	{
		id: "butter-cursor-forecast",
		invokedAtMs: PROJECT_BUTTER_SESSION_EPOCH - 18 * 60 * 1000,
		title: "Compare the Q3 revenue forecast",
		agent: { id: "cursor", name: "Cursor", brandName: "cursor" },
		invokedBy: { name: "Annie Cook", avatarSrc: "/avatar-user/maia-ma/color/asow-dev-lime.png" },
		host: "cloud",
		state: "complete",
		timeLabel: "18m ago",
		message: "Which revenue line should we keep?",
		activityReplies: [
			{ id: "butter-cursor-annie-toolbar", author: "Annie Cook", minutesAfter: 5, body: "Did the indent and outdent controls make it onto the whiteboard toolbar?" },
			{ id: "butter-cursor-toolbar-notes", author: "Cursor", minutesAfter: 6, body: "Indent and outdent are now on the whiteboard element toolbar, in the same pattern as the list and align buttons.\n\nThe repository had no toolbar yet, so this adds the element-toolbar surface and wires the new controls into it.\n\n- **IndentButtonItem** and **OutdentButtonItem** are exported and registered on `CanvasElementToolbarItemData` next to the bullets item.\n- Shapes, sticky notes, and text boxes include both buttons. They call the editor `indent` and `outdent` commands.\n- Both buttons are disabled when the cursor is outside a list item. Indent is also disabled at nesting depth 6, and outdent is disabled on the outermost item (depth 1).\n- Tooltips use `whiteboard.element-toolbar.indent` (\"Indent\") and `whiteboard.element-toolbar.outdent` (\"Outdent\").\n\n`npm test` (49 tests, including the list-button cases) and `npm run typecheck` both passed. There is no application shell to exercise in a browser, so verification is from those unit tests." },
			{ id: "butter-cursor-annie-forecast", author: "Annie Cook", minutesAfter: 7, body: "The two revenue lines still disagree, and we need one chosen before the forecast can ship. What did you find?" },
			{ id: "butter-cursor-annie-choice", author: "Annie Cook", minutesAfter: 9, body: "Say which line we should keep and I will update the forecast on that branch." },
			{ id: "butter-cursor-question", author: "Cursor", minutesAfter: 10, body: "Which revenue line should we keep?" },
		],
	},
	{
		id: "butter-claude-postmortem",
		invokedAtMs: PROJECT_BUTTER_SESSION_EPOCH - 2 * 60 * 60 * 1000,
		title: "Rewrite the incident postmortem",
		agent: { id: "claude", name: "Claude", brandName: "claude" },
		invokedBy: { name: "Annie Cook", avatarSrc: "/avatar-user/maia-ma/color/asow-dev-lime.png" },
		host: "cloud",
		state: "complete",
		timeLabel: "2h ago",
		message: "I rewrote the postmortem from the incident notes. The timeline, impact, and follow-up actions are ready for review.",
		activityReplies: [
			["Sarah Lim", "The onboarding guide still sends people to the old identity page."],
			["Marcus Kim", "I can update the handoff steps once the owner is named."],
			["Elena Rodriguez", "The fallback path drops the session when the page refreshes."],
			["David Hsieh", "The decision should live on the work item, not a side page."],
			["Amara Okafor", "I will link the guide from the description after the review."],
			["Hiroshi Tanaka", "The acceptance criteria do not mention the new sign-in step."],
			["Liam Wilson", "Search results still point at the archived version of the guide."],
			["Fatima Zahra", "I left comments on the Confluence page for the sections that changed."],
			["Oliver Knight", "I can take the next pass once the open questions are marked."],
		].map(([author, body], index) => ({ id: `butter-claude-postmortem-reply-${index}`, author, body, minutesAfter: (index + 1) * 11 })),
	},
];

export function createProjectButterSessions(preset: JiraWorkItemPreset): ProjectButterSessionItem[] {
	if (preset === "empty" || preset === "blank") return [];
	return PROJECT_BUTTER_SESSIONS.map((session) => ({
		...session,
		state: preset === "running" ? "running" : session.state,
	}));
}
