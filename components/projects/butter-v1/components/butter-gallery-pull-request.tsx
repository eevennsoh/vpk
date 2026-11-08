"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { JiraIssue, type JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { ButterInlineAgentPickerContext } from "@/components/blocks/jira-issue/project-butter-inline-picker-context";
import { BOARD_COLUMN_WIDTH_PX } from "@/components/blocks/jira-kanban/experimental/lib/board-column-collapse";
import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { renderButterAgentActivityIndicator } from "@/components/projects/butter-v1/data/agent-activity-indicators";
import { BUTTER_CHAT_AGENT_PROFILES, BUTTER_DIRECTORY_AGENT_PROFILES } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { BUTTER_PAY_CURRENT_USER } from "@/components/projects/butter-v1/data/current-user";
import { applyMerchantJourneyToBoard, merchantJourneyAuthoredCard } from "@/components/projects/butter-v1/data/merchant-journey";
import { BUTTER_SUGGESTION_DEMO_KEY, toButterAgentActivityFromSession } from "@/components/projects/butter-v1/data/presentation-board";
import { createButterPayBoardColumns } from "@/components/projects/butter-v1/data/presentation-story";
import { BUTTER_WORK_ITEM_PLACEHOLDERS } from "@/components/projects/butter-v1/data/work-item-placeholders";
import { useButterWorkItem } from "@/components/projects/butter-v1/hooks/use-butter-work-item";
import { token } from "@/lib/tokens";

const AgentsDirectoryDialog = dynamic(() => import("@/components/blocks/agent-directory").then((module) => module.AgentsDirectoryDialog));

export type ButterPullRequestStatus = "open" | "merged";

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
const BOARD_CARD_WIDTH = `calc(${BOARD_COLUMN_WIDTH_PX}px - ${token("border.width")} - ${token("border.width")} - ${token("space.050")} - ${token("space.050")})`;

function pullRequestCard(phase: "pr" | "merged") {
	const card = applyMerchantJourneyToBoard(createButterPayBoardColumns(), phase, JOURNEY_SESSION.id)
		.flatMap((column) => column.cards)
		.find((item) => item.code === BUTTER_SUGGESTION_DEMO_KEY);
	if (!card) throw new Error("Missing Project Butter pull request issue");
	return card;
}

const PULL_REQUEST_CARDS = { open: pullRequestCard("pr"), merged: pullRequestCard("merged") };

export default function ButterGalleryPullRequest({ status = "open" }: Readonly<{ status?: ButterPullRequestStatus }>) {
	const router = useRouter();
	const workItem = useButterWorkItem();
	const [directoryOpen, setDirectoryOpen] = useState(false);
	const [addedActivities, setAddedActivities] = useState<readonly JiraIssueAgentActivity[]>([]);
	const phase = status === "merged" ? "merged" : "pr";
	const baseCard = PULL_REQUEST_CARDS[status];
	const card = { ...baseCard, agentActivities: [...(baseCard.agentActivities ?? []), ...addedActivities] };
	const addAgent = (agent: AgentSelectorAgent) => {
		const activity = toButterAgentActivityFromSession({ id: `${card.code}:${crypto.randomUUID()}`, agent: { id: agent.id, kind: "agent", name: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo }, title: card.title, state: "needs-input", host: "cloud", timeLabel: "Just now", invokedBy: { name: CURRENT_USER.name, avatarSrc: CURRENT_USER.avatarUrl } });
		setAddedActivities((activities) => [...activities, activity]);
	};

	return (
		<RovoChatProvider agentProfiles={BUTTER_CHAT_AGENT_PROFILES}>
			<div className="flex h-full min-h-0 min-w-0 flex-col items-center overflow-y-auto bg-surface" data-butter-gallery-pull-request="">
				<div className="my-auto flex w-full shrink-0 flex-col" style={{ maxWidth: BOARD_CARD_WIDTH }}>
					<ButterInlineAgentPickerContext value>
					<JiraIssue
						appearance="project-butter"
						agentActivityLayout="merged"
						agentActivities={card.agentActivities}
						agentActivityMode={card.agentActivityMode}
						assignment={{
							agents: BUTTER_PICKER_AGENTS,
							onAgentAssign: addAgent,
							onBrowseAgents: () => setDirectoryOpen(true),
							onCreateAgent: () => router.push("/studio"),
						}}
						assigneeAvatarLabel={card.assignee?.name}
						assigneeAvatarSrc={card.avatarSrc ?? card.assignee?.avatarSrc}
						compact
						iconScale="comfortable"
						issueKey={card.code}
						metadata={{ issueType: card.issueType, dueDate: card.dueDate }}
						onClick={() => workItem.openWorkItem(merchantJourneyAuthoredCard(card), status === "merged" ? "Done" : "In progress")}
						priority={card.priority}
						pullRequestNumber={card.pullRequestNumber}
						pullRequestPreview={card.pullRequestPreview}
						pullRequestStatus={card.pullRequestStatus}
						renderAgentActivityIndicator={renderButterAgentActivityIndicator}
						summary={card.title}
						tags={card.tags}
					/>
					</ButterInlineAgentPickerContext>
				</div>
			</div>
			{directoryOpen ? <AgentsDirectoryDialog agents={BUTTER_DIRECTORY_AGENT_PROFILES} onCreateAgent={() => router.push("/studio")} onOpenChange={setDirectoryOpen} onSelectAgent={() => setDirectoryOpen(false)} open={directoryOpen} variant="standard-v2" /> : null}
			{workItem.selection ? (
				<ProjectButterJiraWorkItem
					autoAssignClaudeToCurrentUser
					currentUser={CURRENT_USER}
					defaultReporter={CURRENT_USER}
					developmentJourney={{ phase, agentName: "Claude", author: { ...CURRENT_USER, assistedBy: { name: "Claude", brandName: "claude" } }, autoFixEnabled: true, autoMergeEnabled: true }}
					initialPreset="filled"
					initialPresentation="modal"
					initialSessions={workItem.selection.initialSessions}
					journeyPhase={phase}
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
