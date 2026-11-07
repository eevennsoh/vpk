import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_SELECTOR_DETAIL: ComponentDetail = {
			description: "Searchable command-list selector for assigning AI agents, with selected agents pinned first, optional selected-agent actions, and optional browse/create actions. The same package exports `InlineAgentSelector` for per-agent actions and favorites. Gallery demos use the borderless editor-palette search bar (`searchVariant=\"palette\"`), matching Assign agents on work items.",
		importStatement: `import { AgentSelector } from "@/components/blocks/agent-selector";`,
		usage: `import { AgentSelector } from "@/components/blocks/agent-selector";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";

const agents: AgentSelectorAgent[] = [
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    byline: "Agent by GitHub",
    brandName: "github",
  },
];

<AgentSelector
  agents={agents}
  searchVariant="palette"
  selectedAgentIds={["github-copilot"]}
  onAgentToggle={(agentId) => console.log(agentId)}
  onBrowseAgents={() => console.log("browse agents")}
  onCreateAgent={() => console.log("create agent")}
/>`,
		demoLayout: { previewHeight: "fixed", examplesContentWidth: "full" },
		examples: [
			{ title: "Standalone picker", description: "Persistent standalone surfaces for the default and selected-agent action states.", demoSlug: "agent-selector-demo-standalone" },
			{ title: "Selected agent actions", description: "Top actions for a selected custom agent before switching to another agent.", demoSlug: "agent-selector-demo-selected-agent-actions" },
			{ title: "Jira kanban", description: "Same palette as Assign agent: Pinned by space / More agents grouping, filled pins only on space-pinned agents, hover reveals an outline pin on unpinned rows, and the footer offers Browse agents and Create agent.", demoSlug: "agent-selector-demo-jira" },
			{ title: "Project Butter submenu", description: "The Project Butter selector with run-location submenus and directory actions.", demoSlug: "agent-selector-demo-project-butter" },
			{ title: "Inline expansion", description: "Import `InlineAgentSelector` from the Agent Selector package. Supply each agent's actions with `getActions`; one action runs directly and multiple actions expand inline. Favorites can be controlled with `favoriteAgentIds` and `onFavoriteAgentIdsChange`.", demoSlug: "agent-selector-demo-inline-expansion" },
		],
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
				description: "Search field treatment. \"boxed\" is the bordered CommandInput used on directory/toolbar surfaces; \"palette\" is the borderless 32px editor-palette bar (RichTextCommandMenuSearchField) shared with Assign agents and \"/\" / \"@\" command menus.",
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
