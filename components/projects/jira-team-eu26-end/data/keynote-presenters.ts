import type { JiraKanbanAssigneeData } from "@/components/blocks/jira-kanban";
import { JIRA_TEAM_EU26_HEADER_AGENT_ASSIGNEES } from "@/components/projects/jira-team-eu26/data/header-agent-assignees";

export const JIRA_TEAM_EU26_END_PRESENTERS = {
	mike: { id: "mike", name: "MCB", avatarSrc: "/avatar-user/mike.png", initials: "MCB" },
	tamar: { id: "tamar", name: "Tamar", avatarSrc: "/avatar-user/tamar.png", initials: "TY" },
	sherif: { id: "sherif", name: "Sherif", avatarSrc: "/avatar-user/sherif.png", initials: "SM" },
	taroon: { id: "taroon", name: "Taroon", avatarSrc: "/avatar-user/taroon.png", initials: "TM" },
} as const satisfies Record<string, JiraKanbanAssigneeData & { initials: string }>;

export const JIRA_TEAM_EU26_END_HEADER_ASSIGNEES = [
	JIRA_TEAM_EU26_END_PRESENTERS.mike,
	JIRA_TEAM_EU26_END_PRESENTERS.tamar,
	JIRA_TEAM_EU26_END_PRESENTERS.sherif,
	JIRA_TEAM_EU26_END_PRESENTERS.taroon,
	...JIRA_TEAM_EU26_HEADER_AGENT_ASSIGNEES,
] as const;

export const JIRA_TEAM_EU26_END_SECTION_PRESENTERS = {
	Context: [JIRA_TEAM_EU26_END_PRESENTERS.mike, JIRA_TEAM_EU26_END_PRESENTERS.tamar],
	Collaboration: [JIRA_TEAM_EU26_END_PRESENTERS.mike, JIRA_TEAM_EU26_END_PRESENTERS.sherif],
	Confidence: [JIRA_TEAM_EU26_END_PRESENTERS.mike, JIRA_TEAM_EU26_END_PRESENTERS.taroon],
} as const;
