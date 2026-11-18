"use client";

import { useEffect, useState } from "react";
import type { JiraIssueCompletedAgentRun } from "@/components/blocks/jira-issue/completed-agent-runs";

export const BOARD_CARD_FINISHED_RUN = [{
	id: "service-impact-agent",
	stateTransition: "agent-session",
	agentName: "Claude",
	agentBrandName: "claude",
	invokedBy: { name: "Venn", avatarSrc: "/avatar-user/venn/venn.png" },
	summary: "Map affected services and implementation impact",
	issueKey: "PD-40",
	issueSummary: "Implement advanced date-range filter",
	state: "done",
}] as const satisfies readonly JiraIssueCompletedAgentRun[];

export function useBoardCardFinishedReplay(enabled: boolean) {
	const [finished, setFinished] = useState(false);
	useEffect(() => {
		if (!enabled) return;
		const timer = window.setTimeout(() => setFinished(true), 1000);
		return () => window.clearTimeout(timer);
	}, [enabled]);
	return enabled && finished;
}
