"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import RovoChatIcon from "@atlaskit/icon/core/rovo-chat";
import StatusVerifiedIcon from "@atlaskit/icon/core/status-verified";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TWGAppstack } from "@/components/ui-custom/twg-appstack";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

import { AgentLanyardGrid } from "./agent-lanyard-grid";
import { AgentLanyardTemplateAvatar } from "./agent-lanyard-template-avatar";
import { AgentLanyardMenu, type AgentLanyardMenuActions } from "./agent-lanyard-menu";
import type { AgentLanyardAgent } from "./data";
import type { AgentLanyardTemplate } from "./template-data";

interface AgentLanyardAgentProps {
	variant?: "agent";
	agent: AgentLanyardAgent;
	perspectiveTilt?: boolean;
	animateGrid?: boolean;
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

// Reference preset: X -1.2°, Y 4.4°, Z -0.6°, perspective 900px.
const HOVER_TILT = "perspective(900px) rotateX(-1.2deg) rotateY(4.4deg) rotateZ(-0.6deg)";
const REST_TILT = "perspective(900px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)";
const ENTER = { duration: 0.15, ease: [0.4, 1, 0.6, 1] as const }; // duration-normal + ease-out-practical
const EXIT = { duration: 0.1, ease: [0.6, 0, 0.8, 0.6] as const }; // duration-fast + ease-in

export function AgentLanyard(props: Readonly<AgentLanyardProps>) {
	const { perspectiveTilt = true, className } = props;
	const template = props.variant === "template" ? props.template : undefined;
	const agentProps = props.variant === "template" ? undefined : props;
	const item = props.variant === "template" ? props.template : props.agent;
	const animateGrid = agentProps?.animateGrid ?? true;
	const onAction = agentProps?.onAction;
	const [hovered, setHovered] = useState(false);
	const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
	const tiltEnabled = perspectiveTilt && !reducedMotion;
	const showGrid = !template && (agentProps?.showGrid ?? true);
	const gridEnabled = showGrid && animateGrid && !reducedMotion;
	const gridActive = hovered && gridEnabled;
	const isChat = agentProps?.agent.action === "chat";

	return (
		// Keep the hover target stationary while its inner card rotates.
		<article
			aria-label={`${item.name} ${template ? "template" : "agent"}`}
			className={cn("w-[252px] max-w-full", className)}
			data-slot="agent-lanyard" data-agent-id={item.id} data-variant={props.variant ?? "agent"}
			data-perspective-tilt={tiltEnabled} data-grid-animation={gridEnabled}
			onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(true); }}
			onPointerLeave={() => setHovered(false)}
			onPointerCancel={() => setHovered(false)}
		>
			<motion.div
				data-slot="agent-lanyard-surface"
				className={cn(
					"flex min-h-[280px] flex-col rounded-xl border border-border bg-surface transition-[background-color,box-shadow] duration-normal ease-out-practical motion-reduce:transition-none",
					hovered ? "bg-surface-hovered shadow-2xl" : null,
				)}
				initial={false}
				animate={{ transform: tiltEnabled ? (hovered ? HOVER_TILT : REST_TILT) : "none" }}
				transition={tiltEnabled ? (hovered ? ENTER : EXIT) : { duration: 0 }}
			>
				<div className={cn("relative h-[108px] shrink-0 overflow-hidden rounded-t-xl", showGrid ? "bg-bg-neutral" : "bg-surface-sunken")} aria-hidden="true">
					{showGrid ? <AgentLanyardGrid active={gridActive} color={agentProps?.agent.accentColor} /> : null}
					<span
						data-slot="agent-lanyard-cutout"
						className="pointer-events-none absolute top-[7px] left-1/2 z-10 h-1.5 w-10 -translate-x-1/2 rounded-[3.75px]"
					>
						<span className="absolute inset-0 rounded-[inherit] bg-surface" />
						<span
							data-slot="agent-lanyard-cutout-shadow"
							className="absolute -inset-[0.5px] rounded-[inherit] text-border"
							// Paint Figma's outside 0.5px rim rather than a CSS border, which
							// Chromium snaps to 1px. Keep its inset shadows across the full rim.
							style={{ boxShadow: "inset 0 0 0 0.5px currentColor, inset 0 1px 1px 0 rgba(30, 31, 33, 0.16), inset 0 0 1px 0 rgba(30, 31, 33, 0.12)" }}
						/>
					</span>
					{agentProps?.avatar ?? (template ? <AgentLanyardTemplateAvatar iconSrc={template.iconSrc} /> : agentProps ? (
						<Image alt="" className="absolute top-6 left-1/2 z-10 -translate-x-1/2" src={agentProps.agent.avatarSrc} width={54} height={60} />
					) : null)}
				</div>
				<div className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-4">
					<div>
						<div className="flex min-w-0 items-center gap-1.5">
							<h3 className="min-w-0 truncate text-base leading-6 font-medium text-text" title={item.name}>{item.name}</h3>
							{agentProps?.agent.verified ? <Icon label="Verified by your org" className="shrink-0 text-icon-information" render={<StatusVerifiedIcon label="" size="small" color="currentColor" />} /> : null}
						</div>
						<p className="text-xs leading-4 font-medium text-text-subtle">{template ? "Template" : agentProps?.agent.publisher}</p>
					</div>
					<p className="min-h-12 text-xs leading-4 text-text-subtle">{item.description}</p>
					{agentProps?.footer ? (
						<div className="mt-auto flex h-6 items-end" data-slot="agent-lanyard-appstack">{agentProps.footer}</div>
					) : template ? (
						<div className="mt-auto flex h-6 items-end" data-slot="agent-lanyard-appstack" role="img" aria-label={`Connected apps: ${template.sources.map((source) => source.label).join(", ")}`}>
							<TWGAppstack sources={template.sources} iconSize="xsmall" animated={false} aria-hidden className="justify-start" />
						</div>
					) : agentProps ? (
					<div className="mt-auto flex items-center gap-1.5">
						<Button variant="outline" size={isChat ? "icon-compact" : "compact"} aria-label={`${isChat ? "Chat with" : "Connect"} ${item.name}`} disabled={!onAction} onClick={onAction ? () => onAction(agentProps.agent) : undefined}>
							{isChat ? <Icon render={<RovoChatIcon label="" size="small" />} /> : "Connect"}
						</Button>
						<AgentLanyardMenu agent={agentProps.agent} actions={agentProps.menuActions} starred={agentProps.starred} onMoreActions={agentProps.onMoreActions} />
					</div>
					) : null}
				</div>
			</motion.div>
		</article>
	);
}
