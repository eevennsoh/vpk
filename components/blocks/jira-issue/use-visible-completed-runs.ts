"use client";

import { useEffect, useRef, useState } from "react";

import type { JiraIssueCompletedAgentRun } from "./completed-agent-runs";

const FINISHED_ROW_DURATION_MS = 5000;

function runKey(run: JiraIssueCompletedAgentRun) {
	return JSON.stringify([run.id, run.state]);
}

export function useVisibleCompletedRuns(
	runs: readonly JiraIssueCompletedAgentRun[],
	enabled: boolean,
	paused: boolean,
) {
	const runIdsKey = JSON.stringify(runs.map(runKey).sort());
	const finishedIdsKey = JSON.stringify(runs.filter((run) => run.state !== "failed").map(runKey).sort());
	const [visibility, setVisibility] = useState<{ runIdsKey: string; dismissed: ReadonlySet<string> }>(
		() => ({ runIdsKey, dismissed: new Set() }),
	);
	const timers = useRef(new Map<string, number>());
	let dismissed = visibility.dismissed;
	if (visibility.runIdsKey !== runIdsKey) {
		const currentIds = new Set<string>(JSON.parse(runIdsKey));
		dismissed = new Set([...dismissed].filter((id) => currentIds.has(id)));
		setVisibility({ runIdsKey, dismissed });
	}

	useEffect(() => {
		const eligible = new Set<string>(enabled && !paused ? JSON.parse(finishedIdsKey) : []);
		for (const [id, timer] of timers.current) {
			if (!eligible.has(id) || dismissed.has(id)) {
				window.clearTimeout(timer);
				timers.current.delete(id);
			}
		}
		for (const id of eligible) {
			if (dismissed.has(id) || timers.current.has(id)) continue;
			timers.current.set(id, window.setTimeout(() => {
				timers.current.delete(id);
				setVisibility((current) => ({
					...current,
					dismissed: new Set([...current.dismissed, id]),
				}));
			}, FINISHED_ROW_DURATION_MS));
		}
	}, [dismissed, enabled, finishedIdsKey, paused]);

	useEffect(() => {
		const activeTimers = timers.current;
		return () => {
			for (const timer of activeTimers.values()) window.clearTimeout(timer);
			activeTimers.clear();
		};
	}, []);

	return runs.filter((run) => run.state === "failed" || !dismissed.has(runKey(run)));
}
