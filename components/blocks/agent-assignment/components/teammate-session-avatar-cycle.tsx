"use client";

import { getAgentSessionAttribution, type AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { AgentLoading, type AgentLoadingAgent } from "@/components/ui-custom/agent-loading";
import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";

type TeammateSessionIdentity = AgentLoadingAgent & Pick<AgentSessionItem, "invokedBy">;

function renderIdentity({ avatar, invokedBy, name }: TeammateSessionIdentity, sizePx: 20 | 24) {
	const human = getAgentSessionAttribution({ invokedBy });
	if (invokedBy && !human) {
		return <AgentAvatarVisual {...avatar} animate={false} label={name} sizePx={sizePx} />;
	}
	return <HumanAgentAvatar agent={{ ...avatar, name }} human={human ?? { name: "Teammate" }} badgeSizePx={12} sizePx={sizePx} />;
}

export function TeammateSessionAvatarCycle({ sessions, sizePx = 20 }: Readonly<{ sessions: readonly TeammateSessionIdentity[]; sizePx?: 20 | 24 }>) {
	const first = sessions[0];
	if (!first) return null;
	if (sessions.length === 1) {
		return <span className="inline-grid size-6 shrink-0 place-items-center">{renderIdentity(first, sizePx)}</span>;
	}
	const byId = new Map(sessions.map((session) => [session.id, session]));
	return <AgentLoading
		agents={sessions}
		announce={false}
		cycleWhenFinished
		renderVerticalAvatar={({ id }) => {
			const session = byId.get(id);
			return session ? renderIdentity(session, sizePx) : null;
		}}
		variant="vertical"
	/>;
}
