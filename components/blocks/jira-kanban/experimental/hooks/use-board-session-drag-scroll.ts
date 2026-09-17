"use client";

import { useEffect, type RefObject } from "react";
import type { BoardAgentSessionDragTransaction } from "@/components/blocks/jira-kanban/experimental/lib/board-agent-session-drag";

/** Scroll only the hovered issue viewport; the pinned create well owns its own space. */
export function useBoardSessionDragScroll({ active, rootRef, transactionRef, onGeometryChange }: Readonly<{
	active: boolean;
	rootRef: RefObject<HTMLElement | null>;
	transactionRef: RefObject<BoardAgentSessionDragTransaction | null>;
	onGeometryChange: () => void;
}>) {
	useEffect(() => {
		const root = rootRef.current;
		if (!active || !root) return;
		let frame = 0;
		let previousTime = 0;
		let paused = false;
		const update = (time: number) => {
			frame = 0;
			const transaction = transactionRef.current;
			if (!transaction || paused) return;
			onGeometryChange();
			const { x, y } = transaction.pointer;
			const board = root.querySelector<HTMLElement>("[data-jira-kanban-scrollport]")?.getBoundingClientRect();
			// Keep velocity consistent across slower frames, but bound catch-up after a stall.
			const elapsed = previousTime ? Math.min(100, time - previousTime) : 16;
			previousTime = time;
			let target: HTMLElement | null = null;
			let nextScroll = 0;
			for (const list of root.querySelectorAll<HTMLElement>("[data-jira-kanban-card-list]")) {
				const rect = list.getBoundingClientRect();
				if (x < Math.max(rect.left, board?.left ?? rect.left) || x > Math.min(rect.right, board?.right ?? rect.right)
					|| y < rect.top || y > rect.bottom) continue;
				// A broad approach zone starts scrolling early and leaves the middle neutral.
				const band = Math.min(160, rect.height / 3);
				const nearness = y < rect.top + band ? -(1 - (y - rect.top) / band)
					: y > rect.bottom - band ? 1 - (rect.bottom - y) / band : 0;
				// Start gently, then accelerate progressively as the pointer approaches either edge.
				const speed = nearness === 0 ? 0 : Math.sign(nearness) * (120 + 600 * nearness ** 2);
				const limit = Math.max(0, list.scrollHeight - list.clientHeight);
				nextScroll = Math.max(0, Math.min(limit, list.scrollTop + speed * elapsed / 1000));
				if (Math.abs(nextScroll - list.scrollTop) >= 1) target = list;
				break;
			}
			// All geometry reads precede the scroll write. Continue only while scrolling advances.
			if (target) {
				const previousScroll = target.scrollTop;
				target.scrollTop = nextScroll;
				if (target.scrollTop !== previousScroll) frame = requestAnimationFrame(update);
			}
		};
		const schedule = () => {
			if (!frame && !paused) {
				previousTime = 0;
				frame = requestAnimationFrame(update);
			}
		};
		const pause = () => {
			paused = true;
			cancelAnimationFrame(frame);
			frame = 0;
		};
		const handlePointerMove = () => {
			paused = false;
			schedule();
		};
		const handlePointerOut = (event: PointerEvent) => {
			if (event.relatedTarget === null) pause();
		};
		const resize = new ResizeObserver(schedule);
		for (const list of root.querySelectorAll("[data-jira-kanban-card-list]")) resize.observe(list);
		document.addEventListener("pointermove", handlePointerMove, { passive: true });
		document.addEventListener("pointerout", handlePointerOut, { passive: true });
		window.addEventListener("blur", pause);
		root.addEventListener("scroll", schedule, true);
		schedule();
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			document.removeEventListener("pointermove", handlePointerMove);
			document.removeEventListener("pointerout", handlePointerOut);
			window.removeEventListener("blur", pause);
			root.removeEventListener("scroll", schedule, true);
		};
	}, [active, rootRef, transactionRef, onGeometryChange]);
}
