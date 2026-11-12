"use client";

import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { TWGAppstack } from "@/components/ui-custom/twg-appstack";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { HoverCardContent } from "@/components/ui/hover-card";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { AgentLanyardCard } from "./components/agent-lanyard-card";
import { AgentLanyardActions } from "./components/agent-lanyard-actions";
import { AgentLanyardTemplateAvatar } from "./agent-lanyard-template-avatar";
import { AgentLanyardAvatarFrame } from "./agent-lanyard-first-party-avatar";
import type { AgentLanyardMenuActions } from "./agent-lanyard-menu";
import type { AgentLanyardAgent } from "./data";
import type { AgentLanyardTemplate } from "./template-data";

interface AgentLanyardAgentProps {
	variant?: "agent";
	recommendationReason?: never;
	agent: AgentLanyardAgent;
	perspectiveTilt?: boolean;
	animateGrid?: boolean;
	/** Play the finite grid wave when mounted by a preview instead of on card hover. */
	gridAnimationTrigger?: "hover" | "reveal";
	headingLevel?: 2 | 3;
	/** Replaces the action row; null hides it entirely. */
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

export interface AgentLanyardRecommendedProps extends Pick<AgentLanyardAgentProps, "agent" | "perspectiveTilt" | "animateGrid" | "gridAnimationTrigger" | "headingLevel" | "showGrid" | "className"> {
	variant: "recommended";
	/** Caller-owned, non-empty explanation. This component does not rank agents. */
	recommendationReason: string;
	footer?: never;
	avatar?: never;
	showDescription?: never;
	onSelect?: never;
	onAction?: never;
	onMoreActions?: never;
	menuActions?: never;
	menuPositionerClassName?: never;
	starred?: never;
}

export type AgentLanyardProps = AgentLanyardAgentProps | AgentLanyardRecommendedProps | {
	variant: "template";
	recommendationReason?: never;
	template: AgentLanyardTemplate;
	templateIcon?: ReactNode;
	perspectiveTilt?: boolean;
	onSelect?: () => void;
	className?: string;
};

export type AgentLanyardHoverContentProps = ComponentProps<typeof HoverCardContent> & { variant?: "agent" | "recommended" };

export function AgentLanyardHoverContent({ className, style, variant = "agent", ...props }: Readonly<AgentLanyardHoverContentProps>) {
	return <HoverCardContent {...props} className={cn("w-[252px] rounded-xl border-0 bg-transparent p-0 shadow-none [&_[data-slot=agent-lanyard-surface]]:border-0 [&_[data-slot=agent-lanyard-surface]]:shadow-none", className)} style={{ ...style, boxShadow: variant === "recommended" ? "none" : token("elevation.shadow.overlay") }} />;
}

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
	const recommended = props.variant === "recommended";
	if (recommended && !props.recommendationReason?.trim()) throw new Error("AgentLanyard recommended variant requires a non-empty recommendationReason.");
	return (
		<AgentLanyardCard
			id={agent.id} name={agent.name} byline={agent.publisher} description={agent.description}
			variant={recommended ? "recommended" : "agent"} recommendationReason={recommended ? props.recommendationReason : undefined} verified={agent.verified} accentColor={agent.accentColor}
			perspectiveTilt={perspectiveTilt} animateGrid={animateGrid} gridAnimationTrigger={gridAnimationTrigger} headingLevel={headingLevel} showGrid={showGrid} showDescription={recommended ? true : showDescription} onSelect={recommended ? undefined : onSelect} className={className}
			avatar={avatar ?? (agent.brandName ? (
				<AgentLanyardAvatarFrame><AgentAvatarVisual animate={false} avatarClassName="size-15" brandName={agent.brandName} label="" sizePx={48} /></AgentLanyardAvatarFrame>
			) : <AgentLanyardAvatarFrame><Image alt="" className={agent.avatarSrc.startsWith("/avatar-agent-new/") ? "h-full w-full" : "h-full w-full scale-110"} src={agent.avatarSrc} width={54} height={60} /></AgentLanyardAvatarFrame>)}
			footer={recommended || footer === null ? null : footer
				? <div className="mt-auto flex h-6 items-end" data-slot="agent-lanyard-appstack">{footer}</div>
				: <AgentLanyardActions agent={agent} {...actions} />}
		/>
	);
}
