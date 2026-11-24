"use client";

import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { TWGAppstack } from "@/components/ui-custom/twg-appstack";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCardContent } from "@/components/ui/hover-card";
import { AtlassianLogoMark } from "@/components/ui/logo-mark";
import { cn } from "@/lib/utils";

import { AGENT_LANYARD_CUTOUT_MASK, AgentLanyardCard } from "./components/agent-lanyard-card";
import { AgentLanyardActions } from "./components/agent-lanyard-actions";
import { AgentLanyardSetupPrompt } from "./components/agent-lanyard-setup-prompt";
import { AgentLanyardTemplateAvatar } from "./agent-lanyard-template-avatar";
import { AgentLanyardAvatarFrame } from "./agent-lanyard-first-party-avatar";
import type { AgentLanyardMenuActions } from "./agent-lanyard-menu";
import type { AgentLanyardAgent } from "./data";
import type { AgentLanyardTemplate } from "./template-data";

interface AgentLanyardAgentProps {
	variant?: "agent";
	recommendationReason?: never;
	recommendationAppearance?: never;
	agent: AgentLanyardAgent;
	perspectiveTilt?: boolean;
	animateGrid?: boolean;
	/** Play the finite grid wave when mounted by a preview instead of on card hover. */
	gridAnimationTrigger?: "hover" | "reveal";
	/** Tilt on card hover (default) or settle into the tilt when a preview reveals the card. */
	tiltTrigger?: "hover" | "reveal";
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

export interface AgentLanyardRecommendedProps extends Pick<AgentLanyardAgentProps, "agent" | "perspectiveTilt" | "tiltTrigger" | "animateGrid" | "gridAnimationTrigger" | "headingLevel" | "showGrid" | "className"> {
	variant: "recommended";
	/** Caller-owned, non-empty explanation. This component does not rank agents. */
	recommendationReason: string;
	recommendationAppearance?: "perforated" | "chin";
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

export interface AgentLanyardMcpSetupProps extends Pick<AgentLanyardAgentProps, "agent" | "headingLevel" | "className"> {
	variant: "mcp-setup";
	invoker: { name: string; avatarSrc?: string };
	setupPrompt: string;
}

export type AgentLanyardProps = AgentLanyardAgentProps | AgentLanyardRecommendedProps | AgentLanyardMcpSetupProps | {
	variant: "template";
	recommendationReason?: never;
	recommendationAppearance?: never;
	template: AgentLanyardTemplate;
	templateIcon?: ReactNode;
	perspectiveTilt?: boolean;
	onSelect?: () => void;
	className?: string;
};

export type AgentLanyardHoverContentProps = ComponentProps<typeof HoverCardContent> & { variant?: "agent" | "recommended" };

export function AgentLanyardHoverContent({ className, style, variant = "agent", ...props }: Readonly<AgentLanyardHoverContentProps>) {
	// A tilting card carries its elevation on the rotating surface so the shadow follows the tilt.
	return <HoverCardContent {...props} className={cn("w-[252px] rounded-xl border-0 bg-transparent p-0 shadow-none [&_[data-slot=agent-lanyard-surface]]:border-0",
		variant === "agent" ? "[&_[data-slot=agent-lanyard]]:rounded-xl [&_[data-slot=agent-lanyard][data-perspective-tilt=false]]:shadow-2xl [&_[data-slot=agent-lanyard-surface]]:shadow-none [&_[data-perspective-tilt=true]_[data-slot=agent-lanyard-surface]]:shadow-2xl" : null, className)} style={style} />;
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

	const { agent, headingLevel, className, ...variantProps } = props;
	const identity = { id: agent.id, name: agent.name, byline: agent.publisher, description: agent.description, verified: agent.verified, accentColor: agent.accentColor };
	const defaultAvatar = <AgentLanyardAvatarFrame>{agent.brandName ? (
		<AgentAvatarVisual animate={false} avatarClassName="size-15" brandName={agent.brandName} thirdPartyLogoSize="xlarge" label="" sizePx={48} />
	) : <Image alt="" className={agent.avatarSrc.startsWith("/avatar-agent-new/") ? "h-full w-full" : "h-full w-full scale-110"} src={agent.avatarSrc} width={54} height={60} />}</AgentLanyardAvatarFrame>;

	if (variantProps.variant === "mcp-setup") {
		const { invoker, setupPrompt } = variantProps;
		return (
			<div className={cn("w-[252px] max-w-full min-w-0 rounded-xl shadow-2xl", className)} data-slot="agent-lanyard-mcp-setup">
			<div className="flex flex-col gap-2 rounded-xl bg-bg-neutral p-2" style={{ ...AGENT_LANYARD_CUTOUT_MASK, maskPosition: "center, center 15px" }}>
				<AgentLanyardCard {...identity} variant="mcp-setup" avatar={defaultAvatar} headingLevel={headingLevel} perspectiveTilt={false} showDescription={false}
					footer={
						<ul className="flex flex-col gap-2 text-xs leading-4 text-text-subtle">
							<li className="flex items-center gap-1">
								<Avatar animate={false} aria-hidden size="xs">
									{invoker.avatarSrc ? <AvatarImage alt="" src={invoker.avatarSrc} /> : (
										<AvatarFallback>{invoker.name.split(/\s+/u).map((part) => part[0]).slice(0, 2).join("")}</AvatarFallback>
									)}
								</Avatar>
								<span className="min-w-0 wrap-anywhere">Invoked by {invoker.name}</span>
							</li>
							<li className="flex items-center gap-1"><AtlassianLogoMark name="atlassian" label="" frame="chip" />Using Atlassian MCP</li>
						</ul>
					}
				/>
				<AgentLanyardSetupPrompt prompt={setupPrompt} />
			</div>
			</div>
		);
	}

	const { perspectiveTilt, tiltTrigger, animateGrid, gridAnimationTrigger, showGrid, showDescription, avatar, footer, onSelect, recommendationAppearance, ...actions } = variantProps;
	const recommended = variantProps.variant === "recommended";
	if (recommended && !variantProps.recommendationReason?.trim()) throw new Error("AgentLanyard recommended variant requires a non-empty recommendationReason.");
	return (
		<AgentLanyardCard
			{...identity}
			variant={recommended ? "recommended" : "agent"} recommendationReason={recommended ? variantProps.recommendationReason : undefined}
			recommendationAppearance={recommendationAppearance}
			perspectiveTilt={perspectiveTilt} tiltTrigger={tiltTrigger} animateGrid={animateGrid} gridAnimationTrigger={gridAnimationTrigger} headingLevel={headingLevel} showGrid={showGrid} showDescription={recommended ? true : showDescription} onSelect={recommended ? undefined : onSelect} className={className}
			avatar={avatar ?? defaultAvatar}
			footer={recommended || footer === null ? null : footer
				? <div className="mt-auto flex h-6 items-end" data-slot="agent-lanyard-appstack">{footer}</div>
				: <AgentLanyardActions agent={agent} {...actions} />}
		/>
	);
}
