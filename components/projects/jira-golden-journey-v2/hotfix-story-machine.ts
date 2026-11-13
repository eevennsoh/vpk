/**
 * Pure state machine for the Jira Golden Journey v2 story. Each chapter carries only its own
 * step, so "build step while reviewing" cannot be represented. No React and no data
 * fixtures: the hook resolves board columns and reduced motion, and feeds events in.
 */
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { PullRequestFixAgentId } from "@/components/blocks/pull-request-fix";
import type { TimedTransitionTable } from "@/components/hooks/use-timed-transition";

import type { JiraAgentsOrchestrationStep } from "./data/orchestration-state";
import type {
	JiraAgentsBuildStep,
	JiraAgentsDescriptionSkillPhase,
	JiraAgentsFixStep,
	JiraAgentsReviewStep,
	JiraAgentsStoryChapter,
} from "./data/story-model";

export type JiraAgentsStoryStage =
	| { readonly chapter: "intake"; readonly descriptionSkillPhase: JiraAgentsDescriptionSkillPhase }
	| { readonly chapter: "plan"; readonly orchestrationStep: Exclude<JiraAgentsOrchestrationStep, "idle"> }
	| { readonly chapter: "build"; readonly buildStep: JiraAgentsBuildStep }
	| { readonly chapter: "review"; readonly reviewStep: JiraAgentsReviewStep }
	| { readonly chapter: "fix"; readonly fixStep: JiraAgentsFixStep; readonly fixAgentId: PullRequestFixAgentId | null }
	| { readonly chapter: "approve" }
	| { readonly chapter: "release" };

export interface JiraAgentsStoryMachineState {
	readonly stage: JiraAgentsStoryStage;
	/** Bumped when the open chapter is selected again, so the page can replay it. */
	readonly chapterRevision: number;
	/** Bumped on every visible change, so the work item rehydrates its snapshot. */
	readonly launchId: number;
	/** Board columns as last arranged on the board; `null` until the board is touched. */
	readonly boardColumns: readonly JiraKanbanColumnData[] | null;
}

export type JiraAgentsStoryTimerKey =
	| `intake:${JiraAgentsDescriptionSkillPhase}`
	| `plan:${Exclude<JiraAgentsOrchestrationStep, "idle">}`
	| `build:${JiraAgentsBuildStep}`
	| `review:${JiraAgentsReviewStep}`
	| `fix:${JiraAgentsFixStep}`;

export type JiraAgentsStoryEvent =
	| { readonly type: "select-chapter"; readonly chapter: JiraAgentsStoryChapter }
	/** The board moved; `chapter` is where the story card landed, when it maps to one. */
	| {
		readonly type: "board-changed";
		readonly columns: readonly JiraKanbanColumnData[];
		readonly chapter: JiraAgentsStoryChapter | null;
	}
	| { readonly type: "invoke-description-skill" }
	| { readonly type: "apply-description-suggestion" }
	| { readonly type: "dismiss-description-suggestion" }
	| { readonly type: "start-orchestration" }
	| { readonly type: "approve-pull-request" }
	| {
		readonly type: "fix-pull-request-check";
		/** Whether the fix targets the story's own PR; fixes on other PRs are ignored. */
		readonly isStoryPullRequest: boolean;
		readonly agentId: PullRequestFixAgentId;
		/** Reduced motion skips the repairing beat. */
		readonly reducedMotion: boolean;
	}
	| { readonly type: "timer-elapsed"; readonly next: JiraAgentsStoryTimerKey };

// These timers reveal authored state snapshots rather than animating layout. Plan stops at
// "complete"; Build only starts when the user selects it. Fix waits for PullRequestFix submit.
export const JIRA_AGENTS_STORY_TIMERS: TimedTransitionTable<JiraAgentsStoryTimerKey> = {
	"intake:running": { next: "intake:awaiting-confirmation", delayMs: 4_000 },
	"plan:agents-working": { next: "plan:comment", delayMs: 1_500 },
	"plan:comment": { next: "plan:reaction-1", delayMs: 1_200 },
	"plan:reaction-1": { next: "plan:reaction-2", delayMs: 1_000 },
	"plan:reaction-2": { next: "plan:lead", delayMs: 3_500 },
	"plan:lead": { next: "plan:consult", delayMs: 1_800 },
	"plan:consult": { next: "plan:complete", delayMs: 1_500 },
	// Demo staging from Plan end: hold on the Consult-ready frame → Implement + PR → Verify.
	"build:ready": { next: "build:implementing", delayMs: 2_500 },
	"build:implementing": { next: "build:verifying", delayMs: 2_200 },
	"build:verifying": { next: "build:complete", delayMs: 2_400 },
	// Review CI: start → widen → unit green → browser green → lint failure.
	"review:queued": { next: "review:running", delayMs: 1_200 },
	"review:running": { next: "review:unit-passed", delayMs: 1_500 },
	"review:unit-passed": { next: "review:settling", delayMs: 1_300 },
	"review:settling": { next: "review:failed", delayMs: 1_600 },
	// ~8 s keeps the CI spinner / rerunning beat visible in demos.
	"fix:repairing": { next: "fix:complete", delayMs: 8_000 },
};

/** Only Review and Fix collapse under reduced motion; the other reveals keep their timing. */
const REDUCED_MOTION_CHAPTERS: ReadonlySet<JiraAgentsStoryChapter> = new Set(["review", "fix"]);

export function createJiraAgentsStoryStage(chapter: JiraAgentsStoryChapter): JiraAgentsStoryStage {
	switch (chapter) {
		case "intake":
			return { chapter, descriptionSkillPhase: "idle" };
		case "plan":
			// Plan plays the staged Activity reveal (comment → 👀 → Claude → Code Planner).
			return { chapter, orchestrationStep: "agents-working" };
		case "build":
			return { chapter, buildStep: "ready" };
		case "review":
			return { chapter, reviewStep: "queued" };
		case "fix":
			// Fix continues from Review's failed PR until PullRequestFix submit advances it.
			return { chapter, fixStep: "failed", fixAgentId: null };
		case "approve":
		case "release":
			return { chapter };
	}
}

export const JIRA_AGENTS_STORY_INITIAL_STATE: JiraAgentsStoryMachineState = {
	stage: createJiraAgentsStoryStage("intake"),
	chapterRevision: 0,
	launchId: 0,
	boardColumns: null,
};

function enterChapter(
	state: JiraAgentsStoryMachineState,
	chapter: JiraAgentsStoryChapter,
	overrides: Partial<JiraAgentsStoryMachineState> = {},
): JiraAgentsStoryMachineState {
	return {
		...state,
		stage: createJiraAgentsStoryStage(chapter),
		launchId: state.launchId + 1,
		...overrides,
	};
}

function withStage(state: JiraAgentsStoryMachineState, stage: JiraAgentsStoryStage): JiraAgentsStoryMachineState {
	return { ...state, stage, launchId: state.launchId + 1 };
}

function applyTimer(state: JiraAgentsStoryMachineState, next: JiraAgentsStoryTimerKey): JiraAgentsStoryMachineState {
	const { stage } = state;
	if (selectJiraAgentsStoryTimerKey(stage) === next) {
		return state;
	}
	const [chapter, step] = next.split(":") as [JiraAgentsStoryChapter, string];
	if (chapter !== stage.chapter) {
		return state;
	}
	switch (stage.chapter) {
		case "intake":
			return withStage(state, { ...stage, descriptionSkillPhase: step as JiraAgentsDescriptionSkillPhase });
		case "plan":
			return withStage(state, { ...stage, orchestrationStep: step as Exclude<JiraAgentsOrchestrationStep, "idle"> });
		case "build":
			return withStage(state, { ...stage, buildStep: step as JiraAgentsBuildStep });
		case "review":
			return withStage(state, { ...stage, reviewStep: step as JiraAgentsReviewStep });
		case "fix":
			return withStage(state, { ...stage, fixStep: step as JiraAgentsFixStep });
		default:
			return state;
	}
}

/** Transition table. Returns the identical object when nothing changes. */
export function jiraAgentsStoryReducer(
	state: JiraAgentsStoryMachineState,
	event: JiraAgentsStoryEvent,
): JiraAgentsStoryMachineState {
	const { stage } = state;
	switch (event.type) {
		case "select-chapter":
			return enterChapter(state, event.chapter, {
				chapterRevision: event.chapter === stage.chapter ? state.chapterRevision + 1 : state.chapterRevision,
			});
		case "board-changed":
			if (event.chapter === null || event.chapter === stage.chapter) {
				return { ...state, boardColumns: event.columns };
			}
			return enterChapter(state, event.chapter, { boardColumns: event.columns });
		case "invoke-description-skill":
			if (stage.chapter !== "intake" || (stage.descriptionSkillPhase !== "idle" && stage.descriptionSkillPhase !== "dismissed")) {
				return state;
			}
			return withStage(state, { ...stage, descriptionSkillPhase: "running" });
		case "apply-description-suggestion":
		case "dismiss-description-suggestion":
			if (stage.chapter !== "intake" || stage.descriptionSkillPhase !== "awaiting-confirmation") {
				return state;
			}
			return withStage(state, {
				...stage,
				descriptionSkillPhase: event.type === "apply-description-suggestion" ? "applied" : "dismissed",
			});
		case "start-orchestration":
			if (stage.chapter !== "intake" || stage.descriptionSkillPhase !== "applied") {
				return state;
			}
			return enterChapter(state, "plan");
		case "approve-pull-request":
			// Approve lands ready-to-merge (teammate approvals and CI already green), so there is
			// never an "available" approval to act on.
			return state;
		case "fix-pull-request-check":
			if (stage.chapter !== "fix" || stage.fixStep !== "failed" || !event.isStoryPullRequest) {
				return state;
			}
			return withStage(state, {
				chapter: "fix",
				fixStep: event.reducedMotion ? "complete" : "repairing",
				fixAgentId: event.agentId,
			});
		case "timer-elapsed":
			return applyTimer(state, event.next);
		default: {
			const _exhaustive: never = event;
			void _exhaustive;
			return state;
		}
	}
}

/** The step that owns a timer in this stage, or `null` where nothing advances by itself. */
export function selectJiraAgentsStoryTimerKey(stage: JiraAgentsStoryStage): JiraAgentsStoryTimerKey | null {
	switch (stage.chapter) {
		case "intake":
			return `intake:${stage.descriptionSkillPhase}`;
		case "plan":
			return `plan:${stage.orchestrationStep}`;
		case "build":
			return `build:${stage.buildStep}`;
		case "review":
			return `review:${stage.reviewStep}`;
		case "fix":
			return `fix:${stage.fixStep}`;
		default:
			return null;
	}
}

export function selectJiraAgentsStoryReducedMotion(stage: JiraAgentsStoryStage, prefersReducedMotion: boolean): boolean {
	return prefersReducedMotion && REDUCED_MOTION_CHAPTERS.has(stage.chapter);
}

/** The flat view the controller exposes: steps outside their chapter read as at rest. */
export interface JiraAgentsStorySteps {
	readonly descriptionSkillPhase: JiraAgentsDescriptionSkillPhase;
	readonly orchestrationStep: JiraAgentsOrchestrationStep;
	readonly buildStep: JiraAgentsBuildStep;
	readonly reviewStep: JiraAgentsReviewStep;
	readonly fixStep: JiraAgentsFixStep;
	readonly fixAgentId: PullRequestFixAgentId | null;
	readonly pullRequestApproved: boolean;
}

export function selectJiraAgentsStorySteps(stage: JiraAgentsStoryStage): JiraAgentsStorySteps {
	return {
		descriptionSkillPhase: stage.chapter === "intake" ? stage.descriptionSkillPhase : "applied",
		orchestrationStep: stage.chapter === "plan" ? stage.orchestrationStep : "idle",
		buildStep: stage.chapter === "build" ? stage.buildStep : "complete",
		reviewStep: stage.chapter === "review" ? stage.reviewStep : "queued",
		fixStep: stage.chapter === "fix" ? stage.fixStep : "failed",
		fixAgentId: stage.chapter === "fix" ? stage.fixAgentId : null,
		pullRequestApproved: stage.chapter === "approve",
	};
}
