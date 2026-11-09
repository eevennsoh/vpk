import type { ComponentDetail } from "@/app/data/component-detail-types";

type AgentDetailOptions = Readonly<{
	demoSlugPrefix: "agent";
	importPath: "@/components/blocks/agent";
}>;

export function createAgentDetail({ demoSlugPrefix, importPath }: AgentDetailOptions): ComponentDetail {
	return {
		description:
			"A structured agent strategy/configuration surface with an app header, cover area, compact section navigation, section block wrappers, knowledge controls, and instructions composer.",
		importStatement: `import {
  Agent,
  AgentHeader,
  AgentContent,
  AgentConfigFields,
} from "${importPath}";`,
		usage: `import {
  Agent,
  AgentHeader,
  AgentContent,
  AgentConfigFields,
} from "${importPath}";

<Agent>
  <AgentHeader name="Policy Checker" model="Draft" />
  <AgentContent>
    <AgentConfigFields
      config={agentConfig}
      idPrefix="agent-config"
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
			{ name: "AgentHeader", description: "Top app bar with agent avatar, name, status lozenge, and Configure/Test tabs (override via the `actions` prop)." },
			{ name: "AgentContent", description: "Body container for the agent configuration surface." },
			{ name: "AgentConfigFields", description: "Shared Figma-style agent strategy surface used by the catalog preview and Studio panel." },
			{ name: "AgentCompactHeaderNav", description: "Compact section navigation for Insights, Surfaces, Evaluation, Users, and Access." },
			{ name: "AgentCompactInsightsPanel", description: "Wrapper around the Agent Insight block for compact agent layouts." },
			{ name: "AgentCompactSurfacesPanel", description: "Wrapper around the Agent Surface block for compact agent layouts." },
			{ name: "AgentCompactEvaluationPanel", description: "Wrapper around the Agent Evaluation block for compact agent layouts." },
			{ name: "AgentCompactUsersPanel", description: "Wrapper around the Agent User block for compact agent layouts." },
			{ name: "AgentCompactAccessPanel", description: "Wrapper around the Agent Access block for compact agent layouts." },
			{ name: "AgentInstructions", description: "Instruction text block with label." },
			{ name: "AgentTools", description: "Accordion container for tool definitions." },
			{ name: "AgentTool", description: "Individual tool item with expandable JSON schema." },
			{ name: "AgentOutput", description: "Output schema display with syntax highlighting." },
		],
		examples: [
			{ title: "Filled agent", description: "Agent strategy surface after configuration fields have been populated.", demoSlug: `${demoSlugPrefix}-demo-full` },
			{ title: "Empty agent", description: "Default setup state with quick configuration links and Operations prompt starters before details are populated.", demoSlug: `${demoSlugPrefix}-demo-empty` },
		],
	};
}
