"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { TWGAppstack } from "@/components/ui-custom/twg-appstack";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";

import { AgentLanyardCard } from "./components/agent-lanyard-card";
import { AgentLanyardActions } from "./components/agent-lanyard-actions";
import { AgentLanyardTemplateAvatar } from "./agent-lanyard-template-avatar";
import { AgentLanyardAvatarFrame } from "./agent-lanyard-first-party-avatar";
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
	showDescription?: boolean;
	onSelect?: () => void;
	onAction?: (agent: AgentLanyardAgent) => void;
	onMoreActions?: (agent: AgentLanyardAgent) => void;
	menuActions?: AgentLanyardMenuActions;
	menuPositionerClassName?: string;
	starred?: boolean;
	className?: string;
}

export type AgentLanyardProps = AgentLanyardAgentProps | {
	variant: "template";
	template: AgentLanyardTemplate;
	templateIcon?: ReactNode;
	perspectiveTilt?: boolean;
	onSelect?: () => void;
	className?: string;
};

export function AgentLanyard(props: Readonly<AgentLanyardProps>) {
	if (props.variant === "template") {
		const { template, templateIcon, perspectiveTilt, onSelect, className } = props;
		return (
			<AgentLanyardCard
				id={template.id} name={template.name} byline="Template" description={template.description}
				variant="template" perspectiveTilt={perspectiveTilt} onSelect={onSelect} className={className} showGrid={false}
				avatar={<AgentLanyardTemplateAvatar iconSrc={template.iconSrc} icon={templateIcon} />}
				footer={
					<div className="mt-auto flex h-6 items-end" data-slot="agent-lanyard-appstack" role="img" aria-label={`Connected apps: ${template.sources.map((source) => source.label).join(", ")}`}>
						<TWGAppstack sources={template.sources} iconSize="xsmall" animated={false} aria-hidden className="justify-start" />
					</div>
				}
			/>
		);
	}

	const { agent, perspectiveTilt, animateGrid, gridAnimationTrigger, headingLevel, showGrid, showDescription, avatar, footer, onSelect, className, ...actions } = props;
	return (
		<AgentLanyardCard
			id={agent.id} name={agent.name} byline={agent.publisher} description={agent.description}
			variant="agent" verified={agent.verified} accentColor={agent.accentColor}
			perspectiveTilt={perspectiveTilt} animateGrid={animateGrid} gridAnimationTrigger={gridAnimationTrigger} headingLevel={headingLevel} showGrid={showGrid} showDescription={showDescription} onSelect={onSelect} className={className}
			avatar={avatar ?? (agent.brandName ? (
				<AgentLanyardAvatarFrame><AgentAvatarVisual animate={false} avatarClassName="size-15" brandName={agent.brandName} label="" sizePx={48} /></AgentLanyardAvatarFrame>
			) : <AgentLanyardAvatarFrame><Image alt="" className={agent.avatarSrc.startsWith("/avatar-agent-new/") ? "h-full w-full" : "h-full w-full scale-110"} src={agent.avatarSrc} width={54} height={60} /></AgentLanyardAvatarFrame>)}
			footer={footer
				? <div className="mt-auto flex h-6 items-end" data-slot="agent-lanyard-appstack">{footer}</div>
				: <AgentLanyardActions agent={agent} {...actions} />}
		/>
	);
}
