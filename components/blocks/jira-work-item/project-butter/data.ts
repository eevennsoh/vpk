import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";

// Reference: atlassian/prototyping, wiv-v2/main at 3a53253a, packages/prototypes/wiv-v2.
export type ProjectButterSessionItem = AgentSessionItem & { message: string; invokedAtMs?: number };
export const PROJECT_BUTTER_SESSION_EPOCH = Date.UTC(2026, 10, 1, 15, 45);

export const PROJECT_BUTTER_SESSIONS: readonly ProjectButterSessionItem[] = [
	{
		id: "butter-coding",
		invokedAtMs: Date.UTC(2026, 4, 19, 9),
		title: "Draft billing flow PRD",
		agent: {
			id: "rovo-dev",
			name: "Jira Coding agent",
			avatarSrc: "/avatar-agent/dev-agents/basic-coding-agent-template.svg",
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
			avatarSrc: "/avatar-agent/teamwork-agents/work-item-planner.svg",
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
];

export function createProjectButterSessions(preset: JiraWorkItemPreset): ProjectButterSessionItem[] {
	if (preset === "empty" || preset === "blank") return [];
	return PROJECT_BUTTER_SESSIONS.map((session) => ({
		...session,
		state: preset === "running" ? "running" : session.state,
	}));
}
