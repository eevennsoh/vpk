"use client";

import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { ExperimentalJiraKanban } from "@/components/blocks/jira-kanban/experimental/experimental-jira-kanban";
import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter-v1/project-butter-jira-work-item";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter-v1/data";
import { renderButterAgentActivityIndicator } from "@/components/projects/butter-v1/data/agent-activity-indicators";
import { BUTTER_CHAT_AGENT_PROFILES } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { BUTTER_PAY_CURRENT_USER } from "@/components/projects/butter-v1/data/current-user";
import { applyMerchantJourneyToBoard, merchantJourneyAuthoredCard } from "@/components/projects/butter-v1/data/merchant-journey";
import { BUTTER_BOARD_AGENTS, BUTTER_SUGGESTION_DEMO_KEY } from "@/components/projects/butter-v1/data/presentation-board";
import { createButterPayBoardColumns } from "@/components/projects/butter-v1/data/presentation-story";
import { BUTTER_WORK_ITEM_PLACEHOLDERS } from "@/components/projects/butter-v1/data/work-item-placeholders";
import { useButterWorkItem } from "@/components/projects/butter-v1/hooks/use-butter-work-item";

const CURRENT_USER = { name: BUTTER_PAY_CURRENT_USER.name, avatarUrl: BUTTER_PAY_CURRENT_USER.avatarSrc };
const JOURNEY_SESSION: ProjectButterSessionItem = {
	id: "PAY-999:merchant-journey",
	title: "Work on Improve merchant onboarding for Payments SDK v2",
	state: "running",
	host: "cloud",
	timeLabel: "Just now",
	message: "Working on the merchant onboarding quickstart.",
	agent: { id: "claude-code", kind: "agent", name: "Claude", brandName: "claude" },
	invokedBy: { name: CURRENT_USER.name, avatarSrc: CURRENT_USER.avatarUrl },
};
const PULL_REQUEST_BOARD = applyMerchantJourneyToBoard(createButterPayBoardColumns(), "pr", JOURNEY_SESSION.id)
	.filter((column) => column.title === "In progress")
	.map((column) => {
		const cards = column.cards.filter((card) => card.code === BUTTER_SUGGESTION_DEMO_KEY);
		return { ...column, cards, count: cards.length };
	});

export default function ButterGalleryPullRequest() {
	const workItem = useButterWorkItem();

	return (
		<RovoChatProvider agentProfiles={BUTTER_CHAT_AGENT_PROFILES}>
			<div className="flex h-full min-h-0 min-w-0 flex-col items-center overflow-y-auto bg-surface" data-butter-gallery-pull-request="">
				<div className="my-auto flex w-full max-w-sm shrink-0 flex-col">
					<ExperimentalJiraKanban
						addAgentLabel="Add agent"
						agentActivityLayout="merged"
						agents={BUTTER_BOARD_AGENTS}
						ariaLabel="Pull request Kanban board"
						boardColumns={PULL_REQUEST_BOARD}
						cardAppearance="project-butter"
						columnChrome="default"
						columnSizing="content"
						columnWidth="fluid"
						iconScale="comfortable"
						onCardClick={(_title, _code, card, column) => workItem.openWorkItem(merchantJourneyAuthoredCard(card), column)}
						paddingTop={0}
						renderAgentActivityIndicator={renderButterAgentActivityIndicator}
						showAgentSessionUnlinkWell={false}
					/>
				</div>
			</div>
			{workItem.selection ? (
				<ProjectButterJiraWorkItem
					autoAssignClaudeToCurrentUser
					currentUser={CURRENT_USER}
					defaultReporter={CURRENT_USER}
					developmentJourney={{ phase: "pr", agentName: "Claude", author: { ...CURRENT_USER, assistedBy: { name: "Claude", brandName: "claude" } }, autoFixEnabled: true, autoMergeEnabled: true }}
					initialPreset="filled"
					initialPresentation="modal"
					initialSessions={workItem.selection.initialSessions}
					journeyPhase="pr"
					journeySession={JOURNEY_SESSION}
					onClose={workItem.closeWorkItem}
					open={workItem.open}
					placeholders={BUTTER_WORK_ITEM_PLACEHOLDERS}
					shell="project"
					showAuditInActivity
					suggestionProfile="payments"
					workItem={workItem.selection.workItem}
				/>
			) : null}
		</RovoChatProvider>
	);
}
