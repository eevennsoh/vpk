import {
	DEFAULT_STARTER_ICON,
	getStarterIcon,
	type StarterIconKey,
} from "@/components/blocks/conversation-starter";
import type { RovoAgentProfile } from "@/app/data/directory/agents";
import type { RovoDataParts } from "@/lib/rovo-ui-messages";
import { getRandomAgentAvatarSrc } from "@/lib/agent-avatars";

const STUDIO_AGENT_MAX_CONVERSATION_STARTERS = 3;

export type StudioAgentRegistrationResult =
	| string
	| {
			id?: string | null;
	  }
	| RovoAgentProfile
	| null
	| undefined
	| void;

function getNonEmptyString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeStudioAgentResult(
	agentResult: RovoDataParts["agent-result"],
	getFallbackAvatarSrc: () => string = getRandomAgentAvatarSrc,
): RovoAgentProfile | null {
	const id = getNonEmptyString(agentResult.agentId);
	const name = getNonEmptyString(agentResult.name);
	const summary = getNonEmptyString(agentResult.summary);
	const description = getNonEmptyString(agentResult.description) ?? summary;
	const conversationStarters = Array.isArray(agentResult.conversationStarters)
		? agentResult.conversationStarters.map((starter) => starter.trim()).filter(Boolean).slice(0, STUDIO_AGENT_MAX_CONVERSATION_STARTERS)
		: [];
	const conversationStarterIcons = Array.isArray(agentResult.conversationStarterIcons)
		? agentResult.conversationStarterIcons
		: [];

	if (!id || !name || !description || conversationStarters.length === 0) {
		return null;
	}

	const contextDescription = [
		"[Selected Studio-generated agent]",
		`Agent: ${name}`,
		"Source: /studio agent creation result",
		`Description: ${description}`,
		summary ? `Summary: ${summary}` : null,
		conversationStarters.length > 0 ? `Conversation starters: ${conversationStarters.join(" | ")}` : null,
		"Answer as this selected generated agent while using the existing Studio chat capabilities and available context.",
		"[End selected Studio-generated agent]",
	]
		.filter((line): line is string => Boolean(line))
		.join("\n");

	return {
		avatarSrc: getNonEmptyString(agentResult.avatarSrc) ?? getFallbackAvatarSrc(),
		byline: "Custom agent by You",
		contextDescription,
		description,
		id,
		name,
		starters: conversationStarters.map((starter, index) => ({
			icon: getStarterIcon((conversationStarterIcons[index] as StarterIconKey | undefined) ?? DEFAULT_STARTER_ICON),
			id: `${id}-starter-${index + 1}`,
			label: starter,
			prompt: starter,
			type: "prompt",
		})),
	};
}

export function resolveRegisteredStudioAgentId(
	result: StudioAgentRegistrationResult,
	fallbackAgentId: string,
): string {
	if (typeof result === "string" && result.trim().length > 0) {
		return result.trim();
	}

	if (result && typeof result === "object" && typeof result.id === "string" && result.id.trim().length > 0) {
		return result.id.trim();
	}

	return fallbackAgentId;
}
