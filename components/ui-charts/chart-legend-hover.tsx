"use client";

import { createContext, type ReactNode, use, useMemo } from "react";

interface ChartLegendHoverContextValue {
	hoveredIndex: number | null;
	setHoveredIndex: (index: number | null) => void;
}

const ChartLegendHoverContext =
	createContext<ChartLegendHoverContextValue | null>(null);

export function ChartLegendHoverProvider({
	hoveredIndex,
	onHoverChange,
	children,
}: {
	hoveredIndex: number | null;
	onHoverChange: (index: number | null) => void;
	children: ReactNode;
}) {
	const value = useMemo(
		() => ({ hoveredIndex, setHoveredIndex: onHoverChange }),
		[hoveredIndex, onHoverChange]
	);

	return (
		<ChartLegendHoverContext value={value}>
			{children}
		</ChartLegendHoverContext>
	);
}

export function useChartLegendHover(): ChartLegendHoverContextValue {
	const context = use(ChartLegendHoverContext);
	return (
		context ?? {
			hoveredIndex: null,
			setHoveredIndex: () => {
				/* noop outside ChartLegendHoverProvider */
			},
		}
	);
}
