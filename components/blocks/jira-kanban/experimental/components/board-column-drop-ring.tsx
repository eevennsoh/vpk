import type { KanbanColumnChromeStyles } from "@/components/blocks/jira-kanban/column-chrome";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

/** Decorative drop feedback; the parent shell continues to own the hit area. */
export function BoardColumnDropRing({ chrome, collapsed = false, transition = "none" }: Readonly<{
	chrome: KanbanColumnChromeStyles;
	collapsed?: boolean;
	transition?: string;
}>) {
	return <div
		aria-hidden
		data-jira-kanban-column-drop-ring=""
		data-jira-kanban-collapsed-drop-ring={collapsed ? "" : undefined}
		className={cn("pointer-events-none absolute z-30", collapsed ? "-inset-0.5" : "-inset-x-0.5 -top-0.5", chrome.dropShellClassName)}
		style={{ borderRadius: token("radius.xlarge"), height: collapsed ? undefined : 0, transition }}
	/>;
}
