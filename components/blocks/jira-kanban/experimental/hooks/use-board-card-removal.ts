"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { JIRA_CREATE_REMOVE_DURATION_S } from "@/components/blocks/jira-creating/lib/jira-creating-motion";
import { useLatestRef } from "@/lib/use-latest-ref";
import type { JiraKanbanCardData } from "@/components/blocks/jira-kanban";
import type { JiraKanbanCardMoreMenuActions } from "../experimental-jira-kanban-card";

type RemovalRequest = { kind: "card"; card: JiraKanbanCardData; action: keyof JiraKanbanCardMoreMenuActions }
	| { kind: "selection"; cardCodes: readonly string[] };
interface PendingRemoval {
	request: RemovalRequest;
	cardCodes: ReadonlySet<string>;
	remainingCodes: Set<string>;
	timer: ReturnType<typeof setTimeout>;
}

/** Keep a removed card just long enough to reverse its create entrance. */
export function useBoardCardRemoval(
	actions: JiraKanbanCardMoreMenuActions | undefined,
	reducedMotion: boolean | null,
	onCardsRemove?: (cardCodes: readonly string[]) => void,
) {
	const latestActions = useLatestRef({ actions, onCardsRemove });
	const pending = useRef<PendingRemoval | null>(null);
	const [removingCardCodes, setRemovingCardCodes] = useState<ReadonlySet<string>>(() => new Set());
	const commit = useCallback((request: RemovalRequest) => {
		if (request.kind === "selection") latestActions.current.onCardsRemove?.(request.cardCodes);
		else latestActions.current.actions?.[request.action]?.(request.card);
	}, [latestActions]);
	const finish = useCallback(() => {
		const removal = pending.current;
		if (!removal) return;
		pending.current = null;
		clearTimeout(removal.timer);
		commit(removal.request);
		setRemovingCardCodes(new Set());
	}, [commit]);
	const complete = useCallback((code: string) => {
		const removal = pending.current;
		if (!removal || !removal.remainingCodes.delete(code)) return;
		if (removal.remainingCodes.size === 0) finish();
	}, [finish]);
	const remove = useCallback((request: RemovalRequest) => {
		const codes = request.kind === "selection" ? request.cardCodes : [request.card.code];
		if (codes.length === 0 || codes.every(code => pending.current?.cardCodes.has(code))) return;
		// Finish the previous gesture before starting another removal. Each
		// transaction then receives the board state committed by its predecessor.
		finish();
		if (reducedMotion) {
			commit(request);
			return;
		}
		// Filtering/collapsing a column can unmount the animation before it ends.
		const timer = setTimeout(finish, JIRA_CREATE_REMOVE_DURATION_S * 1000 + 100);
		pending.current = { request, cardCodes: new Set(codes), remainingCodes: new Set(codes), timer };
		setRemovingCardCodes(new Set(codes));
	}, [commit, finish, reducedMotion]);
	useEffect(() => {
		return () => {
			const removal = pending.current;
			if (removal) {
				clearTimeout(removal.timer);
				pending.current = null;
				commit(removal.request);
			}
		};
	}, [commit]);
	return {
		removingCardCodes,
		complete,
		deleteCards: onCardsRemove ? (cardCodes: readonly string[]) => remove({ kind: "selection", cardCodes: [...new Set(cardCodes)] }) : undefined,
		actions: actions ? {
			onArchive: actions.onArchive ? (card: JiraKanbanCardData) => remove({ kind: "card", action: "onArchive", card }) : undefined,
			onDelete: actions.onDelete ? (card: JiraKanbanCardData) => remove({ kind: "card", action: "onDelete", card }) : undefined,
		} : undefined,
	};
}
