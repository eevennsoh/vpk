import ChartBarIcon from "@atlaskit/icon/core/chart-bar";
import PageIcon from "@atlaskit/icon/core/page";
import ProjectIcon from "@atlaskit/icon/core/project";

import type { ArtifactListItem } from "@/components/ui-custom/artifact-list";

// Mirrors the Figma node "Search — Smart link / Card view mini". The third row
// demonstrates the logo variant; the repo ships no `google-sheets` 3P asset, so
// it uses the available `google-drive` mark.
export const SAMPLE_ARTIFACT_ITEMS: readonly ArtifactListItem[] = [
	{
		id: "audience-engagement-report",
		title: "Audience Engagement Report",
		source: "Confluence page",
		owner: "Vitafleet Team",
		icon: <PageIcon label="" />,
		tileVariant: "blueSubtle",
	},
	{
		id: "engagement-data",
		title: "Engagement data",
		source: "Analytics",
		owner: "Vitafleet Team",
		icon: <ChartBarIcon label="" />,
		tileVariant: "greenSubtle",
	},
	{
		id: "content-variation-analysis",
		title: "Content Variation Analysis",
		source: "Google Spreadsheet",
		owner: "Vitafleet Team",
		logoName: "google-drive",
	},
	{
		id: "improve-lead-conversion",
		title: "Improve lead conversion rate by 15%",
		source: "Projects",
		owner: "Vitafleet Team",
		icon: <ProjectIcon label="" />,
		tileVariant: "purpleSubtle",
	},
	{
		id: "hr-policy-assistant",
		title: "HR Policy Assistant",
		source: "Rovo agent",
		owner: "Vitafleet Team",
		avatarSrc: "/avatar-agent-new/blue/team-connection.svg",
	},
];

export const COMPACT_SAMPLE_ARTIFACT_ITEMS: readonly ArtifactListItem[] = [
	{
		id: "vertexrail-assets-positioning-pr",
		title: "VertexRail Assets positioning",
		source: "GitHub pull request",
		logoName: "github",
		pullRequest: {
			number: 1847,
			status: "Open",
			additions: 148,
			deletions: 37,
		},
	},
	{
		id: "audience-engagement-report-compact",
		title: "Audience Engagement Report",
		source: "Confluence page",
		owner: "Vitafleet Team",
		iconName: "globe",
	},
	{
		id: "chat-summary-compact",
		title: "Chat summary title",
		source: "A snippet of the chat summary",
		iconName: "ai-chat",
	},
];
