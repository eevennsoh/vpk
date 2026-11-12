import { ROVO_DIRECTORY_AGENT_PROFILES, type RovoAgentProfile } from "@/app/data/directory/agents";
import { AGENT_LANYARD_AGENTS } from "@/components/blocks/agent-lanyard/data";
import { AGENT_LANYARD_FIRST_PARTY_AGENTS } from "@/components/blocks/agent-lanyard/first-party-data";
import { JGP_CHAT_AGENT_PROFILES } from "@/components/projects/jira-golden-journey-v1/data/agent-chat-data";

const jiraCodingAgent = AGENT_LANYARD_FIRST_PARTY_AGENTS.find((agent) => agent.id === "jira-coding")!;
const workItemPlanner = JGP_CHAT_AGENT_PROFILES.find((agent) => agent.id === "work-item-planner")!;

export const BUTTER_CHAT_AGENT_PROFILES: readonly RovoAgentProfile[] = [
	...JGP_CHAT_AGENT_PROFILES,
	{
		...workItemPlanner,
		id: "jira-scoping",
		name: "Jira Scoping agent",
	},
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

export function resolveButterChatAgentId(agent: { id?: string; name: string }, sessionId: string): string {
	return BUTTER_CHAT_AGENT_PROFILES.find((profile) => profile.name.toLowerCase() === agent.name.toLowerCase())?.id
		?? (agent.id ?? sessionId).split(":").at(-1) ?? sessionId;
}

const BUTTER_DIRECTORY_CODING_AGENT_IDS = new Set(["claude-code", "cursor", "review-agent", "jira-coding"]);
const BUTTER_DIRECTORY_VERIFIED_AGENTS = [...AGENT_LANYARD_AGENTS, jiraCodingAgent];

export const BUTTER_DIRECTORY_AGENT_PROFILES: readonly RovoAgentProfile[] = [
	...BUTTER_CHAT_AGENT_PROFILES.filter((agent) => BUTTER_DIRECTORY_CODING_AGENT_IDS.has(agent.id)).map((agent) => ({
		...agent,
		verified: BUTTER_DIRECTORY_VERIFIED_AGENTS.find((candidate) => candidate.name === agent.name)?.verified ?? agent.verified,
	})),
	...ROVO_DIRECTORY_AGENT_PROFILES.filter((agent) => !BUTTER_DIRECTORY_CODING_AGENT_IDS.has(agent.id)),
];
