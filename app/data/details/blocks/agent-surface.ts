import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_SURFACE_DETAIL: ComponentDetail = {
		description:
			"Agent “Surfaces” screen for choosing where an agent appears across Atlassian apps and connected channels, including default surfaces and extended channel entry points.",
		importStatement: `import { AgentSurface } from "@/components/blocks/agent-surface";`,
		usage: `import { AgentSurface } from "@/components/blocks/agent-surface";

<AgentSurface />`,
		demoLayout: { previewHeight: "fixed" },
		props: [
			{ name: "className", type: "string", description: "Additional classes applied to the outer container." },
		],
	};
