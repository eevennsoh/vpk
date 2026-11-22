import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeRelativeTimeLabel, toCompactRelativeTimeLabel } from "@/lib/elapsed-time";
import { cn } from "@/lib/utils";

export function JiraActivityTimestamp({ timestamp, content, icon, className }: Readonly<{
	timestamp?: string;
	content?: ReactNode;
	icon?: ReactNode;
	className?: string;
}>) {
	if (content === null || (content === undefined && !timestamp)) return null;
	const compact = timestamp ? toCompactRelativeTimeLabel(timestamp) : "";
	const detail = timestamp ? describeRelativeTimeLabel(timestamp) ?? timestamp : "";

	return (
		<span
			className={cn(
				"pointer-events-none inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-normal text-text-subtlest opacity-0",
				"group-hover/activity-timestamp:pointer-events-auto group-hover/activity-timestamp:opacity-100",
				"group-focus-visible/activity-timestamp:opacity-100 group-has-[:focus-visible]/activity-timestamp:pointer-events-auto group-has-[:focus-visible]/activity-timestamp:opacity-100",
				"[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
				className,
			)}
			data-slot="jira-activity-timestamp"
		>
			<span aria-hidden>·</span>
			{icon}
			{content !== undefined ? content : (
				<Tooltip>
					<TooltipTrigger render={<span className="rounded-sm underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} />}>
						{compact === timestamp ? compact : (
							<>
								<span className="sr-only">{timestamp}</span>
								<span aria-hidden>{compact}</span>
							</>
						)}
					</TooltipTrigger>
					<TooltipContent positionerClassName="z-[650]" role="tooltip" side="bottom">{detail}</TooltipContent>
				</Tooltip>
			)}
		</span>
	);
}
