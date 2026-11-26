"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { preload } from "react-dom";
import { animate as animateMotion, motion as motionElement, useMotionTemplate, useMotionValue, useTransform, type MotionValue } from "motion/react";
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
import { motionEase } from "@/lib/motion";
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
	onBadgeReadyChange?: (ready: boolean) => void;
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
const HUMAN_BADGE_ENTRANCE = { duration: 0.3, ease: motionEase.inOut };

function HumanAvatarBadge({ human, sizePx, style, opacity, transform, onReadyChange }: Readonly<{
	human: HumanAgentAvatarProps["human"];
	sizePx: number;
	style: CSSProperties;
	opacity: MotionValue<number>;
	transform: MotionValue<string>;
	onReadyChange: (ready: boolean) => void;
}>) {
	const [status, setStatus] = useState<"loading" | "loaded" | "error">(human.avatarSrc ? "loading" : "error");
	return (
		<motionElement.span
			aria-hidden="true"
			className="absolute"
			style={{ ...style, opacity, transform }}
			data-avatar-role="human"
		>
			<Avatar animate={false} className={PX_TO_IDENTITY_FRAME_CLASS_NAME[sizePx]} label="" size={PX_TO_HUMAN_AVATAR_SIZE[sizePx]}>
				{human.avatarSrc ? <AvatarImage alt="" src={human.avatarSrc} onLoadingStatusChange={(next) => { const status = next === "loaded" || next === "error" ? next : "loading"; setStatus(status); onReadyChange(status !== "loading"); }} /> : null}
				{status === "error" ? <AvatarFallback>{human.name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "?"}</AvatarFallback> : null}
			</Avatar>
		</motionElement.span>
	);
}
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
	onBadgeReadyChange,
	groupSizePx,
	className,
}: Readonly<HumanAgentAvatarProps>) {
	if (human.avatarSrc) preload(human.avatarSrc, { as: "image" });
	const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
	const [readyAvatarSrc, setReadyAvatarSrc] = useState<string | undefined>();
	const badgeReady = !human.avatarSrc || readyAvatarSrc === human.avatarSrc;
	useEffect(() => { onBadgeReadyChange?.(badgeReady); }, [badgeReady, onBadgeReadyChange]);
	useEffect(() => () => onBadgeReadyChange?.(true), [onBadgeReadyChange]);
	const entranceProgress = useMotionValue(0);
	const badgeTransform = useTransform(entranceProgress, [0, 1], badgeEntrance && !reducedMotion ? ["scale(0.35)", "scale(1)"] : ["scale(1)", "scale(1)"]);
	const shouldAnimate = animate && !reducedMotion;
	useEffect(() => {
		if (animate && reducedMotion && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			onAnimationComplete?.();
		}
	}, [animate, reducedMotion, onAnimationComplete]);
	const agentFirst = attributionOrder === "agent-first";
	const geometry = humanAgentAvatarGeometry(sizePx, agentFirst, badgeSizePx);
	const { frameSize, agentSize: agentSizePx, humanSize } = geometry;
	const cutoutCenter = frameSize - geometry.humanInset - humanSize - geometry.agentInset + humanSize / 2;
	const cutoutRadius = useTransform(entranceProgress, [0, 1], [0, humanSize / 2 + 1.5]);
	const cutoutOuterRadius = useTransform(entranceProgress, [0, 1], [0, humanSize / 2 + 2]);
	const animatedMask = useMotionTemplate`radial-gradient(circle at ${cutoutCenter}px ${cutoutCenter}px, transparent ${cutoutRadius}px, black ${cutoutOuterRadius}px)`;
	useEffect(() => {
		if (!badgeReady || !badgeEntrance || reducedMotion) {
			entranceProgress.set(badgeReady ? 1 : 0);
			return;
		}
		let controls: ReturnType<typeof animateMotion> | undefined;
		let frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => {
				controls = animateMotion(entranceProgress, 1, HUMAN_BADGE_ENTRANCE);
			});
		});
		return () => {
			cancelAnimationFrame(frame);
			controls?.stop();
		};
	}, [badgeEntrance, badgeReady, entranceProgress, reducedMotion]);
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

	const humanSlot = <HumanAvatarBadge key={`${human.avatarSrc ?? "fallback"}-${badgeEntrance}`} human={human} sizePx={humanSize} style={{ ...positions.human, ...(!agentFirst ? humanAgentAvatarCutout(geometry, false) : {}) }} opacity={entranceProgress} transform={badgeTransform} onReadyChange={(ready) => setReadyAvatarSrc(ready ? human.avatarSrc : undefined)} />;
	const animatedCutout = agentFirst && badgeEntrance;
	const agentSlot = (
		<motionElement.span
			aria-hidden="true"
			className="absolute"
			style={{ ...positions.agent, ...(animatedCutout ? { maskImage: animatedMask, WebkitMaskImage: animatedMask } : agentFirst ? humanAgentAvatarCutout(geometry, true) : {}) }}
			data-avatar-role="agent"
			key="agent"
		>
			{agentAvatar()}
		</motionElement.span>
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
