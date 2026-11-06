import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_DIRECTORY_DETAIL: ComponentDetail = {
		description: "Agent Directory for browsing recommended, verified, team, partner, and session-created agents, available as a page or dialog.",
		importStatement: `import { AgentDirectoryView, AgentsDirectoryDialog } from "@/components/blocks/agent-directory";`,
		usage: `import { AgentDirectoryView, AgentsDirectoryDialog } from "@/components/blocks/agent-directory";
import type { AgentsDirectoryAgent, AgentsDirectoryTemplateAgent } from "@/components/blocks/agent-directory";

const agents: AgentsDirectoryAgent[] = [
  {
    id: "feedback-analyzer",
    name: "Feedback Analyzer",
    byline: "Product agent by Atlassian",
    avatarSrc: "/avatar-agent-new/purple/customer-insight.svg",
    description: "Clusters customer feedback and surfaces themes.",
  },
];

const templates: AgentsDirectoryTemplateAgent[] = [];

<AgentDirectoryView
  agents={agents}
  templateAgents={templates}
  onSelectAgent={(agent) => console.log(agent.id)}
/>

<AgentsDirectoryDialog
  open={open}
  onOpenChange={setOpen}
  variant="standard-v2"
  agents={agents}
  templateAgents={templates}
  onCreateAgent={() => console.log("Create agent")}
  onSelectAgent={(agent) => console.log(agent.id)}
  onSelectTemplateAgent={(template) => console.log(template.id)}
/>`,
		demoLayout: { previewHeight: "fixed" },
		examples: [
			{
				title: "Standard directory v1",
				description: "The original sidebar directory with agent and template browsing.",
				demoSlug: "agent-directory-demo-standard",
			},
			{
				title: "Standard directory v2",
				description: "The latest directory with recommendations, categories, search, filters, and browse tabs.",
				demoSlug: "agent-directory-demo-standard-v2",
			},
			{
				title: "Experimental",
				description: "Dense browse layout with full-width search, sectioned rows, and searchable multi-select filters.",
				demoSlug: "agent-directory-demo-experimental",
			},
		],
		props: [
			{
				name: "agents",
				type: "readonly AgentsDirectoryAgent[]",
				required: true,
				description: "Base catalog agents shown in the directory.",
			},
			{
				name: "ownedAgentIds",
				type: "readonly string[]",
				description: "Agent IDs shown as owned by the current user in the page view. The dialog uses session agent IDs automatically.",
			},
			{
				name: "sessionAgents",
				type: "readonly AgentsDirectoryAgent[]",
				description: "Runtime-created agents appended to the catalog.",
			},
			{
				name: "templateAgents",
				type: "readonly AgentsDirectoryTemplateAgent[]",
				description: "Template catalog entries available in the directory.",
			},
			{
				name: "sessionTemplateAgents",
				type: "readonly AgentsDirectoryTemplateAgent[]",
				description: "Runtime-created template entries appended to the template catalog.",
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
				name: "onCreateAgent",
				type: "() => void",
				description: "Optional handler for the Create agent action.",
			},
			{
				name: "onSelectAgent",
				type: "(agent: AgentsDirectoryAgent) => void",
				description: "Called when an agent is selected or its primary action is used.",
			},
			{
				name: "onSelectTemplateAgent",
				type: "(agent: AgentsDirectoryTemplateAgent) => void",
				description: "Called when an agent template tile is selected.",
			},
			{
				name: "sidebarGroups",
				type: "readonly AgentsDirectorySidebarGroup[]",
				description: "Sidebar grouping override for v1 and experimental. Defaults to the Studio grouping.",
			},
			{
				name: "title",
				type: "string",
				description: "Optional dialog title. Defaults to “Browse agents” in v1 and “Agents” in v2.",
			},
			{
				name: "variant",
				type: "\"default\" | \"standard-v1\" | \"standard-v2\" | \"experimental\"",
				default: "\"default\"",
				description: "Choose standard directory v1, standard directory v2, or experimental. Default preserves v1.",
			},
		],
	};
