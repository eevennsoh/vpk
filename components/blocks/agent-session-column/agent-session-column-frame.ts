/**
 * In-flow well framing. Independent of KanbanColumnChrome so this block
 * never imports jira-kanban.
 *
 * `"enclosed"` — header is a child of the well (default kanban chrome),
 * expanded and collapsed. Gutter rest stays unframed. `"caption"` — header
 * sits on the host surface above the well (simple).
 */
export type AgentSessionColumnFrame = "enclosed" | "caption";

export type AgentSessionColumnLayout = "panel" | AgentSessionColumnFrame;

/**
 * Standalone hosts keep today's header-outside look. Boards overwrite
 * `columnFrame` from `chrome.headerFrame` after spreading config.
 */
export const DEFAULT_AGENT_SESSION_COLUMN_FRAME: AgentSessionColumnFrame = "caption";

export function resolveAgentSessionColumnLayout(
	headerSurface: "column" | "panel" = "column",
	columnFrame: AgentSessionColumnFrame = DEFAULT_AGENT_SESSION_COLUMN_FRAME,
): AgentSessionColumnLayout {
	switch (headerSurface) {
		case "panel":
			return "panel";
		case "column":
			return columnFrame;
		default: {
			const exhaustive: never = headerSurface;
			return exhaustive;
		}
	}
}
