"use client";

import { use, useLayoutEffect, useState, type ReactNode } from "react";
import { motion, type MotionProps } from "motion/react";

import { JiraCreateEntrance } from "@/components/blocks/jira-creating/components/jira-creating-entrance";
import { getJiraCreateArrivalDelayS } from "@/components/blocks/jira-creating/lib/jira-creating-motion";
import type { JiraKanbanCardMoveAnimation } from "@/components/blocks/jira-kanban";
import { cn } from "@/lib/utils";

import type { JiraKanbanCreatedCardArrival } from "../hooks/use-created-card-arrival";
import type { BoardCardInsertion } from "../lib/board-agent-session-drag";
import { resolveBoardCardArrival } from "../lib/board-card-arrival";
import {
	getBoardCardInsertionAnchorClassName,
	resolveBoardCardInsertionPosition,
} from "../lib/board-card-insertion";
import {
	getJiraKanbanCardScale,
	JIRA_KANBAN_CARD_DEPART,
	JIRA_KANBAN_CARD_MOVE,
} from "../lib/card-motion";
import { BoardCardHoverInsertionContext } from "./board-card-hover-insertion-context";
import { BoardCardInsertionLine } from "./board-card-insertion-line";

interface CreatedCardArrivalMotionProps {
	arrival?: JiraKanbanCreatedCardArrival;
	/** Column size and slot, so a session drag can resolve the gaps around this card. */
	cardCount: number;
	cardCode: string;
	cardIndex: number;
	cardMovePhase: JiraKanbanCardMoveAnimation["phase"] | undefined;
	children: ReactNode;
	className?: string;
	columnTitle: string;
	dropTarget: "attach" | "unlink" | null | undefined;
	/** The board-wide armed insertion; this card resolves whether it owns a seam. */
	cardInsertion: BoardCardInsertion | null | undefined;
	onArrivalComplete: (arrivalId: number) => void;
	positionMotion?: Readonly<Pick<MotionProps, "layout" | "layoutId" | "transition">>;
	shouldAnimateCardMoves: boolean;
}

function getCardMoveAnimation(
	shouldAnimateCardMoves: boolean,
	cardMovePhase: JiraKanbanCardMoveAnimation["phase"] | undefined,
): MotionProps["animate"] {
	return shouldAnimateCardMoves
		? { scale: getJiraKanbanCardScale(cardMovePhase) }
		: undefined;
}

function getArrivalCompletionHandler(
	arrival: JiraKanbanCreatedCardArrival | undefined,
	isFinalArrivingCard: boolean,
	onArrivalComplete: (arrivalId: number) => void,
): MotionProps["onAnimationComplete"] {
	if (!isFinalArrivingCard || !arrival) {
		return undefined;
	}
	return () => onArrivalComplete(arrival.id);
}

/**
 * The wrapper only ever drives column reshuffles now — an arriving card's
 * `will-change` and transition belong to the jira-creating entrance inside it.
 */
function getCardMoveStyle(
	cardMovePhase: JiraKanbanCardMoveAnimation["phase"] | undefined,
): MotionProps["style"] {
	return cardMovePhase ? { willChange: "transform" } : undefined;
}

function getCardMoveTransition(
	cardMovePhase: JiraKanbanCardMoveAnimation["phase"] | undefined,
): MotionProps["transition"] {
	return cardMovePhase === "departing" ? JIRA_KANBAN_CARD_DEPART : JIRA_KANBAN_CARD_MOVE;
}

export function CreatedCardArrivalMotion({
	arrival,
	cardCode,
	cardCount,
	cardIndex,
	cardInsertion,
	cardMovePhase,
	children,
	className,
	columnTitle,
	dropTarget,
	onArrivalComplete,
	positionMotion,
	shouldAnimateCardMoves,
}: Readonly<CreatedCardArrivalMotionProps>) {
	const hoverInsertion = use(BoardCardHoverInsertionContext);
	const insertionPosition = resolveBoardCardInsertionPosition(cardInsertion ?? hoverInsertion, {
		cardIndex,
		columnTitle,
	});
	const cardArrival = resolveBoardCardArrival(arrival, cardCode);
	const [entranceStarted, setEntranceStarted] = useState(!cardArrival.deferred);
	const waiting = cardArrival.deferred && !entranceStarted;
	useLayoutEffect(() => {
		if (!cardArrival.deferred) setEntranceStarted(true);
	}, [cardArrival.deferred]);
	const cardMoveAnimation = getCardMoveAnimation(shouldAnimateCardMoves, cardMovePhase);
	const handleArrivalComplete = getArrivalCompletionHandler(
		arrival,
		cardArrival.final,
		onArrivalComplete,
	);
	const enterDelayS = cardArrival.entering && arrival
		? getJiraCreateArrivalDelayS(arrival.cardCodes, cardCode)
		: 0;

	// Only interior gaps arm a seam, so the rule always has a real gutter to
	// centre itself in — no card owns a flush column-edge line.
	const insertionLine = insertionPosition ? (
		<BoardCardInsertionLine position={insertionPosition} seam="gap" />
	) : null;

	return (
		<motion.div
			aria-hidden={waiting || undefined}
			className={cn("w-full min-w-0 max-w-[280px]", waiting ? "hidden" : null)}
			data-created-card-pending={waiting || undefined}
			inert={waiting || undefined}
			layout={cardArrival.entering ? false : positionMotion?.layout}
			layoutId={cardArrival.entering ? undefined : positionMotion?.layoutId}
			transition={positionMotion?.transition}
		>
			<motion.div
				animate={cardArrival.entering ? undefined : cardMoveAnimation}
				className={cn(
					"flex w-full min-w-0 max-w-[280px] flex-col gap-2 rounded-lg",
					"transition-[background-color,opacity] duration-normal ease-out-practical motion-reduce:transition-none",
					getBoardCardInsertionAnchorClassName(insertionPosition),
					className,
				)}
				data-board-agent-session-drop-zone="issue"
				data-board-agent-session-target={dropTarget ?? undefined}
				data-board-card-count={cardCount}
				data-board-card-index={cardIndex}
				data-board-column-title={columnTitle}
				data-created-card-arrival-id={cardArrival.arrivalId}
				data-created-card-arrival-last={cardArrival.final || undefined}
				data-jira-creating-arrival={cardArrival.entering || undefined}
				data-issue-key={cardCode}
				initial={false}
				style={getCardMoveStyle(cardMovePhase)}
				transition={getCardMoveTransition(cardMovePhase)}
			>
				{/*
				 * The entrance wrapper stays mounted at rest rather than being swapped
				 * for a fragment when the arrival clears. Changing the child's element
				 * type would unmount and remount the card, discarding any menu,
				 * expansion, drag, or focus state the user opened on the brand-new card
				 * during its entrance.
				 */}
				<JiraCreateEntrance
					active={cardArrival.entering}
					deferred={waiting}
					enterDelayS={enterDelayS}
					onAnimationComplete={handleArrivalComplete}
				>
					{insertionLine}
					{children}
				</JiraCreateEntrance>
			</motion.div>
		</motion.div>
	);
}
