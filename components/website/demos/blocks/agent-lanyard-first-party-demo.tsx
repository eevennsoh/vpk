import AgentLanyardFirstPartyPage from "@/components/blocks/agent-lanyard/first-party-page";
import { AGENT_LANYARD_FIRST_PARTY_AGENTS } from "@/components/blocks/agent-lanyard/first-party-data";

export default function AgentLanyardCustomFirstPartyDemo() {
	return <AgentLanyardFirstPartyPage />;
}

export function AgentLanyardNamedFirstPartyDemo() {
	return <AgentLanyardFirstPartyPage agents={AGENT_LANYARD_FIRST_PARTY_AGENTS} />;
}
