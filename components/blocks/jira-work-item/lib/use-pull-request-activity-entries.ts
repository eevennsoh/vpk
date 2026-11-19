"use client";

import { useCallback, useMemo, useState, type SetStateAction } from "react";

import type { JiraActivityEntry } from "@/components/blocks/jira-activity";

export function usePullRequestActivityEntries<Activity>({
	activity,
	adaptActivity,
	getRevision,
}: Readonly<{
	activity: readonly Activity[];
	adaptActivity: (activity: readonly Activity[]) => readonly JiraActivityEntry[];
	getRevision: (activity: readonly Activity[]) => string;
}>) {
	const activityKey = useMemo(() => getRevision(activity), [activity, getRevision]);
	const [state, setState] = useState(() => ({
		revision: activityKey,
		entries: adaptActivity(activity),
	}));
	let current = state;
	if (state.revision !== activityKey) {
		current = { revision: activityKey, entries: adaptActivity(activity) };
		setState(current);
	}

	const setEntries = useCallback((update: SetStateAction<readonly JiraActivityEntry[]>) => {
		setState((previous) => ({
			...previous,
			entries: typeof update === "function" ? update(previous.entries) : update,
		}));
	}, []);

	return { activityKey, entries: current.entries, setEntries };
}
