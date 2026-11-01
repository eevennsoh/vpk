"use client";

import { createContext, use, useCallback, useId, useRef, useState, type ReactNode } from "react";
import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import { AgentLanyard, AGENT_LANYARD_AGENTS, type AgentLanyardAgent, type AgentLanyardFirstPartyAgent } from "@/components/blocks/agent-lanyard";
import { AgentLanyardFirstPartyAvatar } from "@/components/blocks/agent-lanyard/agent-lanyard-first-party-avatar";
import { AgentSessionAvatarPreviewContext, type AgentSessionAvatarPreview } from "@/components/blocks/agent-session/agent-session-avatar-preview";
import { HoverCard, HoverCardContent, HoverCardTrigger, createHoverCardHandle, type HoverCardHandle } from "@/components/ui/hover-card";
import { TOOLTIP_POPUP_ANIMATION_CLASSES } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";

type HeaderAgent = AgentLanyardAgent | AgentLanyardFirstPartyAgent;
const HeaderLanyardContext = createContext<HoverCardHandle<HeaderAgent> | null>(null);
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

export function useHeaderLanyardHandle() {
	const handle = use(HeaderLanyardContext);
	if (!handle) throw new Error("EU26 header avatars require HeaderLanyards");
	return handle;
}

export function HeaderLanyards({ children }: Readonly<{ children: ReactNode }>) {
	const { openChat, selectAgent } = useRovoChatControls();
	const [handle] = useState(() => createHoverCardHandle<HeaderAgent>());
	const [menuAnnouncement, setMenuAnnouncement] = useState("");
	const popupRef = useRef<HTMLDivElement>(null);
	const renderSessionAvatar = useCallback<AgentSessionAvatarPreview>((identity, avatar) => {
		const id = identity.brandName ? SESSION_AGENT_IDS.get(identity.brandName) : undefined;
		const agent = AGENT_LANYARD_AGENTS.find((candidate) => candidate.id === id || (identity.avatarSrc && candidate.avatarSrc === identity.avatarSrc));
		return agent ? <SessionAvatarPreview key="agent" agent={agent} avatar={avatar} handle={handle} /> : avatar;
	}, [handle]);
	function chatWithAgent(agent: AgentLanyardAgent) {
		handle.close();
		selectAgent(agent.id === "claude" ? "claude-code" : agent.id);
		openChat("sidebar");
	}
	function announceMenuSelection(action: string, agent: AgentLanyardAgent) {
		// These project previews expose the shared options without navigating elsewhere.
		setMenuAnnouncement(`Selected ${action} for ${agent.name}.`);
	}
	return (
		<HeaderLanyardContext value={handle}>
			<AgentSessionAvatarPreviewContext value={renderSessionAvatar}>{children}</AgentSessionAvatarPreviewContext>
			<HoverCard handle={handle} onOpenChange={(open) => {
				// A fast switch can arrive before the first entrance has finished.
				if (open && handle.isOpen) {
					for (const animation of popupRef.current?.getAnimations() ?? []) animation.finish();
				}
			}}>
				{({ payload: agent }) => (
					<HoverCardContent
						ref={popupRef}
						positionerClassName="z-[600]"
						align="center" alignOffset={0} sideOffset={8}
						style={{ boxShadow: token("elevation.shadow.overlay") }}
						className={cn(
							"w-[252px] rounded-xl border-0 bg-transparent p-0 shadow-none [&_[data-slot=agent-lanyard-surface]]:border-0 [&_[data-slot=agent-lanyard-surface]]:shadow-none",
							TOOLTIP_POPUP_ANIMATION_CLASSES,
							"data-starting-style:scale-100 data-ending-style:scale-100",
						)}
					>
						{agent ? (
							<AgentLanyard
								agent={agent}
								avatar={"badge" in agent ? <AgentLanyardFirstPartyAvatar badge={agent.badge} backgroundColor={agent.accentColor} /> : undefined}
								perspectiveTilt={false}
								animateGrid
								gridAnimationTrigger="reveal"
								menuPositionerClassName="z-[700]"
								headingLevel={2}
								onAction={chatWithAgent}
								menuActions={{
									onViewProfile: (selected) => announceMenuSelection("View profile", selected),
									onToggleStar: (selected) => announceMenuSelection("Star", selected),
									onCopyLink: (selected) => announceMenuSelection("Copy link", selected),
									onDuplicate: (selected) => announceMenuSelection("Duplicate", selected),
								}}
							/>
						) : null}
					</HoverCardContent>
				)}
			</HoverCard>
			<span role="status" className="sr-only">{menuAnnouncement}</span>
		</HeaderLanyardContext>
	);
}
