"use client";

import { JiraIssue } from "@/components/blocks/jira-issue";

import type { JiraCreateBoardCard } from "../data/jira-creating-board";
import { JiraCreateEntrance } from "./jira-creating-entrance";

export interface JiraCreateCardProps {
	card: JiraCreateBoardCard;
	className?: string;
	enterDelayS?: number;
	itemId?: string;
}

export function JiraCreateCard({
	card,
	className,
	enterDelayS = 0,
	itemId,
}: Readonly<JiraCreateCardProps>) {
	const activityCount = card.agentActivities?.length ?? 0;

	return (
		<JiraCreateEntrance
			className={className}
			enterDelayS={enterDelayS}
			itemId={itemId}
		>
			<JiraIssue appearance="default"
				agentActivities={card.agentActivities}
				agentActivityLayout={activityCount > 1 ? "split" : "merged"}
				agentActivityMode={card.agentActivityMode ?? (activityCount > 0 ? "working" : "none")}
				assigneeAvatarLabel={card.assigneeAvatarLabel}
				assigneeAvatarSrc={card.assigneeAvatarSrc}
				chrome="stroke"
				compact
				draggable={false}
				issueKey={card.code}
				priority={card.priority}
				showMoreAction={false}
				summary={card.title}
				tags={card.tags}
			/>
		</JiraCreateEntrance>
	);
}
