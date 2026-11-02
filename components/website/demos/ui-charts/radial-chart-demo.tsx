"use client";

import { RadialAxis } from "@/components/ui-charts/radial-axis";
import { RadialBar } from "@/components/ui-charts/radial-bar";
import { RadialCenter } from "@/components/ui-charts/radial-center";
import { RadialChart } from "@/components/ui-charts/radial-chart";
import { RadialLegend } from "@/components/ui-charts/radial-legend";

const series = [
	{ dataKey: "desktop", label: "Desktop" },
	{ dataKey: "mobile", label: "Mobile" },
];
const data = [
	{ month: "Jan", desktop: 186, mobile: 80 },
	{ month: "Feb", desktop: 305, mobile: 200 },
	{ month: "Mar", desktop: 237, mobile: 120 },
	{ month: "Apr", desktop: 173, mobile: 190 },
	{ month: "May", desktop: 209, mobile: 130 },
	{ month: "Jun", desktop: 214, mobile: 140 },
];

export function RadialChartDemoDefault() {
	return (
		<div className="w-full p-4">
			<RadialChart angleType="band" data={data} maxValue="stacked" maxWidth={360} series={series} xDataKey="month">
				<RadialBar />
				<RadialAxis showCircle={false} />
				<RadialCenter />
				<RadialLegend />
			</RadialChart>
		</div>
	);
}

export default RadialChartDemoDefault;
