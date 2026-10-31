import { token } from "@/lib/tokens";
import type { JiraIssuePriority } from "./types";
import { PRIORITY_ICONS } from "./priority-model";

export function ButterPriorityIcon({ priority }: Readonly<{ priority: JiraIssuePriority }>) {
	const Glyph = PRIORITY_ICONS[priority];
	return (
		<Glyph
			label={`${priority} priority`}
			size="small"
			color={token(priority === "critical" ? "color.icon.danger" : "color.icon.subtle")}
		/>
	);
}
