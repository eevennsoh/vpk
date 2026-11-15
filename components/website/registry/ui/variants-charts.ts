import dynamic from "next/dynamic";
import { createElement, type ComponentType } from "react";

/**
 * The shadcn gallery charts size to their container (ResponsiveContainer), so in the centred
 * example shell they would collapse to their intrinsic width. Give them the width they have in
 * shadcn's gallery: one grid cell, or the full row for the interactive area, bar and line charts.
 * Those three fill their parent's height (h-full card, flex-1 content), so the row also sets one.
 */
function inGallerySlot(Chart: ComponentType, className: string): ComponentType {
	function GalleryChart() {
		return createElement("div", { className }, createElement(Chart));
	}
	GalleryChart.displayName = `GalleryChart(${Chart.displayName ?? Chart.name})`;
	return GalleryChart;
}

function inGalleryCell(Chart: ComponentType) {
	return inGallerySlot(Chart, "w-full max-w-md");
}

function inGalleryRow(Chart: ComponentType) {
	return inGallerySlot(Chart, "h-96 w-full");
}

/**
 * Chart examples for /components/ui/chart. The seven chart-demo-* entries are VPK's own
 * demos; the rest are the shadcn chart gallery (components/charts/*), copied 1:1.
 */
export const UI_CHART_VARIANT_DEMOS: Record<string, ComponentType> = {
	// VPK chart demos
	"chart-demo-default": dynamic(
		() =>
			import("../../demos/ui/chart-demo").then((mod) => ({
				default: mod.ChartDemoDefault,
			})),
		{ ssr: false },
	),
	"chart-demo-with-legend": dynamic(
		() =>
			import("../../demos/ui/chart-demo").then((mod) => ({
				default: mod.ChartDemoWithLegend,
			})),
		{ ssr: false },
	),
	"chart-demo-area-chart": dynamic(
		() =>
			import("../../demos/ui/chart-demo").then((mod) => ({
				default: mod.ChartDemoAreaChart,
			})),
		{ ssr: false },
	),
	"chart-demo-bar-chart": dynamic(
		() =>
			import("../../demos/ui/chart-demo").then((mod) => ({
				default: mod.ChartDemoBarChart,
			})),
		{ ssr: false },
	),
	"chart-demo-line-chart": dynamic(
		() =>
			import("../../demos/ui/chart-demo").then((mod) => ({
				default: mod.ChartDemoLineChart,
			})),
		{ ssr: false },
	),
	"chart-demo-radar-chart": dynamic(
		() =>
			import("../../demos/ui/chart-demo").then((mod) => ({
				default: mod.ChartDemoRadarChart,
			})),
		{ ssr: false },
	),
	"chart-demo-radial-chart": dynamic(
		() =>
			import("../../demos/ui/chart-demo").then((mod) => ({
				default: mod.ChartDemoRadialChart,
			})),
		{ ssr: false },
	),
	// Area
	"chart-area": dynamic(
		() =>
			import("../../../charts/area/chart-area").then((mod) => ({ default: inGalleryCell(mod.ChartAreaDefault) })),
		{ ssr: false },
	),
	"chart-area-interactive": dynamic(
		() =>
			import("../../../charts/area/chart-area-interactive").then((mod) => ({ default: inGalleryRow(mod.ChartAreaInteractive) })),
		{ ssr: false },
	),
	"chart-area-axes": dynamic(
		() =>
			import("../../../charts/area/chart-area-axes").then((mod) => ({ default: inGalleryCell(mod.ChartAreaAxes) })),
		{ ssr: false },
	),
	"chart-area-gradient": dynamic(
		() =>
			import("../../../charts/area/chart-area-gradient").then((mod) => ({ default: inGalleryCell(mod.ChartAreaGradient) })),
		{ ssr: false },
	),
	"chart-area-icons": dynamic(
		() =>
			import("../../../charts/area/chart-area-icons").then((mod) => ({ default: inGalleryCell(mod.ChartAreaIcons) })),
		{ ssr: false },
	),
	"chart-area-legend": dynamic(
		() =>
			import("../../../charts/area/chart-area-legend").then((mod) => ({ default: inGalleryCell(mod.ChartAreaLegend) })),
		{ ssr: false },
	),
	"chart-area-linear": dynamic(
		() =>
			import("../../../charts/area/chart-area-linear").then((mod) => ({ default: inGalleryCell(mod.ChartAreaLinear) })),
		{ ssr: false },
	),
	"chart-area-stacked": dynamic(
		() =>
			import("../../../charts/area/chart-area-stacked").then((mod) => ({ default: inGalleryCell(mod.ChartAreaStacked) })),
		{ ssr: false },
	),
	"chart-area-stacked-expanded": dynamic(
		() =>
			import("../../../charts/area/chart-area-stacked-expanded").then(
				(mod) => ({ default: inGalleryCell(mod.ChartAreaStackedExpand) }),
			),
		{ ssr: false },
	),
	"chart-area-step": dynamic(
		() =>
			import("../../../charts/area/chart-area-step").then((mod) => ({ default: inGalleryCell(mod.ChartAreaStep) })),
		{ ssr: false },
	),
	// Bar
	"chart-bar": dynamic(
		() =>
			import("../../../charts/bar/chart-bar").then((mod) => ({ default: inGalleryCell(mod.ChartBarDefault) })),
		{ ssr: false },
	),
	"chart-bar-interactive": dynamic(
		() =>
			import("../../../charts/bar/chart-bar-interactive").then((mod) => ({ default: inGalleryRow(mod.ChartBarInteractive) })),
		{ ssr: false },
	),
	"chart-bar-active": dynamic(
		() =>
			import("../../../charts/bar/chart-bar-active").then((mod) => ({ default: inGalleryCell(mod.ChartBarActive) })),
		{ ssr: false },
	),
	"chart-bar-chart-stacked-legend": dynamic(
		() =>
			import("../../../charts/bar/chart-bar-chart-stacked-legend").then(
				(mod) => ({ default: inGalleryCell(mod.ChartBarStacked) }),
			),
		{ ssr: false },
	),
	"chart-bar-custom-label": dynamic(
		() =>
			import("../../../charts/bar/chart-bar-custom-label").then((mod) => ({ default: inGalleryCell(mod.ChartBarLabelCustom) })),
		{ ssr: false },
	),
	"chart-bar-horizontal": dynamic(
		() =>
			import("../../../charts/bar/chart-bar-horizontal").then((mod) => ({ default: inGalleryCell(mod.ChartBarHorizontal) })),
		{ ssr: false },
	),
	"chart-bar-label": dynamic(
		() =>
			import("../../../charts/bar/chart-bar-label").then((mod) => ({ default: inGalleryCell(mod.ChartBarLabel) })),
		{ ssr: false },
	),
	"chart-bar-mixed": dynamic(
		() =>
			import("../../../charts/bar/chart-bar-mixed").then((mod) => ({ default: inGalleryCell(mod.ChartBarMixed) })),
		{ ssr: false },
	),
	"chart-bar-multiple": dynamic(
		() =>
			import("../../../charts/bar/chart-bar-multiple").then((mod) => ({ default: inGalleryCell(mod.ChartBarMultiple) })),
		{ ssr: false },
	),
	"chart-bar-negative": dynamic(
		() =>
			import("../../../charts/bar/chart-bar-negative").then((mod) => ({ default: inGalleryCell(mod.ChartBarNegative) })),
		{ ssr: false },
	),
	// Line
	"chart-line": dynamic(
		() =>
			import("../../../charts/line/chart-line").then((mod) => ({ default: inGalleryCell(mod.ChartLineDefault) })),
		{ ssr: false },
	),
	"chart-line-interactive": dynamic(
		() =>
			import("../../../charts/line/chart-line-interactive").then((mod) => ({ default: inGalleryRow(mod.ChartLineInteractive) })),
		{ ssr: false },
	),
	"chart-line-custom-dots": dynamic(
		() =>
			import("../../../charts/line/chart-line-custom-dots").then((mod) => ({ default: inGalleryCell(mod.ChartLineDotsCustom) })),
		{ ssr: false },
	),
	"chart-line-custom-label": dynamic(
		() =>
			import("../../../charts/line/chart-line-custom-label").then(
				(mod) => ({ default: inGalleryCell(mod.ChartLineLabelCustom) }),
			),
		{ ssr: false },
	),
	"chart-line-dots": dynamic(
		() =>
			import("../../../charts/line/chart-line-dots").then((mod) => ({ default: inGalleryCell(mod.ChartLineDots) })),
		{ ssr: false },
	),
	"chart-line-dots-colors": dynamic(
		() =>
			import("../../../charts/line/chart-line-dots-colors").then((mod) => ({ default: inGalleryCell(mod.ChartLineDotsColors) })),
		{ ssr: false },
	),
	"chart-line-label": dynamic(
		() =>
			import("../../../charts/line/chart-line-label").then((mod) => ({ default: inGalleryCell(mod.ChartLineLabel) })),
		{ ssr: false },
	),
	"chart-line-linear": dynamic(
		() =>
			import("../../../charts/line/chart-line.linear").then((mod) => ({ default: inGalleryCell(mod.ChartLineLinear) })),
		{ ssr: false },
	),
	"chart-line-multiple": dynamic(
		() =>
			import("../../../charts/line/chart-line-multiple").then((mod) => ({ default: inGalleryCell(mod.ChartLineMultiple) })),
		{ ssr: false },
	),
	"chart-line-step": dynamic(
		() =>
			import("../../../charts/line/chart-line-step").then((mod) => ({ default: inGalleryCell(mod.ChartLineStep) })),
		{ ssr: false },
	),
	// Pie
	"chart-pie": dynamic(
		() =>
			import("../../../charts/pie/chart-pie").then((mod) => ({ default: inGalleryCell(mod.ChartPieSimple) })),
		{ ssr: false },
	),
	"chart-pie-custom-label": dynamic(
		() =>
			import("../../../charts/pie/chart-pie-custom-label").then((mod) => ({ default: inGalleryCell(mod.ChartPieLabelCustom) })),
		{ ssr: false },
	),
	"chart-pie-donut": dynamic(
		() =>
			import("../../../charts/pie/chart-pie-donut").then((mod) => ({ default: inGalleryCell(mod.ChartPieDonut) })),
		{ ssr: false },
	),
	"chart-pie-donut-active": dynamic(
		() =>
			import("../../../charts/pie/chart-pie-donut-active").then((mod) => ({ default: inGalleryCell(mod.ChartPieDonutActive) })),
		{ ssr: false },
	),
	"chart-pie-donut-with-text": dynamic(
		() =>
			import("../../../charts/pie/chart-pie-donut-with-text").then(
				(mod) => ({ default: inGalleryCell(mod.ChartPieDonutText) }),
			),
		{ ssr: false },
	),
	"chart-pie-interactive": dynamic(
		() =>
			import("../../../charts/pie/chart-pie-interactive").then((mod) => ({ default: inGalleryCell(mod.ChartPieInteractive) })),
		{ ssr: false },
	),
	"chart-pie-label": dynamic(
		() =>
			import("../../../charts/pie/chart-pie-label").then((mod) => ({ default: inGalleryCell(mod.ChartPieLabel) })),
		{ ssr: false },
	),
	"chart-pie-label-list": dynamic(
		() =>
			import("../../../charts/pie/chart-pie-label-list").then((mod) => ({ default: inGalleryCell(mod.ChartPieLabelList) })),
		{ ssr: false },
	),
	"chart-pie-legend": dynamic(
		() =>
			import("../../../charts/pie/chart-pie-legend").then((mod) => ({ default: inGalleryCell(mod.ChartPieLegend) })),
		{ ssr: false },
	),
	"chart-pie-separator-none": dynamic(
		() =>
			import("../../../charts/pie/chart-pie-separator-none").then(
				(mod) => ({ default: inGalleryCell(mod.ChartPieSeparatorNone) }),
			),
		{ ssr: false },
	),
	"chart-pie-stacked": dynamic(
		() =>
			import("../../../charts/pie/chart-pie-stacked").then((mod) => ({ default: inGalleryCell(mod.ChartPieStacked) })),
		{ ssr: false },
	),
	// Radar
	"chart-radar": dynamic(
		() =>
			import("../../../charts/radar/chart-radar").then((mod) => ({ default: inGalleryCell(mod.ChartRadarDefault) })),
		{ ssr: false },
	),
	"chart-radar-custom-label": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-custom-label").then(
				(mod) => ({ default: inGalleryCell(mod.ChartRadarLabelCustom) }),
			),
		{ ssr: false },
	),
	"chart-radar-dots": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-dots").then((mod) => ({ default: inGalleryCell(mod.ChartRadarDots) })),
		{ ssr: false },
	),
	"chart-radar-grid-circle": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-grid-circle").then(
				(mod) => ({ default: inGalleryCell(mod.ChartRadarGridCircle) }),
			),
		{ ssr: false },
	),
	"chart-radar-grid-circle-filled": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-grid-circle-filled").then(
				(mod) => ({ default: inGalleryCell(mod.ChartRadarGridCircleFill) }),
			),
		{ ssr: false },
	),
	"chart-radar-grid-circle-no-lines": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-grid-circle-no-lines").then(
				(mod) => ({ default: inGalleryCell(mod.ChartRadarGridCircleNoLines) }),
			),
		{ ssr: false },
	),
	"chart-radar-grid-custom": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-grid-custom").then(
				(mod) => ({ default: inGalleryCell(mod.ChartRadarGridCustom) }),
			),
		{ ssr: false },
	),
	"chart-radar-grid-filled": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-grid-filled").then(
				(mod) => ({ default: inGalleryCell(mod.ChartRadarGridFill) }),
			),
		{ ssr: false },
	),
	"chart-radar-grid-none": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-grid-none").then((mod) => ({ default: inGalleryCell(mod.ChartRadarGridNone) })),
		{ ssr: false },
	),
	"chart-radar-legend": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-legend").then((mod) => ({ default: inGalleryCell(mod.ChartRadarLegend) })),
		{ ssr: false },
	),
	"chart-radar-lines-only": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-lines-only").then(
				(mod) => ({ default: inGalleryCell(mod.ChartRadarLinesOnly) }),
			),
		{ ssr: false },
	),
	"chart-radar-multiple": dynamic(
		() =>
			import("../../../charts/radar/chart-radar-multiple").then((mod) => ({ default: inGalleryCell(mod.ChartRadarMultiple) })),
		{ ssr: false },
	),
	// Radial
	"chart-radial": dynamic(
		() =>
			import("../../../charts/radial/chart-radial").then((mod) => ({ default: inGalleryCell(mod.ChartRadialSimple) })),
		{ ssr: false },
	),
	"chart-radial-grid": dynamic(
		() =>
			import("../../../charts/radial/chart-radial-grid").then((mod) => ({ default: inGalleryCell(mod.ChartRadialGrid) })),
		{ ssr: false },
	),
	"chart-radial-label": dynamic(
		() =>
			import("../../../charts/radial/chart-radial-label").then((mod) => ({ default: inGalleryCell(mod.ChartRadialLabel) })),
		{ ssr: false },
	),
	"chart-radial-shape": dynamic(
		() =>
			import("../../../charts/radial/chart-radial-shape").then((mod) => ({ default: inGalleryCell(mod.ChartRadialShape) })),
		{ ssr: false },
	),
	"chart-radial-stacked": dynamic(
		() =>
			import("../../../charts/radial/chart-radial-stacked").then((mod) => ({ default: inGalleryCell(mod.ChartRadialStacked) })),
		{ ssr: false },
	),
	"chart-radial-text": dynamic(
		() =>
			import("../../../charts/radial/chart-radial-text").then((mod) => ({ default: inGalleryCell(mod.ChartRadialText) })),
		{ ssr: false },
	),
	// Tooltip
	"chart-tooltip": dynamic(
		() =>
			import("../../../charts/tooltip/chart-tooltip").then((mod) => ({ default: inGalleryCell(mod.ChartTooltipDefault) })),
		{ ssr: false },
	),
	"chart-tooltip-advanced": dynamic(
		() =>
			import("../../../charts/tooltip/chart-tooltip-advanced").then(
				(mod) => ({ default: inGalleryCell(mod.ChartTooltipAdvanced) }),
			),
		{ ssr: false },
	),
	"chart-tooltip-custom-label": dynamic(
		() =>
			import("../../../charts/tooltip/chart-tooltip-custom-label").then(
				(mod) => ({ default: inGalleryCell(mod.ChartTooltipLabelCustom) }),
			),
		{ ssr: false },
	),
	"chart-tooltip-formatter": dynamic(
		() =>
			import("../../../charts/tooltip/chart-tooltip-formatter").then(
				(mod) => ({ default: inGalleryCell(mod.ChartTooltipFormatter) }),
			),
		{ ssr: false },
	),
	"chart-tooltip-icons": dynamic(
		() =>
			import("../../../charts/tooltip/chart-tooltip-icons").then((mod) => ({ default: inGalleryCell(mod.ChartTooltipIcons) })),
		{ ssr: false },
	),
	"chart-tooltip-label-formatter": dynamic(
		() =>
			import("../../../charts/tooltip/chart-tooltip-label-formatter").then(
				(mod) => ({ default: inGalleryCell(mod.ChartTooltipLabelFormatter) }),
			),
		{ ssr: false },
	),
	"chart-tooltip-line-indicator": dynamic(
		() =>
			import("../../../charts/tooltip/chart-tooltip-line-indicator").then(
				(mod) => ({ default: inGalleryCell(mod.ChartTooltipIndicatorLine) }),
			),
		{ ssr: false },
	),
	"chart-tooltip-no-indicator": dynamic(
		() =>
			import("../../../charts/tooltip/chart-tooltip-no-indicator").then(
				(mod) => ({ default: inGalleryCell(mod.ChartTooltipIndicatorNone) }),
			),
		{ ssr: false },
	),
	"chart-tooltip-no-label": dynamic(
		() =>
			import("../../../charts/tooltip/chart-tooltip-no-label").then(
				(mod) => ({ default: inGalleryCell(mod.ChartTooltipLabelNone) }),
			),
		{ ssr: false },
	),
};
