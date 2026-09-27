import type { JiraKanbanAssigneeData } from "@/components/blocks/jira-kanban";

export const JIRA_TEAM_EU26_HEADER_AGENT_ASSIGNEES = [
	{ id: "claude-code", name: "Claude", avatarSrc: "/illustration/agent-lanyard/claude.svg" },
	{ id: "review-agent", name: "Jira Coding Agent", avatarSrc: "/1p/agent-lanyard/glyph-jira-coding.svg" },
	{ id: "test-agent", name: "Cursor", avatarSrc: "/illustration/agent-lanyard/cursor.svg" },
] as const satisfies readonly JiraKanbanAssigneeData[];
