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
}

interface JiraIssueAgentActivityRowInput extends JiraIssueAgentActivitySummaryInput {
	id: string;
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
		const featured = completedActivities[0];

		return {
			activityCount: completedActivities.length,
			featuredActivityIndex: featured === undefined ? null : featured.index,
			label: "Finished",
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
 * row. When nothing is still running they become one session row per agent —
 * never a merged "N Finished" chip.
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

		const summary = summarizeJiraIssueAgentActivities(activeActivities);

		return [{ activities: activeActivities, key: `${summary.priorityState}-${summary.activityCount}` }];
	}

	return activities
		.filter((activity) => activity.state === "completed")
		.map((activity) => ({ activities: [activity], key: activity.id }));
}
