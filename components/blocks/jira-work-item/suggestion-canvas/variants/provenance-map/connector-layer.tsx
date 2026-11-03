"use client";

import { cn } from "@/lib/utils";

import type { ConnectorGeometry, ConnectorPoint } from "./use-connector-geometry";
import type { ProvenanceEdge } from "./sources";

const edgeKey = (edge: ProvenanceEdge) => `${edge.suggestionId}->${edge.sourceId}`;

function curve(from: ConnectorPoint, to: ConnectorPoint): string {
	const pull = Math.max((to.x - from.x) * 0.6, 20);
	return `M ${from.x} ${from.y} C ${from.x + pull} ${from.y}, ${to.x - pull} ${to.y}, ${to.x} ${to.y}`;
}

interface ConnectorLayerProps {
	geometry: ConnectorGeometry;
	pendingEdges: readonly ProvenanceEdge[];
	activeEdges: readonly ProvenanceEdge[];
	dimsOthers: boolean;
}

/**
 * Decorative curves between suggestions and their sources. The same relationships are written out in
 * each row ("From …") and each source's accessible name, so the drawing is aria-hidden.
 */
export function ConnectorLayer({ geometry, pendingEdges, activeEdges, dimsOthers }: Readonly<ConnectorLayerProps>) {
	const active = new Set(activeEdges.map(edgeKey));
	const drawable = pendingEdges.flatMap((edge) => {
		const from = geometry.rows[edge.suggestionId];
		const to = geometry.sources[edge.sourceId];
		return from && to ? [{ edge, key: edgeKey(edge), from, to, d: curve(from, to), lit: active.has(edgeKey(edge)) }] : [];
	});

	return (
		<svg
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 overflow-visible"
			focusable="false"
			height={geometry.height}
			shapeRendering="geometricPrecision"
			viewBox={`0 0 ${geometry.width} ${geometry.height}`}
			width={geometry.width}
		>
			<g className={cn("fill-none stroke-border-bold transition-opacity duration-normal ease-out-practical", dimsOthers ? "opacity-35" : "opacity-60")}>
				{drawable.map(({ key, d }) => <path d={d} key={key} strokeDasharray="2 3" strokeWidth={1} />)}
			</g>
			<g className="fill-none stroke-border-selected">
				{drawable.map(({ key, d, lit }) => (
					<path
						className={cn(
							"transition-[stroke-dashoffset,opacity]",
							lit ? "opacity-100 duration-slow ease-out" : "opacity-0 duration-fast ease-in",
						)}
						d={d}
						key={key}
						pathLength={1}
						strokeDasharray="1 1"
						strokeDashoffset={lit ? 0 : 1}
						strokeLinecap="round"
						strokeWidth={1.5}
					/>
				))}
			</g>
			<g>
				{drawable.map(({ key, from, to, lit }) => (
					<g className={cn("transition-[fill,stroke] duration-normal ease-out-practical", lit ? "fill-surface stroke-border-selected" : "fill-surface stroke-border-bold")} key={key}>
						<circle cx={from.x} cy={from.y} r={lit ? 3 : 2.5} strokeWidth={1.5} />
						<circle cx={to.x} cy={to.y} r={lit ? 3 : 2.5} strokeWidth={1.5} />
					</g>
				))}
			</g>
		</svg>
	);
}
