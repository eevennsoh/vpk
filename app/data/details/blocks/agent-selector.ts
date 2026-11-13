import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_SELECTOR_DETAIL: ComponentDetail = {
			description: "Searchable agent selectors for assigning agents. The default preview uses `InlineAgentSelector` to select a cloud agent directly; `AgentSelector` supports selected agents, optional actions, and browse/create actions.",
		importStatement: `import { InlineAgentSelector } from "@/components/blocks/agent-selector";`,
		usage: `import { InlineAgentSelector } from "@/components/blocks/agent-selector";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";

const agents: AgentSelectorAgent[] = [
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    byline: "Agent by GitHub",
    brandName: "github",
  },
];

<InlineAgentSelector
  agents={agents}
  softwareAgentIds={["github-copilot"]}
  getActions={(agent) => [{
    id: "start",
    label: "Start a new session",
    icon: null,
    onSelect: () => console.log(agent.id),
  }]}
  onBrowseAgents={() => console.log("browse agents")}
/>`,
		demoLayout: { previewHeight: "fixed", examplesContentWidth: "full" },
		examples: [
			{ title: "Include byline", description: "Show agent descriptions on hover or focus.", demoSlug: "agent-selector-demo-include-byline" },
			{ title: "Standalone picker", description: "Persistent standalone surfaces for the default and selected-agent action states.", demoSlug: "agent-selector-demo-standalone" },
			{ title: "Selected agent actions", description: "Top actions for a selected custom agent before switching to another agent.", demoSlug: "agent-selector-demo-selected-agent-actions" },
			{ title: "Jira kanban", description: "A Jira agent picker with Pinned by space and More agents groups. Pin an agent to keep it in the pinned group, or use the footer to browse or create agents.", demoSlug: "agent-selector-demo-jira" },
			{ id: "inline-expansion", title: "Inline expansion", description: "Choose cloud and local agent options from one picker using inline expansion. Import `InlineAgentSelector` from the Agent Selector package and supply each agent's actions with `getActions`; one action runs directly and multiple actions expand inline. Rovo CLI includes local workspace options. Favorites can be controlled with `favoriteAgentIds` and `onFavoriteAgentIdsChange`.", demoSlug: "agent-selector-demo-inline-expansion" },
		],
		subComponents: [{
			name: "InlineAgentSelector",
			description: "Select an agent directly when it has one action, or expand its actions inline when it has multiple choices.",
			props: [
				{ name: "agents", type: "readonly AgentSelectorAgent[]", required: true, description: "Agents to display." },
				{ name: "softwareAgentIds", type: "readonly string[]", required: true, description: "Agent IDs shown in the software agents group." },
				{ name: "getActions", type: "(agent: AgentSelectorAgent) => readonly InlineAgentAction[]", required: true, description: "Actions available for each agent." },
				{ name: "recommendedAgentId", type: "string", description: "Agent shown first with a Recommended label." },
				{ name: "onBrowseAgents", type: "() => void", description: "Shows the Browse agents action." },
				{ name: "onCreateAgent", type: "() => void", description: "Shows the Create agent action." },
			],
		}],
		props: [
			{
				name: "agents",
				type: "readonly AgentSelectorAgent[]",
				description: "Agents to render. Defaults to the complete Agent Directory catalog.",
			},
			{
				name: "pinnedAgentIds",
				type: "readonly string[]",
				description: "Controlled pinned agent ids. Pinned agents move into a separate Pinned section.",
			},
			{
				name: "pinningAppearance",
				type: '"pin" | "favorite"',
				default: '"pin"',
				description: "Choose pin or favorite-star labels and icons for saved agents.",
			},
			{
				name: "onPinnedAgentIdsChange",
				type: "(agentIds: readonly string[]) => void",
				description: "Called when an agent is pinned or unpinned.",
			},
			{
				name: "selectedAgentIds",
				type: "readonly string[]",
				description: "Selected agent ids. Selected agents remain pinned above unselected agents when there is no active search, and matching selected agents stay first while filtering.",
			},
			{
				name: "onAgentToggle",
				type: "(agentId: string) => void",
				description: "Called when an agent row is selected.",
			},
			{
				name: "onBrowseAgents",
				type: "() => void",
				description: "Shows the footer browse action and runs when Browse agents is selected.",
			},
			{
				name: "onCreateAgent",
				type: "() => void",
				description: "Shows the footer action and runs when Create agent is selected.",
			},
			{
				name: "query",
				type: "string",
				description: "Controlled search value.",
			},
			{
				name: "onQueryChange",
				type: "(query: string) => void",
				description: "Called when the search input changes.",
			},
			{
				name: "searchVariant",
				type: '"boxed" | "palette"',
				default: '"boxed"',
				description: "Search layout. Both variants use the shared menu search field; \"palette\" applies editor-palette spacing.",
			},
			{
				name: "paletteHeadings",
				type: "boolean",
				default: "false",
				description: "Use editor-palette spacing for agent group headings.",
			},
			{
				name: "showByline",
				type: "boolean",
				default: "true",
				description: "Show agent descriptions when a row is hovered or focused.",
			},
			{
				name: "selectionMode",
				type: '"multiple" | "single"',
				default: '"multiple"',
				description: "Controls whether selected rows render with multi-select checkbox semantics and checkmarks.",
			},
			{
				name: "selectedAgentActions",
				type: "readonly AgentSelectorAction[]",
				description: "Optional actions rendered above the switch-agent list for the currently selected agent.",
			},
			{
				name: "inProgressAgentIds",
				type: "readonly string[]",
				description: "Opt-in (Jira kanban): agents currently running on the item render in a top In progress section instead of showing a tick, and are excluded from the pinned/available groups. Absent/empty leaves the list unchanged.",
			},
			{
				name: "inProgressLabel",
				type: "string",
				default: '"In progress"',
				description: "Heading for the in-progress section.",
			},
			{
				name: "onStopAgent",
				type: "(agentId: string) => void",
				description: "Called when the trailing stop control on an in-progress row is activated. The row body still fires onAgentToggle (e.g. to open the agent's chat).",
			},
		],
	};
