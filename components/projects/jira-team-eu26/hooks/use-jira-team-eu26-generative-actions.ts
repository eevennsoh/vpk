"use client";

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { ROVO_AGENT_ID } from "@/app/data/directory/agents";
import type { JiraIssueAgentActivity, JiraIssueGenerativeActionRequest } from "@/components/blocks/jira-issue";
import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { linkJiraKanbanAgentSession } from "@/components/blocks/jira-kanban/state";
import type { RichTextMentionItem } from "@/components/ui-custom/rich-text-editor";
import {
	createJgpKanbanActivity,
	getJgpGenerativeAgentSelection,
	JGP_KANBAN_DEFAULT_AGENT_ID,
} from "@/components/projects/jira-golden-journeys-v1/data/kanban-activity-data";
import type { UseJgpAgentChatDemoResult } from "@/components/projects/jira-golden-journeys-v1/hooks/use-jira-golden-journeys-v1-agent-chat-demo";
import { progressJiraTeamEu26WorkItemOnStart } from "@/components/projects/jira-team-eu26/lib/list-rows";

interface UseJiraTeamEu26GenerativeActionsOptions {
	openAgentChat: UseJgpAgentChatDemoResult["openAgentChat"];
	setBoardColumns: Dispatch<SetStateAction<JiraKanbanColumnData[]>>;
}

interface ComposerPrefillRequest {
	mention: RichTextMentionItem;
	requestKey: number;
}

function getSkillMentionId(id: string): string {
	return id.startsWith("skill:") ? id : `skill:${id}`;
}

function createAssignedActivity(
	request: JiraIssueGenerativeActionRequest,
	card: JiraKanbanCardData,
): JiraIssueAgentActivity {
	const selection = getJgpGenerativeAgentSelection(request);
	const skillName = request.kind === "skill" ? request.selectedItem?.label : undefined;
	const activity: JiraIssueAgentActivity = {
		...createJgpKanbanActivity(
			selection.id,
			skillName ? { ...selection, name: "Claude" } : selection,
			`${card.code}:${selection.id}`,
		),
		...(skillName ? { agentBrandName: "claude" as const } : {}),
		startedAtMs: Date.now(),
		startupSequence: "jira-work-item-start",
	};

	if (!skillName) return activity;

	const applyingLabel = `Applying ${skillName}`;
	return {
		...activity,
		label: applyingLabel,
		labels: [
			applyingLabel,
			`Reading ${card.code} context`,
			"Preparing the skill result",
		],
		message: `Claude is applying ${skillName} to ${card.code}.`,
	};
}

export function useJiraTeamEu26GenerativeActions({
	openAgentChat,
	setBoardColumns,
}: Readonly<UseJiraTeamEu26GenerativeActionsOptions>) {
	const prefillRequestKeyRef = useRef(0);
	const [composerPrefillRequest, setComposerPrefillRequest] = useState<ComposerPrefillRequest>();
	const handleComposerPrefillConsumed = useCallback((requestKey: number) => {
		setComposerPrefillRequest((current) => (
			current?.requestKey === requestKey ? undefined : current
		));
	}, []);

	const handleCardGenerativeActionSubmit = useCallback((
		request: JiraIssueGenerativeActionRequest,
		card: JiraKanbanCardData,
	) => {
		if (request.kind === "ask-rovo") {
			openAgentChat({
				agentId: ROVO_AGENT_ID,
				agentName: "Rovo",
				issueKey: card.code,
				issueSummary: card.title,
				request: request.prompt,
			});
			return;
		}

		if ((request.kind === "agent" || request.kind === "skill") && request.selectedItem) {
			const activity = createAssignedActivity(request, card);
			setBoardColumns((columns) => progressJiraTeamEu26WorkItemOnStart(
				linkJiraKanbanAgentSession(columns, card.code, activity),
				card.code,
			));

			if (request.kind !== "skill") return;

			openAgentChat({
				agentId: JGP_KANBAN_DEFAULT_AGENT_ID,
				agentName: "Claude",
				issueKey: card.code,
				issueSummary: card.title,
				request: request.prompt,
				skillInvocation: {
					id: getSkillMentionId(request.selectedItem.id),
					label: request.selectedItem.label,
					instruction: `for Jira issue ${card.code}: ${card.title}.`,
				},
			});
			prefillRequestKeyRef.current += 1;
			setComposerPrefillRequest({
				mention: {
					category: "skill",
					description: request.selectedItem.description,
					id: getSkillMentionId(request.selectedItem.id),
					label: request.selectedItem.label,
				},
				requestKey: prefillRequestKeyRef.current,
			});
		}
	}, [openAgentChat, setBoardColumns]);

	return {
		composerPrefillRequest,
		handleCardGenerativeActionSubmit,
		handleComposerPrefillConsumed,
	};
}
