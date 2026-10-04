"use client";

import { TWGAppstack } from "@/components/ui-custom/twg-appstack";
import { cn } from "@/lib/utils";

import { AgentLanyard } from "./agent-lanyard";
import type { AgentLanyardFirstPartyAgent } from "./first-party-data";
import { AgentLanyardFirstPartyAvatar } from "./agent-lanyard-first-party-avatar";

export interface AgentLanyardFirstPartyProps {
	agent: AgentLanyardFirstPartyAgent;
	perspectiveTilt?: boolean;
	/** Enables the hover wave; the static grid backdrop is always visible. */
	animateGrid?: boolean;
	/** Play the finite grid wave when mounted by a preview instead of on card hover. */
	gridAnimationTrigger?: "hover" | "reveal";
	headingLevel?: 2 | 3;
	className?: string;
}

export function AgentLanyardFirstParty({
	agent, perspectiveTilt = true, animateGrid = false, gridAnimationTrigger, headingLevel, className,
}: Readonly<AgentLanyardFirstPartyProps>) {
	return (
		<AgentLanyard
			agent={agent} className={cn("max-w-[320px]", className)}
			avatar={<AgentLanyardFirstPartyAvatar badge={agent.badge} backgroundColor={agent.accentColor} />}
			perspectiveTilt={perspectiveTilt} animateGrid={animateGrid} gridAnimationTrigger={gridAnimationTrigger} headingLevel={headingLevel}
			footer={
				<div role="img" aria-label={`Connected apps: ${agent.sources.map((source) => source.label).join(", ")}`}>
					<TWGAppstack sources={agent.sources} iconSize="xsmall" animated={false} aria-hidden="true" className="justify-start" />
				</div>
			}
		/>
	);
}
