import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_INSIGHT_DETAIL: ComponentDetail = {
		description:
			"Agent “Insights” screen for reviewing adoption, answer quality, feedback mix, top topics, and recommended improvements for an agent.",
		importStatement: `import { AgentInsight } from "@/components/blocks/agent-insight";`,
		usage: `import { AgentInsight } from "@/components/blocks/agent-insight";

<AgentInsight />`,
		demoLayout: {
			previewContentWidth: "full",
			examplesContentWidth: "full",
		},
		props: [
			{ name: "className", type: "string", description: "Additional classes applied to the outer container." },
		],
	};
