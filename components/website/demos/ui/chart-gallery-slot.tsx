import type { ComponentType } from "react";

/**
 * The shadcn gallery charts (components/charts/*) size to their container through
 * ResponsiveContainer, so in the centred example shell they would collapse to their intrinsic
 * width. These slots give each chart the width it has on shadcn's gallery: one grid cell, or the
 * full row for the interactive area, bar and line charts.
 */
function inGallerySlot(Chart: ComponentType, className: string): ComponentType {
	function GalleryChart() {
		return (
			<div className={className}>
				<Chart />
			</div>
		);
	}
	GalleryChart.displayName = `GalleryChart(${Chart.displayName ?? Chart.name})`;
	return GalleryChart;
}

export function inGalleryCell(Chart: ComponentType) {
	return inGallerySlot(Chart, "w-full max-w-md");
}

export function inGalleryRow(Chart: ComponentType) {
	return inGallerySlot(Chart, "w-full");
}
