"use client";

import { useEffect } from "react";
import { motion as motionElement } from "motion/react";
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
import { motionRecipe } from "@/lib/motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import { humanAgentAvatarCutout, humanAgentAvatarGeometry, humanAgentAvatarPositions } from "@/components/ui-custom/human-agent-avatar-geometry";

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
	/** Override the smaller avatar's size for compact surfaces. */
	badgeSizePx?: 12 | 16;
	/** Reveal the human badge when a session is first attached. */
	badgeEntrance?: boolean;
	/** Avatar size in the horizontal group, independent of the compact badge size. */
	groupSizePx?: 12 | 16 | 24;
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
	badgeSizePx,
	badgeEntrance = false,
	groupSizePx,
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
	const geometry = humanAgentAvatarGeometry(sizePx, agentFirst, badgeSizePx);
	const { frameSize, agentSize: agentSizePx, humanSize } = geometry;
	const frameClassName = PX_TO_IDENTITY_FRAME_CLASS_NAME[frameSize];
	const positions = humanAgentAvatarPositions(geometry, agentFirst);
	const label = `${agent.name}, used by ${human.name}`;
	const frameClass = cn("relative block shrink-0", frameClassName, className);
	const humanAvatar = (sizePx: number = humanSize) => (
		<Avatar
			animate={false}
			className={PX_TO_IDENTITY_FRAME_CLASS_NAME[sizePx]}
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
	const agentAvatar = (sizePx: number = agentSizePx) => (
		<AgentAvatarVisual {...agent} animate={false} label="" sizePx={sizePx} />
	);

	if (shouldAnimate || composition === "horizontal-group") {
		return (
			<HumanAgentAvatarMotion
				options={motion}
				animate={shouldAnimate}
				composition={composition}
				groupSizePx={groupSizePx}
				onAnimationComplete={onAnimationComplete}
				agent={agentAvatar}
				human={humanAvatar}
				agentFirst={agentFirst}
				frameSize={frameSize}
				agentSize={agentSizePx}
				humanSize={humanSize}
				positions={positions}
				cutout={humanAgentAvatarCutout(geometry, agentFirst)}
				topLeftInset={agentFirst ? geometry.agentInset : geometry.humanInset}
				bottomRightInset={agentFirst ? geometry.humanInset : geometry.agentInset}
				className={frameClass}
				label={label}
			/>
		);
	}

	const humanSlot = (
		<motionElement.span
			aria-hidden="true"
			className="absolute"
			style={{ ...positions.human, ...(!agentFirst ? humanAgentAvatarCutout(geometry, false) : {}) }}
			initial={badgeEntrance && !reducedMotion ? { opacity: 0, transform: "scale(0.75)" } : false}
			animate={{ opacity: 1, transform: "scale(1)" }}
			transition={motionRecipe.avatar.enter}
			data-avatar-role="human"
			key={badgeEntrance ? "human-entrance" : "human"}
		>
			{humanAvatar()}
		</motionElement.span>
	);
	const agentSlot = (
		<span
			aria-hidden="true"
			className="absolute"
			style={{ ...positions.agent, ...(agentFirst ? humanAgentAvatarCutout(geometry, true) : {}) }}
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
