import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";

// Reference: atlassian/prototyping, wiv-v2/main at 72a8dc5d, packages/prototypes/wiv-v2.
export type ProjectButterSessionItem = AgentSessionItem & { message: string };

export const PROJECT_BUTTER_SESSIONS: readonly ProjectButterSessionItem[] = [
	{
		id: "butter-coding",
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
		title: "Review Teamwork onboarding guide",
		agent: { id: "claude", name: "Claude", brandName: "claude" },
		invokedBy: { name: "Annie Cook", avatarSrc: "/avatar-user/maia-ma/color/asow-dev-lime.png" },
		host: "local",
		state: "needs-input",
		timeLabel: "46m ago",
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
