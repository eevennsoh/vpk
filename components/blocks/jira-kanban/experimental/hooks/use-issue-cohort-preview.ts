"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type DragEvent } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { createIssueCohortPreview } from "../lib/issue-drag-preview";
import { createIssueCohortGatherKeyframes, ISSUE_COHORT_GATHER_TIMING, type IssueCohortGatherLayer } from "../lib/issue-cohort-gather";
import { settleIssueCohortPreview } from "../lib/issue-drop-handoff";

/**
 * A visual traveller; native Jira drag/drop continues to own the transaction.
 * With `settleOnDrop` (boards that hand their drop commit to the next frame),
 * a drop lets it settle where it was released instead of vanishing at once.
 */
export function useIssueCohortPreview(enabled: boolean, draggedCardCode: string | null, onCancel?: () => void, settleOnDrop = false) {
	const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const preview = useRef<HTMLElement | null>(null);
	const emptyImage = useRef<HTMLCanvasElement | null>(null);
	const frame = useRef(0);
	const offset = useRef({ x: 0, y: 0 });
	const pointer = useRef({ x: 0, y: 0 });
	const animations = useRef<Animation[]>([]);
	// Survives stop/cancel and selection renders; only a fresh pickup replaces it.
	const previousLayers = useRef<readonly IssueCohortGatherLayer[]>([]);
	const sourceObserver = useRef<MutationObserver | null>(null);
	const cancelCallback = useRef(onCancel);
	useLayoutEffect(() => { cancelCallback.current = onCancel; }, [onCancel]);
	// Read at release: a live media change must not re-run the drag listeners, whose cleanup cancels the drag.
	const reduceMotionAtRelease = useRef(reduceMotion);
	useLayoutEffect(() => { reduceMotionAtRelease.current = reduceMotion; }, [reduceMotion]);
	const stop = useCallback(() => {
		sourceObserver.current?.disconnect();
		sourceObserver.current = null;
		cancelAnimationFrame(frame.current);
		frame.current = 0;
		for (const animation of animations.current) animation.cancel();
		animations.current = [];
		preview.current?.remove();
		emptyImage.current?.remove();
		preview.current = null;
		emptyImage.current = null;
	}, []);
	const cancel = useCallback(() => {
		const active = preview.current !== null;
		stop();
		if (active) cancelCallback.current?.();
	}, [stop]);
	// Released, the traveller is no longer the live preview: later stops (drag
	// end, the committed arrival) leave its fade to finish.
	const settle = useCallback(() => {
		const node = preview.current;
		preview.current = null;
		stop();
		if (node) settleIssueCohortPreview(node, reduceMotionAtRelease.current);
	}, [stop]);

	useEffect(() => {
		if (!enabled) return;
		const move = (event: globalThis.DragEvent) => {
			if (!preview.current || (!event.clientX && !event.clientY)) return;
			pointer.current = { x: event.clientX, y: event.clientY };
			if (frame.current) return;
			frame.current = requestAnimationFrame(() => {
				frame.current = 0;
				if (preview.current) preview.current.style.transform = `translate3d(${pointer.current.x - offset.current.x}px, ${pointer.current.y - offset.current.y}px, 0)`;
			});
		};
		// Workflow zones stop propagation; capture keeps the traveller on the
		// pointer there, and dragenter covers the first move into a new target.
		document.addEventListener("dragenter", move, true);
		document.addEventListener("dragover", move, true);
		const release = settleOnDrop ? settle : stop;
		document.addEventListener("dragend", stop);
		document.addEventListener("drop", release);
		return () => {
			document.removeEventListener("dragenter", move, true);
			document.removeEventListener("dragover", move, true);
			document.removeEventListener("dragend", stop);
			document.removeEventListener("drop", release);
			cancel();
		};
	}, [enabled, stop, cancel, settle, settleOnDrop]);
	useLayoutEffect(() => { if (!draggedCardCode) stop(); }, [draggedCardCode, stop]);
	useEffect(() => {
		if (reduceMotion) for (const animation of animations.current) animation.cancel();
	}, [reduceMotion]);

	const start = useCallback((event: DragEvent<HTMLElement>, surface: HTMLElement, selection?: ReadonlySet<string>) => {
		stop();
		const bounds = surface.getBoundingClientRect();
		offset.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
		const { node, gathering } = createIssueCohortPreview(surface, selection, previousLayers.current);
		if (gathering.length > 0) previousLayers.current = gathering.map(({ layer }) => layer);
		node.style.transform = `translate3d(${bounds.left}px, ${bounds.top}px, 0)`;
		preview.current = node;
		const source = event.currentTarget;
		const host = source.closest('[data-jira-kanban-column]') ?? source.parentElement;
		if (host) {
			const observer = new MutationObserver(() => { if (!source.isConnected) cancel(); });
			observer.observe(host, { childList: true, subtree: true });
			sourceObserver.current = observer;
		}
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 1;
		canvas.dataset.issueCohortDragImage = "";
		canvas.setAttribute("aria-hidden", "true");
		Object.assign(canvas.style, { position: "fixed", left: "-10000px", top: "0", pointerEvents: "none" });
		document.body.append(canvas);
		emptyImage.current = canvas;
		event.dataTransfer.setDragImage(canvas, 0, 0);
		if (!reduceMotion) {
			const timing = ISSUE_COHORT_GATHER_TIMING;
			animations.current = gathering.map(({ sheet, layer }, index) => sheet.animate(
				createIssueCohortGatherKeyframes(layer),
				{ duration: timing.duration, delay: index * timing.stagger, easing: timing.easing, fill: "backwards" },
			));
		}
	}, [reduceMotion, stop, cancel]);
	const getPreview = useCallback(() => preview.current, []);
	return { start, stop, getPreview };
}
