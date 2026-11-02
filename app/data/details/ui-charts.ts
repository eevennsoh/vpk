import type { ComponentDetail, PropDefinition, SubComponentDoc } from "@/app/data/component-detail-types";

const cartesianProps: PropDefinition[] = [
	{ name: "data", type: "Record<string, unknown>[]", required: true, description: "Rows used by the chart root and child series." },
	{ name: "xDataKey", type: "string", default: "\"date\"", description: "Row key used for the x-axis scale." },
	{ name: "children", type: "ReactNode", required: true, description: "Composable chart children such as Grid, series, axes, and ChartTooltip." },
	{ name: "aspectRatio", type: "string", default: "\"2 / 1\"", description: "Responsive chart ratio when the parent is not explicitly sized." },
];

const chartChildren: SubComponentDoc[] = [
	{ name: "Grid", description: "Renders horizontal or vertical chart grid lines inside the chart root." },
	{ name: "XAxis / YAxis", description: "Portal-backed axis labels connected to the active chart scale." },
	{ name: "ChartTooltip", description: "Shared hover tooltip and crosshair for cartesian charts." },
];

const statCardProps: PropDefinition[] = [
	{ name: "hover state", type: "internal", description: "The card syncs chart hover state into the value, label, and trend badge." },
	{ name: "data", type: "bundled sample", description: "The installed block includes its own source data and chart composition." },
];

function chartDetail(input: {
	description: string;
	importStatement: string;
	usage: string;
	props?: PropDefinition[];
	subComponents?: SubComponentDoc[];
	examples?: ComponentDetail["examples"];
}): ComponentDetail {
	return {
		description: input.description,
		importStatement: input.importStatement,
		usage: input.usage,
		props: input.props ?? cartesianProps,
		subComponents: input.subComponents ?? chartChildren,
		demoLayout: {
			previewContentWidth: "full",
			examplesContentWidth: "full",
		},
		examples: input.examples,
	};
}

export const UI_CHART_DETAILS: Record<string, ComponentDetail> = {
	"chart-utilities": chartDetail({
		description: "Composable chart overlays for ranges, forecasts, trends, dates, markers, and backgrounds.",
		importStatement: 'import { LineChart, Line, ReferenceArea, TrendLine } from "@/components/ui-charts";',
		usage: `<LineChart data={data} xDataKey="date">
	<ReferenceArea y1={40} y2={60} />
	<Line dataKey="value" />
	<TrendLine dataKey="value" />
</LineChart>`,
		props: [],
		subComponents: [
			{ name: "Background / ReferenceArea", description: "Shade the plot or a region of its data domain." },
			{ name: "ProjectionLine / TrendLine / Band", description: "Show a forecast, fitted trend, or range alongside a series." },
			{ name: "Weekends / Deadline / ChartMarkers", description: "Add dates and events to a time-series chart." },
			{ name: "ChartBrush / ChartBrushLayout", description: "Select a time range to zoom a line or area chart." },
			{ name: "BarDepth", description: "Add a dimensional treatment to bars." },
		],
		examples: [
			{ title: "Background", demoSlug: "chart-utilities-demo-background" },
			{ title: "Reference area", demoSlug: "chart-utilities-demo-reference-area" },
			{ title: "Projection", demoSlug: "chart-utilities-demo-projection-line" },
			{ title: "Band", demoSlug: "chart-utilities-demo-band" },
			{ title: "Brush", demoSlug: "chart-utilities-demo-brush" },
			{ title: "Weekends", demoSlug: "chart-utilities-demo-weekends" },
			{ title: "Deadline", demoSlug: "chart-utilities-demo-deadline" },
			{ title: "Trend line", demoSlug: "chart-utilities-demo-trend-line" },
			{ title: "Markers", demoSlug: "chart-utilities-demo-markers" },
			{ title: "Bar depth", demoSlug: "chart-utilities-demo-bar-depth" },
		],
	}),
	"radial-chart": chartDetail({
		description: "Composable radial charts for categories, time series, and circular or partial-arc comparisons.",
		importStatement: 'import { RadialChart, RadialBar, RadialAxis, RadialCenter } from "@/components/ui-charts";',
		usage: `<RadialChart angleType="band" data={data} xDataKey="month" series={series}>
	<RadialBar />
	<RadialAxis />
	<RadialCenter />
</RadialChart>`,
		props: [
			{ name: "data", type: "Record<string, unknown>[]", required: true, description: "Values for each angular or radial bin." },
			{ name: "series", type: "RadialSeries[]", description: "Keys, labels, and colors for the data series." },
			{ name: "angleType", type: '"clock" | "band" | "time"', description: "How bins are arranged around the chart." },
		],
		subComponents: [
			{ name: "RadialBar / RadialRingBar / RadialDotBar", description: "Display values as radial bars, rings, or dots." },
			{ name: "RadialLine / RadialArea", description: "Display a series as a line or filled area." },
			{ name: "RadialAxis / RadialCenter / RadialLegend", description: "Add labels and context to the chart." },
		],
		examples: [{ title: "Default", demoSlug: "radial-chart-demo-default" }],
	}),
	"sparkline": chartDetail({
		description: "Compact line, area, and bar trends for dense dashboards and table cells.",
		importStatement: 'import { LineSparkline, AreaSparkline, BarSparkline, useSparklineHover } from "@/components/ui-charts";',
		usage: `<LineSparkline data={data} dataKey="value" />
<AreaSparkline data={data} dataKey="value" />
<BarSparkline data={data} dataKey="value" />`,
		props: [
			{ name: "data", type: "readonly T[]", required: true, description: "Ordered points to display." },
			{ name: "dataKey", type: "keyof T | ((row: T) => number)", required: true, description: "Numeric value for each point." },
			{ name: "height", type: "number", default: "32", description: "Height in pixels; width fills the parent unless specified." },
		],
		subComponents: [{ name: "useSparklineHover", description: "Shares hover state and exposes the active datum for a separate value display." }],
		examples: [{ title: "Line, area, and bar", demoSlug: "sparkline-demo-default" }],
	}),
	"sunburst-chart": chartDetail({
		description: "Hierarchical part-to-whole chart with drill-down navigation.",
		importStatement: 'import { buildArcs, SunburstChart, SunburstSegment, SunburstCenter, SunburstLabels } from "@/components/ui-charts";',
		usage: `const { arcs } = buildArcs(data);
<SunburstChart data={data}>
	{arcs.map((arc) => <SunburstSegment key={arc.id} index={arc.arcIndex} />)}
	<SunburstCenter />
	<SunburstLabels />
</SunburstChart>`,
		props: [
			{ name: "data", type: "SunburstNode", required: true, description: "A tree of named values and child nodes." },
			{ name: "size", type: "number", description: "Maximum chart diameter in pixels." },
		],
		subComponents: [
			{ name: "SunburstSegment", description: "Draws a segment and enables drill-down for a node with children." },
			{ name: "SunburstCenter / SunburstBreadcrumb", description: "Provide navigation back through the hierarchy." },
			{ name: "SunburstLabels / SunburstHint", description: "Show labels and the active segment." },
		],
		examples: [{ title: "Default", demoSlug: "sunburst-chart-demo-default" }],
	}),
	"area-chart": chartDetail({
		description: "Composable Bklit area chart for filled trend lines and multi-series comparisons.",
		importStatement: 'import { AreaChart, Area, Grid, XAxis, YAxis, ChartTooltip } from "@/components/ui-charts";',
		usage: `<AreaChart data={data} xDataKey="date">
	<Grid horizontal />
	<Area dataKey="revenue" />
	<XAxis />
	<YAxis />
	<ChartTooltip />
</AreaChart>`,
		examples: [
			{ title: "Default", description: "Filled revenue trend with grid, axes, and tooltip.", demoSlug: "area-chart-demo-default" },
			{ title: "Two series", description: "Layered areas using chart CSS variables.", demoSlug: "area-chart-demo-stacked" },
		],
	}),
		"bar-chart": chartDetail({
			description: "Composable Bklit bar chart for categorical comparisons and stacked values.",
			importStatement: 'import { BarChart, Bar, BarXAxis, Grid, YAxis, ChartTooltip } from "@/components/ui-charts";',
			usage: `<BarChart data={data} xDataKey="name">
	<Grid horizontal />
	<Bar dataKey="active" />
	<BarXAxis />
	<YAxis />
	<ChartTooltip />
</BarChart>`,
		examples: [
			{ title: "Default", description: "Single-series categorical bars.", demoSlug: "bar-chart-demo-default" },
			{ title: "Stacked", description: "Stacked active and queued values.", demoSlug: "bar-chart-demo-stacked" },
		],
	}),
	"candlestick-chart": chartDetail({
		description: "OHLC financial chart with animated candle bodies, grid, axes, and tooltip support.",
		importStatement: 'import { CandlestickChart, Candlestick, Grid, XAxis, YAxis, ChartTooltip } from "@/components/ui-charts";',
		usage: `<CandlestickChart data={ohlcData} xDataKey="date">
	<Grid horizontal />
	<Candlestick />
	<XAxis />
	<YAxis />
	<ChartTooltip />
</CandlestickChart>`,
		props: [
			...cartesianProps,
			{ name: "candleGap", type: "number", default: "0.2", description: "Fractional gap between candle slots." },
			{ name: "candleWidth", type: "number", description: "Optional fixed candle body width." },
		],
		examples: [{ title: "Default", description: "Positive and negative candles from sample OHLC data.", demoSlug: "candlestick-chart-demo-default" }],
	}),
	"choropleth-chart": chartDetail({
		description: "GeoJSON choropleth map with feature hover state, zoom support, and tooltips.",
		importStatement: 'import { ChoroplethChart, ChoroplethFeatureComponent, ChoroplethTooltip } from "@/components/ui-charts";',
		usage: `<ChoroplethChart data={worldData}>
	<ChoroplethFeatureComponent getFeatureColor={getFeatureColor} />
	<ChoroplethTooltip getFeatureValue={getFeatureValue} />
</ChoroplethChart>`,
		props: [
			{ name: "data", type: "FeatureCollection", required: true, description: "GeoJSON feature collection to project." },
			{ name: "zoomEnabled", type: "boolean", default: "false", description: "Enables pan and zoom interactions." },
			{ name: "children", type: "ReactNode", required: true, description: "Feature, graticule, tooltip, or overlay children." },
		],
		subComponents: [
			{ name: "ChoroplethFeatureComponent", description: "Draws projected features and resolves fill color or patterns." },
			{ name: "ChoroplethTooltip", description: "Displays hovered feature metadata and values." },
		],
		examples: [{ title: "Default", description: "World visitor distribution using Bklit choropleth primitives.", demoSlug: "choropleth-chart-demo-default" }],
	}),
	"composed-chart": chartDetail({
		description: "Mixed Bklit chart root for combining bars, lines, and areas on one time axis.",
		importStatement: 'import { ComposedChart, SeriesBar, Line, Grid, XAxis, YAxis, ChartTooltip } from "@/components/ui-charts";',
		usage: `<ComposedChart data={data} xDataKey="date">
	<Grid horizontal />
	<SeriesBar dataKey="revenue" />
	<Line dataKey="forecast" />
	<XAxis />
	<YAxis />
	<ChartTooltip />
</ComposedChart>`,
		examples: [{ title: "Default", description: "Revenue bars with a forecast line.", demoSlug: "composed-chart-demo-default" }],
	}),
	"funnel-chart": chartDetail({
		description: "Animated stage funnel for conversion and pipeline drop-off views.",
		importStatement: 'import { FunnelChart } from "@/components/ui-charts";',
		usage: `<FunnelChart data={stages} grid showValues />`,
		props: [
			{ name: "data", type: "FunnelStage[]", required: true, description: "Ordered stages with label and value." },
			{ name: "orientation", type: "\"horizontal\" | \"vertical\"", default: "\"horizontal\"", description: "Flow direction for the funnel." },
			{ name: "grid", type: "boolean | object", description: "Optional bands and grid lines behind stages." },
		],
		subComponents: [],
		examples: [{ title: "Default", description: "Conversion stages with values and grid bands.", demoSlug: "funnel-chart-demo-default" }],
	}),
	"gauge-chart": chartDetail({
		description: "Notched gauge chart for a single progress or readiness value.",
		importStatement: 'import { Gauge } from "@/components/ui-charts";',
		usage: `<Gauge value={76} centerValue={76} suffix="%" />`,
		props: [
			{ name: "value", type: "number", required: true, description: "Fill level from 0 to 100." },
			{ name: "centerValue", type: "number", required: true, description: "Value shown in the center stat." },
			{ name: "totalNotches", type: "number", default: "40", description: "Number of arc notches." },
		],
		subComponents: [],
		examples: [{ title: "Default", description: "Readiness gauge using chart CSS variables.", demoSlug: "gauge-chart-demo-default" }],
	}),
	"heatmap-chart": chartDetail({
		description: "GitHub-style contribution heatmap with animated cells, axes, legend, and tooltip support.",
		importStatement: 'import { HeatmapChart, HeatmapCells, HeatmapXAxis, HeatmapYAxis, HeatmapLegend, HeatmapTooltip } from "@/components/ui-charts";',
		usage: `<HeatmapChart data={data}>
	<HeatmapCells />
	<HeatmapXAxis />
	<HeatmapYAxis />
	<HeatmapTooltip />
</HeatmapChart>
<HeatmapLegend />`,
		props: [
			{ name: "data", type: "HeatmapColumn[]", required: true, description: "Column data with one bin per row cell." },
			{ name: "layout", type: "\"fluid\" | \"fill\"", default: "\"fluid\"", description: "Controls whether width drives square cells or the grid fills its parent." },
			{ name: "levelColors / levelStyles", type: "tuple", description: "Optional Less-to-More color or pattern styles for five contribution levels." },
			{ name: "status", type: "\"ready\" | \"loading\"", default: "\"ready\"", description: "Displays the loading shimmer and label while data is loading." },
		],
		subComponents: [
			{ name: "HeatmapCells", description: "Draws animated, hoverable heatmap cells." },
			{ name: "HeatmapXAxis / HeatmapYAxis", description: "Portal-backed month and weekday labels." },
			{ name: "HeatmapLegend", description: "Less-to-More legend that can share hover state with the chart." },
			{ name: "HeatmapTooltip", description: "Displays the hovered cell value and date." },
		],
		examples: [{ title: "Default", description: "Weekly contribution density with axes, tooltip, and legend.", demoSlug: "heatmap-chart-demo-default" }],
	}),
	"line-chart": chartDetail({
		description: "Composable Bklit line chart for time-series trends and multi-line comparisons.",
		importStatement: 'import { LineChart, Line, Grid, XAxis, YAxis, ChartTooltip } from "@/components/ui-charts";',
		usage: `<LineChart data={data} xDataKey="date">
	<Grid horizontal />
	<Line dataKey="revenue" />
	<XAxis />
	<YAxis />
	<ChartTooltip />
</LineChart>`,
		examples: [
			{ title: "Default", description: "Single trend line with grid and tooltip.", demoSlug: "line-chart-demo-default" },
			{ title: "Multiple", description: "Revenue and forecast lines using chart variables.", demoSlug: "line-chart-demo-multiple" },
		],
	}),
	"live-line-chart": chartDetail({
		description: "Streaming Bklit line chart with live axes, value badge, and paused debug mode.",
		importStatement: 'import { LiveLineChart, LiveLine, LiveXAxis, LiveYAxis, Grid, ChartTooltip } from "@/components/ui-charts";',
		usage: `<LiveLineChart data={points} value={latestValue}>
	<Grid horizontal />
	<LiveLine dataKey="value" />
	<LiveXAxis />
	<LiveYAxis />
	<ChartTooltip />
</LiveLineChart>`,
		props: [
			{ name: "data", type: "LiveLinePoint[]", required: true, description: "Streaming points with time and value." },
			{ name: "value", type: "number", required: true, description: "Latest interpolated value." },
			{ name: "paused", type: "boolean", default: "false", description: "Freezes chart scrolling for debugging." },
		],
		examples: [{ title: "Default", description: "Rolling live line preview with live axes.", demoSlug: "live-line-chart-demo-default" }],
	}),
	"legend": chartDetail({
		description: "Bklit legend utility for hover-synced chart series labels, values, markers, and progress tracks.",
		importStatement: 'import { Legend, LegendItem, LegendMarker, LegendLabel, LegendValue, LegendProgress } from "@/components/ui-charts";',
		usage: `<Legend items={items} hoveredIndex={hoveredIndex} onHoverChange={setHoveredIndex} title="Campaign Performance">
	<LegendItem>
		<LegendMarker />
		<LegendLabel />
		<LegendValue />
		<LegendProgress />
	</LegendItem>
</Legend>`,
		props: [
			{ name: "items", type: "LegendItemData[]", required: true, description: "Series labels, values, max values, and colors for each legend row." },
			{ name: "hoveredIndex", type: "number | null", description: "Controlled hover index shared with a chart." },
			{ name: "onHoverChange", type: "(index: number | null) => void", description: "Receives row hover changes so charts can highlight matching series." },
			{ name: "title", type: "string", description: "Optional legend heading." },
		],
		subComponents: [
			{ name: "LegendItem", description: "Row template cloned for each item and wired to hover state." },
			{ name: "LegendMarker", description: "Color marker using the item color." },
			{ name: "LegendLabel / LegendValue", description: "Displays the series label and formatted value." },
			{ name: "LegendProgress", description: "Optional progress bar when maxValue is provided." },
		],
		examples: [{ title: "Default", description: "Campaign legend with markers, percentages, and progress tracks.", demoSlug: "legend-demo-default" }],
	}),
	"pie-chart": chartDetail({
		description: "Part-to-whole pie or donut chart with composable slices and center content.",
		importStatement: 'import { PieChart, PieSlice, PieCenter } from "@/components/ui-charts";',
		usage: `<PieChart data={segments} innerRadius={58}>
	{segments.map((segment, index) => <PieSlice key={segment.label} index={index} />)}
	<PieCenter defaultLabel="Total" />
</PieChart>`,
		props: [
			{ name: "data", type: "PieData[]", required: true, description: "Slice labels and values." },
			{ name: "innerRadius", type: "number", default: "0", description: "Sets donut hole size." },
			{ name: "children", type: "ReactNode", required: true, description: "PieSlice, PieCenter, patterns, or gradients." },
		],
		subComponents: [
			{ name: "PieSlice", description: "Renders one slice by index." },
			{ name: "PieCenter", description: "Displays aggregate or hovered slice values." },
		],
		examples: [{ title: "Default", description: "Donut-style pie with a center total.", demoSlug: "pie-chart-demo-default" }],
	}),
	"profit-loss-line": chartDetail({
		description: "Line series that splits positive and negative value segments for profit/loss trends.",
		importStatement: 'import { LineChart, ProfitLossLine, Grid, XAxis, YAxis, ChartTooltip } from "@/components/ui-charts";',
		usage: `<LineChart data={data} xDataKey="date">
	<Grid horizontal highlightRowValues={[0]} />
	<ProfitLossLine dataKey="pnl" />
	<XAxis />
	<YAxis />
	<ChartTooltip />
</LineChart>`,
		props: [
			...cartesianProps,
			{ name: "positiveColor / negativeColor", type: "string", description: "Optional segment colors; defaults use theme success/danger variables." },
		],
		examples: [{ title: "Default", description: "Positive and negative periods split around zero.", demoSlug: "profit-loss-line-demo-default" }],
	}),
	"radar-chart": chartDetail({
		description: "Multi-axis radar chart for comparing normalized campaigns or dimensions with legend-driven hover.",
		importStatement: 'import { RadarChart, RadarGrid, RadarAxis, RadarArea, RadarLabels, Legend } from "@/components/ui-charts";',
		usage: `<RadarChart data={series} metrics={metrics}>
	<RadarGrid />
	<RadarAxis />
	{series.map((item, index) => <RadarArea key={item.label} index={index} />)}
	<RadarLabels />
</RadarChart>
<Legend items={legendItems} hoveredIndex={hoveredIndex} onHoverChange={setHoveredIndex} title="Campaign Performance" />`,
		props: [
			{ name: "data", type: "RadarData[]", required: true, description: "Series with normalized metric values." },
			{ name: "metrics", type: "RadarMetric[]", required: true, description: "Axes shown around the chart." },
			{ name: "hoveredIndex / onHoverChange", type: "number | null / callback", description: "Optional controlled hover state shared with Legend." },
			{ name: "children", type: "ReactNode", required: true, description: "Grid, axes, labels, and RadarArea children." },
		],
		subComponents: [
			{ name: "RadarGrid / RadarAxis / RadarLabels", description: "Scaffold the radar coordinate system." },
			{ name: "RadarArea", description: "Draws one polygon by data index." },
			{ name: "Legend", description: "Optional Bklit utility that controls hover for overlapping radar polygons." },
		],
		examples: [{ title: "Default", description: "Campaign comparison with legend hover for each polygon.", demoSlug: "radar-chart-demo-default" }],
	}),
	"ring-chart": chartDetail({
		description: "Multi-ring radial progress chart with hover-aware center stats.",
		importStatement: 'import { RingChart, Ring, RingCenter } from "@/components/ui-charts";',
		usage: `<RingChart data={rings}>
	{rings.map((ring, index) => <Ring key={ring.label} index={index} />)}
	<RingCenter defaultLabel="Total" />
</RingChart>`,
		props: [
			{ name: "data", type: "RingData[]", required: true, description: "Ring label, value, and maxValue entries." },
			{ name: "strokeWidth", type: "number", default: "12", description: "Thickness of each ring." },
			{ name: "children", type: "ReactNode", required: true, description: "Ring and RingCenter children." },
		],
		subComponents: [
			{ name: "Ring", description: "Renders one progress ring by index." },
			{ name: "RingCenter", description: "Displays aggregate or hovered ring values." },
		],
		examples: [{ title: "Default", description: "Three-ring operational scorecard.", demoSlug: "ring-chart-demo-default" }],
	}),
	"sankey-chart": chartDetail({
		description: "Flow chart for showing how volume moves between source, landing, and outcome nodes.",
		importStatement: 'import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "@/components/ui-charts";',
		usage: `<SankeyChart data={flowData}>
	<SankeyLink />
	<SankeyNode />
	<SankeyTooltip />
</SankeyChart>`,
		props: [
			{ name: "data", type: "SankeyData", required: true, description: "Node and link arrays using source and target indexes." },
			{ name: "children", type: "ReactNode", required: true, description: "SankeyLink, SankeyNode, and SankeyTooltip children." },
			{ name: "nodePadding", type: "number", default: "24", description: "Vertical space between nodes." },
		],
		subComponents: [
			{ name: "SankeyLink", description: "Renders animated link paths between nodes." },
			{ name: "SankeyNode", description: "Renders node rectangles and labels." },
			{ name: "SankeyTooltip", description: "Displays hovered node or link details." },
		],
		examples: [{ title: "Default", description: "Request flow from intake to outcomes.", demoSlug: "sankey-chart-demo-default" }],
	}),
	"scatter-chart": chartDetail({
		description: "Composable Bklit scatter chart for correlations, distributions, and point trends.",
		importStatement: 'import { ScatterChart, Scatter, Grid, XAxis, YAxis, ChartTooltip } from "@/components/ui-charts";',
		usage: `<ScatterChart data={data} xDataKey="date">
	<Grid horizontal />
	<Scatter dataKey="throughput" />
	<XAxis />
	<YAxis />
	<ChartTooltip />
</ScatterChart>`,
		examples: [{ title: "Default", description: "Throughput points over time.", demoSlug: "scatter-chart-demo-default" }],
	}),
	"stat-card-area-01": chartDetail({
		description: "Bklit stat card block pairing a KPI header with an embedded area chart.",
		importStatement: 'import { StatCardArea } from "@/components/ui-charts/stat-card-area-01";',
		usage: "<StatCardArea />",
		props: statCardProps,
		subComponents: [{ name: "StatCardArea", description: "Self-contained KPI card with hover-synced area chart." }],
		examples: [{ title: "Default", description: "Revenue card with embedded area sparkline.", demoSlug: "stat-card-area-01-demo-default" }],
	}),
	"stat-card-choropleth-01": chartDetail({
		description: "Bklit stat card block pairing a KPI header with an embedded choropleth map.",
		importStatement: 'import { StatCardChoropleth } from "@/components/ui-charts/stat-card-choropleth-01";',
		usage: "<StatCardChoropleth />",
		props: statCardProps,
		subComponents: [{ name: "StatCardChoropleth", description: "Self-contained KPI card with hover-synced world map." }],
		examples: [{ title: "Default", description: "Visitor card with embedded choropleth map.", demoSlug: "stat-card-choropleth-01-demo-default" }],
	}),
	"stat-card-line-01": chartDetail({
		description: "Bklit stat card block pairing a KPI header with an embedded line chart.",
		importStatement: 'import { StatCardLine } from "@/components/ui-charts/stat-card-line-01";',
		usage: "<StatCardLine />",
		props: statCardProps,
		subComponents: [{ name: "StatCardLine", description: "Self-contained KPI card with hover-synced line chart." }],
		examples: [{ title: "Default", description: "Sessions card with embedded line chart.", demoSlug: "stat-card-line-01-demo-default" }],
	}),
};
