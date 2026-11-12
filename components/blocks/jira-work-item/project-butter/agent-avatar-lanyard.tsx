"use client";

import { createContext, use, useRef, useState, type ReactNode, type RefObject } from "react";
import { ROVO_AGENT_PROFILES } from "@/app/data/directory/agents";
import { AgentLanyard, AGENT_LANYARD_AGENTS, AGENT_LANYARD_FIRST_PARTY_AGENTS, type AgentLanyardAgent } from "@/components/blocks/agent-lanyard";
import { AgentLanyardAvatarFrame, AgentLanyardFirstPartyAvatar } from "@/components/blocks/agent-lanyard/agent-lanyard-first-party-avatar";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { HoverCard, HoverCardContent, HoverCardTrigger, createHoverCardHandle, type HoverCardHandle } from "@/components/ui/hover-card";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { token } from "@/lib/tokens";

const LanyardContext = createContext<HoverCardHandle<AgentSelectorAgent> | null>(null);

export function AgentAvatarLanyards({ anchorRef, children }: Readonly<{ anchorRef: RefObject<HTMLDivElement | null>; children: ReactNode }>) {
	const [handle] = useState(() => createHoverCardHandle<AgentSelectorAgent>());
	const popupRef = useRef<HTMLDivElement>(null);
	return (
		<LanyardContext value={handle}>
			{children}
			<HoverCard handle={handle} onOpenChange={(open) => {
				if (open && handle.isOpen) for (const animation of popupRef.current?.getAnimations() ?? []) animation.finish();
			}}>
				{({ payload: agent }) => {
					if (!agent) return null;
					const firstParty = AGENT_LANYARD_FIRST_PARTY_AGENTS.find((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase());
					const known = AGENT_LANYARD_AGENTS.find((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase()) ?? firstParty;
					const profile = ROVO_AGENT_PROFILES.find((candidate) => candidate.id === agent.id.replace(/^session-agent:/, ""));
					const publisher = profile?.byline === "Rovo agent by Atlassian" ? "Atlassian" : profile?.byline ?? agent.byline;
					const identity = { id: agent.id, name: agent.name, publisher, description: profile?.description ?? "", action: "chat" as const };
					const lanyard: AgentLanyardAgent = known ?? (agent.brandName ? { ...identity, brandName: agent.brandName } : { ...identity, avatarSrc: agent.avatarSrc ?? "/1p/agent-lanyard/glyph-custom-white.svg" });
					const usesLanyardImage = !agent.brandName && !agent.logoName && !agent.vpkLogo && !agent.avatarSrc?.startsWith("/2p/");
					const avatar = firstParty ? <AgentLanyardFirstPartyAvatar badge={firstParty.badge} backgroundColor={firstParty.accentColor} /> : known || usesLanyardImage ? undefined : <AgentLanyardAvatarFrame><AgentAvatarVisual animate={false} appearance="coding" avatarClassName="size-15" avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} vpkLogo={agent.vpkLogo} label="" sizePx={48} /></AgentLanyardAvatarFrame>;
					return <HoverCardContent ref={popupRef} anchor={() => anchorRef.current} side="left" align="start" alignOffset={0} sideOffset={25} positionerClassName="z-[700]" className="w-[252px] rounded-xl border-0 bg-transparent p-0 [&_[data-slot=agent-lanyard-surface]]:min-h-0 [&_[data-slot=agent-lanyard-surface]]:border-0 [&_[data-slot=agent-lanyard-surface]]:shadow-none [&_[data-slot=agent-lanyard-surface]_p]:min-h-0" style={{ boxShadow: token("elevation.shadow.overlay") }}>
						<AgentLanyard agent={lanyard} avatar={avatar} perspectiveTilt={false} animateGrid={false} footer={null} />
					</HoverCardContent>;
				}}
			</HoverCard>
		</LanyardContext>
	);
}

export function AgentAvatarLanyard({ agent, children, onOpenPicker }: Readonly<{ agent: AgentSelectorAgent; children: ReactNode; onOpenPicker: () => void }>) {
	const handle = use(LanyardContext);
	if (!handle) throw new Error("Agent avatars require AgentAvatarLanyards");
	return <HoverCardTrigger handle={handle} payload={agent} delay={150} closeDelay={150} render={<button aria-label={`${agent.name}, add agent`} className="pointer-events-auto inline-flex shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { handle.close(); onOpenPicker(); }} type="button">{children}</button>} />;
}
