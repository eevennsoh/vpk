"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { applyMerchantJourneyToBoard, type MerchantJourneyPhase } from "@/components/projects/butter/data/merchant-journey";
import { BUTTER_SUGGESTION_DEMO_KEY, toButterAgentActivityFromSession } from "@/components/projects/butter/data/presentation-board";

type Replay = Readonly<{ id: number; source: "prepare" | "passed"; target: "working" | "merged" }>;
type BoardUpdate = (columns: readonly JiraKanbanColumnData[]) => JiraKanbanColumnData[];

export function useButterJourneyReplay({ boardColumns, journeySession, phase, queueUpdate, setBoardColumns, wacContent }: Readonly<{
	boardColumns: readonly JiraKanbanColumnData[];
	journeySession?: ProjectButterSessionItem;
	phase: MerchantJourneyPhase;
	queueUpdate: (issueKey: string, update: BoardUpdate, onApplied?: () => void, animation?: "fade", feedback?: "trace") => void;
	setBoardColumns: Dispatch<SetStateAction<JiraKanbanColumnData[]>>;
	wacContent: boolean;
}>) {
	const [replay, setReplay] = useState<Replay | null>(null);
	const sequence = useRef(0);
	const started = useRef(0);
	const start = useCallback((step: number) => {
		if (wacContent || (step !== 1 && step !== 4) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setReplay(null);
			return;
		}
		const next: Replay = { id: ++sequence.current, source: step === 1 ? "prepare" : "passed", target: step === 1 ? "working" : "merged" };
		const session = journeySession ? toButterAgentActivityFromSession(journeySession) : "PAY-999:merchant-journey";
		setReplay(next);
		setBoardColumns((columns) => applyMerchantJourneyToBoard(columns, next.source, session));
	}, [journeySession, setBoardColumns, wacContent]);
	const cancel = useCallback(() => setReplay(null), []);
	useEffect(() => {
		if (!replay || phase !== replay.target || started.current === replay.id) return;
		const sourceColumn = replay.source === "prepare" ? "To do" : "In progress";
		if (!boardColumns.some((column) => column.title === sourceColumn && column.cards.some((card) => card.code === BUTTER_SUGGESTION_DEMO_KEY))) return;
		started.current = replay.id;
		document.querySelector<HTMLElement>(`[data-butter-board-surface] [data-issue-key="${BUTTER_SUGGESTION_DEMO_KEY}"][data-board-column-title="${sourceColumn}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
		const session = journeySession ? toButterAgentActivityFromSession(journeySession) : undefined;
		queueUpdate(BUTTER_SUGGESTION_DEMO_KEY, (columns) => applyMerchantJourneyToBoard(columns, replay.target, session), () => setReplay((current) => current?.id === replay.id ? null : current), "fade", "trace");
	}, [boardColumns, journeySession, phase, queueUpdate, replay]);
	return { active: replay !== null, start, cancel };
}
