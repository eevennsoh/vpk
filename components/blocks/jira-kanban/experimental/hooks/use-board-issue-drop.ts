"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import type { JiraKanbanCardDropTarget } from "../../card-drop";

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
	beforeCardCode: string | null;
	lineTop?: number;
}

/** A status choice is latched until the pointer leaves the column. */
export function useBoardIssueDrop({
	source, title, statuses, onDrop,
}: Readonly<{
	source?: BoardIssueDragSource;
	title: string;
	statuses?: readonly string[];
	onDrop?: (title: string, target?: JiraKanbanCardDropTarget) => void;
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
		const list = root.querySelector<HTMLElement>("[data-jira-kanban-card-list]");
		const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-board-agent-session-drop-zone="issue"]'))
			.filter((node) => !active.codes.has(node.dataset.issueKey ?? ""))
			.map((node) => ({ node, rect: node.getBoundingClientRect() }));
		const following = cards.find(({ rect }) => y < rect.top + rect.height / 2);
		const last = cards.at(-1);
		const clip = list?.getBoundingClientRect() ?? bounds;
		const top = following ? following.rect.top - 2 : last ? last.rect.bottom + 2 : clip.top + 2;
		return {
			sourceCode: active.code, status, entered: true,
			beforeCardCode: following?.node.dataset.issueKey ?? null,
			lineTop: Math.max(clip.top, Math.min(top, clip.bottom - 2)) - bounds.top,
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
			if (!status) return;
			if (pending.current?.status === status) {
				pointer.current = { y, status };
				return;
			}
			clearWork();
			pointer.current = { y, status };
			const next = { sourceCode: active.code, status, entered: false, beforeCardCode: null };
			pending.current = next;
			setState(next);
			// Brief dwell distinguishes crossing a target from entering it.
			timer.current = setTimeout(() => {
				timer.current = null;
				const entered = resolveAt(pointer.current?.y ?? y, status);
				pending.current = entered;
				setState(entered);
			}, 250);
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
			const delta = bounds ? point.y < bounds.top + 32 ? -8 : point.y > bounds.bottom - 32 ? 8 : 0 : 0;
			pending.current = next;
			setState((previous) => previous?.beforeCardCode === next?.beforeCardCode
				&& previous?.lineTop === next?.lineTop && previous?.status === next?.status ? previous : next);
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
		const bounds = event.currentTarget.getBoundingClientRect();
		if (event.clientX > bounds.left && event.clientX < bounds.right && event.clientY > bounds.top && event.clientY < bounds.bottom) return;
		clearWork();
		setState(null);
	}

	function drop(event: DragEvent<HTMLDivElement>) {
		if (!active) return;
		event.preventDefault();
		event.stopPropagation();
		const zoneStatus = choosing ? (event.target as Element).closest<HTMLElement>("[data-issue-status-zone]")?.dataset.issueStatusZone : undefined;
		const status = zoneStatus ?? pending.current?.status ?? current?.status
			?? (active.columnTitle === title ? active.status : choices[0]);
		const target = choosing ? { status, beforeCardCode: null } : resolveAt(event.clientY, status);
		clearWork();
		setState(null);
		if (target) onDrop?.(title, target);
	}

	return {
		rootRef, active, choosing, offeringChoices, choices, current,
		header: active?.columnTitle === title ? "Transition to..."
			: current?.entered ? `${active?.status} → ${current.status}` : title,
		handlers: { onDragEnter: over, onDragOver: over, onDragLeave: leave, onDrop: drop },
	};
}
