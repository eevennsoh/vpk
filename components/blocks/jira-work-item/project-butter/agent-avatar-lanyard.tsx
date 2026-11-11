"use client";

import { useRef, useState, type ReactNode } from "react";
import { useOptionalRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import { AgentLanyard, AGENT_LANYARD_AGENTS, AGENT_LANYARD_FIRST_PARTY_AGENTS, type AgentLanyardAgent } from "@/components/blocks/agent-lanyard";
import { AgentLanyardFirstPartyAvatar } from "@/components/blocks/agent-lanyard/agent-lanyard-first-party-avatar";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { token } from "@/lib/tokens";

export function AgentAvatarLanyard({ agent, children, onOpenPicker }: Readonly<{
	agent: AgentSelectorAgent;
	children: ReactNode;
	onOpenPicker: () => void;
}>) {
	const [open, setOpen] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const triggerRef = useRef<HTMLButtonElement>(null);
	const controls = useOptionalRovoChatControls();
	const firstParty = AGENT_LANYARD_FIRST_PARTY_AGENTS.find((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase());
	const known = AGENT_LANYARD_AGENTS.find((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase()) ?? firstParty;
	const identity = { id: agent.id, name: agent.name, publisher: agent.byline, description: "", action: "chat" as const };
	const lanyard: AgentLanyardAgent = known ?? (agent.brandName ? { ...identity, brandName: agent.brandName } : { ...identity, avatarSrc: agent.avatarSrc ?? "/1p/agent-lanyard/glyph-custom-white.svg" });
	const avatar = firstParty ? <AgentLanyardFirstPartyAvatar badge={firstParty.badge} backgroundColor={firstParty.accentColor} /> : known ? undefined : <span className="absolute top-6 left-1/2 z-10 -translate-x-1/2"><AgentAvatarVisual animate={false} appearance="coding" avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} vpkLogo={agent.vpkLogo} label="" sizePx={48} /></span>;
	return (
		<HoverCard open={open} onOpenChange={setOpen} openDelay={150} closeDelay={150}>
			<HoverCardTrigger render={<button aria-label={`${agent.name}, add agent`} ref={triggerRef} className="pointer-events-auto inline-flex shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setOpen(false); onOpenPicker(); }} type="button">{children}</button>} />
			<HoverCardContent anchor={() => triggerRef.current?.closest('[data-panel-id="details"]') ?? triggerRef.current} side="left" align="start" alignOffset={0} sideOffset={8} positionerClassName="z-[700]" className="w-[252px] rounded-xl border-0 bg-transparent p-0 [&_[data-slot=agent-lanyard-surface]]:border-0 [&_[data-slot=agent-lanyard-surface]]:shadow-none" style={{ boxShadow: token("elevation.shadow.overlay") }}>
				<AgentLanyard agent={lanyard} avatar={avatar} perspectiveTilt={false} animateGrid gridAnimationTrigger="reveal" onAction={controls ? (selected) => { setOpen(false); controls.selectAgent(selected.id === "claude" ? "claude-code" : selected.id); controls.openChat("sidebar"); } : undefined} menuPositionerClassName="z-[710]" menuActions={{ onViewProfile: (selected) => setAnnouncement(`Selected View profile for ${selected.name}.`), onToggleStar: (selected) => setAnnouncement(`Selected Star for ${selected.name}.`), onCopyLink: (selected) => setAnnouncement(`Selected Copy link for ${selected.name}.`), onDuplicate: (selected) => setAnnouncement(`Selected Duplicate for ${selected.name}.`) }} />
			</HoverCardContent>
			<span role="status" className="sr-only">{announcement}</span>
		</HoverCard>
	);
}
