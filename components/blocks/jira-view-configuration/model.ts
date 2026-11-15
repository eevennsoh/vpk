import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import FlagIcon from "@atlaskit/icon/core/flag";
import PersonIcon from "@atlaskit/icon/core/person";
import PriorityHighestIcon from "@atlaskit/icon/core/priority-highest";
import StatusInformationIcon from "@atlaskit/icon/core/status-information";
import TagIcon from "@atlaskit/icon/core/tag";
import TaskIcon from "@atlaskit/icon/core/task";

export const DONE_OPTIONS = [
	{ value: "never", label: "Never" },
	{ value: "1-day", label: "1 day" },
	{ value: "7-days", label: "7 days" },
	{ value: "14-days", label: "14 days" },
	{ value: "30-days", label: "30 days" },
] as const;

export const MUTE_OPTIONS = [
	{ value: "1-day", label: "1 day" },
	{ value: "2-days", label: "2 days" },
	{ value: "3-days", label: "3 days" },
	{ value: "4-days", label: "4 days" },
	{ value: "5-days", label: "5 days" },
	{ value: "6-days", label: "6 days" },
	{ value: "7-days", label: "7 days" },
	{ value: "1-week", label: "1 week" },
	{ value: "2-weeks", label: "2 weeks" },
	{ value: "3-weeks", label: "3 weeks" },
	{ value: "4-weeks", label: "4 weeks" },
] as const;

export const FIELDS = [
	{ value: "agent-sessions", label: "Agent sessions", icon: AiAgentIcon },
	{ value: "assignee", label: "Assignee", icon: PersonIcon },
	{ value: "development", label: "Development", icon: AngleBracketsIcon },
	{ value: "due-date", label: "Due date", icon: CalendarIcon },
	{ value: "flagged", label: "Flagged", icon: FlagIcon },
	{ value: "work-type", label: "Work type", icon: TaskIcon },
	{ value: "priority", label: "Priority", icon: PriorityHighestIcon },
	{ value: "status", label: "Status", icon: StatusInformationIcon },
	{ value: "labels", label: "Labels", icon: TagIcon },
] as const;

export type JiraViewConfigurationField = (typeof FIELDS)[number]["value"];
export type JiraViewConfigurationValue = {
	doneAfter: (typeof DONE_OPTIONS)[number]["value"];
	muteAgentSessionsAfter: (typeof MUTE_OPTIONS)[number]["value"];
	columnWidth: "flexible" | "fixed";
	scrollMode: "columns" | "board";
	visibleFieldIds: readonly JiraViewConfigurationField[];
};

export const DEFAULT_JIRA_VIEW_CONFIGURATION: JiraViewConfigurationValue = {
	doneAfter: "14-days",
	muteAgentSessionsAfter: "1-week",
	columnWidth: "flexible",
	scrollMode: "columns",
	visibleFieldIds: ["agent-sessions", "assignee", "development", "due-date", "flagged"],
};
