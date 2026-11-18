export type JiraIssueActiveAgentState = "working" | "awaiting-input";

type RelatedAgentActivityMode = "none" | JiraIssueActiveAgentState | "completed";

/**
 * Unlinked-but-related sessions keep the grey agent-activity backdrop.
 * JiraIssue lights that shell from `working` with an empty chin — the same
 * contract the experimental Unlink fixture uses — without inventing a chin row.
 */
export function resolveRelatedJiraIssueAgentActivityMode(
	mode: RelatedAgentActivityMode | undefined,
	hasRelatedSessions: boolean,
): RelatedAgentActivityMode | undefined {
	if (hasRelatedSessions && (mode === "none" || mode === undefined)) {
		return "working";
	}
	return mode;
}

/**
 * `merged` collapses every active agent into one prioritized chin row
 * (`Working`). `split` gives each active agent its own row.
 */
export type JiraIssueAgentActivityLayout = "merged" | "split";

interface JiraIssueAgentActivitySummaryInput {
	state: JiraIssueActiveAgentState | "completed";
	/** Outcome copy for a completed run; `"Failed"` marks a failed run. */
	label?: string;
}

interface JiraIssueAgentActivityRowInput extends JiraIssueAgentActivitySummaryInput {
	stateTransition?: "agent-session";
	id: string;
	role?: string;
}

export function getJiraIssueVisibleActivities<TActivity extends { role?: string }>(activities: readonly TActivity[]): readonly TActivity[] {
	const personal = activities.filter((activity) => activity.role !== "viewer");
	return personal.length > 0 ? personal : activities;
}

export interface JiraIssueAgentActivityRowGroup<TActivity> {
	activities: readonly TActivity[];
	key: string;
}

export interface JiraIssueAgentActivitySummary {
	activityCount: number;
	featuredActivityIndex: number | null;
	label: string;
	priorityCount: number;
	priorityState: JiraIssueActiveAgentState;
}

export function summarizeJiraIssueAgentActivities(
	activities: readonly JiraIssueAgentActivitySummaryInput[],
): JiraIssueAgentActivitySummary {
	const activeActivities = activities
		.map((activity, index) => ({ activity, index }))
		.filter(({ activity }) => activity.state !== "completed");
	if (activeActivities.length === 0) {
		const completedActivities = activities
			.map((activity, index) => ({ activity, index }))
			.filter(({ activity }) => activity.state === "completed");
		// A failure anywhere in the group decides its status, whatever the input order.
		const failed = completedActivities.find(({ activity }) => activity.label === "Failed");
		const featured = failed ?? completedActivities[0];

		return {
			activityCount: completedActivities.length,
			featuredActivityIndex: featured === undefined ? null : featured.index,
			label: failed === undefined ? "Finished" : "Failed",
			priorityCount: completedActivities.length,
			priorityState: "working",
		};
	}
	const awaitingInputActivities = activeActivities.filter(({ activity }) => activity.state === "awaiting-input");
	const awaitingInputCount = awaitingInputActivities.length;
	const priorityState = awaitingInputCount > 0 ? "awaiting-input" : "working";
	const priorityCount = awaitingInputCount > 0 ? awaitingInputCount : activeActivities.length;
	const featuredActivityIndex = activeActivities.length === 1
		? activeActivities[0]?.index ?? null
		: awaitingInputActivities.length === 1
			? awaitingInputActivities[0]?.index ?? null
			: null;
	const label = priorityState === "awaiting-input"
		? "Needs input"
		: "Working";

	return {
		activityCount: activeActivities.length,
		featuredActivityIndex,
		label,
		priorityCount,
		priorityState,
	};
}

/**
 * Resolves the chin rows to render. Completed activities never join an active
 * row. When nothing is still running, `merged` gathers the finished agents into
 * one row whose flyout lists every session, the same way it gathers working
 * agents; `split` keeps one session row per agent. A lone finished agent keeps
 * its own id so a session that completes in place does not remount.
 */
export function groupJiraIssueAgentActivityRows<TActivity extends JiraIssueAgentActivityRowInput>(
	activities: readonly TActivity[],
	layout: JiraIssueAgentActivityLayout,
): readonly JiraIssueAgentActivityRowGroup<TActivity>[] {
	const activeActivities = activities.filter((activity) => activity.state !== "completed");

	if (activeActivities.length > 0) {
		if (layout === "split") {
			return activeActivities.map((activity) => ({ activities: [activity], key: activity.id }));
		}

		const visibleActivities = getJiraIssueVisibleActivities(activeActivities);
		const summary = summarizeJiraIssueAgentActivities(visibleActivities);

		const key = visibleActivities.length === 1 && visibleActivities[0].stateTransition === "agent-session"
			? visibleActivities[0].id : `${summary.priorityState}-${summary.activityCount}`;
		return [{ activities: activeActivities, key }];
	}

	const completedActivities = activities.filter((activity) => activity.state === "completed");
	if (layout === "merged" && completedActivities.length > 1) {
		return [{ activities: completedActivities, key: `completed-${completedActivities.length}` }];
	}
	return completedActivities.map((activity) => ({ activities: [activity], key: activity.id }));
}
