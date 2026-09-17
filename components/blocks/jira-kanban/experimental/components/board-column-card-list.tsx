"use client";

import {
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
} from "react";

import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import type { KanbanColumnChromeStyles } from "../../column-chrome";
import {
	useCreatedCardArrivalScroll,
	type JiraKanbanCreatedCardArrival,
} from "../hooks/use-created-card-arrival";
import {
	parseBoardCardGapZones,
	toChinFreeBoardCardBounds,
	type BoardAgentSessionDropBounds,
	type BoardCardInsertion,
} from "../lib/board-agent-session-drag";
import {
	BOARD_CARD_INSERTION_BAND_PX,
	pickBoardCardInsertionAtPoint,
} from "../lib/board-card-insertion";
import { BoardCardHoverInsertionContext } from "./board-card-hover-insertion-context";
import { BoardEmptyColumnInsertionSlot } from "./board-card-insertion-line";
import { BoardColumnAddButton } from "./create-work-item-drop-zone";
import type { AgentSessionWorkItemDraft } from "@/components/blocks/agent-session";

function toDropBounds(rect: DOMRectReadOnly): BoardAgentSessionDropBounds {
	return {
		bottom: rect.bottom,
		left: rect.left,
		right: rect.right,
		top: rect.top,
	};
}

function collectHoverGapZones(cardList: HTMLElement) {
	const clip = toDropBounds(cardList.getBoundingClientRect());
	const cardZones = Array.from(
		cardList.querySelectorAll<HTMLElement>('[data-board-agent-session-drop-zone="issue"]'),
	).flatMap((node) => {
		const chin = node.querySelector('[data-slot="jira-issue-attach-chin"]');
		return parseBoardCardGapZones(
			node.dataset.boardColumnTitle,
			node.dataset.issueKey,
			node.dataset.boardCardIndex,
			node.dataset.boardCardCount,
			toChinFreeBoardCardBounds(
				toDropBounds(node.getBoundingClientRect()),
				chin?.getBoundingClientRect().height ?? 0,
			),
			BOARD_CARD_INSERTION_BAND_PX,
		);
	});

	return cardZones.flatMap((zone) => {
		const top = Math.max(zone.bounds.top, clip.top);
		const bottom = Math.min(zone.bounds.bottom, clip.bottom);
		return bottom > top ? [{ ...zone, bounds: { ...zone.bounds, bottom, top } }] : [];
	});
}

/**
 * The scrolling card stack of a board column.
 *
 * Split out of `experimental-jira-kanban.tsx` because it owns concerns the
 * column shell does not: its own overflow measurement, the scroll mask derived
 * from it, the arrival scroll after cards are created, and the geometry an
 * insertion seam needs. The shell just says what to render and whether a seam
 * is armed.
 */
export function BoardColumnCardList({
	children,
	chrome,
	columnTitle,
	columnSizing = "fill",
	count,
	createdCardArrival,
	insertionArmed,
	isEmpty,
	isSessionDragging = false,
	onCreateWorkItem,
}: Readonly<{
	children: ReactNode;
	chrome: KanbanColumnChromeStyles;
	columnTitle: string;
	columnSizing?: "fill" | "content";
	count: number;
	createdCardArrival?: JiraKanbanCreatedCardArrival;
	insertionArmed: boolean;
	isEmpty: boolean;
	isSessionDragging?: boolean;
	onCreateWorkItem?: (draft: AgentSessionWorkItemDraft) => void;
}>) {
	const { ref, showBottomScrollMask, showTopScrollMask } = useHasVerticalOverflow<HTMLDivElement>({ trackAnimatedOverflow: true });
	const cardListRef = useRef<HTMLDivElement | null>(null);
	const setOverflowRef = useCallback((node: HTMLDivElement | null) => {
		cardListRef.current = node;
		ref(node);
	}, [ref]);
	useLayoutEffect(() => {
		const list = cardListRef.current;
		if (columnSizing !== "content" || !isSessionDragging || !list) return;
		// Proximity previews may grow a card's attach chin. Keep the natural
		// footer position stable for this drag; flex shrink still fits the viewport.
		const previousHeight = list.style.height;
		list.style.height = `${list.offsetHeight}px`;
		return () => { list.style.height = previousHeight; };
	}, [columnSizing, isSessionDragging]);
	const [hoverInsertion, setHoverInsertion] = useState<BoardCardInsertion | null>(null);
	const setCardListRef = useCreatedCardArrivalScroll({
		arrival: createdCardArrival,
		cardCount: count,
		onCardListRef: setOverflowRef,
		title: columnTitle,
	});
	const scrollMaskStyle = useMemo(
		() => buildScrollMaskStyle({
			fadeBottom: showBottomScrollMask,
			fadeSize: "3rem",
			fadeTop: showTopScrollMask,
			scrollbarWidth: 0,
		}),
		[showBottomScrollMask, showTopScrollMask],
	);
	const suppressCardInsertion = createdCardArrival !== undefined;
	const paintInsertion = !suppressCardInsertion && (insertionArmed || hoverInsertion !== null);

	const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.pointerType === "touch") {
			return;
		}
		if (suppressCardInsertion) {
			setHoverInsertion((current) => (current === null ? current : null));
			return;
		}
		if (insertionArmed) {
			setHoverInsertion((current) => (current === null ? current : null));
			return;
		}

		const nextInsertion = pickBoardCardInsertionAtPoint(
			{ x: event.clientX, y: event.clientY },
			collectHoverGapZones(event.currentTarget),
		);
		setHoverInsertion((current) => {
			if (
				current?.columnTitle === nextInsertion?.columnTitle
				&& current?.insertAtIndex === nextInsertion?.insertAtIndex
				&& current?.position === nextInsertion?.position
				&& current?.relativeToCardCode === nextInsertion?.relativeToCardCode
			) {
				return current;
			}
			return nextInsertion;
		});
	}, [insertionArmed, suppressCardInsertion]);

	const handlePointerLeave = useCallback(() => {
		setHoverInsertion((current) => (current === null ? current : null));
	}, []);

	return (
		<BoardCardHoverInsertionContext value={suppressCardInsertion ? null : hoverInsertion}>
			<div
				ref={setCardListRef}
				data-created-card-arrival-id={createdCardArrival?.id}
				data-jira-kanban-card-list=""
				className={cn(
					"min-h-0 min-w-0 overflow-y-auto overscroll-y-contain",
					// The mask fades the top and bottom 3rem, which would wash out a line
					// drawn near a scrolled edge. Stand down the mask only — dropping
					// `overflow-y-auto` would make the browser discard the scroll offset.
					paintInsertion && "[mask-image:none]! [-webkit-mask-image:none]!",
				)}
				onPointerLeave={handlePointerLeave}
				onPointerMove={handlePointerMove}
				style={{
					flexGrow: columnSizing === "fill" ? 1 : 0,
					flexBasis: columnSizing === "fill" ? 0 : "auto",
					display: "flex",
					flexDirection: "column",
					gap: token("space.100"),
					...scrollMaskStyle,
					...chrome.cardList,
					// Share the focus-ring gutter with the footer's top inset so
					// the card-to-create gap matches the well's outer insets.
					...(columnSizing === "content" && chrome.headerFrame === "enclosed" ? {
						paddingBottom: token("space.050"),
						marginBottom: `calc(${token("border.width")} - ${token("space.050")})`,
					} : {}),
					// A child cannot read its parent's `gap`, and the value is chrome
					// dependent, so an insertion line is handed the track it centres in.
					"--board-card-gap": chrome.cardList.gap ?? token("space.100"),
				} as CSSProperties}
			>
				{children}
				{columnSizing === "fill" ? <div
					aria-hidden={isSessionDragging || undefined}
					inert={isSessionDragging || undefined}
					className={cn("shrink-0 justify-center py-1", isSessionDragging ? "hidden" : "flex")}
					data-board-work-item-create=""
				>
					<BoardColumnAddButton onCreateWorkItem={onCreateWorkItem} title={columnTitle} />
				</div> : null}
				{isEmpty && columnSizing === "fill" ? <BoardEmptyColumnInsertionSlot columnTitle={columnTitle} /> : null}
			</div>
		</BoardCardHoverInsertionContext>
	);
}
