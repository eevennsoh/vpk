"use client";

import { useEffect } from "react";
import {
	AgentAvatarVisual,
	type AgentAvatarVisualProps,
} from "@/components/ui-custom/agent-avatar-visual";
import { HumanAgentAvatarMotion } from "@/components/ui-custom/human-agent-avatar-motion";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	type AvatarProps,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { humanAgentAvatarGeometry, humanAgentAvatarPositions } from "@/components/ui-custom/human-agent-avatar-geometry";

import type { HumanAgentAvatarMotionOptions } from "@/components/ui-custom/human-agent-avatar-motion-config";

export type { HumanAgentAvatarMotionOptions } from "@/components/ui-custom/human-agent-avatar-motion-config";

export type HumanAgentAvatarOrder = "agent-first" | "human-first";

export interface HumanAgentAvatarProps {
	agent: Pick<
		AgentAvatarVisualProps,
		"avatarSrc" | "brandName" | "logoName" | "vpkLogo" | "fallbackText"
	> & { name: string };
	human: { name: string; avatarSrc?: string };
	/** Swap the human and agent, hold, then return. Static by default. */
	animate?: boolean;
	/** Controlled destination; horizontal groups hold instead of looping. */
	composition?: "compact" | "horizontal-group";
	/** Called after a finite animation, or immediately when reduced motion skips it. */
	onAnimationComplete?: () => void;
	motion?: Partial<HumanAgentAvatarMotionOptions>;
	attributionOrder?: HumanAgentAvatarOrder;
	/** Figma variants: 24px (24px agent / 12px human) and 32px (30px / 16px). */
	sizePx?: number;
	className?: string;
}

const PX_TO_IDENTITY_FRAME_CLASS_NAME: Record<number, string> = {
	16: "size-4",
	20: "size-5",
	24: "size-6",
	32: "size-8",
	40: "size-10",
	48: "size-12",
};
/** A human photo and agent hexagon sharing one stable, accessible footprint. */
export function HumanAgentAvatar({
	agent,
	human,
	animate = false,
	composition,
	onAnimationComplete,
	motion,
	attributionOrder = "agent-first",
	sizePx = 32,
	className,
}: Readonly<HumanAgentAvatarProps>) {
	const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
	const shouldAnimate = animate && !reducedMotion;
	useEffect(() => {
		if (animate && reducedMotion && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			onAnimationComplete?.();
		}
	}, [animate, reducedMotion, onAnimationComplete]);
	const geometry = humanAgentAvatarGeometry(sizePx);
	const { frameSize, agentSize: agentSizePx, humanSize } = geometry;
	const frameClassName = PX_TO_IDENTITY_FRAME_CLASS_NAME[frameSize];
	const personAvatarSize = humanSize === 24 ? "sm" : humanSize === 12 ? "xxs" : "xs";
	const agentFirst = attributionOrder === "agent-first";
	const positions = humanAgentAvatarPositions(geometry, agentFirst);
	const label = `${agent.name}, used by ${human.name}`;
	const frameClass = cn("relative block shrink-0", frameClassName, className);
	const humanAvatar = (outline?: AvatarProps["outline"]) => (
		<Avatar
			animate={false}
			outline={outline ? { ...outline, color: "inverse", strokeWidth: 2 } : undefined}
			className={outline ? undefined : "after:border-2 after:border-border-inverse after:mix-blend-normal dark:after:mix-blend-normal"}
			label=""
			size={personAvatarSize}
		>
			{human.avatarSrc ? <AvatarImage alt="" src={human.avatarSrc} /> : null}
			<AvatarFallback>
				{human.name
					.split(" ")
					.filter(Boolean)
					.slice(0, 2)
					.map((word) => word[0]?.toUpperCase())
					.join("") || "?"}
			</AvatarFallback>
		</Avatar>
	);
	const agentAvatar = (sizePx: number = agentSizePx) => (
		<AgentAvatarVisual {...agent} animate={false} label="" sizePx={sizePx} />
	);

	if (shouldAnimate || composition === "horizontal-group") {
		return (
			<HumanAgentAvatarMotion
				options={motion}
				animate={shouldAnimate}
				composition={composition}
				onAnimationComplete={onAnimationComplete}
				agent={agentAvatar}
				human={humanAvatar}
				agentFirst={agentFirst}
				frameSize={frameSize}
				agentSize={agentSizePx}
				humanSize={humanSize}
				positions={positions}
				topLeftInset={agentFirst ? geometry.agentInset : 0}
				bottomRightInset={agentFirst ? geometry.humanInset : geometry.agentInset}
				className={frameClass}
				label={label}
			/>
		);
	}

	const humanSlot = (
		<span
			aria-hidden="true"
			className="absolute"
			style={positions.human}
			data-avatar-role="human"
			key="human"
		>
			{humanAvatar()}
		</span>
	);
	const agentSlot = (
		<span
			aria-hidden="true"
			className="absolute"
			style={positions.agent}
			data-avatar-role="agent"
			key="agent"
		>
			{agentAvatar()}
		</span>
	);

	return (
		<span
			aria-label={label}
			className={frameClass}
			data-animated="false"
			data-slot="human-agent-avatar"
			role="img"
		>
			{agentFirst ? [agentSlot, humanSlot] : [humanSlot, agentSlot]}
		</span>
	);
}
