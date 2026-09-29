"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import type { JiraKanbanCardDropTarget } from "../../card-drop";
import { getBoardIssueInsertionLineTop, resolveBoardIssueDropSurface, type BoardIssueDropSurface } from "../lib/board-card-insertion";

const STATUS_CHOICE_DWELL_MS = 500;

export interface BoardIssueDragSource {
	code: string;
	columnTitle: string;
	status: string;
	codes: ReadonlySet<string>;
}

interface DropState {
	sourceCode: string;
	status: string;
	entered: boolean;
	beforeCardCode?: string | null;
	surface: BoardIssueDropSurface;
	lineTop?: number;
}

type IssueDropHeader = string | { source: string; destination?: string };

function resolveIssueDropHeader(active: BoardIssueDragSource | undefined, current: DropState | null, title: string, choices: readonly string[], choosing: boolean, moveVisual: boolean): IssueDropHeader {
	if (!active) return title;
	if (active.columnTitle === title) return "Transition to...";
	if (!moveVisual) return current?.entered ? { source: active.status, destination: current.status } : title;
	return { source: active.status, destination: choosing && !current ? undefined : current?.status ?? choices[0] ?? title };
}

/** A status choice is latched until the pointer leaves the column. */
export function useBoardIssueDrop({
	source, title, statuses, onDrop, moveVisual = true,
}: Readonly<{
	source?: BoardIssueDragSource;
	title: string;
	statuses?: readonly string[];
	onDrop?: (title: string, target?: JiraKanbanCardDropTarget) => void;
	moveVisual?: boolean;
}>) {
	const rootRef = useRef<HTMLDivElement>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const frame = useRef<number | null>(null);
	const pending = useRef<DropState | null>(null);
	const pointer = useRef<{ y: number; status: string } | null>(null);
	const [state, setState] = useState<DropState | null>(null);
	const active = source && onDrop ? source : undefined;
	const current = active && state?.sourceCode === active.code ? state : null;
	const choices = statuses ?? [title];
	const offeringChoices = Boolean(active && choices.length > 1 && active.columnTitle !== title);
	const choosing = offeringChoices && !current?.entered;

	function clearWork() {
		if (timer.current !== null) clearTimeout(timer.current);
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		timer.current = null;
		frame.current = null;
		pending.current = null;
		pointer.current = null;
	}

	useEffect(() => () => {
		clearWork();
		setState(null);
	}, [active?.code]);

	function resolveAt(y: number, status: string): DropState | null {
		const root = rootRef.current;
		if (!active || !root) return null;
		const bounds = root.getBoundingClientRect();
		const column = root.closest<HTMLElement>("[data-jira-kanban-column]");
		const header = column?.querySelector<HTMLElement>('[data-slot="board-column-header"]');
		const list = root.querySelector<HTMLElement>("[data-jira-kanban-card-list]");
		const allCards = Array.from(root.querySelectorAll<HTMLElement>('[data-board-agent-session-drop-zone="issue"]'))
			.map((node) => ({ node, rect: node.getBoundingClientRect() }));
		const cards = allCards.filter(({ node }) => !active.codes.has(node.dataset.issueKey ?? ""));
		const following = cards.find(({ rect }) => y < rect.top + rect.height / 2);
		const last = cards.at(-1);
		const clip = list?.getBoundingClientRect() ?? bounds;
		const surface = resolveBoardIssueDropSurface(y, header?.getBoundingClientRect().bottom ?? bounds.top, clip, allCards.at(-1)?.rect.bottom);
		// Grouped columns have no header destination; choose a body status first.
		if (surface === "header" && choices.length > 1) return null;
		if (surface !== "position") return { sourceCode: active.code, status, entered: true, surface };
		// Dragged cards stay in the source stack. They still bound the visible gap
		// even though the insertion transaction excludes them from its candidates.
		const previous = following ? allCards[allCards.indexOf(following) - 1] : last;
		const next = following ?? (last ? allCards[allCards.indexOf(last) + 1] : undefined);
		const gap = list ? parseFloat(getComputedStyle(list).getPropertyValue("--board-card-gap")) || 4 : 4;
		const top = next
			? getBoardIssueInsertionLineTop(previous?.rect.bottom ?? clip.top, next.rect.top)
			: previous ? getBoardIssueInsertionLineTop(previous.rect.bottom, previous.rect.bottom + gap) : clip.top + 2;
		return {
			sourceCode: active.code, status, entered: true, surface,
			beforeCardCode: following?.node.dataset.issueKey ?? null,
			lineTop: allCards.length > 0 ? Math.max(clip.top, Math.min(top, clip.bottom - 2)) - bounds.top : undefined,
		};
	}

	function over(event: DragEvent<HTMLDivElement>) {
		if (!active) return;
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = "move";
		const y = event.clientY;
		if (choosing) {
			const zone = (event.target as Element).closest<HTMLElement>("[data-issue-status-zone]");
			const status = zone?.dataset.issueStatusZone;
			if (!status) {
				event.dataTransfer.dropEffect = "none";
				clearWork();
				setState(null);
				return;
			}
			if (pending.current?.status === status) {
				pointer.current = { y, status };
				return;
			}
			clearWork();
			pointer.current = { y, status };
			const next: DropState = { sourceCode: active.code, status, entered: false, surface: "column", beforeCardCode: null };
			pending.current = next;
			setState(next);
			// Brief dwell distinguishes crossing a target from entering it.
			timer.current = setTimeout(() => {
				timer.current = null;
				const entered = resolveAt(pointer.current?.y ?? y, status);
				pending.current = entered;
				setState(entered);
			}, STATUS_CHOICE_DWELL_MS);
			return;
		}
		const status = current?.status ?? (active.columnTitle === title ? active.status : choices[0]);
		pointer.current = { y, status };
		if (frame.current !== null) return;
		const update = () => {
			frame.current = null;
			const point = pointer.current;
			if (!point) return;
			const next = resolveAt(point.y, point.status);
			const list = rootRef.current?.querySelector<HTMLElement>("[data-jira-kanban-card-list]");
			const bounds = list?.getBoundingClientRect();
			const scrollTop = list?.scrollTop ?? 0;
			const scrollLimit = list ? list.scrollHeight - list.clientHeight : 0;
			const delta = bounds && next?.surface === "position" ? point.y < bounds.top + 32 ? -8 : point.y > bounds.bottom - 32 ? 8 : 0 : 0;
			pending.current = next;
			setState((previous) => previous?.beforeCardCode === next?.beforeCardCode
				&& previous?.lineTop === next?.lineTop && previous?.status === next?.status
				&& previous?.surface === next?.surface && previous?.entered === next?.entered ? previous : next);
			// The stable overlay receives native drag events, so scroll its card list
			// explicitly. Geometry is read above; the scroll write is last.
			if (list && delta && ((delta < 0 && scrollTop > 0) || (delta > 0 && scrollTop < scrollLimit))) {
				list.scrollTop = Math.max(0, Math.min(scrollLimit, scrollTop + delta));
				frame.current = requestAnimationFrame(update);
			}
		};
		frame.current = requestAnimationFrame(update);
	}

	function leave(event: DragEvent<HTMLDivElement>) {
		if (!active) return;
		event.stopPropagation();
		const column = event.currentTarget.closest<HTMLElement>("[data-jira-kanban-column]");
		const bounds = (choosing || !moveVisual ? event.currentTarget : column ?? event.currentTarget).getBoundingClientRect();
		if (event.clientX > bounds.left && event.clientX < bounds.right && event.clientY > bounds.top && event.clientY < bounds.bottom) return;
		clearWork();
		setState(null);
	}

	function drop(event: DragEvent<HTMLDivElement>) {
		if (!active) return;
		event.preventDefault();
		event.stopPropagation();
		const zoneStatus = choosing ? (event.target as Element).closest<HTMLElement>("[data-issue-status-zone]")?.dataset.issueStatusZone : undefined;
		if (choosing && !zoneStatus) {
			event.dataTransfer.dropEffect = "none";
			clearWork();
			setState(null);
			return;
		}
		const status = zoneStatus ?? pending.current?.status ?? current?.status
			?? (active.columnTitle === title ? active.status : choices[0]);
		const target = choosing ? { status, beforeCardCode: null } : resolveAt(event.clientY, status);
		clearWork();
		setState(null);
		if (target) onDrop?.(title, target);
	}

	return {
		rootRef, active, choosing, offeringChoices, choices, current,
		header: resolveIssueDropHeader(active, current, title, choices, choosing, moveVisual),
		handlers: { onDragEnter: over, onDragOver: over, onDragLeave: leave, onDrop: drop },
	};
}
