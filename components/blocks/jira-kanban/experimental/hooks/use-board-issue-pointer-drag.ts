"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

interface Pickup {
	source: HTMLElement;
	x: number;
	y: number;
	pointerId: number;
	active: boolean;
	transfer: DataTransfer;
	hovered: Element | null;
}

/** Pointer transport for the existing issue drag handlers. Native DnD blocks Return. */
export function useBoardIssuePointerDrag(rootRef: RefObject<HTMLElement | null>, enabled: boolean) {
	const pickup = useRef<Pickup | null>(null);
	const frame = useRef(0);
	const suppressClick = useRef(false);
	const send = useCallback((type: string, target: Element, current: Pickup, relatedTarget?: Element | null) => {
		target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, clientX: current.x, clientY: current.y, dataTransfer: current.transfer, relatedTarget }));
	}, []);
	const stop = useCallback(() => {
		const current = pickup.current;
		pickup.current = null;
		cancelAnimationFrame(frame.current);
		frame.current = 0;
		if (!current) return;
		current.source.draggable = true;
		if (current.active) {
			const root = rootRef.current;
			if (root && root.ownerDocument.activeElement === root) root.blur();
			suppressClick.current = true;
			send("dragend", current.source, current);
		}
	}, [rootRef, send]);
	useEffect(() => {
		const root = rootRef.current;
		if (!enabled || !root) return;
		const doc = root.ownerDocument;
		const down = (event: PointerEvent) => {
			if (event.button !== 0 || !event.isPrimary || !(event.target instanceof Element)) return;
			const source = event.target.closest<HTMLElement>('[draggable="true"]');
			if (!source || !root.contains(source) || !source.closest('[data-board-agent-session-drop-zone="issue"]')) return;
			if (!event.target.closest('[data-slot="jira-issue-card"]')) return;
			// Session chins and nested menus retain their own pointer transactions.
			if (event.target.closest('[data-slot="jira-issue-agent-activity"], [data-board-agent-session-drag-handle]')) return;
			const control = event.target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]');
			if (control && control !== source && !control.hasAttribute("data-jira-issue-activation-control")) return;
			stop();
			suppressClick.current = false;
			source.draggable = false;
			pickup.current = { source, x: event.clientX, y: event.clientY, pointerId: event.pointerId, active: false, transfer: new DataTransfer(), hovered: null };
		};
		const move = (event: PointerEvent) => {
			const current = pickup.current;
			if (!current || current.pointerId !== event.pointerId) return;
			if (!current.active) {
				if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
				current.active = true;
				root.focus({ preventScroll: true });
				send("dragstart", current.source, current);
			}
			event.preventDefault();
			current.x = event.clientX;
			current.y = event.clientY;
			if (frame.current) return;
			frame.current = requestAnimationFrame(() => {
				frame.current = 0;
				const target = doc.elementFromPoint(current.x, current.y);
				if (!target || pickup.current !== current) return;
				if (target !== current.hovered) {
					if (current.hovered) send("dragleave", current.hovered, current, target);
					send("dragenter", target, current, current.hovered);
					current.hovered = target;
				}
				send("dragover", target, current);
				const bounds = root.getBoundingClientRect();
				if (current.x < bounds.left + 32) root.scrollLeft -= 8;
				else if (current.x > bounds.right - 32) root.scrollLeft += 8;
			});
		};
		const up = (event: PointerEvent) => {
			const current = pickup.current;
			if (!current || current.pointerId !== event.pointerId) return;
			current.x = event.clientX;
			current.y = event.clientY;
			const target = doc.elementFromPoint(current.x, current.y);
			if (current.active && target && root.contains(target)) send("drop", target, current);
			stop();
		};
		const click = (event: MouseEvent) => {
			if (!suppressClick.current) return;
			suppressClick.current = false;
			event.preventDefault();
			event.stopPropagation();
		};
		const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && pickup.current?.active) stop(); };
		const resetClick = () => { suppressClick.current = false; };
		doc.addEventListener("pointerdown", resetClick, true);
		root.addEventListener("pointerdown", down, true);
		doc.addEventListener("pointermove", move);
		doc.addEventListener("pointerup", up);
		doc.addEventListener("pointercancel", stop);
		doc.addEventListener("keydown", escape);
		doc.addEventListener("click", click, true);
		window.addEventListener("blur", stop);
		return () => {
			doc.removeEventListener("pointerdown", resetClick, true);
			root.removeEventListener("pointerdown", down, true);
			doc.removeEventListener("pointermove", move);
			doc.removeEventListener("pointerup", up);
			doc.removeEventListener("pointercancel", stop);
			doc.removeEventListener("keydown", escape);
			doc.removeEventListener("click", click, true);
			window.removeEventListener("blur", stop);
			stop();
		};
	}, [enabled, rootRef, send, stop]);
	return { stop };
}
