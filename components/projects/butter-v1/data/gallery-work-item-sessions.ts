import { PROJECT_BUTTER_SESSIONS, type ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { BUTTER_PAY_CURRENT_USER } from "@/components/projects/butter-v1/data/current-user";

export const BUTTER_GALLERY_SESSIONS: readonly ProjectButterSessionItem[] = PROJECT_BUTTER_SESSIONS.map((session) => ({
	...session,
	invokedBy: { name: BUTTER_PAY_CURRENT_USER.name, avatarSrc: BUTTER_PAY_CURRENT_USER.avatarSrc },
	role: "owner",
}));

export const BUTTER_WORK_ITEM_SESSIONS: readonly ProjectButterSessionItem[] = BUTTER_GALLERY_SESSIONS
	.filter((session) => session.id === "butter-coding" || session.id === "butter-cursor-forecast")
	.map((session) => session.id === "butter-coding" ? {
		...session,
		title: "Implement onboarding step validation",
		message: "I reviewed the onboarding requirements. Should I start with account setup validation or the progress indicator?",
	} : {
		...session,
		title: "Review the onboarding flow",
		message: "I reviewed the onboarding flow and identified the main account setup issues.",
		activityReplies: [
			{ id: "onboarding-cursor-reply-1", author: "Annie Cook", minutesAfter: 5, body: "Did you check the account setup step?" },
			{ id: "onboarding-cursor-reply-2", author: "Cursor", minutesAfter: 6, body: "Yes. The validation messages need to explain how to recover from an error." },
			{ id: "onboarding-cursor-reply-3", author: "Annie Cook", minutesAfter: 7, body: "Please check keyboard navigation too." },
			{ id: "onboarding-cursor-reply-4", author: "Cursor", minutesAfter: 9, body: "The step controls are reachable by keyboard, but the error summary needs focus." },
			{ id: "onboarding-cursor-reply-5", author: "Annie Cook", minutesAfter: 10, body: "Thanks. Let's include both fixes in the next pass." },
		],
	});
