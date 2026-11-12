import type { AgentBrowserSidebarGroup } from "@/components/blocks/agent-browser";

export const DEFAULT_TOOL_DIRECTORY_SIDEBAR_GROUPS: readonly AgentBrowserSidebarGroup[] = [
	{
		title: "By companies",
		agentIds: [
			"atlassian",
			"google-drive",
			"github-copilot",
			"slack",
			"asana",
			"servicenow",
			"salesforce",
			"miro",
			"sentry",
			"outlook",
			"stripe",
		],
	},
];
