import type {
	JiraActivityEntry,
	JiraActivityEventEntry,
} from "@/components/blocks/jira-activity";
import type { JiraInsightCheckpoint } from "@/components/blocks/jira-insight/jira-insight-types";

const INSIGHTS_ACTOR = {
	id: "jira-insight-rovo",
	name: "Rovo",
	kind: "agent" as const,
	vpkLogo: "rovo" as const,
};

/** Project captured decisions onto the same event-row contract as Jira Activity. */
export function projectJiraInsightCheckpointsToActivityEntries(
	checkpoints: readonly JiraInsightCheckpoint[],
): JiraActivityEventEntry[] {
	return checkpoints.map((checkpoint) => ({
		actor: INSIGHTS_ACTOR,
		category: "insight",
		createdAtMs: checkpoint.capturedAtMs,
		id: checkpoint.id,
		kind: "event",
		segments: [],
		showActor: false,
		showTimestamp: false,
		timestamp: "",
	}));
}

/**
 * Merge regular Activity and captured decisions into one stable oldest-first feed.
 * Existing entries win equal-time ties so an insight follows the event it explains.
 */
export function mergeJiraActivityEntriesWithInsights(
	activityEntries: readonly JiraActivityEntry[],
	checkpoints: readonly JiraInsightCheckpoint[],
): JiraActivityEntry[] {
	return [
		...activityEntries,
		...projectJiraInsightCheckpointsToActivityEntries(checkpoints),
	].sort((left, right) => (
		(left.createdAtMs ?? Number.NEGATIVE_INFINITY)
		- (right.createdAtMs ?? Number.NEGATIVE_INFINITY)
	));
}
