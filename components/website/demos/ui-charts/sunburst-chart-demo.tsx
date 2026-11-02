"use client";

import { Button } from "@/components/ui/button";
import { SunburstBreadcrumb, useSunburstBreadcrumbItems } from "@/components/ui-charts/sunburst-breadcrumb";
import { SunburstCenter } from "@/components/ui-charts/sunburst-center";
import { SunburstChart, type SunburstNode } from "@/components/ui-charts/sunburst-chart";
import { SunburstHint } from "@/components/ui-charts/sunburst-hint";
import { SunburstLabels } from "@/components/ui-charts/sunburst-labels";
import { SunburstSegment } from "@/components/ui-charts/sunburst-segment";
import { buildArcs } from "@/components/ui-charts/sunburst";

const data: SunburstNode = {
	name: "Workspace",
	children: [
		{ name: "Product", children: [{ name: "Design", value: 24 }, { name: "Research", value: 16 }] },
		{ name: "Engineering", children: [{ name: "Platform", value: 32 }, { name: "Experience", value: 28 }] },
		{ name: "Operations", children: [{ name: "Support", value: 18 }, { name: "Enablement", value: 12 }] },
	],
};
const { arcs } = buildArcs(data);

function BreadcrumbItems() {
	const { items, zoomTo } = useSunburstBreadcrumbItems();
	return (
		<div className="flex flex-wrap justify-center gap-1">
			{items.map((item) => (
				<Button aria-current={item.isCurrent ? "location" : undefined} disabled={item.isCurrent} key={item.id} onClick={() => zoomTo(item.id)} size="compact" variant="ghost">{item.label}</Button>
			))}
		</div>
	);
}

export function SunburstChartDemoDefault() {
	return (
		<div className="flex w-full justify-center p-4">
			<SunburstChart data={data} size={360}>
				<SunburstBreadcrumb><BreadcrumbItems /></SunburstBreadcrumb>
				{arcs.map((arc) => <SunburstSegment index={arc.arcIndex} key={arc.id} />)}
				<SunburstLabels />
				<SunburstCenter />
				<SunburstHint />
			</SunburstChart>
		</div>
	);
}

export default SunburstChartDemoDefault;
