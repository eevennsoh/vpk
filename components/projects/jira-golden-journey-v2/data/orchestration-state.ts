import type { JiraWorkItemState } from "@/components/blocks/jira-work-item/data/session-state";
import { getAgentActivityActorId } from "@/components/blocks/jira-work-item/data/shared-channel-state";

import { createJiraAgentsStoryState } from "./hotfix-story";

export type JiraAgentsOrchestrationStep =
	| "idle"
	| "agents-working"
	| "comment"
	| "reaction-1"
	| "reaction-2"
	| "lead"
	| "consult"
	| "complete";

const CONSULT_READY_PREVIEW = "Code Planner's secure API contract and validation matrix are ready. I'm confirming the plan handoff before implementation begins in Build.";

function createConsultReadyPlanState(
	plan: Readonly<JiraWorkItemState>,
	build: Readonly<JiraWorkItemState>,
): JiraWorkItemState {
	const completedPlanner = build.sessions.find((session) => session.agentId === "code-planner");
	return {
		...plan,
		sessions: plan.sessions.map((session) => {
			if (session.agentId === "code-planner" && completedPlanner) return completedPlanner;
			if (session.agentId !== "claude-code") return session;
			// Consultation reply is visible — check off "Consult Code Planner…".
			// Build staging continues from this Plan-end checklist (1 checked, no artifacts).
			const progressChecklist = session.progressChecklist?.map((item, index) => (
				index === 0 ? { ...item, completed: true } : item
			));
			return {
				...session,
				previewText: CONSULT_READY_PREVIEW,
				...(progressChecklist ? { progressChecklist } : {}),
				messages: session.messages.map((message, index) => index === session.messages.length - 1
					? { ...message, content: CONSULT_READY_PREVIEW }
					: message),
			};
		}),
	};
}

function acknowledgementActorIds(state: Readonly<JiraWorkItemState>): string[] {
	return state.sessions
		.filter((session) => session.status !== "completed" && !session.agentId.startsWith("skill:"))
		.map((session) => getAgentActivityActorId(session.agentId));
}

/**
 * Route-owned snapshots for the prompt-driven orchestration reveal. Sessions
 * exist from the first step so the composer can immediately show the shared
 * two-agent context. Activity independently reveals those sessions after the
 * prompt and acknowledgement reactions land.
 */
export function createJiraAgentsOrchestrationState(
	step: JiraAgentsOrchestrationStep,
): JiraWorkItemState {
	if (step === "idle") return createJiraAgentsStoryState("intake");

	const intake = createJiraAgentsStoryState("intake", { descriptionImproved: true });
	const plan = createJiraAgentsStoryState("plan");
	const build = createJiraAgentsStoryState("build");
	// Consult and the terminal Plan complete step share the handoff-ready plan
	// snapshot so orchestration can finish without advancing into Build.
	const stageState = step === "consult" || step === "complete"
		? createConsultReadyPlanState(plan, build)
		: plan;
	const orchestrationComment = stageState.comments.find(
		(comment) => comment.id === "story-channel-orchestration",
	);
	// Eyes acknowledge the prompt, then clear as soon as the lead agent comments.
	const reactionCount = step === "reaction-1"
		? 1
		: step === "reaction-2"
			? 2
			: 0;
	const showComment = step !== "agents-working";
	const showLeadActivity = step === "lead" || step === "consult" || step === "complete";
	const reactionActorIds = acknowledgementActorIds(stageState);
	const stagedComment = orchestrationComment
		? {
			...orchestrationComment,
			...(reactionCount > 0
				? {
					reactions: [{
						emoji: "👀",
						actorIds: reactionActorIds.slice(0, reactionCount),
					}],
				}
				: { reactions: undefined }),
		}
		: null;

	return {
		...stageState,
		comments: showComment && stagedComment
			? [...intake.comments, stagedComment]
			: intake.comments,
		staticEvents: showLeadActivity ? stageState.staticEvents : intake.staticEvents,
	};
}
