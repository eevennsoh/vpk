"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useMemo, useReducer } from "react";

import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import type { JiraWorkItemState } from "@/components/blocks/jira-work-item/data/session-state";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { useTimedTransition } from "@/components/hooks/use-timed-transition";
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
import {
	JIRA_AGENTS_STORY_INITIAL_STATE,
	JIRA_AGENTS_STORY_TIMERS,
	jiraAgentsStoryReducer,
	selectJiraAgentsStoryReducedMotion,
	selectJiraAgentsStorySteps,
	selectJiraAgentsStoryTimerKey,
} from "./hotfix-story-machine";

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

const NO_APPROVALS: Readonly<Record<string, JiraAgentsPullRequestApprovalState>> = {};
const STORY_PULL_REQUEST_APPROVED: Readonly<Record<string, JiraAgentsPullRequestApprovalState>> = {
	[JIRA_AGENTS_PULL_REQUEST_IDENTITY]: "approved",
};

export function useJiraAgentsStory(active = true): JiraAgentsStoryController {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const [state, dispatch] = useReducer(jiraAgentsStoryReducer, JIRA_AGENTS_STORY_INITIAL_STATE);
	const { chapterRevision, launchId, stage } = state;
	const { chapter } = stage;
	const steps = selectJiraAgentsStorySteps(stage);
	const {
		buildStep,
		descriptionSkillPhase,
		fixStep,
		orchestrationStep,
		pullRequestApproved,
		reviewStep,
	} = steps;
	const fixAgentId = steps.fixAgentId ?? DEFAULT_PULL_REQUEST_FIX_AGENT_ID;

	// One timer for whichever step the open chapter is on; paused while the story is hidden.
	useTimedTransition(active ? selectJiraAgentsStoryTimerKey(stage) : null, JIRA_AGENTS_STORY_TIMERS, {
		onAdvance: (next) => dispatch({ type: "timer-elapsed", next }),
		reducedMotion: selectJiraAgentsStoryReducedMotion(stage, shouldReduceMotion),
	});

	const selectChapter = useCallback((nextChapter: JiraAgentsStoryChapter) => {
		dispatch({ type: "select-chapter", chapter: nextChapter });
	}, []);

	const resetCurrentChapter = useCallback(() => {
		dispatch({ type: "select-chapter", chapter });
	}, [chapter]);

	const invokeDescriptionSkill = useCallback(() => {
		dispatch({ type: "invoke-description-skill" });
	}, []);

	const applyDescriptionSuggestion = useCallback(() => {
		dispatch({ type: "apply-description-suggestion" });
	}, []);

	const dismissDescriptionSuggestion = useCallback(() => {
		dispatch({ type: "dismiss-description-suggestion" });
	}, []);

	const descriptionImproved = descriptionSkillPhase === "applied";

	const startOrchestration = useCallback(() => {
		dispatch({ type: "start-orchestration" });
	}, []);

	const approvePullRequest = useCallback((_identity: string) => {
		dispatch({ type: "approve-pull-request" });
	}, []);

	const fixPullRequestCheck = useCallback((
		identity: string,
		agentId: PullRequestFixAgentId = DEFAULT_PULL_REQUEST_FIX_AGENT_ID,
	) => {
		dispatch({
			type: "fix-pull-request-check",
			agentId,
			isStoryPullRequest: identity === JIRA_AGENTS_PULL_REQUEST_IDENTITY,
			reducedMotion: shouldReduceMotion,
		});
	}, [shouldReduceMotion]);

	const updateBoardColumns = useCallback((nextColumns: readonly JiraKanbanColumnData[]) => {
		const storyColumn = getJiraAgentsStoryColumn(nextColumns);
		dispatch({
			type: "board-changed",
			chapter: storyColumn ? getJiraAgentsStoryChapterForStatus(storyColumn) : null,
			columns: nextColumns,
		});
	}, []);

	const boardColumns = useMemo(
		() => createJiraAgentsBoardColumns(chapter, state.boardColumns ?? undefined),
		[chapter, state.boardColumns],
	);
	const pullRequestApprovalStates = pullRequestApproved ? STORY_PULL_REQUEST_APPROVED : NO_APPROVALS;
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
