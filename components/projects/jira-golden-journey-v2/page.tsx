"use client";

import { useCallback, useEffect, useState } from "react";

import { RovoChatProvider, useRovoChat } from "@/app/contexts/context-rovo-chat";
import type { SkillDirectorySkill } from "@/app/data/directory";
import { ROVO_AGENT_ID } from "@/app/data/directory/agents";
import { Gallery, type GalleryItem } from "@/components/blocks/gallery";
import type { AgentSession } from "@/components/blocks/jira-work-item/data/session-state";
import { ExperimentalV2JiraWorkItem } from "@/components/blocks/jira-work-item/experimental-v2/experimental-v2-jira-work-item";
import type { WorkItemAutomationRule } from "@/components/blocks/jira-work-item/experimental-v2/components/automation-tab";
import { JGP_CHAT_AGENT_PROFILES } from "@/components/projects/jira-golden-journey-v1/data/agent-chat-data";
import { JIRA_AGENTS_GALLERY_ITEMS } from "./data/gallery-items";
import {
	JIRA_AGENTS_PULL_REQUEST_IDENTITY,
	JIRA_AGENTS_STATUS_PHASES,
	JIRA_AGENTS_STORY_COMPOSER_AGENTS,
	shouldStartJiraAgentsPlan,
} from "./data/hotfix-story";
import { JiraAgentsComposerPrivacyToggle } from "./composer-privacy-toggle";
import { JiraAgentsStoryControls } from "./story-controls";
import { useJiraAgentsStory, type JiraAgentsStoryController } from "./use-hotfix-story";

const JIRA_AGENTS_AUTOMATION_RULES = [
	{
		id: "reduce-checkout-abandonment",
		title: "Reduce storefront checkout abandonment",
		iconVariant: "purple",
	},
	{
		id: "validate-guest-order-totals",
		title: "Validate guest checkout order totals",
		iconVariant: "purple",
	},
	{
		id: "prevent-duplicate-payment",
		title: "Prevent duplicate payment on retry",
		iconVariant: "blue",
	},
	{
		id: "run-checkout-regression",
		title: "Run guest checkout regression suite",
		iconVariant: "green",
		lastRunAt: "2m ago",
	},
] as const satisfies readonly WorkItemAutomationRule[];

const JIRA_AGENTS_LEAD_SESSION_ID = "story-session-claude-code";
const JIRA_AGENTS_CHILD_SESSION_IDS = ["story-session-code-planner"] as const;

function getVisibleOrchestrationSessionIds(
	controller: JiraAgentsStoryController,
): readonly string[] {
	// Build keeps Claude Code's Activity card expanded in the lead-thread View
	// (parent + nested Code Planner reply) so checklist/artifacts stay visible.
	if (controller.chapter === "build") {
		return [JIRA_AGENTS_LEAD_SESSION_ID, ...JIRA_AGENTS_CHILD_SESSION_IDS];
	}
	switch (controller.orchestrationStep) {
		case "agents-working":
		case "comment":
		case "reaction-1":
		case "reaction-2":
			return [];
		case "lead":
			return [JIRA_AGENTS_LEAD_SESSION_ID];
		case "consult":
			return [JIRA_AGENTS_LEAD_SESSION_ID, JIRA_AGENTS_CHILD_SESSION_IDS[0]];
		case "idle":
		case "complete":
			return [JIRA_AGENTS_LEAD_SESSION_ID, ...JIRA_AGENTS_CHILD_SESSION_IDS];
	}
}

function JiraAgentsWorkItemStage({
	controller,
}: Readonly<{ controller: JiraAgentsStoryController }>): React.ReactElement {
	const { closeChat, openChat, resetChat, selectAgent } = useRovoChat();
	const {
		applyDescriptionSuggestion,
		chapter,
		chapterRevision,
		descriptionImproved,
		dismissDescriptionSuggestion,
		descriptionSkillPhase,
		invokeDescriptionSkill,
		startOrchestration,
	} = controller;
	const visibleSessionIds = getVisibleOrchestrationSessionIds(controller);
	useEffect(() => {
		closeChat();
		resetChat();
	}, [chapter, chapterRevision, closeChat, resetChat]);
	const handleOpenAgentChat = useCallback((agentId: string) => {
		selectAgent(agentId.startsWith("skill:") ? ROVO_AGENT_ID : agentId, { preserveCurrentThread: true });
		openChat("floating");
	}, [openChat, selectAgent]);
	const handleAgentPromptSubmit = useCallback((agentIds: readonly string[]) => {
		if (shouldStartJiraAgentsPlan(chapter, agentIds, descriptionImproved)) {
			startOrchestration();
		}
	}, [chapter, descriptionImproved, startOrchestration]);
	const handleSkillInvoke = useCallback((skill: SkillDirectorySkill) => {
		if (skill.id !== "improve-description") return false;
		invokeDescriptionSkill();
		return true;
	}, [invokeDescriptionSkill]);
	// The answered question card is replaced by the shared clarification answer
	// card, so the user's selection stays visible above Rovo's reply. Leave
	// `visibility` unset: the clarification summary rows that sidebar chat
	// attaches to this user message are what render the answer card.
	const handleSessionReply = useCallback((session: AgentSession, text: string) => {
		if (
			session.agentId !== "skill:improve-description"
			|| descriptionSkillPhase !== "awaiting-confirmation"
		) return { handled: false };
		if (text.includes("Add suggested description")) {
			return {
				handled: true,
				assistantReply: "Done — I added the approved description to SHOP-4821. The original work item stayed unchanged until this confirmation.",
				delayMs: 0,
				onApplyAfterResponse: applyDescriptionSuggestion,
			};
		}
		if (text.includes("Keep current description")) {
			return {
				handled: true,
				assistantReply: "Understood — I kept the current work item description unchanged. You can run Improve description again whenever you’re ready.",
				delayMs: 0,
				onApplyAfterResponse: dismissDescriptionSuggestion,
			};
		}
		return { handled: false };
	}, [applyDescriptionSuggestion, descriptionSkillPhase, dismissDescriptionSuggestion]);

	return (
		<div className="relative left-1/2 flex h-full min-h-0 w-[100cqw] -translate-x-1/2 items-start justify-center overflow-hidden px-8 pt-4 pb-4">
			<ExperimentalV2JiraWorkItem
				activitySessionThread={{
					parentSessionId: JIRA_AGENTS_LEAD_SESSION_ID,
					childSessionIds: JIRA_AGENTS_CHILD_SESSION_IDS,
					visibleSessionIds,
					// Build focuses Claude's checklist/artifacts; Plan keeps the
					// Code Planner consultation reply expanded by default.
					...(chapter === "build" ? { defaultRepliesExpanded: false } : {}),
				}}
				autoOpenPullRequestIdentity={
					controller.chapter === "review"
						|| controller.chapter === "fix"
						|| controller.chapter === "approve"
						? JIRA_AGENTS_PULL_REQUEST_IDENTITY
						: null
				}
				automationRules={JIRA_AGENTS_AUTOMATION_RULES}
				composerAgents={JIRA_AGENTS_STORY_COMPOSER_AGENTS}
				composerDelivery="broadcast-active-agents"
				composerToolsAfterAdd={<JiraAgentsComposerPrivacyToggle />}
				initialPreset={controller.initialState.preset}
				initialState={controller.initialState}
				initialStateRevision={controller.launchId}
				inlineSurface="card-fill"
				onAgentPromptSubmit={handleAgentPromptSubmit}
				onOpenAgentChat={handleOpenAgentChat}
				onPullRequestApprove={controller.approvePullRequest}
				onPullRequestFix={
					controller.chapter === "fix" && controller.fixStep === "failed"
						? controller.fixPullRequestCheck
						: undefined
				}
				onSessionReply={handleSessionReply}
				onSkillInvoke={handleSkillInvoke}
				presentation="inline"
				pullRequestApprovalStates={controller.pullRequestApprovalStates}
				revealActivityEntryId={
					controller.chapter === "build" && controller.buildStep !== "complete"
						? controller.buildStep === "ready"
							// Orient on Claude during the Plan-end hold.
							? `activity-${JIRA_AGENTS_LEAD_SESSION_ID}`
							// Once the PR is created, show Review's Open #1847 snapshot.
							: "story-pr-review"
						: null
				}
				revealActivityKey={
					controller.orchestrationStep !== "idle"
						? `${controller.orchestrationStep}:${controller.launchId}`
						: controller.chapter === "build" && controller.buildStep !== "complete"
							? `${controller.buildStep}:${controller.launchId}`
							: null
				}
				stageKey={`${chapter}:${chapterRevision}`}
				statusPhases={JIRA_AGENTS_STATUS_PHASES}
				workItem={controller.workItem}
			/>
		</div>
	);
}

export default function JiraAgentsPage(): React.ReactElement {
	const [selectedId, setSelectedId] = useState(JIRA_AGENTS_GALLERY_ITEMS[0]?.id ?? "");
	const storyController = useJiraAgentsStory(selectedId === "work-item");
	const handleSelectedChange = useCallback((nextSelectedId: string) => {
		storyController.resetCurrentChapter();
		setSelectedId(nextSelectedId);
	}, [storyController]);
	const renderSelectedItem = useCallback((item: GalleryItem): React.ReactNode => {
		if (item.id === "work-item") return <JiraAgentsWorkItemStage controller={storyController} />;
		return null;
	}, [storyController]);

	return (
		<RovoChatProvider agentProfiles={JGP_CHAT_AGENT_PROFILES}>
			<div className="relative h-dvh w-full overflow-hidden bg-surface">
				<Gallery
					items={JIRA_AGENTS_GALLERY_ITEMS}
					onReset={storyController.resetCurrentChapter}
					title="Jira Golden Journey v2"
					selectedId={selectedId}
					onSelectedChange={handleSelectedChange}
					renderSelectedItem={renderSelectedItem}
					showTopBarBorder={selectedId !== "work-item"}
					topBarCenter={
						selectedId === "work-item"
							? <JiraAgentsStoryControls controller={storyController} />
							: null
					}
				/>
			</div>
		</RovoChatProvider>
	);
}
