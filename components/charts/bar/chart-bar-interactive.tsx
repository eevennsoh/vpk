"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { INTERACTIVE_CHART_DATA } from "@/components/charts/data/chart-data-interactive";

export const description = "An interactive bar chart";

const chartConfig = {
	views: {
		label: "Page Views",
	},
	desktop: {
		label: "Desktop",
		color: "var(--color-chart-2)",
	},
	mobile: {
		label: "Mobile",
		color: "var(--color-chart-1)",
	},
} satisfies ChartConfig;

export function ChartBarInteractive() {
	const [activeChart, setActiveChart] = useState<keyof typeof chartConfig>("desktop");

	const total = useMemo(
		() => ({
			desktop: INTERACTIVE_CHART_DATA.reduce((acc, curr) => acc + curr.desktop, 0),
			mobile: INTERACTIVE_CHART_DATA.reduce((acc, curr) => acc + curr.mobile, 0),
		}),
		[],
	);

	return (
		<Card className="py-0 h-full flex flex-col">
			<CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
				<div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:!py-0">
					<CardTitle>Bar Chart - Interactive</CardTitle>
					<CardDescription>Showing total visitors for the last 3 months</CardDescription>
				</div>
				<div className="flex">
					{["desktop", "mobile"].map((key) => {
						const chart = key as keyof typeof chartConfig;
						return (
							<button
								key={chart}
								type="button"
								data-active={activeChart === chart}
								className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
								onClick={() => setActiveChart(chart)}
							>
								<span className="text-muted-foreground text-xs">{chartConfig[chart].label}</span>
								<span className="text-lg leading-none font-bold sm:text-3xl">{total[key as keyof typeof total].toLocaleString("en-US")}</span>
							</button>
						);
					})}
				</div>
			</CardHeader>
			<CardContent className="px-2 sm:p-6 flex-1 min-h-0">
				<ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
					<BarChart
						accessibilityLayer
						data={INTERACTIVE_CHART_DATA}
						margin={{
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="date"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							tickFormatter={(value) => {
								const date = new Date(value);
								return date.toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
								});
							}}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									className="w-[150px]"
									nameKey="views"
									labelFormatter={(value) => {
										return new Date(value).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
											year: "numeric",
										});
									}}
								/>
							}
						/>
						<Bar dataKey={activeChart} fill={`var(--color-${activeChart})`} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
