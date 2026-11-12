"use client";

import { useCallback, useId, type ReactNode } from "react";
import { AGENT_LANYARD_AGENTS, type AgentLanyardAgent, type AgentLanyardFirstPartyAgent } from "@/components/blocks/agent-lanyard";
import { AgentSessionAvatarPreviewContext, type AgentSessionAvatarPreview } from "@/components/blocks/agent-session/agent-session-avatar-preview";
import { HeaderLanyards as SharedHeaderLanyards, useHeaderLanyardHandle } from "@/components/projects/shared/components/eu26-header-lanyards";
import { HoverCardTrigger, type HoverCardHandle } from "@/components/ui/hover-card";

type HeaderAgent = AgentLanyardAgent | AgentLanyardFirstPartyAgent;
const SESSION_AGENT_IDS = new Map([
	["claude", "claude"],
	["cursor", "cursor"],
	["openai-codex", "codex"],
	["github-copilot", "copilot"],
]);

function SessionAvatarPreview({ agent, avatar, handle }: Readonly<{ agent: AgentLanyardAgent; avatar: ReactNode; handle: HoverCardHandle<HeaderAgent> }>) {
	const id = useId();
	return (
		<HoverCardTrigger
			closeDelay={150}
			delay={150}
			handle={handle}
			id={id}
			payload={agent}
			render={<button aria-label={`Preview ${agent.name}`} className="inline-flex shrink-0 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => handle.open(id)} onKeyDown={(event) => {
				if (event.key === "Escape" && handle.isOpen) {
					event.stopPropagation();
					handle.close();
				}
			}} type="button">{avatar}</button>}
		/>
	);
}

function ButterSessionAvatarPreviews({ children }: Readonly<{ children: ReactNode }>) {
	const handle = useHeaderLanyardHandle();
	const renderSessionAvatar = useCallback<AgentSessionAvatarPreview>((identity, avatar) => {
		const id = identity.brandName ? SESSION_AGENT_IDS.get(identity.brandName) : undefined;
		const agent = AGENT_LANYARD_AGENTS.find((candidate) => candidate.id === id || (identity.avatarSrc && candidate.avatarSrc === identity.avatarSrc));
		return agent ? <SessionAvatarPreview key="agent" agent={agent} avatar={avatar} handle={handle} /> : avatar;
	}, [handle]);
	return <AgentSessionAvatarPreviewContext value={renderSessionAvatar}>{children}</AgentSessionAvatarPreviewContext>;
}

export function HeaderLanyards({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<SharedHeaderLanyards positionerClassName="z-[600]" menuPositionerClassName="z-[700]">
			<ButterSessionAvatarPreviews>{children}</ButterSessionAvatarPreviews>
		</SharedHeaderLanyards>
	);
}
