import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CHAIN_OF_THOUGHT_DETAIL: ComponentDetail = {
	description:
		"Displays a summary that expands into the steps an agent took. Built on Trace: the root is a TraceCollapsible, the header a TraceCollapsibleTrigger with a TraceLine whose title shimmers while thinking, and each step a TraceLine title with VPK's icon rail, connector and cycling byline. Use it for status traces, tool summaries, and staged progress, not hidden chain-of-thought.",
	usage: `import {
  ChainOfThoughtScenario,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
} from "@/components/ui/chain-of-thought";
import { SearchIcon } from "@/components/ui/vpk-icons";

<ChainOfThoughtScenario
  state="thinking"
  steps={[
    {
      id: "search",
      icon: SearchIcon,
      label: "Searching approved sources",
      description: "Looking across Confluence, Jira history, and proposal-library snippets.",
      status: "active",
      collapsible: true,
      children: (
        <ChainOfThoughtSearchResults>
          <ChainOfThoughtSearchResult>Confluence</ChainOfThoughtSearchResult>
          <ChainOfThoughtSearchResult>Jira history</ChainOfThoughtSearchResult>
        </ChainOfThoughtSearchResults>
      ),
    },
  ]}
/>

AI usage guidance:
- Start staged AI workflows with a preload/thinking header so the morphing Rovo shape and shimmering title have time to read.
- Reveal specific step labels only when that work begins.
- Match labels to the domain: automation flows should mention triggers, schedules, delivery, and saving; research flows should mention search, source evaluation, and synthesis.
- Render Teamwork Graph calls with TwgTool, showing the connected Jira, Confluence, and Figma source stack alongside a concise delivery-context summary.
- Never use placeholder labels such as "Reading agent brief" unless that is literally the work being performed.`,
	demoLayout: {
		previewContentWidth: "full",
		examplesContentWidth: "full",
	},
	props: [
		{
			name: "state",
			type: '"preload" | "thinking" | "completed"',
			description: "Scenario state for the high-level helper. Drives the morphing Rovo preload/thinking header or completed summary.",
		},
		{
			name: "steps",
			type: "readonly ChainOfThoughtScenarioStep[]",
			description: "Data-driven steps rendered through ChainOfThoughtStep. Each step owns its label, status, icon, and optional expanded content.",
		},
		{
			name: "duration",
			type: "number",
			description: "Completed thinking duration in seconds for the scenario header.",
		},
		{
			name: "open",
			type: "boolean",
			description: "Controlled open state for the reasoning container.",
		},
		{
			name: "defaultOpen",
			type: "boolean",
			default: "false",
			description: "Initial open state when used uncontrolled.",
		},
		{
			name: "onOpenChange",
			type: "(open: boolean) => void",
			description: "Callback fired whenever open state changes.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes for the root container.",
		},
	],
	subComponents: [
		{ name: "ChainOfThoughtScenario", description: "Data-driven recipe helper for preload, thinking, and completed AI progress traces." },
		{ name: "ChainOfThoughtHeader", description: "TraceCollapsibleTrigger with a TraceLine: morphing Rovo icon (static Rovo once completed), a title that shimmers while preload/thinking, and Trace's chevron. showChevron={false} renders the line without a trigger." },
		{ name: "ChainOfThoughtContent", description: "TraceCollapsibleContent holding a Trace of steps, with the Trace content rule turned off in favour of the step connector." },
		{ name: "ChainOfThoughtStep", description: "Step with a 16px icon rail and icon-to-icon connector, a TraceLine title (status active runs the shimmer) and a CyclingByline description. collapsible adds a TraceCollapsible whose chevron shows on hover or focus; headerRender, iconRender and iconContainerStyle/ClassName replace the header, icon and rail offset." },
		{ name: "ChainOfThoughtSearchResults", description: "Container for source/result chips attached to a step." },
		{ name: "ChainOfThoughtSearchResult", description: "Single result chip rendered as an ADS-aligned badge." },
		{ name: "ChainOfThoughtImage", description: "Image container with caption support for visual reasoning evidence." },
	],
	examples: [
		{ title: "Usage", description: "A completed summary that expands into its steps.", demoSlug: "chain-of-thought-demo-usage" },
		{ title: "Steps", description: "Write each title in the tense of its state: running (active, shimmering), done with detail, done linking out, and failed.", demoSlug: "chain-of-thought-demo-steps" },
		{ title: "Preload", description: "Collapsed initial state before reasoning begins — header visible, content hidden.", demoSlug: "chain-of-thought-demo-preload" },
		{ title: "Normal tool calling replay", description: "Resettable Studio-style replay that steps through running and completed tool calls for custom-agent creation.", demoSlug: "chain-of-thought-demo-normal-tool-calling-replay" },
		{ title: "Awaiting user response replay", description: "Resettable custom-agent creation replay that pauses on an ask_user_questions tool call while awaiting input.", demoSlug: "chain-of-thought-demo-awaiting-user-response-replay" },
		{ title: "Thinking", description: "Active processing — multiple steps with search results, image evidence, and one active step in progress.", demoSlug: "chain-of-thought-demo-thinking" },
		{ title: "Completed", description: "All reasoning steps complete, with the parent summary collapsed by default.", demoSlug: "chain-of-thought-demo-completed" },
		{ title: "Status variants", description: "Compare complete, active, and pending step states in one reasoning chain.", demoSlug: "chain-of-thought-demo-status-variants" },
		{ title: "Search results", description: "Standalone source-chip usage for search and retrieval phases.", demoSlug: "chain-of-thought-demo-search-results" },
		{ title: "Image step", description: "Reasoning step with image evidence and caption.", demoSlug: "chain-of-thought-demo-image-step" },
		{ title: "Studio agent generation flow", description: "Canonical staged agent-generation recipe: brief, clarification, tools, instructions, and save.", demoSlug: "chain-of-thought-demo-studio-agent-generation-flow" },
		{ title: "Automation trigger flow", description: "Automation-specific recipe with preload, existing-rule review, schedule setup, Slack delivery, and save.", demoSlug: "chain-of-thought-demo-automation-trigger-flow" },
		{ title: "Research retrieval flow", description: "Search/retrieval recipe with source lookup, source-fit evaluation, and synthesis.", demoSlug: "chain-of-thought-demo-research-retrieval-flow" },
		{ title: "TWG tool call", description: "Teamwork Graph delivery-context step with connected Jira, Confluence, and Figma evidence.", demoSlug: "chain-of-thought-demo-twg-tool-call" },
		{ title: "Tool-call details flow", description: "Completed trace with collapsed tool rows that expose parameters and results.", demoSlug: "chain-of-thought-demo-tool-call-details-flow" },
		{ title: "Tool icon table", description: "Reference table showing the resolved icon or logo used for native tools, Atlassian/VPK servers, 3P MCP servers, and fallback cases.", demoSlug: "chain-of-thought-demo-tool-icon-table" },
	],
};
