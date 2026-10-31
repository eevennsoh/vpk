"use client";

import { useCallback, useState } from "react";
import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import type { JiraKanbanCardData } from "@/components/blocks/jira-kanban";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { toButterDetachedAgentSession } from "@/components/projects/butter/data/presentation-story";

const PRIORITIES: Readonly<Record<JiraKanbanCardData["priority"], NonNullable<WorkItemData["priority"]>>> = {
	critical: "Highest",
	major: "High",
	medium: "Medium",
	minor: "Low",
};

export function useButterWorkItem() {
	const [selection, setSelection] = useState<{
		workItem: WorkItemData;
		initialSessions: readonly ProjectButterSessionItem[];
	} | null>(null);
	const [open, setOpen] = useState(false);
	const openWorkItem = useCallback((card: JiraKanbanCardData, columnTitle: string) => {
		setSelection({
			workItem: {
				code: card.code,
				title: card.title,
				status: card.status ?? columnTitle,
				priority: PRIORITIES[card.priority],
				assignee: card.assignee ? { name: card.assignee.name, avatarUrl: card.assignee.avatarSrc } : undefined,
				dueDate: card.dueDate,
			},
			initialSessions: [
				...(card.agentActivities ?? []).map((activity) => ({ ...toButterDetachedAgentSession(activity, card), message: activity.message ?? activity.label })),
				...(card.agentDoneRuns ?? []).map((run): ProjectButterSessionItem => ({
					id: run.id, title: run.summary, state: "complete", message: run.description ?? run.summary,
					agent: { id: run.id, name: run.agentName, avatarSrc: run.agentAvatarSrc, brandName: run.agentBrandName },
					host: run.host, invokedBy: run.invokedBy, timeLabel: run.relativeTime,
					sessionDetails: { issueKey: card.code, issueSummary: card.title, pullRequestNumber: run.pullRequestNumber },
				})),
			],
		});
		setOpen(true);
	}, []);
	const closeWorkItem = useCallback(() => setOpen(false), []);
	return { selection, open, openWorkItem, closeWorkItem };
}
