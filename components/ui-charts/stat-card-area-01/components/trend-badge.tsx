"use client";

import ArrowDownIcon from "@atlaskit/icon/core/arrow-down";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TrendBadge({
	value,
	className,
}: {
	value: number;
	className?: string;
}) {
	const positive = value >= 0;
	const Icon = positive ? ArrowUpIcon : ArrowDownIcon;

	return (
		<Badge
			className={cn(className)}
			variant={positive ? "success" : "danger"}
		>
			<Icon color="currentColor" label="" size="small" data-icon="inline-start" />
			{positive ? "+" : ""}
			{value.toFixed(1)}%
		</Badge>
	);
}
