import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SUBAGENT_DETAIL: ComponentDetail = {
	description:
		"A line for work the agent hands to a subagent. Subagent is a collapsible Trace: the run is the title, like “Ran the research agent”, and opening it shows the tool calls the subagent made and what it found.",
	usage: `import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentTool,
  AgentTools,
} from "@/components/ui/subagent";

<Agent>
  <AgentHeader name="Ran the research agent" model="anthropic/claude-sonnet-4.5" />
  <AgentContent>
    <AgentInstructions>Find out why image optimization reruns on every deploy.</AgentInstructions>
    <AgentTools>
      {Object.entries(tools).map(([name, tool]) => (
        <AgentTool key={name} tool={tool} />
      ))}
    </AgentTools>
  </AgentContent>
</Agent>`,
	props: [
		{
			name: "name",
			type: "string",
			required: true,
			description: "AgentHeader only. The title, like “Ran the research agent”.",
		},
		{
			name: "model",
			type: "string",
			description: "AgentHeader only. Shown in a Badge after the title.",
		},
		{
			name: "status",
			type: '"running" | "error" | "pending"',
			description: "AgentHeader and AgentTool. TraceLine status, such as running while the subagent works.",
		},
		{
			name: "icon",
			type: "ReactNode",
			description: "AgentHeader and AgentTool. Replaces the default icon, for example with a spinner while running.",
		},
		{
			name: "collapsible",
			type: "boolean",
			default: "true",
			description: "AgentHeader only. Set false while the subagent has nothing to show, for a plain line.",
		},
		{
			name: "tool",
			type: "Tool",
			description: "AgentTool only. An AI SDK tool; its description is the title unless children are given.",
		},
		{
			name: "output",
			type: "string",
			description: "AgentTool only. The tool call's output; makes the line collapsible with a Code Block.",
		},
		{
			name: "schema",
			type: "string",
			required: true,
			description: "AgentOutput only. The output schema, shown in a Code Block.",
		},
	],
	subComponents: [
		{ name: "Agent", description: "Trace with a TraceCollapsible." },
		{
			name: "AgentHeader",
			description: "TraceCollapsibleTrigger with a TraceLine, the run as the title and the model in a Badge.",
		},
		{ name: "AgentContent", description: "Kept-mounted TraceCollapsibleContent." },
		{ name: "AgentInstructions", description: "The task the subagent was given." },
		{ name: "AgentTools", description: "Trace of the subagent's tool calls." },
		{ name: "AgentTool", description: "TraceLine for one tool call; collapsible when it has output." },
		{ name: "AgentOutput", description: "Code Block with the output schema." },
	],
	examples: [
		{ title: "Running", demoSlug: "subagent-demo-running" },
		{ title: "Details", demoSlug: "subagent-demo-details" },
	],
};
