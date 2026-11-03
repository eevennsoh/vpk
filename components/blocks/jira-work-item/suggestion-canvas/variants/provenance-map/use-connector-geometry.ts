"use client";

import { useEffect, useState, type RefObject } from "react";

export interface ConnectorPoint {
	x: number;
	y: number;
}

export interface ConnectorRowPoint extends ConnectorPoint {
	/** The row is partly scrolled out and its anchor is pinned to the list edge. */
	clamped: boolean;
}

export interface ConnectorGeometry {
	width: number;
	height: number;
	rows: Readonly<Record<string, ConnectorRowPoint>>;
	sources: Readonly<Record<string, ConnectorPoint>>;
}

const EMPTY: ConnectorGeometry = { width: 0, height: 0, rows: {}, sources: {} };
/** Distance from a row's top edge to the centre of its label line, where its connectors leave. */
export const ROW_ANCHOR_OFFSET = 22;
const EDGE_INSET = 10;

/** Half-pixel snap keeps 1px strokes crisp at 100% zoom. */
const snap = (value: number) => Math.round(value * 2) / 2;

function measure(container: HTMLElement, viewport: HTMLElement): ConnectorGeometry {
	const box = container.getBoundingClientRect();
	// The canvas camera may zoom the preview; convert screen pixels back to the container's own space.
	const scale = container.offsetWidth > 0 ? box.width / container.offsetWidth : 1;
	const local = (value: number) => snap(value / scale);
	const view = viewport.getBoundingClientRect();
	const rows: Record<string, ConnectorRowPoint> = {};
	const sources: Record<string, ConnectorPoint> = {};
	const top = view.top + EDGE_INSET * scale;
	const bottom = view.bottom - EDGE_INSET * scale;

	for (const element of container.querySelectorAll<HTMLElement>("[data-prov-row]")) {
		const rect = element.getBoundingClientRect();
		if (rect.bottom < top || rect.top > bottom) continue;
		const ideal = rect.top + ROW_ANCHOR_OFFSET * scale;
		const y = Math.min(Math.max(ideal, top), Math.min(bottom, rect.bottom - EDGE_INSET * scale));
		rows[element.dataset.provRow ?? ""] = { x: local(rect.right - box.left), y: local(y - box.top), clamped: Math.abs(y - ideal) > 1 };
	}
	for (const element of container.querySelectorAll<HTMLElement>("[data-prov-source]")) {
		const rect = element.getBoundingClientRect();
		sources[element.dataset.provSource ?? ""] = { x: local(rect.left - box.left), y: local(rect.top + rect.height / 2 - box.top) };
	}
	return { width: container.offsetWidth, height: container.offsetHeight, rows, sources };
}

/**
 * Measures connector endpoints from live DOM geometry. All reads happen in one animation frame,
 * then one state write; scroll and resize bursts coalesce into that frame.
 */
export function useConnectorGeometry(
	containerRef: RefObject<HTMLElement | null>,
	viewportRef: RefObject<HTMLElement | null>,
	layoutKey: string,
): ConnectorGeometry {
	const [geometry, setGeometry] = useState<ConnectorGeometry>(EMPTY);

	useEffect(() => {
		const container = containerRef.current;
		const viewport = viewportRef.current;
		if (!container || !viewport) return;

		let frame = 0;
		let lastKey = "";
		const run = () => {
			frame = 0;
			const next = measure(container, viewport);
			const key = JSON.stringify(next);
			if (key === lastKey) return;
			lastKey = key;
			setGeometry(next);
		};
		const schedule = () => {
			if (frame === 0) frame = requestAnimationFrame(run);
		};

		const resizeObserver = new ResizeObserver(schedule);
		resizeObserver.observe(container);
		resizeObserver.observe(viewport);
		for (const element of container.querySelectorAll("[data-prov-row], [data-prov-source]")) resizeObserver.observe(element);
		viewport.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		schedule();

		return () => {
			if (frame !== 0) cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			viewport.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
		};
	}, [containerRef, layoutKey, viewportRef]);

	return geometry;
}
