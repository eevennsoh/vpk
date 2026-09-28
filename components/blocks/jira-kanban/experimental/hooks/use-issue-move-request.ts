"use client";

import { useEffect, useRef } from "react";
import type { IssueCardMove } from "./use-issue-card-drop-arrival";

/**
 * A host-requested move of several issues at once. The board plays it through
 * the same capture-then-commit path as dropping that cohort by hand, so the
 * drop flight, arrival entrance and selection reset all match a real drag.
 */
export interface JiraKanbanIssueMoveRequest extends IssueCardMove {
	/** Each new id plays the move once; re-renders with the same id are ignored. */
	readonly id: number;
}

/** Replays each new request id once, after the board has painted its current slots. */
export function useIssueMoveRequest(
	request: JiraKanbanIssueMoveRequest | undefined,
	onMove: ((move: IssueCardMove) => void) | undefined,
) {
	const handledId = useRef<number | undefined>(undefined);
	useEffect(() => {
		if (!request || !onMove || handledId.current === request.id) return;
		handledId.current = request.id;
		onMove(request);
	}, [onMove, request]);
}
