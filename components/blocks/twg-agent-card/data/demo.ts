import type { TWGAgentSuggestion } from "@/components/blocks/twg-agent-card/components/twg-agent-card";
import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";

export const DEFAULT_TWG_AGENT_CARD_SOURCES = [
	{ id: "jira-product-discovery", label: "Jira Product Discovery", provider: "jira-product-discovery" },
	{ id: "jira", label: "Jira", provider: "jira" },
	{ id: "google-drive", label: "Google Drive", provider: "google-drive" },
	{ id: "confluence", label: "Confluence", provider: "confluence" },
	{ id: "jira-service-management", label: "Jira Service Management", provider: "jira-service-management" },
	{ id: "teams", label: "Microsoft Teams", provider: "teams" },
	{ id: "salesforce", label: "Salesforce", provider: "salesforce" },
] as const satisfies readonly TwgToolSource[];

export const DEFAULT_TWG_AGENT_CARD_SUGGESTIONS = [
	{
		id: "life-admin-agent",
		name: "Life Admin Agent",
		description: "Handles reminders, forms, and renewals.",
		avatarSrc: "/avatar-agent-new/yellow/ops-agent.svg",
	},
	{
		id: "relationship-rhythm-agent",
		name: "Relationship Rhythm Agent",
		description: "Drafts timely follow-ups.",
		avatarSrc: "/avatar-agent-new/lime/auto-dev.svg",
	},
	{
		id: "focus-recovery-agent",
		name: "Focus Recovery Agent",
		description: "Finds distraction patterns.",
		avatarSrc: "/avatar-agent-new/purple/product-requirements.svg",
	},
] as const satisfies readonly TWGAgentSuggestion[];
