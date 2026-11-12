import type { AgentBrowserSidebarGroup } from "@/components/blocks/agent-browser";

export const DEFAULT_AGENT_TEMPLATE_SIDEBAR_GROUPS: readonly AgentBrowserSidebarGroup[] = [
	{
		title: "Favourites",
		agentIds: ["feedback-analyzer", "ai-insights-agent"],
	},
	{
		title: "By teams",
		showAll: true,
		items: [
			{
				id: "product-experience",
				label: "Product Experience",
				avatarSrc: "/avatar-project/compass.svg",
			},
			{
				id: "platform-engineering",
				label: "Platform Engineering",
				avatarSrc: "/avatar-project/code.svg",
			},
			{
				id: "customer-success",
				label: "Customer Success",
				avatarSrc: "/avatar-project/service-bell.svg",
			},
			{
				id: "revenue-operations",
				label: "Revenue Operations",
				avatarSrc: "/avatar-project/graph.svg",
			},
			{
				id: "security-and-trust",
				label: "Security & Trust",
				avatarSrc: "/avatar-project/shield.svg",
			},
		],
	},
	{
		title: "By companies",
		showAll: true,
		agentIds: ["atlassian", "google-drive", "github-copilot", "slack", "notion"],
	},
];
