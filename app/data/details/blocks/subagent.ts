import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SUBAGENT_DETAIL: ComponentDetail = {
		importStatement: `import Subagent from "@/components/blocks/subagent/page";`,
		description: "Agent builder surface for one base parent agent with conditional subagent prompt copies selected from a floating mini-map switcher.",
		usage: `import Subagent, { type SubagentPrompt, type SubagentBaseAgent } from "@/components/blocks/subagent/page";

const baseAgent: SubagentBaseAgent = {
  id: "policy-checker",
  config: { name: "Policy Checker", subagents: [] },
};

const subagents: SubagentPrompt[] = [
  {
    id: "benefits-question",
    triggerName: "Benefits question",
    condition: "Use this prompt for benefits eligibility questions.",
    config: { instructions: "Summarize benefits rules for the base agent." },
  },
];

<Subagent initialBaseAgent={baseAgent} initialSubagents={subagents} />`,
		props: [
			{
				name: "initialBaseAgent",
				type: "SubagentBaseAgent",
				default: "DEFAULT_SUBAGENT_BASE_AGENT",
				description: "Base parent agent identity and shared config used for every prompt copy.",
			},
			{
				name: "initialSubagents",
				type: "ReadonlyArray<SubagentPrompt>",
				default: "SUBAGENT_DEMO_PROMPTS",
				description: "Conditional prompt copies owned by the base agent. Rows are labeled by trigger name.",
			},
			{
				name: "initialActiveSubagentId",
				type: "string",
				description: "Optional subagent prompt id selected when the block first renders.",
			},
			{
				name: "className",
				type: "string",
				description: "Optional className applied to the outer block container.",
			},
		],
		examples: [
			{
				title: "No subagents",
				description: "Base parent agent only, showing an empty subagent prompt list and create-subagent action.",
				demoSlug: "subagent-demo-empty",
			},
		],
	};
