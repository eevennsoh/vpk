"use client";

import { getAgentSessionAttribution, type AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { AgentLoading, type AgentLoadingAgent } from "@/components/ui-custom/agent-loading";
import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";

type TeammateSessionIdentity = AgentLoadingAgent & Pick<AgentSessionItem, "invokedBy">;

export function renderSessionIdentity({ avatar, invokedBy, name }: TeammateSessionIdentity, sizePx: 16 | 20 | 24, fallbackToTeammate = false, badgeEntrance = false, onBadgeReadyChange?: (ready: boolean) => void) {
	const human = getAgentSessionAttribution({ invokedBy });
	if (!human && !fallbackToTeammate) {
		return <AgentAvatarVisual {...avatar} animate={false} label={name} sizePx={sizePx} />;
	}
	return <HumanAgentAvatar agent={{ ...avatar, name }} badgeEntrance={badgeEntrance} human={human ?? { name: "Teammate" }} badgeSizePx={12} sizePx={sizePx} onBadgeReadyChange={onBadgeReadyChange} />;
}

export function TeammateSessionAvatarCycle({ sessions, sizePx = 20 }: Readonly<{ sessions: readonly TeammateSessionIdentity[]; sizePx?: 20 | 24 }>) {
	const first = sessions[0];
	if (!first) return null;
	if (sessions.length === 1) {
		return <span className="inline-grid size-6 shrink-0 place-items-center">{renderSessionIdentity(first, sizePx, true)}</span>;
	}
	const byId = new Map(sessions.map((session) => [session.id, session]));
	return <AgentLoading
		agents={sessions}
		announce={false}
		cycleWhenFinished
		renderVerticalAvatar={({ id }) => {
			const session = byId.get(id);
			return session ? renderSessionIdentity(session, sizePx, true) : null;
		}}
		variant="vertical"
	/>;
}
