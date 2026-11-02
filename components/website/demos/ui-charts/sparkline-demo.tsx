"use client";

import { AreaSparkline, BarSparkline, LineSparkline, useSparklineHover } from "@/components/ui-charts/sparkline";

const data = [18, 23, 21, 32, 28, 39, 35, 45, 41, 52, 49, 60];

export function SparklineDemoDefault() {
	const hover = useSparklineHover<number>();
	return (
		<div className="flex w-full max-w-md flex-col gap-6 p-6">
			<div className="flex items-center justify-between text-sm text-text-subtle">
				<span>Weekly activity</span>
				<span className="font-medium tabular-nums text-text">{hover.datum ?? data.at(-1)}</span>
			</div>
			<LineSparkline aria-label="Weekly activity, line trend" data={data} dataKey={(value) => value} endDot height={48} {...hover.sparklineProps} />
			<AreaSparkline aria-label="Weekly activity, area trend" color="var(--chart-2)" data={data} dataKey={(value) => value} height={48} {...hover.sparklineProps} />
			<BarSparkline aria-label="Weekly activity, bar trend" color="var(--chart-3)" data={data} dataKey={(value) => value} height={48} {...hover.sparklineProps} />
		</div>
	);
}

export default SparklineDemoDefault;
