import { AGENT_LANYARD_AGENTS } from "@/components/blocks/agent-lanyard";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";

const claude = AGENT_LANYARD_AGENTS.find((agent) => agent.id === "claude");
if (!claude) throw new Error("The recommendation canvas requires the catalog Claude lanyard.");

// Production identity; illustrative task and coding-agent brief shared by every concept.
export const recommendationSample = {
	workItem: "DEMO-42",
	title: "Add keyboard navigation to the agent picker",
	brief: "Support arrow keys, visible focus and Escape to close.",
	qualification: "Claude’s identity is real. The work item and the strengths listed for Claude are illustrative. No user data, measured performance or real ranking is represented.",
	agent: claude,
} as const;

export const recommendationPickerAgents: readonly AgentSelectorAgent[] = [
	{ id: recommendationSample.agent.id, name: recommendationSample.agent.name, byline: recommendationSample.agent.publisher, avatarSrc: recommendationSample.agent.avatarSrc, brandName: recommendationSample.agent.brandName },
	{ id: "sample-outline", name: "Outline", byline: "Sample planning agent" },
	{ id: "sample-patchwork", name: "Patchwork", byline: "Sample coding agent" },
];

export const recommendationConceptNames = {
	"margin-note": "Margin note",
	"evidence-ledger": "Evidence ledger",
	"scope-map": "Scope map",
	"work-plan": "Work plan",
} as const;

export type RecommendationConcept = keyof typeof recommendationConceptNames;

export const recommendationParagraphs = {
	"margin-note": "Claude can help add keyboard navigation, visible focus and Escape to close.",
	"evidence-ledger": "Claude is a good fit for adding keyboard navigation, focus states and Escape to close.",
	"scope-map": "Claude is recommended for its fit with keyboard navigation, visible focus and Escape behavior.",
	"work-plan": "This task matches Claude’s strengths in keyboard navigation, focus states and closing menus with Escape.",
} satisfies Record<RecommendationConcept, string>;
