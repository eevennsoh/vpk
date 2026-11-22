import type { JiraActivityActor, JiraActivityCommentEntry, JiraActivityEntry, JiraActivityReply } from "@/components/blocks/jira-activity";
import { createProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import { projectButterSessionInvocation } from "@/components/blocks/jira-work-item/project-butter/activity-feed-model";
import { PROJECT_BUTTER_SESSIONS, PROJECT_BUTTER_SESSION_EPOCH, type ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { BUTTER_WORK_ITEM_SESSIONS } from "@/components/projects/butter-v1/data/gallery-work-item-sessions";
import { BUTTER_PAY_CURRENT_USER } from "@/components/projects/butter-v1/data/current-user";

function fixtureSession(items: readonly ProjectButterSessionItem[], id: string): ProjectButterSessionItem {
	const session = items.find((item) => item.id === id);
	if (!session) throw new Error(`Missing VITA-1 activity fixture: ${id}`);
	return session;
}

export const ACTIVITY_PREVIEW_USER: JiraActivityActor = { ...BUTTER_PAY_CURRENT_USER, kind: "person" };
export const ACTIVITY_OWNER_SESSION = fixtureSession(BUTTER_WORK_ITEM_SESSIONS, "butter-cursor-forecast");
export const ACTIVITY_TEAMMATE_SESSION: ProjectButterSessionItem = {
	...fixtureSession(PROJECT_BUTTER_SESSIONS, "butter-claude"),
	invokedAtMs: PROJECT_BUTTER_SESSION_EPOCH - 60 * 60_000,
	timeLabel: "1h ago",
};

const AUDIT_AGES = new Map([
	["sensitive-data-restore-2026-10-26", 22],
	["sensitive-data-inline-removed-description", 44],
]);

export function createActivityPreviewEntries() {
	const reference = createProjectButterActivity(false);
	return {
		owner: projectButterSessionInvocation(ACTIVITY_OWNER_SESSION),
		teammate: projectButterSessionInvocation(ACTIVITY_TEAMMATE_SESSION),
		comments: reference.filter((entry) => entry.id === "butter-source-comment-1"),
		audit: reference.flatMap((entry) => {
			const age = AUDIT_AGES.get(entry.id);
			return age === undefined ? [] : [{ ...entry, timestamp: `${age} mins ago`, createdAtMs: PROJECT_BUTTER_SESSION_EPOCH - age * 60_000 }];
		}).sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)),
	};
}

type InstructionDraft =
	| Readonly<{ kind: "idle" }>
	| Readonly<{ kind: "review"; text: string; sources: readonly JiraActivityReply[] }>
	| Readonly<{ kind: "pending"; replyId: string }>;

export type ActivityOwnerState = Readonly<{ entry: JiraActivityCommentEntry; draft: InstructionDraft; working: boolean }>;
export type ActivityOwnerAction =
	| Readonly<{ type: "entries"; entries: readonly JiraActivityEntry[] }>
	| Readonly<{ type: "draft"; sources: readonly JiraActivityReply[] }>
	| Readonly<{ type: "text"; text: string }>
	| Readonly<{ type: "send"; text: string; replyId: string }>
	| Readonly<{ type: "acknowledge"; replyId: string }>;

const INITIAL_INSTRUCTION = "Update the account setup validation messages to explain how to recover from an error. Move focus to the error summary when validation fails. Check keyboard navigation, then share the changes and verification results in this discussion.";

export function activityOwnerReducer(state: ActivityOwnerState, action: ActivityOwnerAction): ActivityOwnerState {
	switch (action.type) {
		case "entries": {
			const entry = action.entries.find((candidate) => candidate.id === state.entry.id);
			return entry?.kind === "comment" ? { ...state, entry } : state;
		}
		case "draft": {
			if (state.draft.kind !== "idle") return state;
			const { sources } = action;
			const additional = sources.slice(5).map((reply) => `${reply.actor.name}: ${reply.body}`);
			const text = additional.length ? `${INITIAL_INSTRUCTION}\n\nAlso consider this additional discussion:\n${additional.join("\n")}` : INITIAL_INSTRUCTION;
			return { ...state, draft: { kind: "review", text, sources } };
		}
		case "text":
			return state.draft.kind === "review" ? { ...state, draft: { ...state.draft, text: action.text } } : state;
		case "send": {
			const text = action.text.trim();
			if (state.draft.kind !== "review" || !text) return state;
			const reply: JiraActivityReply = { id: action.replyId, actor: ACTIVITY_PREVIEW_USER, timestamp: "Just now", body: text };
			return {
				...state,
				entry: { ...state.entry, replies: [...state.entry.replies ?? [], reply], replyPreviewCount: 1 },
				draft: { kind: "pending", replyId: reply.id },
			};
		}
		case "acknowledge": {
			if (state.draft.kind !== "pending" || state.draft.replyId !== action.replyId) return state;
			return {
				entry: {
					...state.entry,
					replies: state.entry.replies?.map((reply) => reply.id === action.replyId
						? { ...reply, reactions: [...reply.reactions ?? [], { emoji: "👀", actorIds: [state.entry.actor.id] }] }
						: reply),
				},
				draft: { kind: "idle" },
				working: true,
			};
		}
	}
}
