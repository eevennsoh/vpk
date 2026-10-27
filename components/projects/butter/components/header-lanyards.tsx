"use client";

import { createContext, use, useRef, useState, type ReactNode } from "react";
import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import { AgentLanyard, type AgentLanyardAgent, type AgentLanyardFirstPartyAgent } from "@/components/blocks/agent-lanyard";
import { AgentLanyardFirstPartyAvatar } from "@/components/blocks/agent-lanyard/agent-lanyard-first-party-avatar";
import { HoverCard, HoverCardContent, createHoverCardHandle, type HoverCardHandle } from "@/components/ui/hover-card";
import { TOOLTIP_POPUP_ANIMATION_CLASSES } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";

type HeaderAgent = AgentLanyardAgent | AgentLanyardFirstPartyAgent;
const HeaderLanyardContext = createContext<HoverCardHandle<HeaderAgent> | null>(null);

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
			{children}
			<HoverCard handle={handle} onOpenChange={(open) => {
				// A fast switch can arrive before the first entrance has finished.
				if (open && handle.isOpen) {
					for (const animation of popupRef.current?.getAnimations() ?? []) animation.finish();
				}
			}}>
				{({ payload: agent }) => (
					<HoverCardContent
						ref={popupRef}
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
