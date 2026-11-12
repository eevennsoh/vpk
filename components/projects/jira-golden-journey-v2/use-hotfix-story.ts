"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import type { JiraWorkItemState } from "@/components/blocks/jira-work-item/data/session-state";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import {
	DEFAULT_PULL_REQUEST_FIX_AGENT_ID,
	type PullRequestFixAgentId,
} from "@/components/blocks/pull-request-fix";
import type { JiraForYouSection } from "@/components/projects/jira-for-you/jira-for-you-types";
import {
	createJiraAgentsBoardColumns,
	createJiraAgentsStoryState,
	createJiraAgentsStoryWorkItem,
	createJiraAgentsWorkspaceSections,
	getJiraAgentsStoryChapterForStatus,
	getJiraAgentsStoryColumn,
	JIRA_AGENTS_PULL_REQUEST_IDENTITY,
	type JiraAgentsBuildStep,
	type JiraAgentsDescriptionSkillPhase,
	type JiraAgentsFixStep,
	type JiraAgentsReviewStep,
	type JiraAgentsStoryChapter,
} from "./data/hotfix-story";
import {
	createJiraAgentsOrchestrationState,
	type JiraAgentsOrchestrationStep,
} from "./data/orchestration-state";

const ORCHESTRATION_SEQUENCE = {
	"agents-working": { next: "comment", delayMs: 1_500 },
	comment: { next: "reaction-1", delayMs: 1_200 },
	"reaction-1": { next: "reaction-2", delayMs: 1_000 },
	"reaction-2": { next: "lead", delayMs: 3_500 },
	lead: { next: "consult", delayMs: 1_800 },
	consult: { next: "complete", delayMs: 1_500 },
} as const satisfies Record<
	Exclude<JiraAgentsOrchestrationStep, "idle" | "complete">,
	{ next: Exclude<JiraAgentsOrchestrationStep, "idle">; delayMs: number }
>;

// Demo-friendly staging from Plan end:
// hold on Consult-ready frame → Implement+PR → Verify+screenshot → settle.
const BUILD_SEQUENCE = {
	ready: { next: "implementing", delayMs: 2_500 },
	implementing: { next: "verifying", delayMs: 2_200 },
	verifying: { next: "complete", delayMs: 2_400 },
} as const satisfies Record<
	Exclude<JiraAgentsBuildStep, "complete">,
	{ next: JiraAgentsBuildStep; delayMs: number }
>;

// Review CI: start → widen → unit green → browser green → lint failure.
const REVIEW_SEQUENCE = {
	queued: { next: "running", delayMs: 1_200 },
	running: { next: "unit-passed", delayMs: 1_500 },
	"unit-passed": { next: "settling", delayMs: 1_300 },
	settling: { next: "failed", delayMs: 1_600 },
} as const satisfies Record<
	Exclude<JiraAgentsReviewStep, "failed">,
	{ next: JiraAgentsReviewStep; delayMs: number }
>;

// Fix CI repair after PullRequestFix submit: repairing → green.
// ~8s keeps the CI spinner / rerunning beat visible in demos.
const FIX_SEQUENCE = {
	repairing: { next: "complete", delayMs: 8_000 },
} as const satisfies Record<
	Exclude<JiraAgentsFixStep, "failed" | "complete">,
	{ next: JiraAgentsFixStep; delayMs: number }
>;

const DESCRIPTION_SKILL_GENERATION_DELAY_MS = 4_000;

export type JiraAgentsPullRequestApprovalState = "available" | "approved";

export interface JiraAgentsStoryController {
	applyDescriptionSuggestion: () => void;
	approvePullRequest: (identity: string) => void;
	boardColumns: readonly JiraKanbanColumnData[];
	buildStep: JiraAgentsBuildStep;
	chapter: JiraAgentsStoryChapter;
	chapterRevision: number;
	descriptionSkillPhase: JiraAgentsDescriptionSkillPhase;
	descriptionImproved: boolean;
	dismissDescriptionSuggestion: () => void;
	fixPullRequestCheck: (identity: string, agentId?: PullRequestFixAgentId) => void;
	fixStep: JiraAgentsFixStep;
	initialState: JiraWorkItemState;
	invokeDescriptionSkill: () => void;
	launchId: number;
	orchestrationStep: JiraAgentsOrchestrationStep;
	pullRequestApprovalStates: Readonly<Record<string, JiraAgentsPullRequestApprovalState>>;
	resetCurrentChapter: () => void;
	reviewStep: JiraAgentsReviewStep;
	sections: readonly JiraForYouSection[];
	selectChapter: (chapter: JiraAgentsStoryChapter) => void;
	startOrchestration: () => void;
	updateBoardColumns: (columns: readonly JiraKanbanColumnData[]) => void;
	workItem: WorkItemData;
}

export function useJiraAgentsStory(active = true): JiraAgentsStoryController {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const [chapter, setChapter] = useState<JiraAgentsStoryChapter>("intake");
	const [chapterRevision, setChapterRevision] = useState(0);
	const [descriptionSkillPhase, setDescriptionSkillPhase] = useState<JiraAgentsDescriptionSkillPhase>("idle");
	const [orchestrationStep, setOrchestrationStep] = useState<JiraAgentsOrchestrationStep>("idle");
	const [buildStep, setBuildStep] = useState<JiraAgentsBuildStep>("complete");
	const [pullRequestApprovalStates, setPullRequestApprovalStates] = useState<
		Record<string, JiraAgentsPullRequestApprovalState>
	>({});
	const [reviewStep, setReviewStep] = useState<JiraAgentsReviewStep>("queued");
	const [fixStep, setFixStep] = useState<JiraAgentsFixStep>("failed");
	const [fixAgentId, setFixAgentId] = useState<PullRequestFixAgentId>(
		DEFAULT_PULL_REQUEST_FIX_AGENT_ID,
	);
	const [launchId, setLaunchId] = useState(0);
	const [boardColumns, setBoardColumns] = useState<JiraKanbanColumnData[]>(
		() => createJiraAgentsBoardColumns("intake"),
	);

	const selectChapter = useCallback((nextChapter: JiraAgentsStoryChapter) => {
		if (nextChapter === chapter) {
			setChapterRevision((current) => current + 1);
		}
		// Plan plays the staged Activity reveal (comment → 👀 → Claude → Code Planner).
		setOrchestrationStep(nextChapter === "plan" ? "agents-working" : "idle");
		// Build stages former Handoff work from Plan end:
		// ready (orient) → implement → verify/screenshot → complete.
		setBuildStep(nextChapter === "build" ? "ready" : "complete");
		setChapter(nextChapter);
		setDescriptionSkillPhase(nextChapter === "intake" ? "idle" : "applied");
		// Approve lands ready-to-merge: teammate approvals + CI are already green.
		setPullRequestApprovalStates(nextChapter === "approve"
			? { [JIRA_AGENTS_PULL_REQUEST_IDENTITY]: "approved" }
			: {});
		setReviewStep("queued");
		// Fix continues from Review's failed PR until PullRequestFix submit advances it.
		setFixStep("failed");
		setFixAgentId(DEFAULT_PULL_REQUEST_FIX_AGENT_ID);
		setLaunchId((current) => current + 1);
		setBoardColumns((current) => createJiraAgentsBoardColumns(nextChapter, current));
	}, [chapter]);

	const resetCurrentChapter = useCallback(() => {
		selectChapter(chapter);
	}, [chapter, selectChapter]);

	const invokeDescriptionSkill = useCallback(() => {
		if (
			chapter !== "intake"
			|| descriptionSkillPhase === "running"
			|| descriptionSkillPhase === "awaiting-confirmation"
			|| descriptionSkillPhase === "applied"
		) return;
		setDescriptionSkillPhase("running");
		setLaunchId((current) => current + 1);
	}, [chapter, descriptionSkillPhase]);

	const applyDescriptionSuggestion = useCallback(() => {
		if (chapter !== "intake" || descriptionSkillPhase !== "awaiting-confirmation") return;
		setDescriptionSkillPhase("applied");
		setLaunchId((current) => current + 1);
	}, [chapter, descriptionSkillPhase]);

	const dismissDescriptionSuggestion = useCallback(() => {
		if (chapter !== "intake" || descriptionSkillPhase !== "awaiting-confirmation") return;
		setDescriptionSkillPhase("dismissed");
		setLaunchId((current) => current + 1);
	}, [chapter, descriptionSkillPhase]);

	const descriptionImproved = descriptionSkillPhase === "applied";

	const startOrchestration = useCallback(() => {
		if (chapter !== "intake" || !descriptionImproved || orchestrationStep !== "idle") return;
		setChapter("plan");
		setOrchestrationStep("agents-working");
		setBuildStep("complete");
		setPullRequestApprovalStates({});
		setReviewStep("queued");
		setFixStep("failed");
		setFixAgentId(DEFAULT_PULL_REQUEST_FIX_AGENT_ID);
		setLaunchId((current) => current + 1);
		setBoardColumns((current) => createJiraAgentsBoardColumns("plan", current));
	}, [chapter, descriptionImproved, orchestrationStep]);

	useEffect(() => {
		if (!active || chapter !== "intake" || descriptionSkillPhase !== "running") return undefined;
		const timeoutId = window.setTimeout(() => {
			setDescriptionSkillPhase("awaiting-confirmation");
			setLaunchId((current) => current + 1);
		}, DESCRIPTION_SKILL_GENERATION_DELAY_MS);
		return () => window.clearTimeout(timeoutId);
	}, [active, chapter, descriptionSkillPhase]);

	// These timers reveal authored state snapshots rather than animating layout.
	// Plan orchestration stops at "complete" — Build only starts when the user
	// selects that chapter manually. Review CI keeps the same causal frames, but
	// reduced motion jumps straight to the final failed checks. Fix waits for
	// PullRequestFix submit, then stages repairing → green (reduced motion
	// jumps to green).
	useEffect(() => {
		if (!active || orchestrationStep === "idle" || orchestrationStep === "complete") {
			return undefined;
		}

		const transition = ORCHESTRATION_SEQUENCE[orchestrationStep];
		const timeoutId = window.setTimeout(() => {
			setOrchestrationStep(transition.next);
			setLaunchId((current) => current + 1);
		}, transition.delayMs);

		return () => window.clearTimeout(timeoutId);
	}, [active, orchestrationStep]);

	useEffect(() => {
		if (!active || chapter !== "build" || buildStep === "complete") return undefined;
		const transition = BUILD_SEQUENCE[buildStep];
		const timeoutId = window.setTimeout(() => {
			setBuildStep(transition.next);
			setLaunchId((current) => current + 1);
		}, transition.delayMs);
		return () => window.clearTimeout(timeoutId);
	}, [active, buildStep, chapter]);

	useEffect(() => {
		if (!active || chapter !== "review" || reviewStep === "failed") return undefined;
		if (shouldReduceMotion) {
			setReviewStep("failed");
			setLaunchId((current) => current + 1);
			return undefined;
		}
		const transition = REVIEW_SEQUENCE[reviewStep];
		const timeoutId = window.setTimeout(() => {
			setReviewStep(transition.next);
			setLaunchId((current) => current + 1);
		}, transition.delayMs);
		return () => window.clearTimeout(timeoutId);
	}, [active, chapter, reviewStep, shouldReduceMotion]);

	useEffect(() => {
		if (!active || chapter !== "fix" || fixStep !== "repairing") return undefined;
		if (shouldReduceMotion) {
			setFixStep("complete");
			setLaunchId((current) => current + 1);
			return undefined;
		}
		const transition = FIX_SEQUENCE[fixStep];
		const timeoutId = window.setTimeout(() => {
			setFixStep(transition.next);
			setLaunchId((current) => current + 1);
		}, transition.delayMs);
		return () => window.clearTimeout(timeoutId);
	}, [active, chapter, fixStep, shouldReduceMotion]);

	const approvePullRequest = useCallback((identity: string) => {
		if (
			chapter !== "approve"
			|| identity !== JIRA_AGENTS_PULL_REQUEST_IDENTITY
			|| pullRequestApprovalStates[identity] !== "available"
		) return;
		setPullRequestApprovalStates((current) => ({ ...current, [identity]: "approved" }));
		// Rehydrate the work-item session snapshot so Claude resolves its
		// waiting-on-user state. PR detail owns Guide progress by stable identity,
		// so this refresh updates approval evidence without remounting the Guide.
		setLaunchId((current) => current + 1);
	}, [chapter, pullRequestApprovalStates]);

	const fixPullRequestCheck = useCallback((
		identity: string,
		agentId: PullRequestFixAgentId = DEFAULT_PULL_REQUEST_FIX_AGENT_ID,
	) => {
		if (
			chapter !== "fix"
			|| fixStep !== "failed"
			|| identity !== JIRA_AGENTS_PULL_REQUEST_IDENTITY
		) return;
		setFixAgentId(agentId);
		// Reduced motion skips the repairing beat and lands on green checks.
		setFixStep(shouldReduceMotion ? "complete" : "repairing");
		setLaunchId((current) => current + 1);
	}, [chapter, fixStep, shouldReduceMotion]);

	const updateBoardColumns = useCallback((nextColumns: readonly JiraKanbanColumnData[]) => {
		const storyColumn = getJiraAgentsStoryColumn(nextColumns);
		const nextChapter = storyColumn
			? getJiraAgentsStoryChapterForStatus(storyColumn)
			: null;
		const resolvedChapter = nextChapter ?? chapter;

		setBoardColumns(createJiraAgentsBoardColumns(resolvedChapter, nextColumns));
		if (nextChapter && nextChapter !== chapter) {
			setOrchestrationStep(nextChapter === "plan" ? "agents-working" : "idle");
			setBuildStep(nextChapter === "build" ? "ready" : "complete");
			setChapter(nextChapter);
			setDescriptionSkillPhase(nextChapter === "intake" ? "idle" : "applied");
			// Approve lands ready-to-merge (same default as the chapter picker).
			setPullRequestApprovalStates(nextChapter === "approve"
				? { [JIRA_AGENTS_PULL_REQUEST_IDENTITY]: "approved" }
				: {});
			setReviewStep("queued");
			setFixStep("failed");
			setFixAgentId(DEFAULT_PULL_REQUEST_FIX_AGENT_ID);
			setLaunchId((current) => current + 1);
		}
	}, [chapter]);

	const pullRequestApproved =
		pullRequestApprovalStates[JIRA_AGENTS_PULL_REQUEST_IDENTITY] === "approved";
	const initialState = useMemo(
		() => orchestrationStep === "idle"
			? createJiraAgentsStoryState(chapter, {
				buildStep: chapter === "build" ? buildStep : undefined,
				descriptionSkillPhase,
				fixAgentId: chapter === "fix" ? fixAgentId : undefined,
				fixStep: chapter === "fix" ? fixStep : undefined,
				pullRequestApproved,
				reviewStep,
			})
			: createJiraAgentsOrchestrationState(orchestrationStep),
		[
			buildStep,
			chapter,
			descriptionSkillPhase,
			fixAgentId,
			fixStep,
			orchestrationStep,
			pullRequestApproved,
			reviewStep,
		],
	);
	const sections = useMemo(() => createJiraAgentsWorkspaceSections(chapter), [chapter]);
	const workItem = useMemo(
		() => createJiraAgentsStoryWorkItem(chapter, { descriptionSkillPhase }),
		[chapter, descriptionSkillPhase],
	);

	return {
		applyDescriptionSuggestion,
		approvePullRequest,
		boardColumns,
		buildStep,
		chapter,
		chapterRevision,
		descriptionSkillPhase,
		descriptionImproved,
		dismissDescriptionSuggestion,
		fixPullRequestCheck,
		fixStep,
		initialState,
		invokeDescriptionSkill,
		launchId,
		orchestrationStep,
		pullRequestApprovalStates,
		resetCurrentChapter,
		reviewStep,
		sections,
		selectChapter,
		startOrchestration,
		updateBoardColumns,
		workItem,
	};
}
