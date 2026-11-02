import type { JiraActivityEntry, JiraActivityFilter } from "../jira-activity-types";

/**
 * True when an activity entry is waiting on the viewer — agent session state
 * `needs-input` on the lead card or a nested reply session summary.
 */
export function activityEntryNeedsInput(entry: JiraActivityEntry): boolean {
	if (entry.kind === "comment") {
		if (entry.sessionItem?.state === "needs-input") return true;
		return (entry.replies ?? []).some(
			(reply) => reply.sessionItem?.state === "needs-input",
		);
	}
	if (entry.kind === "changed-files") {
		return entry.sessionItem?.state === "needs-input";
	}
	return false;
}

function matchesAgentsOnly(entry: JiraActivityEntry): boolean {
	return (
		entry.actor.kind === "agent" &&
		(entry.kind === "comment" ||
			(entry.kind === "changed-files" && entry.outputs !== undefined))
	);
}

/** Whether a timeline entry is visible under the active view filter. */
export function matchesJiraActivityFilter(
	entry: JiraActivityEntry,
	filter: JiraActivityFilter,
): boolean {
	switch (filter) {
		case "all":
			return true;
		case "agents-only":
			return matchesAgentsOnly(entry);
		case "needs-input":
			return activityEntryNeedsInput(entry);
		case "comments-only":
			return entry.kind === "comment";
		case "history-only":
			return entry.kind !== "comment";
		case "insights-only":
			return entry.category === "insight";
		default: {
			const _exhaustive: never = filter;
			return _exhaustive;
		}
	}
}

/** Filters the activity feed for the header view control. */
export function filterJiraActivityEntries(
	entries: readonly JiraActivityEntry[],
	filter: JiraActivityFilter,
): readonly JiraActivityEntry[] {
	if (filter === "all") return entries;
	return entries.filter((entry) => matchesJiraActivityFilter(entry, filter));
}
