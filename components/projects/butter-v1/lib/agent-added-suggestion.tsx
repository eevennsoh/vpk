import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { FloatingRovoButtonSuggestion } from "@/components/blocks/rovo-button";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";

export function agentAddedSuggestion(session: Pick<AgentSessionItem, "id" | "agent">, onSelect: () => void, onDismiss: () => void): FloatingRovoButtonSuggestion {
	const { agent } = session;
	return {
		id: session.id,
		label: `${agent.name} added`,
		icon: <span aria-hidden="true"><AgentAvatarVisual animate={false} appearance="coding" avatarSrc={agent.avatarSrc} brandName={agent.brandName} vpkLogo={agent.vpkLogo} fallbackText={agent.name.slice(0, 2).toUpperCase()} label="" sizePx={20} /></span>,
		onDismiss,
		onSelect,
	};
}
