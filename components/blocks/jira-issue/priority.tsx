import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { JiraIssuePriority } from "./types";
import { PRIORITY_COLORS, PRIORITY_ICONS } from "./priority-model";

export function ButterPriorityIcon({ priority, appearance = "colored" }: Readonly<{ priority: JiraIssuePriority; appearance?: "colored" | "on-hover" }>) {
	const Glyph = PRIORITY_ICONS[priority];
	const style: CSSProperties & { "--priority-icon-color": string } = { "--priority-icon-color": PRIORITY_COLORS[priority] };
	return (
		<span
			className={cn("inline-flex shrink-0", appearance === "on-hover"
				? "text-icon-subtle group-hover/jira-issue:text-(--priority-icon-color) group-focus-within/jira-issue:text-(--priority-icon-color)"
				: "text-(--priority-icon-color)")}
			style={style}
		>
			<Glyph label={`${priority} priority`} size="small" color="currentColor" />
		</span>
	);
}
