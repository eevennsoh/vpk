"use client";

import { createContext, use, useRef, useState, type ReactNode } from "react";
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
	const [handle] = useState(() => createHoverCardHandle<HeaderAgent>());
	const popupRef = useRef<HTMLDivElement>(null);
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
							/>
						) : null}
					</HoverCardContent>
				)}
			</HoverCard>
		</HeaderLanyardContext>
	);
}
