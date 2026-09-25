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
		"avatarSrc" | "brandName" | "logoName" | "vpkLogo" | "fallbackText" | "appearance"
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
	12: "size-3",
	16: "size-4",
	20: "size-5",
	24: "size-6",
	30: "size-7.5",
	32: "size-8",
	40: "size-10",
	48: "size-12",
};
const PX_TO_HUMAN_AVATAR_SIZE: Record<number, NonNullable<AvatarProps["size"]>> = {
	12: "xxs",
	16: "xs",
	20: "sm",
	24: "sm",
	30: "default",
	32: "default",
	40: "lg",
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
	const agentFirst = attributionOrder === "agent-first";
	const geometry = humanAgentAvatarGeometry(sizePx, agentFirst);
	const { frameSize, agentSize: agentSizePx, humanSize } = geometry;
	const frameClassName = PX_TO_IDENTITY_FRAME_CLASS_NAME[frameSize];
	const positions = humanAgentAvatarPositions(geometry, agentFirst);
	const label = `${agent.name}, used by ${human.name}`;
	const frameClass = cn("relative block shrink-0", frameClassName, className);
	const humanAvatar = (outline?: AvatarProps["outline"], sizePx: number = humanSize) => (
		<Avatar
			animate={false}
			className={PX_TO_IDENTITY_FRAME_CLASS_NAME[sizePx]}
			// Keep the same centered stroke when motion hands back to the resting pose.
			outline={{ scale: 1, transition: { duration: 0 }, ...outline, color: "inverse", strokeWidth: 2 }}
			label=""
			size={PX_TO_HUMAN_AVATAR_SIZE[sizePx]}
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
	const agentAvatar = (sizePx: number = agentSizePx, separator = agentSizePx < humanSize) => (
		<AgentAvatarVisual {...agent} animate={false} label="" sizePx={sizePx} separator={separator} />
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
				topLeftInset={agentFirst ? geometry.agentInset : geometry.humanInset}
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
