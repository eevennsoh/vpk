import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_ASSIGNMENT_DETAIL: ComponentDetail = {
	description: "Reusable assigned-agent field. Default reuses the Jira Issue agent activity row as the closed field and Agent Session long cards in the picker. Simple keeps the facepile trigger and suggestion-menu rows.",
	demoLayout: { previewHeight: "fit" },
	examples: [
		{
			title: "Default",
			description:
				"The closed field is the medium-attached Jira agent activity row. Opening it shows assigned agents as Agent Session long cards covering owner/viewer × local/cloud — same hover actions as Agent Session — and Assign agent in the footer.",
			demoSlug: "agent-assignment-demo-default",
		},
		{
			title: "Simple",
			description:
				"The previous facepile field with an Edit agents overlay and suggestion-menu assigned rows.",
			demoSlug: "agent-assignment-demo-simple",
		},
	],
	importStatement: `import { AgentAssignment } from "@/components/blocks/agent-assignment";`,
	usage: `import { AgentAssignment } from "@/components/blocks/agent-assignment";

<AgentAssignment
  agents={availableAgents}
  assignedAgents={assignedAgents.map((agent) => ({
    ...agent,
    statusKind: agent.statusKind,
    statusSequence: agent.statusKind === "working" ? agent.toolCallLabels : undefined,
    statusCycleIntervalMs: 1800,
    statusCycleJitterMs: 1600,
  }))}
  onAssignedAgentIdsChange={setAssignedAgentIds}
  onAssignedAgentSelect={(agent) => openAgentSession(agent.id)}
/>`,
	props: [
		{
			name: "agents",
			type: "readonly AgentSelectorAgent[]",
			required: true,
			description: "Agents available in the searchable assignment selector.",
		},
		{
			name: "assignedAgents",
			type: "readonly AgentAssignmentAgent[]",
			required: true,
			description: "Controlled assigned agents. Set statusKind to working, needs-input, finished, or idle. Working rows can supply a statusSequence that cycles on hover; other kinds use a static byline and a rest-state trailing icon.",
		},
		{
			name: "onAgentAssign",
			type: "(agent: AgentSelectorAgent) => void",
			description: "Called when an unassigned agent is chosen, before the controlled id change. Use it to invoke the agent and create its running session.",
		},
		{
			name: "onAssignedAgentIdsChange",
			type: "(agentIds: readonly string[]) => void",
			required: true,
			description: "Called with the next assignment whenever an agent is added or removed.",
		},
		{
			name: "onDeleteAssignedAgent",
			type: "(agent: AgentAssignmentAgent) => void",
			description: "Deletes a cloud session record from the Default picker. This capability is separate from changing assignments. Expired rows offer only Delete, disabled when this callback is omitted.",
		},
		{
			name: "variant",
			type: '"default" | "simple"',
			default: '"default"',
			description:
				"Default uses the Jira agent activity row as the field and Agent Session long cards in the picker. Simple keeps the facepile trigger and suggestion-menu rows.",
		},
		{
			name: "onAssignedAgentSelect",
			type: "(agent: AgentAssignmentAgent) => void",
			required: true,
			description: "Called when an assigned-agent row or its View action is activated, such as to open its session.",
		},
	],
};
