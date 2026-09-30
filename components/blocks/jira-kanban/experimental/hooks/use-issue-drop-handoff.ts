"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import type { JiraKanbanCardDropTarget } from "@/components/blocks/jira-kanban/card-drop";
import { afterNextPresentedFrame, createIssueDropHandoff } from "../lib/issue-drop-handoff";

type IssueDrop = (columnTitle: string, target?: JiraKanbanCardDropTarget) => void;

/**
 * Native drop and drag-end callbacks, with the drop's commit handed to the
 * frame after the release (see `lib/issue-drop-handoff.ts`). Disabled, both
 * run at once, as before. `handleDrop` exists only when `onDrop` does.
 */
export function useIssueDropHandoff(enabled: boolean, onDrop: IssueDrop | undefined, onDragEnd: (() => void) | undefined) {
	const latest = useRef({ onDrop, onDragEnd });
	useLayoutEffect(() => {
		latest.current = { onDrop, onDragEnd };
	});
	const handoff = useMemo(() => createIssueDropHandoff(afterNextPresentedFrame), []);
	useEffect(() => () => handoff.flush(), [handoff]);
	const drop = useCallback<IssueDrop>((columnTitle, target) => {
		// The callbacks of the render that saw the drop, exactly as a synchronous drop would call them.
		const commit = latest.current.onDrop;
		if (enabled) handoff.defer(() => commit?.(columnTitle, target));
		else commit?.(columnTitle, target);
	}, [enabled, handoff]);
	const dragEnd = useCallback(() => {
		const end = latest.current.onDragEnd;
		handoff.then(() => end?.());
	}, [handoff]);
	return { handleDrop: onDrop ? drop : undefined, handleDragEnd: dragEnd };
}
