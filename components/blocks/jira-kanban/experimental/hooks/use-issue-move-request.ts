"use client";

import { useEffect, useRef } from "react";
import { afterNextPresentedFrame, createIssueDropHandoff, type AfterNextFrame, type IssueDropHandoff } from "../lib/issue-drop-handoff";
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

/**
 * Replays each new request id once, after the board has painted its current
 * slots. A request made from a discrete event (a menu click) flushes this
 * effect before paint, so the move waits for the next presented frame: the
 * click's own feedback (the menu leaving) is on screen, on the compositor,
 * before the move's long commit, exactly like a native drop's handoff.
 */
export function useIssueMoveRequest(
	request: JiraKanbanIssueMoveRequest | undefined,
	onMove: ((move: IssueCardMove) => void) | undefined,
	afterFrame: AfterNextFrame = afterNextPresentedFrame,
) {
	const handledId = useRef<number | undefined>(undefined);
	const handoff = useRef<IssueDropHandoff | null>(null);
	useEffect(() => () => handoff.current?.flush(), []);
	useEffect(() => {
		if (!request || !onMove || handledId.current === request.id) return;
		handledId.current = request.id;
		handoff.current ??= createIssueDropHandoff(afterFrame);
		handoff.current.defer(() => onMove(request));
	}, [afterFrame, onMove, request]);
}
