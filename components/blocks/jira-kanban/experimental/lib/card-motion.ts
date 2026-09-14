import type { Transition } from "motion/react";

import { JIRA_ISSUE_MOTION_LAYOUT } from "@/components/blocks/jira-issue/lib";
import type { JiraKanbanCardMoveAnimation } from "../../index";

/** Position-only reflow, synchronized with the Jira issue shell's layout motion. */
export const JIRA_KANBAN_CARD_LAYOUT = JIRA_ISSUE_MOTION_LAYOUT;
export const JIRA_KANBAN_CARD_MOVE: Transition = { duration: 0.6, ease: [0.4, 0, 0, 1] }; // duration-slowest + ease-in-out
export const JIRA_KANBAN_CARD_DEPART: Transition = { duration: 0.4, ease: [0.6, 0, 0.8, 0.6] }; // duration-slower + ease-in
// Arrivals have no transition of their own here: every created card — create
// well or mid-column gap drop — enters through the shared jira-creating entrance,
// which owns its own timing and reduced-motion fallback.

export function getJiraKanbanCardScale(
	phase: JiraKanbanCardMoveAnimation["phase"] | undefined,
): number {
	if (phase === "arriving") return 0.9;
	if (phase === "departing") return 0.96;
	return 1;
}
