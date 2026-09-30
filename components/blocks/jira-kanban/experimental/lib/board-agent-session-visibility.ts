import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";

import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban/index";

interface AgentSessionVisibility {
	showFinished: boolean;
	showNeedsInput: boolean;
	showWorking: boolean;
}

function toVisibility(shownStateIds: ReadonlySet<string>): AgentSessionVisibility {
	return {
		showFinished: shownStateIds.has("finished"),
		showNeedsInput: shownStateIds.has("needs-input"),
		showWorking: shownStateIds.has("working"),
	};
}

function isActivityVisible(
	activity: JiraIssueAgentActivity,
	visibility: AgentSessionVisibility,
): boolean {
	switch (activity.state) {
		case "working":
			return visibility.showWorking;
		case "awaiting-input":
			return visibility.showNeedsInput;
		case "completed":
			return visibility.showFinished;
		default: {
			const _exhaustive: never = activity.state;
			return _exhaustive;
		}
	}
}

function resolveVisibleAgentActivityMode(
	activities: readonly JiraIssueAgentActivity[],
	doneRuns: JiraKanbanCardData["agentDoneRuns"],
): JiraKanbanCardData["agentActivityMode"] {
	if (activities.some((activity) => activity.state === "awaiting-input")) {
		return "awaiting-input";
	}
	if (activities.some((activity) => activity.state === "working")) {
		return "working";
	}
	if (doneRuns?.length) {
		return "completed";
	}
	// `undefined`, not `"none"`: JiraIssue treats an explicit mode as a reason
	// to keep the agent shell even when no rows remain.
	return undefined;
}

export function applyCardAgentSessionVisibility(
	card: JiraKanbanCardData,
	shownStateIds: ReadonlySet<string>,
): JiraKanbanCardData {
	const visibility = toVisibility(shownStateIds);
	if (visibility.showWorking && visibility.showNeedsInput && visibility.showFinished) {
		return card;
	}

	const visibleActivities = (card.agentActivities ?? []).filter((activity) => (
		isActivityVisible(activity, visibility)
	));
	const visibleDoneRuns = visibility.showFinished ? card.agentDoneRuns : undefined;
	const nextMode = resolveVisibleAgentActivityMode(visibleActivities, visibleDoneRuns);
	const activitiesUnchanged = visibleActivities.length === (card.agentActivities?.length ?? 0);
	const doneRunsUnchanged = (visibleDoneRuns?.length ?? 0) === (card.agentDoneRuns?.length ?? 0);
	const modeUnchanged = nextMode === card.agentActivityMode;

	if (activitiesUnchanged && doneRunsUnchanged && modeUnchanged) {
		return card;
	}

	return {
		...card,
		agentActivities: visibleActivities.length > 0 ? visibleActivities : undefined,
		agentActivityMode: nextMode,
		agentDoneRuns: visibleDoneRuns?.length ? visibleDoneRuns : undefined,
	};
}

/**
 * Hide linked-session chrome the viewer unchecked in View → Agent.
 *
 * Cards stay on the board. Working / Needs input strip matching activity
 * rows; Finished strips completed-run notifications. When every linked
 * state is still shown, the columns are returned as given.
 */
export function filterJiraKanbanColumnsByAgentSessionState(
	columns: readonly JiraKanbanColumnData[],
	shownStateIds: ReadonlySet<string>,
): JiraKanbanColumnData[] {
	if (
		shownStateIds.has("working")
		&& shownStateIds.has("needs-input")
		&& shownStateIds.has("finished")
	) {
		return [...columns];
	}

	return columns.map((column) => {
		let changed = false;
		const cards = column.cards.map((card) => {
			const nextCard = applyCardAgentSessionVisibility(card, shownStateIds);
			if (nextCard !== card) {
				changed = true;
			}
			return nextCard;
		});

		return changed ? { ...column, cards } : column;
	});
}
