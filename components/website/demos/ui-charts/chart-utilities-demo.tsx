"use client";

import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Background } from "@/components/ui-charts/background";
import { Band } from "@/components/ui-charts/band";
import { Bar } from "@/components/ui-charts/bar";
import { BarChart } from "@/components/ui-charts/bar-chart";
import { BarDepthBack, BarDepthFront, BarDepthProvider } from "@/components/ui-charts/bar-depth";
import { BarXAxis } from "@/components/ui-charts/bar-x-axis";
import { withBollingerBands } from "@/components/ui-charts/bollinger";
import { ChartBrush } from "@/components/ui-charts/chart-brush";
import { ChartBrushLayout } from "@/components/ui-charts/chart-brush-layout";
import { chartCssVars } from "@/components/ui-charts/chart-context";
import { Deadline } from "@/components/ui-charts/deadline";
import { Grid } from "@/components/ui-charts/grid";
import { Line } from "@/components/ui-charts/line";
import { LineChart } from "@/components/ui-charts/line-chart";
import { ChartMarkers, type ChartMarker, MarkerTooltipContent, useActiveMarkers } from "@/components/ui-charts/markers";
import { ProjectionLine } from "@/components/ui-charts/projection-line";
import { buildProjectionPath } from "@/components/ui-charts/projection-utils";
import { ReferenceArea } from "@/components/ui-charts/reference-area";
import { ChartTooltip } from "@/components/ui-charts/tooltip";
import { TrendLine } from "@/components/ui-charts/trend-line";
import { Weekends } from "@/components/ui-charts/weekends";
import { XAxis } from "@/components/ui-charts/x-axis";
import { YAxis } from "@/components/ui-charts/y-axis";
import { categoryVolume } from "./data";

const dailyActivity = [42, 48, 44, 56, 63, 59, 54, 62, 68, 65, 71, 79, 74, 69, 76, 83, 78, 86, 91, 88, 96].map((value, index) => ({
	date: new Date(Date.UTC(2026, 9, index + 1)),
	value,
}));
const bollingerActivity = withBollingerBands(dailyActivity, {
	dataKey: "value",
	period: 5,
	minPeriods: 1,
});
const projection = buildProjectionPath({
	sourceData: dailyActivity,
	seriesKey: "value",
	mode: "target",
	horizonPoints: 6,
	endValue: 116,
});
const eventMarkers: ChartMarker[] = [
	{ date: new Date(Date.UTC(2026, 9, 7)), icon: "1", title: "Release one", description: "Daily activity reached 54." },
	{ date: new Date(Date.UTC(2026, 9, 16)), icon: "2", title: "Release two", description: "Daily activity reached 83." },
];

function UtilityFrame({ children, description }: { children: ReactNode; description: string }) {
	return (
		<figure className="m-0 h-full min-h-[280px] w-full p-4">
			<figcaption className="sr-only">{description}</figcaption>
			{children}
		</figure>
	);
}

export function BackgroundDemo() {
	const reduceMotion = useReducedMotion();
	return (
		<UtilityFrame description="Daily activity rises from 42 to 96 over three weeks, on a dotted plot background.">
			<LineChart data={dailyActivity}>
				<Background pattern="dots" />
				<Line dataKey="value" animate={!reduceMotion} />
				<XAxis />
				<YAxis />
				<ChartTooltip />
			</LineChart>
		</UtilityFrame>
	);
}

export function ReferenceAreaDemo() {
	const reduceMotion = useReducedMotion();
	return (
		<UtilityFrame description="Daily activity crosses a target range of 60 to 80 near the middle of the period.">
			<LineChart data={dailyActivity}>
				<Grid horizontal />
				<ReferenceArea y1={60} y2={80} showMarkers axisLabelColor={chartCssVars.categorical3} />
				<Line dataKey="value" animate={!reduceMotion} />
				<XAxis />
				<YAxis />
				<ChartTooltip />
			</LineChart>
		</UtilityFrame>
	);
}

export function ProjectionLineDemo() {
	const reduceMotion = useReducedMotion();
	return (
		<UtilityFrame description="Activity ends at 96; a dashed projection reaches 116 six days later.">
			<LineChart data={dailyActivity}>
				<Grid horizontal />
				<Line dataKey="value" animate={!reduceMotion} />
				<ProjectionLine data={projection} strokeStyle="gradient" />
				<XAxis />
				<YAxis />
				<ChartTooltip />
			</LineChart>
		</UtilityFrame>
	);
}

export function BandDemo() {
	const reduceMotion = useReducedMotion();
	return (
		<UtilityFrame description="Daily activity with a five-day Bollinger range. The shaded range expands when recent values vary more.">
			<LineChart data={bollingerActivity}>
				<Grid horizontal />
				<Band upperKey="valueUpper" lowerKey="valueLower" label="Bollinger range" fillType="gradient" />
				<Line dataKey="value" animate={!reduceMotion} />
				<XAxis />
				<YAxis />
				<ChartTooltip />
			</LineChart>
		</UtilityFrame>
	);
}

export function WeekendsDemo() {
	const reduceMotion = useReducedMotion();
	return (
		<UtilityFrame description="Daily activity with Saturday and Sunday shaded in stripes.">
			<LineChart data={dailyActivity}>
				<Weekends utc />
				<Line dataKey="value" animate={!reduceMotion} />
				<XAxis />
				<YAxis />
				<ChartTooltip />
			</LineChart>
		</UtilityFrame>
	);
}

export function DeadlineDemo() {
	const reduceMotion = useReducedMotion();
	return (
		<UtilityFrame description="Daily activity with an October 16 deadline; the region after the deadline is shaded.">
			<LineChart data={dailyActivity}>
				<Grid horizontal />
				<Deadline date={new Date(Date.UTC(2026, 9, 16))} label="Due Oct 16" fillType="gradient" />
				<Line dataKey="value" animate={!reduceMotion} />
				<XAxis />
				<YAxis />
				<ChartTooltip />
			</LineChart>
		</UtilityFrame>
	);
}

export function TrendLineDemo() {
	const reduceMotion = useReducedMotion();
	return (
		<UtilityFrame description="Daily activity with a dashed least-squares trend line showing sustained growth.">
			<LineChart data={dailyActivity}>
				<Grid horizontal />
				<Line dataKey="value" animate={!reduceMotion} />
				<TrendLine dataKey="value" stroke={chartCssVars.categorical3} fadeEdges />
				<XAxis />
				<YAxis />
				<ChartTooltip />
			</LineChart>
		</UtilityFrame>
	);
}

function ActiveEventMarkers() {
	const active = useActiveMarkers(eventMarkers);
	return active.length > 0 ? <MarkerTooltipContent markers={active} /> : null;
}

export function MarkersDemo() {
	const reduceMotion = useReducedMotion();
	return (
		<UtilityFrame description="Activity with release markers on October 7 and October 16. Hover the dates to read release details.">
			<LineChart data={dailyActivity} margin={{ top: 40, right: 24, bottom: 40, left: 48 }}>
				<Grid horizontal />
				<Line dataKey="value" animate={!reduceMotion} />
				<ChartMarkers items={eventMarkers} animate={!reduceMotion} />
				<XAxis />
				<YAxis />
				<ChartTooltip><ActiveEventMarkers /></ChartTooltip>
			</LineChart>
		</UtilityFrame>
	);
}

export function BarDepthDemo() {
	const reduceMotion = useReducedMotion();
	return (
		<UtilityFrame description="Active items by category: Search 42, Rovo 58, Studio 46, Graph 34, Voice 25. Bars use a glass depth treatment.">
			<BarDepthProvider>
				<BarChart data={categoryVolume} xDataKey="name">
					<Grid horizontal />
					<BarDepthBack dataKey="active" />
					<Bar dataKey="active" animate={!reduceMotion} />
					<BarDepthFront dataKey="active" />
					<BarXAxis />
					<ChartTooltip />
				</BarChart>
			</BarDepthProvider>
		</UtilityFrame>
	);
}

export function BrushDemo() {
	const reduceMotion = useReducedMotion();
	return (
		<UtilityFrame description="Daily activity with a range brush. Drag either handle, or focus Selection start and Selection end and use arrows, Page Up, Page Down, Home or End to zoom the date range.">
			<div className="h-[300px]">
				<ChartBrushLayout data={dailyActivity} enabled height={64} brushStrip={(layout) => (
					<LineChart data={dailyActivity} animationDuration={0} margin={{ top: 8, right: 40, bottom: 8, left: 40 }} style={{ height: "100%", aspectRatio: "unset" }}>
						<Line dataKey="value" animate={false} showHighlight={false} />
						<ChartBrush initialSelection={layout.brushSelection} onSelectionChange={layout.onBrushSelectionChange} />
					</LineChart>
				)}>
					{(layout) => (
						<LineChart data={dailyActivity} xDomain={layout.xDomain} xDomainSlotCount={layout.xDomainSlotCount} tweenYDomainOnXDomainChange={!reduceMotion} style={{ height: "100%", aspectRatio: "unset" }}>
							<Grid horizontal />
							<Line dataKey="value" animate={!reduceMotion} />
							<XAxis />
							<YAxis />
							<ChartTooltip />
						</LineChart>
					)}
				</ChartBrushLayout>
			</div>
		</UtilityFrame>
	);
}
