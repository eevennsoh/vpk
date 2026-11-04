import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TWG_AGENT_CARD_DETAIL: ComponentDetail = {
		description:
			"Teamwork Graph recommendation card that suggests a small personal agent team from user context. It reuses the Agent Card shell footprint, animated TWG logo tile, TWG app stack, and subtle grid treatment.",
		importStatement: `import { TWGAgentCard } from "@/components/blocks/twg-agent-card";`,
		usage: `import { TWGAgentCard } from "@/components/blocks/twg-agent-card";
import type { TWGAgentSuggestion } from "@/components/blocks/twg-agent-card";

const suggestedAgents: TWGAgentSuggestion[] = [
  {
    id: "life-admin-agent",
    name: "Life Admin Agent",
    description: "Handles reminders, forms, and renewals.",
    avatarSrc: "/avatar-agent-new/yellow/ops-agent.svg",
  },
];

<TWGAgentCard
  userName="Venn"
  userAvatarSrc="/avatar-user/venn/venn.png"
  suggestedAgents={suggestedAgents}
  onSelect={() => openRecommendations()}
/>`,
		demoLayout: { previewHeight: "default" },
		props: [
			{ name: "userName", type: "string", default: '"Venn"', description: "Name inserted into the conversational headline." },
			{ name: "userAvatarSrc", type: "string", default: '"/avatar-user/venn/venn.png"', description: "Avatar shown inline in the headline." },
			{ name: "headline", type: "ReactNode", description: "Copy after the name and avatar in the main headline." },
			{ name: "suggestedAgents", type: "readonly TWGAgentSuggestion[]", description: "Agent recommendations shown in the dream-team section. The count reflects the full array; the card displays the first three rows." },
			{ name: "sources", type: "readonly TwgToolSource[]", description: "Connected apps rendered in the header app stack." },
			{ name: "onSelect", type: "() => void", description: "Whole-card selection handler using the shared Agent Card shell behavior." },
			{ name: "selectLabel", type: "string", default: '"Open Teamwork Graph agent recommendations"', description: "Accessible label for the whole-card select button." },
			{ name: "className", type: "string", description: "Additional classes applied to the card shell." },
		],
		examples: [
			{
				title: "Default",
				description: "Suggested Teamwork Graph agent team card using the Agent Card experimental template footprint.",
				demoSlug: "twg-agent-card",
			},
		],
	};
