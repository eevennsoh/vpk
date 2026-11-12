"use client";

import { createContext, use, useRef, useState, type ReactNode, type RefObject } from "react";
import { useOptionalRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import { AgentLanyard, AGENT_LANYARD_AGENTS, AGENT_LANYARD_FIRST_PARTY_AGENTS, type AgentLanyardAgent } from "@/components/blocks/agent-lanyard";
import { AgentLanyardAvatarFrame, AgentLanyardFirstPartyAvatar } from "@/components/blocks/agent-lanyard/agent-lanyard-first-party-avatar";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { HoverCard, HoverCardContent, HoverCardTrigger, createHoverCardHandle, type HoverCardHandle } from "@/components/ui/hover-card";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { token } from "@/lib/tokens";

const LanyardContext = createContext<HoverCardHandle<AgentSelectorAgent> | null>(null);

export function AgentAvatarLanyards({ anchorRef, children }: Readonly<{ anchorRef: RefObject<HTMLDivElement | null>; children: ReactNode }>) {
	const [handle] = useState(() => createHoverCardHandle<AgentSelectorAgent>());
	const [announcement, setAnnouncement] = useState("");
	const popupRef = useRef<HTMLDivElement>(null);
	const controls = useOptionalRovoChatControls();
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
					const identity = { id: agent.id, name: agent.name, publisher: agent.byline, description: "", action: "chat" as const };
					const lanyard: AgentLanyardAgent = known ?? (agent.brandName ? { ...identity, brandName: agent.brandName } : { ...identity, avatarSrc: agent.avatarSrc ?? "/1p/agent-lanyard/glyph-custom-white.svg" });
					const usesLanyardImage = !agent.brandName && !agent.logoName && !agent.vpkLogo && !agent.avatarSrc?.startsWith("/2p/");
					const avatar = firstParty ? <AgentLanyardFirstPartyAvatar badge={firstParty.badge} backgroundColor={firstParty.accentColor} /> : known || usesLanyardImage ? undefined : <AgentLanyardAvatarFrame><AgentAvatarVisual animate={false} appearance="coding" avatarClassName="size-15" avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} vpkLogo={agent.vpkLogo} label="" sizePx={48} /></AgentLanyardAvatarFrame>;
					return <HoverCardContent ref={popupRef} anchor={() => anchorRef.current} side="left" align="start" alignOffset={0} sideOffset={25} positionerClassName="z-[700]" className="w-[252px] rounded-xl border-0 bg-transparent p-0 [&_[data-slot=agent-lanyard-surface]]:border-0 [&_[data-slot=agent-lanyard-surface]]:shadow-none" style={{ boxShadow: token("elevation.shadow.overlay") }}>
						<AgentLanyard agent={lanyard} avatar={avatar} perspectiveTilt={false} animateGrid gridAnimationTrigger="reveal" onAction={controls ? (selected) => { handle.close(); controls.selectAgent(selected.id === "claude" ? "claude-code" : selected.id); controls.openChat("sidebar"); } : undefined} menuPositionerClassName="z-[710]" menuActions={{ onViewProfile: (selected) => setAnnouncement(`Selected View profile for ${selected.name}.`), onToggleStar: (selected) => setAnnouncement(`Selected Star for ${selected.name}.`), onCopyLink: (selected) => setAnnouncement(`Selected Copy link for ${selected.name}.`), onDuplicate: (selected) => setAnnouncement(`Selected Duplicate for ${selected.name}.`) }} />
					</HoverCardContent>;
				}}
			</HoverCard>
			<span role="status" className="sr-only">{announcement}</span>
		</LanyardContext>
	);
}

export function AgentAvatarLanyard({ agent, children, onOpenPicker }: Readonly<{ agent: AgentSelectorAgent; children: ReactNode; onOpenPicker: () => void }>) {
	const handle = use(LanyardContext);
	if (!handle) throw new Error("Agent avatars require AgentAvatarLanyards");
	return <HoverCardTrigger handle={handle} payload={agent} delay={150} closeDelay={150} render={<button aria-label={`${agent.name}, add agent`} className="pointer-events-auto inline-flex shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { handle.close(); onOpenPicker(); }} type="button">{children}</button>} />;
}
