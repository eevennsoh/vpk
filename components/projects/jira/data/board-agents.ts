import type { JiraKanbanAgentData } from "@/components/blocks/jira-kanban";

export type { JiraKanbanAgentData as BoardAgentData } from "@/components/blocks/jira-kanban";

export const BOARD_AGENTS: readonly JiraKanbanAgentData[] = [
	{
		id: "github-copilot",
		name: "GitHub Copilot",
		byline: "Agent by GitHub",
		brandName: "github",
	},
	{
		id: "readiness-checker",
		name: "Readiness Checker",
		byline: "Rovo agent by Enterprise Solutions",
		avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
	},
	{
		id: "figma",
		name: "Figma",
		byline: "by Figma",
		brandName: "figma",
	},
	{
		id: "canva",
		name: "Canva",
		byline: "by Canva",
		brandName: "canva",
	},
	{
		id: "code-reviewer",
		name: "Code Reviewer",
		byline: "Dev agent by Atlassian",
		avatarSrc: "/avatar-agent-new/lime/auto-review.svg",
	},
	{
		id: "pipeline-troubleshooter",
		name: "Pipeline Troubleshooter",
		byline: "Dev agent by Atlassian",
		avatarSrc: "/avatar-agent-new/lime/ops-agent.svg",
	},
	{
		id: "meeting-insights-reporter",
		name: "Meeting Insights Reporter",
		byline: "Teamwork agent by Atlassian",
		avatarSrc: "/avatar-agent-new/blue/comms-drafter.svg",
	},
	{
		id: "product-requirements-guide",
		name: "Product Requirements Guide",
		byline: "Teamwork agent by Atlassian",
		avatarSrc: "/avatar-agent-new/blue/product-requirements.svg",
	},
	{
		id: "feedback-analyzer",
		name: "Feedback Analyzer",
		byline: "Product agent by Atlassian",
		avatarSrc: "/avatar-agent-new/purple/customer-insight.svg",
	},
	{
		id: "notion",
		name: "Notion",
		byline: "by Notion",
		brandName: "notion",
	},
	{
		id: "slack",
		name: "Slack",
		byline: "by Slack",
		brandName: "slack",
	},
	{
		id: "google-drive",
		name: "Google Drive",
		byline: "by Google",
		brandName: "google-drive",
	},
] as const;
