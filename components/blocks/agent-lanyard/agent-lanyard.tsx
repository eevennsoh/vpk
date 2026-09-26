"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { TWGAppstack } from "@/components/ui-custom/twg-appstack";

import { AgentLanyardCard } from "./components/agent-lanyard-card";
import { AgentLanyardActions } from "./components/agent-lanyard-actions";
import { AgentLanyardTemplateAvatar } from "./agent-lanyard-template-avatar";
import type { AgentLanyardMenuActions } from "./agent-lanyard-menu";
import type { AgentLanyardAgent } from "./data";
import type { AgentLanyardTemplate } from "./template-data";

interface AgentLanyardAgentProps {
	variant?: "agent";
	agent: AgentLanyardAgent;
	perspectiveTilt?: boolean;
	animateGrid?: boolean;
	/** Play the finite grid wave when mounted by a preview instead of on card hover. */
	gridAnimationTrigger?: "hover" | "reveal";
	headingLevel?: 2 | 3;
	/** Replaces the action row with a consumer-owned footer, such as connected apps. */
	footer?: ReactNode;
	/** Optional complete avatar presentation; the default uses agent.avatarSrc. */
	avatar?: ReactNode;
	/** Plain covers can opt out of the decorative grid without affecting tilt. */
	showGrid?: boolean;
	onAction?: (agent: AgentLanyardAgent) => void;
	onMoreActions?: (agent: AgentLanyardAgent) => void;
	menuActions?: AgentLanyardMenuActions;
	starred?: boolean;
	className?: string;
}

export type AgentLanyardProps = AgentLanyardAgentProps | {
	variant: "template";
	template: AgentLanyardTemplate;
	perspectiveTilt?: boolean;
	className?: string;
};

export function AgentLanyard(props: Readonly<AgentLanyardProps>) {
	if (props.variant === "template") {
		const { template, perspectiveTilt, className } = props;
		return (
			<AgentLanyardCard
				id={template.id} name={template.name} byline="Template" description={template.description}
				variant="template" perspectiveTilt={perspectiveTilt} className={className} showGrid={false}
				avatar={<AgentLanyardTemplateAvatar iconSrc={template.iconSrc} />}
				footer={
					<div className="mt-auto flex h-6 items-end" data-slot="agent-lanyard-appstack" role="img" aria-label={`Connected apps: ${template.sources.map((source) => source.label).join(", ")}`}>
						<TWGAppstack sources={template.sources} iconSize="xsmall" animated={false} aria-hidden className="justify-start" />
					</div>
				}
			/>
		);
	}

	const { agent, perspectiveTilt, animateGrid, gridAnimationTrigger, headingLevel, showGrid, avatar, footer, className, ...actions } = props;
	return (
		<AgentLanyardCard
			id={agent.id} name={agent.name} byline={agent.publisher} description={agent.description}
			variant="agent" verified={agent.verified} accentColor={agent.accentColor}
			perspectiveTilt={perspectiveTilt} animateGrid={animateGrid} gridAnimationTrigger={gridAnimationTrigger} headingLevel={headingLevel} showGrid={showGrid} className={className}
			avatar={avatar ?? <Image alt="" className="absolute top-6 left-1/2 z-10 -translate-x-1/2" src={agent.avatarSrc} width={54} height={60} />}
			footer={footer
				? <div className="mt-auto flex h-6 items-end" data-slot="agent-lanyard-appstack">{footer}</div>
				: <AgentLanyardActions agent={agent} {...actions} />}
		/>
	);
}
