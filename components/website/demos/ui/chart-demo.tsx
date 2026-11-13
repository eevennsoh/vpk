import { TrendingUpIcon } from "@/components/ui/vpk-icons";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Label, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, RadialBar, RadialBarChart, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export default function ChartDemo() {
	return (
		<div className="flex flex-col items-center gap-2">
			<div className="flex h-20 items-end gap-1">
				{[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
					/* preview-inline-style-allowed: dynamic chart bar height from mapped sample data */
					<div
						key={i}
						className="w-4 rounded-t bg-primary transition-all"
						style={{ height: `${h}%` }}
					/>
				))}
			</div>
			<span className="text-xs text-muted-foreground">Chart</span>
		</div>
	);
}

export function ChartDemoAreaChart() {
	const chartData = [
		{ month: "January", desktop: 186 },
		{ month: "February", desktop: 305 },
		{ month: "March", desktop: 237 },
		{ month: "April", desktop: 73 },
		{ month: "May", desktop: 209 },
		{ month: "June", desktop: 214 },
	];

	const chartConfig = {
		desktop: {
			label: "Desktop",
			color: "var(--color-chart-1)",
		},
	} satisfies ChartConfig;

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Area Chart</CardTitle>
				<CardDescription>
					Showing total visitors for the last 6 months
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<AreaChart
						accessibilityLayer
						data={chartData}
						margin={{
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="month"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(value) => value.slice(0, 3)}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="line" />}
						/>
						<Area
							dataKey="desktop"
							type="natural"
							fill="var(--color-desktop)"
							fillOpacity={0.4}
							stroke="var(--color-desktop)"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
			<CardFooter>
				<div className="flex w-full items-start gap-2">
					<div className="grid gap-2">
						<div className="flex items-center gap-2 leading-none font-medium">
							Trending up by 5.2% this month{" "}
							<TrendingUpIcon className="size-4" />
						</div>
						<div className="text-muted-foreground flex items-center gap-2 leading-none">
							January - June 2024
						</div>
					</div>
				</div>
			</CardFooter>
		</Card>
	);
}

export function ChartDemoBarChart() {
	const chartData = [
		{ month: "January", desktop: 186, mobile: 80 },
		{ month: "February", desktop: 305, mobile: 200 },
		{ month: "March", desktop: 237, mobile: 120 },
		{ month: "April", desktop: 73, mobile: 190 },
		{ month: "May", desktop: 209, mobile: 130 },
		{ month: "June", desktop: 214, mobile: 140 },
	];

	const chartConfig = {
		desktop: {
			label: "Desktop",
			color: "var(--color-chart-1)",
		},
		mobile: {
			label: "Mobile",
			color: "var(--color-chart-2)",
		},
	} satisfies ChartConfig;

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Bar Chart - Multiple</CardTitle>
				<CardDescription>January - June 2024</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<BarChart accessibilityLayer data={chartData}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="month"
							tickLine={false}
							tickMargin={10}
							axisLine={false}
							tickFormatter={(value) => value.slice(0, 3)}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dashed" />}
						/>
						<Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
						<Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="flex-col items-start gap-2">
				<div className="flex gap-2 leading-none font-medium">
					Trending up by 5.2% this month{" "}
					<TrendingUpIcon className="size-4" />
				</div>
				<div className="text-muted-foreground leading-none">
					Showing total visitors for the last 6 months
				</div>
			</CardFooter>
		</Card>
	);
}

export function ChartDemoDefault() {
	const data = [
		{ month: "Jan", value: 186 },
		{ month: "Feb", value: 305 },
		{ month: "Mar", value: 237 },
		{ month: "Apr", value: 73 },
		{ month: "May", value: 209 },
		{ month: "Jun", value: 214 },
	];

	const config = {
		value: {
			label: "Value",
			color: "var(--color-chart-1)",
		},
	} satisfies ChartConfig;

	return (
		<ChartContainer config={config} className="h-48 w-full max-w-md">
			<BarChart data={data}>
				<XAxis dataKey="month" tickLine={false} axisLine={false} />
				<ChartTooltip content={<ChartTooltipContent />} />
				<Bar dataKey="value" fill="var(--color-value)" radius={4} />
			</BarChart>
		</ChartContainer>
	);
}

export function ChartDemoLineChart() {
	const chartData = [
		{ month: "January", desktop: 186, mobile: 80 },
		{ month: "February", desktop: 305, mobile: 200 },
		{ month: "March", desktop: 237, mobile: 120 },
		{ month: "April", desktop: 73, mobile: 190 },
		{ month: "May", desktop: 209, mobile: 130 },
		{ month: "June", desktop: 214, mobile: 140 },
	];

	const chartConfig = {
		desktop: {
			label: "Desktop",
			color: "var(--color-chart-1)",
		},
		mobile: {
			label: "Mobile",
			color: "var(--color-chart-2)",
		},
	} satisfies ChartConfig;

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Line Chart - Multiple</CardTitle>
				<CardDescription>January - June 2024</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<LineChart
						accessibilityLayer
						data={chartData}
						margin={{
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="month"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(value) => value.slice(0, 3)}
						/>
						<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
						<Line
							dataKey="desktop"
							type="monotone"
							stroke="var(--color-desktop)"
							strokeWidth={2}
							dot={false}
						/>
						<Line
							dataKey="mobile"
							type="monotone"
							stroke="var(--color-mobile)"
							strokeWidth={2}
							dot={false}
						/>
					</LineChart>
				</ChartContainer>
			</CardContent>
			<CardFooter>
				<div className="flex w-full items-start gap-2">
					<div className="grid gap-2">
						<div className="flex items-center gap-2 leading-none font-medium">
							Trending up by 5.2% this month{" "}
							<TrendingUpIcon className="size-4" />
						</div>
						<div className="text-muted-foreground flex items-center gap-2 leading-none">
							Showing total visitors for the last 6 months
						</div>
					</div>
				</div>
			</CardFooter>
		</Card>
	);
}

export function ChartDemoRadarChart() {
	const chartData = [
		{ month: "January", desktop: 186, mobile: 80 },
		{ month: "February", desktop: 305, mobile: 200 },
		{ month: "March", desktop: 237, mobile: 120 },
		{ month: "April", desktop: 73, mobile: 190 },
		{ month: "May", desktop: 209, mobile: 130 },
		{ month: "June", desktop: 214, mobile: 140 },
	];

	const chartConfig = {
		desktop: {
			label: "Desktop",
			color: "var(--color-chart-1)",
		},
		mobile: {
			label: "Mobile",
			color: "var(--color-chart-2)",
		},
	} satisfies ChartConfig;

	return (
		<Card className="w-full">
			<CardHeader className="items-center pb-4">
				<CardTitle>Radar Chart - Multiple</CardTitle>
				<CardDescription>
					Showing total visitors for the last 6 months
				</CardDescription>
			</CardHeader>
			<CardContent className="pb-0">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square max-h-[250px]"
				>
					<RadarChart data={chartData}>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="line" />}
						/>
						<PolarAngleAxis dataKey="month" />
						<PolarGrid />
						<Radar
							dataKey="desktop"
							fill="var(--color-desktop)"
							fillOpacity={0.6}
						/>
						<Radar dataKey="mobile" fill="var(--color-mobile)" />
					</RadarChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="flex-col gap-2">
				<div className="flex items-center gap-2 leading-none font-medium">
					Trending up by 5.2% this month{" "}
					<TrendingUpIcon className="size-4" />
				</div>
				<div className="text-muted-foreground flex items-center gap-2 leading-none">
					January - June 2024
				</div>
			</CardFooter>
		</Card>
	);
}

export function ChartDemoRadialChart() {
	const chartData = [
		{ browser: "safari", visitors: 1260, fill: "var(--color-safari)" },
	];

	const chartConfig = {
		visitors: {
			label: "Visitors",
		},
		safari: {
			label: "Safari",
			color: "var(--color-chart-2)",
		},
	} satisfies ChartConfig;

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Radial Chart - Shape</CardTitle>
				<CardDescription>January - June 2024</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square max-h-[210px]"
				>
					<RadialBarChart
						data={chartData}
						endAngle={100}
						innerRadius={80}
						outerRadius={140}
					>
						<PolarGrid
							gridType="circle"
							radialLines={false}
							stroke="none"
							className="first:fill-muted last:fill-background"
							polarRadius={[86, 74]}
						/>
						<RadialBar dataKey="visitors" background />
						<PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
							<Label
								content={({ viewBox }) => {
									if (viewBox && "cx" in viewBox && "cy" in viewBox) {
										return (
											<text
												x={viewBox.cx}
												y={viewBox.cy}
												textAnchor="middle"
												dominantBaseline="middle"
											>
												<tspan
													x={viewBox.cx}
													y={viewBox.cy}
													className="fill-foreground text-4xl font-bold"
												>
													{chartData[0].visitors.toLocaleString("en-US")}
												</tspan>
												<tspan
													x={viewBox.cx}
													y={(viewBox.cy || 0) + 24}
													className="fill-muted-foreground"
												>
													Visitors
												</tspan>
											</text>
										);
									}
								}}
							/>
						</PolarRadiusAxis>
					</RadialBarChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="flex-col gap-2">
				<div className="flex items-center gap-2 leading-none font-medium">
					Trending up by 5.2% this month{" "}
					<TrendingUpIcon className="size-4" />
				</div>
				<div className="text-muted-foreground leading-none">
					Showing total visitors for the last 6 months
				</div>
			</CardFooter>
		</Card>
	);
}

export function ChartDemoWithLegend() {
	const data = [
		{ month: "Jan", desktop: 186, mobile: 80 },
		{ month: "Feb", desktop: 305, mobile: 200 },
		{ month: "Mar", desktop: 237, mobile: 120 },
		{ month: "Apr", desktop: 73, mobile: 190 },
		{ month: "May", desktop: 209, mobile: 130 },
		{ month: "Jun", desktop: 214, mobile: 140 },
	];

	const config = {
		desktop: {
			label: "Desktop",
			color: "var(--color-chart-1)",
		},
		mobile: {
			label: "Mobile",
			color: "var(--color-chart-2)",
		},
	} satisfies ChartConfig;

	return (
		<ChartContainer config={config} className="h-64 w-full max-w-md">
			<BarChart data={data}>
				<XAxis dataKey="month" tickLine={false} axisLine={false} />
				<ChartTooltip content={<ChartTooltipContent />} />
				<ChartLegend content={<ChartLegendContent />} />
				<Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
				<Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
			</BarChart>
		</ChartContainer>
	);
}
