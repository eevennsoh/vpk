"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { JiraKanbanProps } from "../../index";
import { captureIssueCardDropArrival, resolveIssueCardDropArrival, resolveVisibleIssueDropCodes, type IssueCardDropArrival } from "../lib/board-card-arrival";
import type { JiraKanbanCreatedCardArrival } from "./use-created-card-arrival";
import { captureIssueCardDropFlights, hasIssueDropTarget, startIssueCardDropFlights, type IssueCardDropFlight, type IssueDropPoint } from "../lib/issue-card-drop-flight";

/** Native issue drops share the agent-session card entrance once their owner commits the move. */
export function useIssueCardDropArrival({ boardRef, enabled, getPreview, nativePreviewRef, columns, createdArrival, draggedCardCode, selectedCardCodes, onDrop, onCreatedComplete }: Readonly<{
	boardRef: RefObject<HTMLElement | null>;
	enabled: boolean;
	getPreview: () => HTMLElement | null;
	nativePreviewRef: RefObject<HTMLElement | null>;
	columns: JiraKanbanProps["boardColumns"];
	createdArrival?: JiraKanbanCreatedCardArrival;
	draggedCardCode: string | null;
	selectedCardCodes: JiraKanbanProps["selectedCardCodes"];
	onDrop: JiraKanbanProps["onCardDrop"];
	onCreatedComplete?: (id: number) => void;
}>) {
	const [drop, setDrop] = useState<IssueCardDropArrival | null>(null);
	const version = useRef(0);
	const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const releasePoint = useRef<IssueDropPoint | null>(null);
	const grabOffset = useRef<IssueDropPoint>({ x: 0, y: 0 });
	const snapshot = useRef<{ id: number; title: string; flights: IssueCardDropFlight[]; started?: boolean } | null>(null);
	const arrival = useMemo(() => resolveIssueCardDropArrival(drop, columns), [drop, columns]);
	const flightId = arrival?.animatedCardCodes ? arrival.id : undefined;
	const canDrop = onDrop !== undefined;
	useLayoutEffect(() => {
		const root = boardRef.current;
		if (!enabled) {
			snapshot.current = null;
			releasePoint.current = null;
			setDrop(null);
			return;
		}
		if (!canDrop || !root) return;
		const captureStart = (event: globalThis.DragEvent) => {
			if (!(event.target instanceof Element) || !root.contains(event.target)) return;
			const previousId = snapshot.current?.id;
			if (previousId !== undefined) setDrop((current) => current?.id === previousId ? null : current);
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
		const captured = snapshot.current;
		if (!arrival || captured?.id !== arrival.id) return;
		if (captured.started && captured.flights.some((flight) => !arrival.cardCodes.includes(flight.code))) {
			setDrop((current) => current?.id === captured.id ? null : current);
		} else if (!captured.started) captured.flights = captured.flights.filter((flight) => arrival.cardCodes.includes(flight.code));
	}, [arrival]);
	useLayoutEffect(() => {
		const captured = snapshot.current;
		const root = boardRef.current;
		if (!enabled || flightId === undefined || captured?.id !== flightId || !root) return;
		if (reduceMotion || captured.flights.length === 0) {
			setDrop((current) => current?.id === flightId ? null : current);
			return;
		}
		captured.started = true;
		return startIssueCardDropFlights(root, captured.title, captured.flights, (code) => {
			setDrop((current) => current?.id === flightId ? { ...current, pendingCardCodes: current.pendingCardCodes?.filter((pending) => pending !== code) } : current);
		}, () => {
			const last = captured.flights.at(-1);
			// Collapsed columns have no card entrance to finish this handshake.
			if (!last || !hasIssueDropTarget(root, captured.title, last.code)) setDrop((current) => current?.id === flightId ? null : current);
		});
	}, [boardRef, enabled, flightId, reduceMotion]);
	useLayoutEffect(() => {
		// Once the owner ends the gesture, an unchanged drop must not react to later board edits.
		if (drop && !draggedCardCode && !arrival) setDrop(null);
		// Moving the creation's final card transfers its entrance ownership to this drop.
		const finalCreatedCode = createdArrival?.cardCodes.at(-1);
		if (arrival && createdArrival && finalCreatedCode && arrival.cardCodes.includes(finalCreatedCode)) {
			onCreatedComplete?.(createdArrival.id);
		}
	}, [arrival, createdArrival, draggedCardCode, drop, onCreatedComplete]);
	const handleDrop = useCallback<NonNullable<JiraKanbanProps["onCardDrop"]>>((columnTitle, target) => {
		if (!enabled) {
			onDrop?.(columnTitle, target);
			return;
		}
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
			snapshot.current = { id: next.id, title: columnTitle, flights };
			releasePoint.current = null;
			setDrop(visibleCodes ? { ...next, animatedCardCodes: visibleCodes, pendingCardCodes: flights.map((flight) => flight.code) } : next);
		}
		onDrop?.(columnTitle, target);
	}, [boardRef, columns, draggedCardCode, enabled, getPreview, nativePreviewRef, onDrop, reduceMotion, selectedCardCodes]);
	const handleComplete = useCallback((id: number) => {
		if (id < 0) setDrop((current) => current?.id === id ? null : current);
		else onCreatedComplete?.(id);
	}, [onCreatedComplete]);
	return { arrival: enabled ? arrival : undefined, handleDrop: onDrop ? handleDrop : undefined, handleComplete };
}
