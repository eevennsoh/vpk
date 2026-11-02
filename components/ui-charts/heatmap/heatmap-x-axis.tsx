"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useHeatmap } from "./heatmap-context";

export interface HeatmapXAxisProps {
	/** Additional class name for labels */
	className?: string;
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export const HeatmapXAxis = memo(function HeatmapXAxis({
	className,
}: HeatmapXAxisProps) {
	const { containerRef, data, margin, xScale } = useHeatmap();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const labels = useMemo(() => {
		const ticks: { label: string; x: number; key: string }[] = [];
		let lastMonthKey = "";

		for (let columnIndex = 0; columnIndex < data.length; columnIndex++) {
			const column = data[columnIndex];
			if (!column) {
				continue;
			}

			const monthAnchor = column.bins.find((bin) => bin.date?.getUTCDate() === 1)?.date
				?? column.bins[0]?.date;
			if (!monthAnchor) {
				continue;
			}

			const monthKey = `${monthAnchor.getUTCFullYear()}-${monthAnchor.getUTCMonth()}`;
			if (monthKey === lastMonthKey) {
				continue;
			}

			ticks.push({
				label: monthFmt.format(monthAnchor),
				x: margin.left + xScale(columnIndex),
				key: monthKey,
			});
			lastMonthKey = monthKey;
		}

		return ticks;
	}, [data, margin.left, xScale]);

	const container = containerRef.current;
	if (!(mounted && container)) {
		return null;
	}

	return createPortal(
		labels.map((tick) => (
			<div
				className="pointer-events-none absolute"
				key={tick.key}
				style={{
					top: 0,
					left: tick.x,
					width: 0,
					display: "flex",
					justifyContent: "flex-start",
				}}
			>
				<span
					className={cn(
						"whitespace-nowrap text-chart-label text-xs",
						className
					)}
				>
					{tick.label}
				</span>
			</div>
		)),
		container
	);
});

HeatmapXAxis.displayName = "HeatmapXAxis";

export default HeatmapXAxis;
