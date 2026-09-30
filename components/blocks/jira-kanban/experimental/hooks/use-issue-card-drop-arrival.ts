"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useMediaQuery } from "@/hooks/use-media-query";
import { animateIssueSolitaireDrop, captureIssueCardReflow, resolveIssueSolitaireLanding, type IssueCardReflowPosition } from "../lib/issue-solitaire-drop";
import { settleIssueCohortPreview } from "../lib/issue-drag-preview";
import { getAutoArrangePlan } from "../lib/board-auto-arrange";
import type { JiraKanbanProps } from "@/components/blocks/jira-kanban/index";
import type { JiraKanbanCardDropTarget } from "@/components/blocks/jira-kanban/card-drop";
import { captureIssueCardDropArrival, resolveIssueCardDropArrival, resolveIssueDropDeck, resolveVisibleIssueDropCodes, type IssueCardDropArrival } from "../lib/board-card-arrival";
import type { JiraKanbanCreatedCardArrival } from "./use-created-card-arrival";
import { captureIssueCardDropFlights, hasIssueDropTarget, startIssueCardDropFlights, type IssueCardDropFlight, type IssueDropPoint } from "../lib/issue-card-drop-flight";

/** A host-requested multi-card move, committed like one cohort drop. */
export interface IssueCardMove {
	readonly cardCodes: readonly string[];
	readonly columnTitle: string;
	readonly target?: JiraKanbanCardDropTarget;
	/** Assignment owns its card glow separately; suppress the manual-drop trace. */
	readonly feedback?: "none";
}

/** A released cohort whose move commits in the task after its settled face paints. */
interface SettledIssueDrop {
	readonly preview: HTMLElement;
	readonly dragEnds: (() => void)[];
	frame: number;
	timer: ReturnType<typeof setTimeout> | undefined;
	readonly commit: (flush: boolean) => void;
}

/** Native issue drops share the agent-session card entrance once their owner commits the move. */
export function useIssueCardDropArrival({ boardRef, enabled, getPreview, nativePreviewRef, columns, createdArrival, draggedCardCode, selectedCardCodes, onDrop, onMove, onAutoArrange, onCreatedComplete, solitaire = false, stopPreview, releasePreview }: Readonly<{
	solitaire?: boolean;
	stopPreview?: () => void;
	/** Takes ownership of the held traveller so a release can settle it into place. */
	releasePreview?: () => HTMLElement | null;
	boardRef: RefObject<HTMLElement | null>;
	enabled: boolean;
	getPreview: () => HTMLElement | null;
	nativePreviewRef: RefObject<HTMLElement | null>;
	columns: JiraKanbanProps["boardColumns"];
	createdArrival?: JiraKanbanCreatedCardArrival;
	draggedCardCode: string | null;
	selectedCardCodes: JiraKanbanProps["selectedCardCodes"];
	onDrop: JiraKanbanProps["onCardDrop"];
	/** Commits a host-requested move; the arrival is captured first, exactly like a drop. */
	onMove?: (move: IssueCardMove) => void;
	onAutoArrange?: (codes: ReadonlySet<string>) => void;
	onCreatedComplete?: (id: number) => void;
}>) {
	const [drop, setDrop] = useState<readonly IssueCardDropArrival[]>([]);
	const [flightBatchId, setFlightBatchId] = useState(0);
	const version = useRef(0);
	const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const releasePoint = useRef<IssueDropPoint | null>(null);
	const grabOffset = useRef<IssueDropPoint>({ x: 0, y: 0 });
	const snapshots = useRef<{ id: number; title: string; flights: IssueCardDropFlight[]; started?: boolean; solitaire?: boolean; feedback?: "none"; reflowBefore?: readonly IssueCardReflowPosition[] }[]>([]);
	const arrivals = useMemo(() => drop.flatMap((item) => {
		const arrival = resolveIssueCardDropArrival(item, columns);
		return arrival ? [arrival] : [];
	}), [drop, columns]);
	const committedArrivals = useRef(arrivals);
	useLayoutEffect(() => { committedArrivals.current = arrivals; }, [arrivals]);
	const hasFlights = arrivals.some((arrival) => snapshots.current.some((item) => item.id === arrival.id && !item.solitaire) && arrival.animatedCardCodes !== undefined);
	const hasSolitaire = arrivals.some((arrival) => snapshots.current.some((item) => item.id === arrival.id && item.solitaire));
	const canDrop = onDrop !== undefined;
	useLayoutEffect(() => {
		const root = boardRef.current;
		if (!enabled) {
			snapshots.current = [];
			releasePoint.current = null;
			setDrop([]);
			return;
		}
		if (!canDrop || !root) return;
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
		if (!enabled || !hasFlights || !root) return;
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
	}, [boardRef, committedArrivals, enabled, flightBatchId, hasFlights, reduceMotion]);
	useLayoutEffect(() => {
		const root = boardRef.current;
		if (!enabled || !hasSolitaire || !root) return;
		stopPreview?.();
		nativePreviewRef.current?.remove();
		nativePreviewRef.current = null;
		const cleanups = committedArrivals.current.filter((arrival) => snapshots.current.some((item) => item.id === arrival.id && item.solitaire)).map((arrival) =>
			animateIssueSolitaireDrop(root, arrival.columnTitle, arrival.cardCodes, reduceMotion, () => {
				setDrop((current) => current.filter((item) => item.id !== arrival.id));
			}, undefined, snapshots.current.find((item) => item.id === arrival.id)?.feedback, snapshots.current.find((item) => item.id === arrival.id)?.reflowBefore));
		const stop = () => cleanups.forEach((cleanup) => cleanup());
		const destinations = [...root.querySelectorAll<HTMLElement>("[data-jira-kanban-column]")].filter((column) => committedArrivals.current.some((arrival) => arrival.columnTitle === column.dataset.jiraKanbanColumn));
		const onScroll = (event: Event) => {
			const target = event.target;
			// Emptying a source column resets its scroll offset. That cannot move
			// the destination trace, and must not cancel its completion feedback.
			if (target === root.ownerDocument || target instanceof Element && destinations.some((column) => column.contains(target) || target.contains(column))) stop();
		};
		root.ownerDocument.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", stop);
		return () => {
			root.ownerDocument.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", stop);
			stop();
		};
	}, [boardRef, enabled, flightBatchId, hasSolitaire, nativePreviewRef, reduceMotion, stopPreview]);
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

	// Freeze the cohort's arrival before its owner commits. A native drop flies
	// its one held traveller into the dropped card's slot while the rest cascade
	// in around it. A host move has no traveller, so it lands like auto arrange:
	// a deck of the destination's top cards flies from their own slots into the
	// top of the column, and the cards below it cascade in once it lands.
	const captureDrop = useCallback((codes: readonly string[], columnTitle: string, grabbed: string | null, feedback?: "none") => {
		// Created-card ids are positive; move ids occupy a separate completion namespace.
		const next = captureIssueCardDropArrival(columns, codes, columnTitle, --version.current);
		if (solitaire) {
			const reflowBefore = codes.length === 1 && !reduceMotion && boardRef.current
				? captureIssueCardReflow(boardRef.current, codes, columnTitle) : undefined;
			snapshots.current = [{ id: next.id, title: columnTitle, flights: [], solitaire: true, feedback, reflowBefore }];
			setFlightBatchId(next.id);
			setDrop([{ ...next, animatedCardCodes: [] }]);
			return;
		}
		const root = boardRef.current;
		const dragged = grabbed !== null;
		const movedCodes = next.before.map((card) => card.code);
		const crossColumn = next.before.some((card) => card.columnTitle !== columnTitle);
		// A host move lists its issues in their destination order.
		const leadCardCodes = !crossColumn ? undefined : dragged ? resolveVisibleIssueDropCodes(movedCodes, grabbed) : resolveIssueDropDeck(codes.filter((code) => movedCodes.includes(code)));
		const flights = !reduceMotion && leadCardCodes?.length && root ? captureIssueCardDropFlights({
			root, preview: dragged ? getPreview() : null, nativePreview: dragged ? nativePreviewRef.current : null, pointer: dragged ? releasePoint.current : null,
			grabOffset: grabOffset.current, grabbed: grabbed ?? leadCardCodes[0], codes: leadCardCodes,
		}) : [];
		snapshots.current = [{ id: next.id, title: columnTitle, flights }];
		setFlightBatchId(next.id);
		releasePoint.current = null;
		setDrop([leadCardCodes?.length ? { ...next, animatedCardCodes: movedCodes, pendingCardCodes: flights.map((flight) => flight.code), leadCardCodes, holdBelowLeads: !dragged } : next]);
	}, [boardRef, columns, getPreview, nativePreviewRef, reduceMotion, solitaire]);
	// A deferred commit plays the latest owner callbacks, not the ones held at release.
	const settledDrop = useRef<SettledIssueDrop | null>(null);
	const committers = useRef({ captureDrop, onDrop });
	useLayoutEffect(() => { committers.current = { captureDrop, onDrop }; }, [captureDrop, onDrop]);
	useEffect(() => () => settledDrop.current?.commit(false), []);
	// A bulk release paints the solitaire reveal's first frame before React
	// commits: the already-rendered traveller settles into the lead's slot, and
	// the move (with its dragend) commits in the task after that frame, behind
	// the face. The commit's layout effect starts the real stack under it, so
	// the face is removed in the same task and no frame shows both or neither.
	const settleRelease = useCallback((codes: readonly string[], columnTitle: string, grabbed: string, target: JiraKanbanCardDropTarget) => {
		const root = boardRef.current;
		const preview = getPreview();
		const face = preview?.querySelector<HTMLElement>("[data-issue-cohort-front]");
		if (!solitaire || reduceMotion || codes.length < 2 || !root || !face || !releasePreview || settledDrop.current) return false;
		// The traveller wears the grabbed face, so it can only stand in for a grabbed lead.
		const moving = new Set(codes);
		if (columns.flatMap((column) => column.cards).find((card) => moving.has(card.code))?.code !== grabbed) return false;
		const landing = resolveIssueSolitaireLanding(root, columnTitle, codes, target.beforeCardCode, face.offsetHeight);
		if (!landing || Math.abs(landing.width - face.offsetWidth) > 0.5) return false;
		const released = releasePreview();
		if (!released) return false;
		settleIssueCohortPreview(released, landing);
		const settled: SettledIssueDrop = {
			preview: released, dragEnds: [], frame: 0, timer: undefined,
			commit: (flush) => {
				if (settledDrop.current !== settled) return;
				settledDrop.current = null;
				cancelAnimationFrame(settled.frame);
				clearTimeout(settled.timer);
				const commit = () => {
					committers.current.captureDrop(codes, columnTitle, grabbed);
					committers.current.onDrop?.(columnTitle, target);
					for (const dragEnd of settled.dragEnds) dragEnd();
				};
				if (flush) flushSync(commit);
				else commit();
				released.remove();
			},
		};
		settledDrop.current = settled;
		settled.frame = requestAnimationFrame(() => { settled.timer = setTimeout(() => settled.commit(true), 0); });
		return true;
	}, [boardRef, columns, getPreview, reduceMotion, releasePreview, solitaire]);
	const handleDrop = useCallback<NonNullable<JiraKanbanProps["onCardDrop"]>>((columnTitle, target) => {
		if (enabled && draggedCardCode) {
			const codes = selectedCardCodes?.has(draggedCardCode) ? [...selectedCardCodes] : [draggedCardCode];
			if (target && settleRelease(codes, columnTitle, draggedCardCode, target)) return;
			captureDrop(codes, columnTitle, draggedCardCode);
		}
		onDrop?.(columnTitle, target);
	}, [captureDrop, draggedCardCode, enabled, onDrop, selectedCardCodes, settleRelease]);
	/** Holds a native dragend until a settled release has committed its move. */
	const deferDragEnd = useCallback((dragEnd: () => void) => {
		settledDrop.current?.dragEnds.push(dragEnd);
		return settledDrop.current !== null;
	}, []);
	const handleMove = useCallback((move: IssueCardMove) => {
		if (enabled && move.cardCodes.length > 0) captureDrop(move.cardCodes, move.columnTitle, null, move.feedback);
		onMove?.(move);
	}, [captureDrop, enabled, onMove]);
	// Auto arrange lands each destination as a deck: its top cards (at most the
	// drag deck's depth) fly into the top of the column — from the held traveller
	// during a drag, else from their own slots — and the rest cascade in below.
	const handleAutoArrange = useCallback((codes: ReadonlySet<string>) => {
		const plan = getAutoArrangePlan(columns, codes);
		const root = boardRef.current;
		const captured = [...new Set(plan.map((move) => move.columnTitle))].map((title) => {
			// Auto arrange prepends each destination's cohort in plan order.
			const moving = plan.filter((move) => move.columnTitle === title).map((move) => move.code);
			const next = captureIssueCardDropArrival(columns, moving, title, --version.current);
			const leadCardCodes = resolveIssueDropDeck(moving);
			const flights = enabled && !solitaire && !reduceMotion && root ? captureIssueCardDropFlights({
				root, preview: getPreview(), nativePreview: nativePreviewRef.current, pointer: null,
				grabOffset: grabOffset.current, grabbed: draggedCardCode ?? leadCardCodes[0], codes: leadCardCodes,
			}) : [];
			return { next, title, flights, leadCardCodes };
		});
		snapshots.current = captured.map(({ next, title, flights }) => ({ id: next.id, title, flights, solitaire }));
		setFlightBatchId(version.current);
		setDrop(captured.map(({ next, flights, leadCardCodes }) => solitaire ? { ...next, animatedCardCodes: [] } : enabled && !reduceMotion
			? { ...next, animatedCardCodes: next.before.map((card) => card.code), leadCardCodes, holdBelowLeads: true, pendingCardCodes: flights.map((flight) => flight.code) } : next));
		onAutoArrange?.(codes);
	}, [boardRef, columns, draggedCardCode, enabled, getPreview, nativePreviewRef, onAutoArrange, reduceMotion, solitaire]);
	const handleComplete = useCallback((id: number) => {
		if (id < 0) setDrop((current) => current.filter((item) => item.id !== id));
		else onCreatedComplete?.(id);
	}, [onCreatedComplete]);
	return { isReflowing: enabled && solitaire && arrivals.some((arrival) => arrival.cardCodes.length === 1), arrivalForColumn: (title: string) => enabled ? arrivals.find((arrival) => arrival.columnTitle === title) : undefined, handleDrop: onDrop ? handleDrop : undefined, handleMove: onMove ? handleMove : undefined, handleAutoArrange: onAutoArrange ? handleAutoArrange : undefined, handleComplete, deferDragEnd };
}
