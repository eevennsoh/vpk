import type { StudioSessionAgentEntry } from "@/app/contexts/context-rovo-chat";
import { DEFAULT_CONFIGURED_AUTOMATION_RULES } from "@/components/blocks/trigger/data/trigger-catalog";
import type { RovoDataParts } from "@/lib/rovo-ui-messages";

// Sample agent draft used to drive the standalone Agent Test demos and docs
// page. Mirrors the entry shape the Studio shell feeds the panel at runtime
// (draft snapshot + empty version history), but is fully self-contained so the
// block can be exercised in isolation. Conversation starters seed the Chat
// surface; the default automation rules seed the Automation surface.
const AGENT_TEST_DEMO_RESULT: RovoDataParts["agent-result"] = {
	agentId: "policy-checker",
	name: "Policy Checker",
	byline: "Custom agent test",
	summary:
		"This agent helps employees quickly find and understand company guidelines, HR policies, and benefits information.",
	description:
		"This agent helps employees quickly find and understand company guidelines, HR policies, and benefits information.",
	instructions:
		"Answer policy questions using the connected Confluence and Jira knowledge. Cite the source page when possible and flag anything that needs HR review.",
	contextDescription: "",
	conversationStarters: [
		"Can this policy answer an employee leave question?",
		"Summarize the relevant HR guidance for a manager.",
		"Create a follow-up work item for missing policy context.",
	],
	conversationStarterIcons: [],
	automationRules: [...DEFAULT_CONFIGURED_AUTOMATION_RULES],
	tools: ["Jira", "Confluence"],
	skills: ["Create work items", "Dependency mapper"],
	knowledge: ["Confluence - all content", "Jira - all content"],
	subagents: [],
	guardrail: "",
	action: "create",
};

export function buildAgentTestDemoEntry(
	result: RovoDataParts["agent-result"] = AGENT_TEST_DEMO_RESULT,
): StudioSessionAgentEntry {
	return {
		profile: {
			id: result.agentId ?? "agent-test-demo",
			name: result.name ?? "Untitled agent",
			byline: result.byline ?? "Custom agent test",
			description: result.description ?? result.summary,
			// Real agents always carry an avatar; the demo mirrors that so the
			// greeting renders the agent identity rather than a bare heading.
			avatarSrc: "/avatar-agent-new/yellow/ops-agent.svg",
			starters: [],
		},
		resultKey: `agent-test:${result.agentId ?? "agent-test-demo"}`,
		sourceResult: result,
		draftResult: result,
		lastTouchedAt: 0,
		publishReadyResult: result,
		publishedResult: null,
		publishStatus: "testing",
		publishedVersion: 0,
		lastPublishedAt: null,
		lastPublishedBy: null,
		versionHistory: [],
	};
}

export const AGENT_TEST_DEMO_ENTRY: StudioSessionAgentEntry = buildAgentTestDemoEntry();
