"use client";

// Recharts-backed chart components for the json-render registry.
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart as RechartsBarChart, Bar, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, AreaChart as RechartsAreaChart, Area, RadarChart as RechartsRadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { toDataArray, toSafeText, toSafeOptionalText } from "./registry-values";
import type { Components } from "@json-render/react";
import type { catalog } from "./catalog";

// ── Chart helpers ─────────────────────────────────────────────
const PIE_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function processChartData(
	items: Array<Record<string, unknown>>,
	xKey: string,
	yKey: string,
	aggregate: "sum" | "count" | "avg" | null | undefined,
): { items: Array<Record<string, unknown>>; valueKey: string } {
	if (items.length === 0) {
		return { items: [], valueKey: yKey };
	}
	if (!aggregate) {
		const formatted = items.map((item) => ({ ...item, label: String(item[xKey] ?? "") }));
		return { items: formatted, valueKey: yKey };
	}
	const groups = new Map<string, Array<Record<string, unknown>>>();
	for (const item of items) {
		const groupKey = String(item[xKey] ?? "unknown");
		const group = groups.get(groupKey) ?? [];
		group.push(item);
		groups.set(groupKey, group);
	}
	const valueKey = aggregate === "count" ? "count" : yKey;
	const aggregated: Array<Record<string, unknown>> = [];
	const sortedKeys = Array.from(groups.keys()).sort();
	for (const key of sortedKeys) {
		const group = groups.get(key)!;
		let value: number;
		if (aggregate === "count") {
			value = group.length;
		} else if (aggregate === "sum") {
			value = group.reduce((sum, item) => {
				const v = item[yKey];
				return sum + (typeof v === "number" ? v : parseFloat(String(v)) || 0);
			}, 0);
		} else {
			const sum = group.reduce((s, item) => {
				const v = item[yKey];
				return s + (typeof v === "number" ? v : parseFloat(String(v)) || 0);
			}, 0);
			value = group.length > 0 ? sum / group.length : 0;
		}
		aggregated.push({ label: key, [valueKey]: value });
	}
	return { items: aggregated, valueKey };
}

export const chartComponents = {
	// ── Charts ─────────────────────────────────────
	BarChart: ({ props }) => {
		const { xKey, yKey, aggregate, color, height } = props;
		const title = toSafeOptionalText(props.title);
		const rawData = toDataArray(props.data);
		const { items, valueKey } = processChartData(rawData, xKey, yKey, aggregate);
		const fillColor = color ?? "var(--color-chart-1)";
		const config: ChartConfig = { [valueKey]: { label: valueKey, color: fillColor } };
		return (
			<div>
				{title ? <p className="mb-2 text-sm font-medium text-text">{title}</p> : null}
				<ChartContainer config={config} className="min-h-[200px] w-full" style={height ? { height } : undefined}>
					<RechartsBarChart data={items}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey={aggregate ? "label" : xKey} tick={{ fontSize: 12 }} />
						<YAxis tick={{ fontSize: 12 }} />
						<ChartTooltip content={<ChartTooltipContent />} />
						<Bar dataKey={valueKey} fill={fillColor} radius={[4, 4, 0, 0]} />
					</RechartsBarChart>
				</ChartContainer>
			</div>
		);
	},

	LineChart: ({ props }) => {
		const { xKey, yKey, aggregate, color, height } = props;
		const title = toSafeOptionalText(props.title);
		const rawData = toDataArray(props.data);
		const { items, valueKey } = processChartData(rawData, xKey, yKey, aggregate);
		const strokeColor = color ?? "var(--color-chart-1)";
		const config: ChartConfig = { [valueKey]: { label: valueKey, color: strokeColor } };
		return (
			<div>
				{title ? <p className="mb-2 text-sm font-medium text-text">{title}</p> : null}
				<ChartContainer config={config} className="min-h-[200px] w-full" style={height ? { height } : undefined}>
					<RechartsLineChart data={items}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey={aggregate ? "label" : xKey} tick={{ fontSize: 12 }} />
						<YAxis tick={{ fontSize: 12 }} />
						<ChartTooltip content={<ChartTooltipContent />} />
						<Line type="monotone" dataKey={valueKey} stroke={strokeColor} strokeWidth={2} dot={false} />
					</RechartsLineChart>
				</ChartContainer>
			</div>
		);
	},

	PieChart: ({ props }) => {
		const { nameKey, valueKey, height } = props;
		const title = toSafeOptionalText(props.title);
		const rawData = toDataArray(props.data);
		const config: ChartConfig = {};
		for (let i = 0; i < rawData.length; i++) {
			const name = String(rawData[i][nameKey] ?? `item-${i}`);
			config[name] = { label: name, color: PIE_COLORS[i % PIE_COLORS.length] };
		}
		return (
			<div>
				{title ? <p className="mb-2 text-sm font-medium text-text">{title}</p> : null}
				<ChartContainer config={config} className="min-h-[200px] w-full" style={height ? { height } : undefined}>
					<RechartsPieChart>
						<ChartTooltip content={<ChartTooltipContent />} />
						<Pie data={rawData} nameKey={nameKey} dataKey={valueKey} cx="50%" cy="50%" outerRadius={80} label>
							{rawData.map((entry, i: number) => (
								<Cell key={String(entry[nameKey] ?? i)} fill={PIE_COLORS[i % PIE_COLORS.length]} />
							))}
						</Pie>
					</RechartsPieChart>
				</ChartContainer>
			</div>
		);
	},

	// ── Charts (extended) ─────────────────────────
	AreaChart: ({ props }) => {
		const { xKey, yKey, aggregate, color, height } = props;
		const title = toSafeOptionalText(props.title);
		const rawData = toDataArray(props.data);
		const { items, valueKey } = processChartData(rawData, xKey, yKey, aggregate);
		const fillColor = color ?? "var(--color-chart-1)";
		const config: ChartConfig = { [valueKey]: { label: valueKey, color: fillColor } };
		return (
			<div>
				{title ? <p className="mb-2 text-sm font-medium text-text">{title}</p> : null}
				<ChartContainer config={config} className="min-h-[200px] w-full" style={height ? { height } : undefined}>
					<RechartsAreaChart data={items}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey={aggregate ? "label" : xKey} tick={{ fontSize: 12 }} />
						<YAxis tick={{ fontSize: 12 }} />
						<ChartTooltip content={<ChartTooltipContent />} />
						<Area type="monotone" dataKey={valueKey} stroke={fillColor} fill={fillColor} fillOpacity={0.2} strokeWidth={2} />
					</RechartsAreaChart>
				</ChartContainer>
			</div>
		);
	},

	RadarChart: ({ props }) => {
		const { data, dataKey, categories, colors } = props;
		const title = toSafeOptionalText(props.title);
		const config: ChartConfig = {};
		for (let i = 0; i < categories.length; i++) {
			config[categories[i]] = { label: toSafeText(categories[i]), color: colors?.[i] ?? PIE_COLORS[i % PIE_COLORS.length] };
		}
		return (
			<div>
				{title ? <p className="mb-2 text-sm font-medium text-text">{title}</p> : null}
				<ChartContainer config={config} className="min-h-[200px] w-full">
					<RechartsRadarChart data={data as Record<string, unknown>[]}>
						<PolarGrid />
						<PolarAngleAxis dataKey={dataKey} tick={{ fontSize: 12 }} />
						<PolarRadiusAxis tick={{ fontSize: 10 }} />
						<ChartTooltip content={<ChartTooltipContent />} />
						{categories.map((cat: string, i: number) => (
							<Radar key={cat} name={cat} dataKey={cat} stroke={colors?.[i] ?? PIE_COLORS[i % PIE_COLORS.length]} fill={colors?.[i] ?? PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.2} />
						))}
					</RechartsRadarChart>
				</ChartContainer>
			</div>
		);
	},
} satisfies Partial<Components<typeof catalog>>;
