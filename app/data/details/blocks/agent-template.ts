import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_TEMPLATE_DETAIL: ComponentDetail = {
		apiName: "AgentTemplateDialog",
		description: "Strategy-style dialog for browsing personal agent templates with category controls and a horizontal template carousel.",
		importStatement: `import { AgentTemplateDialog } from "@/components/blocks/agent-template";`,
		usage: `import { AgentTemplateDialog } from "@/components/blocks/agent-template";
import type { AgentTemplateAgent } from "@/components/blocks/agent-template";

// Cards render via EntityCardAgentExpandedCard. The detail fields below are
// optional — omit them and the card falls back to identity + a derived publisher.
const agents: AgentTemplateAgent[] = [
  {
    id: "feedback-analyzer",
    name: "Feedback Analyzer",
    byline: "Product agent by Atlassian",
    avatarSrc: "/avatar-agent-new/purple/customer-insight.svg",
    description: "Clusters customer feedback and surfaces themes.",
    verified: true,
    capabilities: [
      "Surfaces recurring themes from raw feedback",
      "Scores sentiment shifts across releases",
      "Drafts a weekly digest for your team",
    ],
    sources: [
      { id: "jira", label: "Jira", provider: "jira" },
      { id: "confluence", label: "Confluence", provider: "confluence" },
    ],
    skills: [
      { color: "software", label: "jql-search" },
      { color: "teamwork", label: "theme-grouping" },
    ],
    stats: [
      { label: "Remix", value: "1.4K" },
      { label: "Last update", value: "2 weeks ago" },
    ],
  },
];

<AgentTemplateDialog
  open={open}
  onOpenChange={setOpen}
  agents={agents}
  onSelectAgent={(agent) => console.log(agent.id)}
/>`,
		demoLayout: { previewHeight: "fixed" },
		props: [
			{
				name: "agents",
				type: "readonly AgentTemplateAgent[]",
				required: true,
				description: "Base template cards shown in the carousel.",
			},
			{
				name: "sessionAgents",
				type: "readonly AgentTemplateAgent[]",
				description: "Runtime-created templates appended to the catalog.",
			},
			{
				name: "open",
				type: "boolean",
				required: true,
				description: "Controlled dialog open state.",
			},
			{
				name: "onOpenChange",
				type: "(open: boolean) => void",
				required: true,
				description: "Called when the dialog requests an open-state change.",
			},
			{
				name: "onSelectAgent",
				type: "(agent: AgentTemplateAgent) => void",
				description: "Called when a template card is selected.",
			},
			{
				name: "sidebarGroups",
				type: "readonly AgentTemplateSidebarGroup[]",
				description: "Accepted for compatibility; ignored by this layout because it has no sidebar.",
			},
			{
				name: "title",
				type: "string",
				description: "Optional dialog heading. Defaults to the Strategy heading copy.",
			},
		],
	};
