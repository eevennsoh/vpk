import { PROJECT_BUTTER_SESSION_EPOCH, PROJECT_BUTTER_SESSIONS, type ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { BUTTER_PAY_CURRENT_USER } from "@/components/projects/butter-v1/data/current-user";

export const BUTTER_GALLERY_SESSIONS: readonly ProjectButterSessionItem[] = PROJECT_BUTTER_SESSIONS.map((session) => ({
	...session,
	invokedBy: { name: BUTTER_PAY_CURRENT_USER.name, avatarSrc: BUTTER_PAY_CURRENT_USER.avatarSrc },
	role: "owner",
}));

export const BUTTER_WORK_ITEM_SESSIONS: readonly ProjectButterSessionItem[] = [...BUTTER_GALLERY_SESSIONS
	.filter((session) => session.id === "butter-coding" || session.id === "butter-cursor-forecast")
	.map<ProjectButterSessionItem>((session) => session.id === "butter-coding" ? {
		...session,
		invokedBy: PROJECT_BUTTER_SESSIONS.find(({ id }) => id === session.id)?.invokedBy,
		role: "viewer",
		title: "Implement onboarding step validation",
		message: "I reviewed the onboarding requirements. Should I start with account setup validation or the progress indicator?",
	} : {
		...session,
		title: "Review the onboarding flow",
		message: "I reviewed the onboarding flow and identified the main account setup issues.",
		activityReplies: [
			{ id: "onboarding-cursor-reply-1", author: "Annie Cook", minutesAfter: 5, body: "Did you check the account setup step?" },
			{ id: "onboarding-cursor-reply-2", author: "Marcus Kim", minutesAfter: 6, body: "Yes. The validation messages need to explain how to recover from an error." },
			{ id: "onboarding-cursor-reply-3", author: "Annie Cook", minutesAfter: 7, body: "Please check keyboard navigation too." },
			{ id: "onboarding-cursor-reply-4", author: "Marcus Kim", minutesAfter: 9, body: "The step controls are reachable by keyboard, but the error summary needs focus." },
			{ id: "onboarding-cursor-reply-5", author: "Annie Cook", minutesAfter: 10, body: "Thanks. Let's include both fixes in the next pass." },
		],
	}),
	{
		id: "butter-marcus-accessibility",
		invokedAtMs: PROJECT_BUTTER_SESSION_EPOCH - 45 * 60 * 1000,
		title: "Check onboarding accessibility",
		agent: { id: "claude", name: "Claude", brandName: "claude" },
		invokedBy: { name: "Marcus Kim", avatarSrc: projectButterPersonAvatar("Marcus Kim") },
		role: "viewer",
		host: "cloud",
		state: "running",
		timeLabel: "45m ago",
		message: "I’m checking keyboard navigation and error recovery across the onboarding steps.",
	},
	{
		id: "butter-sarah-onboarding-copy",
		invokedAtMs: PROJECT_BUTTER_SESSION_EPOCH - 90 * 60 * 1000,
		title: "Review onboarding copy",
		agent: { id: "cursor", name: "Cursor", brandName: "cursor" },
		invokedBy: { name: "Sarah Lim", avatarSrc: projectButterPersonAvatar("Sarah Lim") },
		role: "viewer",
		host: "cloud",
		state: "complete",
		timeLabel: "1h ago",
		message: "I reviewed the setup copy and noted where the instructions can be clearer.",
	},
];
