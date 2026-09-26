"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getAutoArrangePlan } from "../lib/board-auto-arrange";
import type { JiraKanbanProps } from "../../index";
import { captureIssueCardDropArrival, resolveIssueCardDropArrival, resolveVisibleIssueDropCodes, type IssueCardDropArrival } from "../lib/board-card-arrival";
import type { JiraKanbanCreatedCardArrival } from "./use-created-card-arrival";
import { captureIssueCardDropFlights, hasIssueDropTarget, startIssueCardDropFlights, type IssueCardDropFlight, type IssueDropPoint } from "../lib/issue-card-drop-flight";

/** Native issue drops share the agent-session card entrance once their owner commits the move. */
export function useIssueCardDropArrival({ boardRef, enabled, getPreview, nativePreviewRef, columns, createdArrival, draggedCardCode, selectedCardCodes, onDrop, onAutoArrange, onCreatedComplete }: Readonly<{
	boardRef: RefObject<HTMLElement | null>;
	enabled: boolean;
	getPreview: () => HTMLElement | null;
	nativePreviewRef: RefObject<HTMLElement | null>;
	columns: JiraKanbanProps["boardColumns"];
	createdArrival?: JiraKanbanCreatedCardArrival;
	draggedCardCode: string | null;
	selectedCardCodes: JiraKanbanProps["selectedCardCodes"];
	onDrop: JiraKanbanProps["onCardDrop"];
	onAutoArrange?: (codes: ReadonlySet<string>) => void;
	onCreatedComplete?: (id: number) => void;
}>) {
	const [drop, setDrop] = useState<readonly IssueCardDropArrival[]>([]);
	const [flightBatchId, setFlightBatchId] = useState(0);
	const version = useRef(0);
	const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const releasePoint = useRef<IssueDropPoint | null>(null);
	const grabOffset = useRef<IssueDropPoint>({ x: 0, y: 0 });
	const snapshots = useRef<{ id: number; title: string; flights: IssueCardDropFlight[]; started?: boolean }[]>([]);
	const arrivals = useMemo(() => drop.flatMap((item) => {
		const arrival = resolveIssueCardDropArrival(item, columns);
		return arrival ? [arrival] : [];
	}), [drop, columns]);
	const committedArrivals = useRef(arrivals);
	useLayoutEffect(() => { committedArrivals.current = arrivals; }, [arrivals]);
	const hasFlights = arrivals.some((arrival) => arrival.animatedCardCodes !== undefined);
	const canDrop = onDrop !== undefined;
	useLayoutEffect(() => {
		const root = boardRef.current;
		if (!enabled || !canDrop || !root) return;
		const captureStart = (event: globalThis.DragEvent) => {
			if (!(event.target instanceof Element) || !root.contains(event.target)) return;
			if (snapshots.current.length) setDrop([]);
			snapshots.current = [];
			releasePoint.current = null;
			const face = event.target.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]');
			if (face) {
				const bounds = face.getBoundingClientRect();
				grabOffset.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
			}
		};
		const captureDrop = (event: globalThis.DragEvent) => {
			if (event.target instanceof Node && root.contains(event.target)) releasePoint.current = { x: event.clientX, y: event.clientY };
		};
		root.ownerDocument.addEventListener("dragstart", captureStart, true);
		root.ownerDocument.addEventListener("drop", captureDrop, true);
		return () => {
			root.ownerDocument.removeEventListener("dragstart", captureStart, true);
			root.ownerDocument.removeEventListener("drop", captureDrop, true);
		};
	}, [boardRef, canDrop, enabled]);
	useLayoutEffect(() => {
		for (const captured of snapshots.current) {
			const arrival = arrivals.find((item) => item.id === captured.id);
			if (!arrival) continue;
			if (captured.started && captured.flights.some((flight) => !arrival.cardCodes.includes(flight.code))) {
				setDrop((current) => current.filter((item) => item.id !== captured.id));
			} else if (!captured.started) captured.flights = captured.flights.filter((flight) => arrival.cardCodes.includes(flight.code));
		}
	}, [arrivals]);
	useLayoutEffect(() => {
		const root = boardRef.current;
		if (!hasFlights || !root) return;
		const activeIds = new Set(committedArrivals.current.map((arrival) => arrival.id));
		const cleanups = snapshots.current.filter((captured) => activeIds.has(captured.id)).map((captured) => {
			if (reduceMotion || captured.flights.length === 0) {
				setDrop((current) => current.filter((item) => item.id !== captured.id));
				return () => {};
			}
			captured.started = true;
			return startIssueCardDropFlights(root, captured.title, captured.flights, (code) => {
				setDrop((current) => current.map((item) => item.id === captured.id
					? { ...item, pendingCardCodes: item.pendingCardCodes?.filter((pending) => pending !== code) } : item));
			}, () => {
				// Collapsed columns have no card entrance to finish this handshake.
				if (captured.flights.every((flight) => !hasIssueDropTarget(root, captured.title, flight.code))) {
					setDrop((current) => current.filter((item) => item.id !== captured.id));
				}
			});
		});
		return () => cleanups.forEach((cleanup) => cleanup());
	}, [boardRef, committedArrivals, flightBatchId, hasFlights, reduceMotion]);
	useLayoutEffect(() => {
		// Once the owner ends the gesture, rejected moves cannot react to later edits.
		if (drop.length && !draggedCardCode && drop.some((item) => !arrivals.some((arrival) => arrival.id === item.id))) {
			setDrop((current) => current.filter((item) => arrivals.some((arrival) => arrival.id === item.id)));
		}
		const finalCreatedCode = createdArrival?.cardCodes.at(-1);
		if (createdArrival && finalCreatedCode && arrivals.some((arrival) => arrival.cardCodes.includes(finalCreatedCode))) {
			onCreatedComplete?.(createdArrival.id);
		}
	}, [arrivals, createdArrival, draggedCardCode, drop, onCreatedComplete]);

	const handleDrop = useCallback<NonNullable<JiraKanbanProps["onCardDrop"]>>((columnTitle, target) => {
		if (draggedCardCode) {
			const codes = selectedCardCodes?.has(draggedCardCode) ? [...selectedCardCodes] : [draggedCardCode];
			// Created-card ids are positive; move ids occupy a separate completion namespace.
			const next = captureIssueCardDropArrival(columns, codes, columnTitle, --version.current);
			const root = boardRef.current;
			const crossColumn = next.before.some((card) => card.columnTitle !== columnTitle);
			const visibleCodes = enabled && crossColumn ? resolveVisibleIssueDropCodes(next.before.map((card) => card.code), draggedCardCode) : undefined;
			const flights = enabled && !reduceMotion && crossColumn && root ? captureIssueCardDropFlights({
				root, preview: getPreview(), nativePreview: nativePreviewRef.current, pointer: releasePoint.current,
				grabOffset: grabOffset.current, grabbed: draggedCardCode, codes: next.before.map((card) => card.code),
			}) : [];
			snapshots.current = [{ id: next.id, title: columnTitle, flights }];
			setFlightBatchId(next.id);
			releasePoint.current = null;
			setDrop([visibleCodes ? { ...next, animatedCardCodes: visibleCodes, pendingCardCodes: flights.map((flight) => flight.code) } : next]);
		}
		onDrop?.(columnTitle, target);
	}, [boardRef, columns, draggedCardCode, enabled, getPreview, nativePreviewRef, onDrop, reduceMotion, selectedCardCodes]);
	const handleAutoArrange = useCallback((codes: ReadonlySet<string>) => {
		const plan = getAutoArrangePlan(columns, codes);
		const root = boardRef.current;
		const captured = [...new Set(plan.map((move) => move.columnTitle))].map((title) => {
			const moving = plan.filter((move) => move.columnTitle === title).map((move) => move.code);
			const next = captureIssueCardDropArrival(columns, moving, title, --version.current);
			const flights = enabled && !reduceMotion && root ? captureIssueCardDropFlights({
				root, preview: getPreview(), nativePreview: nativePreviewRef.current, pointer: null,
				grabOffset: grabOffset.current, grabbed: draggedCardCode ?? moving[0], codes: moving, allCards: true,
			}) : [];
			return { next, title, flights };
		});
		snapshots.current = captured.map(({ next, title, flights }) => ({ id: next.id, title, flights }));
		setFlightBatchId(version.current);
		setDrop(captured.map(({ next, flights }) => enabled && !reduceMotion
			? { ...next, animatedCardCodes: next.before.map((card) => card.code), pendingCardCodes: flights.map((flight) => flight.code) } : next));
		onAutoArrange?.(codes);
	}, [boardRef, columns, draggedCardCode, enabled, getPreview, nativePreviewRef, onAutoArrange, reduceMotion]);
	const handleComplete = useCallback((id: number) => {
		if (id < 0) setDrop((current) => current.filter((item) => item.id !== id));
		else onCreatedComplete?.(id);
	}, [onCreatedComplete]);
	return { arrivalForColumn: (title: string) => arrivals.find((arrival) => arrival.columnTitle === title), handleDrop: onDrop ? handleDrop : undefined, handleAutoArrange: onAutoArrange ? handleAutoArrange : undefined, handleComplete };
}
