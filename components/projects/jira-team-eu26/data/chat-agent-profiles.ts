import type { RovoAgentProfile } from "@/app/data/directory/agents";
import { AGENT_LANYARD_FIRST_PARTY_AGENTS } from "@/components/blocks/agent-lanyard/first-party-data";
import { JGP_CHAT_AGENT_PROFILES } from "@/components/projects/jira-golden-journeys-v1/data/agent-chat-data";

const jiraCodingAgent = AGENT_LANYARD_FIRST_PARTY_AGENTS.find((agent) => agent.id === "jira-coding")!;

export const JIRA_TEAM_EU26_CHAT_AGENT_PROFILES: readonly RovoAgentProfile[] = [
	...JGP_CHAT_AGENT_PROFILES,
	{
		id: jiraCodingAgent.id,
		name: jiraCodingAgent.name,
		byline: jiraCodingAgent.publisher,
		avatarSrc: jiraCodingAgent.avatarSrc,
		description: jiraCodingAgent.description,
		starters: [],
		contextDescription: `Answer as ${jiraCodingAgent.name} for the current Jira board.`,
	},
];
