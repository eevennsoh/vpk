import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SKILL_CONFIG_DETAIL: ComponentDetail = {
		description:
			"A structured skill strategy/configuration surface duplicated from the Agent block as a baseline for new skill configuration screens. Includes an app header, cover area, compact section navigation, section block wrappers, knowledge controls, and instructions composer.",
		importStatement: `import {
  Agent,
  AgentHeader,
  AgentContent,
  AgentConfigFields,
} from "@/components/blocks/skill-config";`,
		usage: `import {
  Agent,
  AgentHeader,
  AgentContent,
  AgentConfigFields,
} from "@/components/blocks/skill-config";

<Agent>
  <AgentHeader name="Policy Checker" model="Draft" />
  <AgentContent>
    <AgentConfigFields
      config={agentConfig}
      idPrefix="skill-config"
      onTextChange={handleTextChange}
      onListItemChange={updateListItem}
      onRemoveListItem={removeListItem}
      onAppendListItem={appendListItem}
    />
  </AgentContent>
</Agent>`,
		demoLayout: {
			previewContentWidth: "full",
			examplesContentWidth: "full",
		},
		props: [
			{
				name: "className",
				type: "string",
				description: "Additional classes applied to the outer container.",
			},
		],
		subComponents: [
			{ name: "AgentHeader", description: "Top app bar with avatar, name, status lozenge, and Configure/Test tabs (override via the `actions` prop)." },
			{ name: "AgentContent", description: "Body container for the configuration surface." },
			{ name: "AgentConfigFields", description: "Shared Figma-style strategy surface used by the catalog preview and Studio panel." },
			{ name: "AgentCompactHeaderNav", description: "Compact section navigation for Insights, Surfaces, Evaluation, Users, and Access." },
			{ name: "AgentCompactInsightsPanel", description: "Wrapper around the Agent Insight block for compact layouts." },
			{ name: "AgentCompactSurfacesPanel", description: "Wrapper around the Agent Surface block for compact layouts." },
			{ name: "AgentCompactEvaluationPanel", description: "Wrapper around the Agent Evaluation block for compact layouts." },
			{ name: "AgentCompactUsersPanel", description: "Wrapper around the Agent User block for compact layouts." },
			{ name: "AgentCompactAccessPanel", description: "Wrapper around the Agent Access block for compact layouts." },
			{ name: "AgentInstructions", description: "Instruction text block with label." },
			{ name: "AgentTools", description: "Accordion container for tool definitions." },
			{ name: "AgentTool", description: "Individual tool item with expandable JSON schema." },
			{ name: "AgentOutput", description: "Output schema display with syntax highlighting." },
		],
		examples: [
			{ title: "Filled skill", description: "Skill strategy surface after configuration fields have been populated.", demoSlug: "skill-config-demo-full" },
			{ title: "Empty skill", description: "Default setup state with quick configuration links and Operations prompt starters before details are populated.", demoSlug: "skill-config-demo-empty" },
		],
	};
