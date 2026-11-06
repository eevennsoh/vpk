import { getAllDataParts, type RovoUIMessage } from "@/lib/rovo-ui-messages";
import { STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE } from "@/components/projects/studio/lib/studio-automation-artifact-list";

const STUDIO_AUTOMATION_CREATE_AGENT_DRAFTS_TOOL_NAME = "studio.create_agent_drafts";

export interface StudioAutomationGeneratingAgent {
	avatarSrc: string;
	id: string;
	label: string;
	lastTouchedAt: number;
}

const STUDIO_AUTOMATION_GENERATING_AGENTS: readonly Omit<StudioAutomationGeneratingAgent, "lastTouchedAt">[] = [
	{
		avatarSrc: "/avatar-agent-new/purple/customer-insight.svg",
		id: "venn-loom-distribution-agent",
		label: "Loom Distribution Agent",
	},
	{
		avatarSrc: "/avatar-agent-new/yellow/ops-agent.svg",
		id: "venn-inactive-agent-triage-agent",
		label: "Inactive Agent Triage Agent",
	},
	{
		avatarSrc: "/avatar-agent-new/orange/research-scout.svg",
		id: "venn-weekly-sprint-atlas-digest-agent",
		label: "Weekly Sprint/Atlas Digest Agent",
	},
];

function getTimestampMs(value: string | undefined): number | null {
	if (!value) {
		return null;
	}

	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : null;
}

export function getStudioAutomationGeneratingAgents(
	messages: ReadonlyArray<RovoUIMessage>,
): readonly StudioAutomationGeneratingAgent[] {
	for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
		const message = messages[messageIndex];
		if (message.role !== "assistant") {
			continue;
		}

		const hasFinalArtifactList = getAllDataParts(message, "data-widget-data").some((part) => (
			part.data?.type === STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE
		));
		if (hasFinalArtifactList) {
			return [];
		}

		const createDraftEvents = getAllDataParts(message, "data-thinking-event")
			.map((part) => part.data)
			.filter((event) => event.toolName === STUDIO_AUTOMATION_CREATE_AGENT_DRAFTS_TOOL_NAME);
		if (createDraftEvents.length === 0) {
			continue;
		}

		const latestCreateDraftEvent = createDraftEvents[createDraftEvents.length - 1];
		if (latestCreateDraftEvent.phase !== "start") {
			return [];
		}

		const baseTouchedAt = getTimestampMs(latestCreateDraftEvent.timestamp) ?? 0;
		return STUDIO_AUTOMATION_GENERATING_AGENTS.map((agent, index) => ({
			...agent,
			lastTouchedAt: baseTouchedAt - index,
		}));
	}

	return [];
}
