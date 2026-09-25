"use client";

import { useRef, type ReactNode, type CSSProperties } from "react";
import type { AvatarProps } from "@/components/ui/avatar";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";

import {
	humanAgentAvatarOrbit,
	createHumanAgentAvatarOrbitMotion,
} from "@/components/ui-custom/human-agent-avatar-orbit";

import { humanAgentAvatarSizeSwapProgress, resolveHumanAgentAvatarTargets, type HumanAgentAvatarMotionOptions } from "@/components/ui-custom/human-agent-avatar-motion-config";

import { HumanAgentAvatarGroupMotion } from "@/components/ui-custom/human-agent-avatar-group-motion";

export type HumanAgentAvatarMotionProps = Readonly<{
	agent: (sizePx?: number, separator?: boolean) => ReactNode;
	human: (outline?: AvatarProps["outline"], sizePx?: number) => ReactNode;
	agentFirst: boolean;
	frameSize: number;
	agentSize: number;
	humanSize: number;
	positions: { agent: CSSProperties; human: CSSProperties };
	topLeftInset: number;
	bottomRightInset: number;
	className: string;
	label: string;
	options?: Partial<HumanAgentAvatarMotionOptions>;
	animate?: boolean;
	composition?: "compact" | "horizontal-group";
	onAnimationComplete?: () => void;
}>;

export function HumanAgentAvatarMotion(props: HumanAgentAvatarMotionProps) {
	return props.composition !== undefined ||
		props.options?.variant === "horizontal-group" ? (
		<HumanAgentAvatarGroupMotion {...props} />
	) : (
		<HumanAgentAvatarOrbitMotion {...props} />
	);
}

function HumanAgentAvatarOrbitMotion({
	agent,
	human,
	agentFirst,
	frameSize,
	agentSize,
	humanSize,
	topLeftInset,
	bottomRightInset,
	className,
	label,
	options,
	onAnimationComplete,
}: HumanAgentAvatarMotionProps) {
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref);
	const motionConfig = createHumanAgentAvatarOrbitMotion(options);
	const active = !motionConfig.config.pauseWhenOffscreen || inView;
	const { humanSize: humanTargetSize, agentSize: agentTargetSize } = resolveHumanAgentAvatarTargets(
		{ frameSize }, motionConfig.config,
	);
	// Handoff when the actual sizes cross, as in main's original 24px/16px swap.
	const sizeSwapAt = humanAgentAvatarSizeSwapProgress(agentSize, humanSize, agentTargetSize, humanTargetSize, motionConfig.config.scaleAmount);
	const agentOrbit = humanAgentAvatarOrbit(
		frameSize,
		agentSize,
		agentTargetSize,
		agentFirst,
		motionConfig,
		topLeftInset,
		bottomRightInset,
	);
	const humanOrbit = humanAgentAvatarOrbit(
		frameSize,
		humanSize,
		humanTargetSize,
		!agentFirst,
		motionConfig,
		topLeftInset,
		bottomRightInset,
	);
	const agentStartZIndex = agentFirst ? 0 : 2;
	const agentEndZIndex = agentFirst ? 2 : 0;
	return (
		<span
			aria-label={label}
			className={cn(className, "isolate")}
			data-animated="true"
			data-slot="human-agent-avatar"
			ref={ref}
			role="img"
		>
			<motion.span
				key={`agent:${motionConfig.key}`}
				animate={
					active
						? {
								transform: agentOrbit.transforms,
								zIndex: motionConfig.progress.map((progress) =>
									progress < sizeSwapAt
										? agentStartZIndex
										: agentEndZIndex,
								),
							}
						: { transform: agentOrbit.initial, zIndex: agentStartZIndex }
				}
				aria-hidden="true"
				className="absolute left-0 top-0 origin-top-left"
				data-avatar-role="agent"
				initial={false}
				style={{
					transform: agentOrbit.initial,
					willChange: active ? "transform" : undefined,
				}}
				transition={active ? motionConfig.transition : { duration: 0 }}
			>
				{agent()}
			</motion.span>
			<motion.span
				key={`human:${motionConfig.key}`}
				animate={
					active
						? { transform: humanOrbit.transforms }
						: { transform: humanOrbit.initial }
				}
				aria-hidden="true"
				className="absolute left-0 top-0 z-[1] origin-top-left"
				data-avatar-role="human"
				initial={false}
				onAnimationComplete={active && motionConfig.config.repeat !== "infinite" ? onAnimationComplete : undefined}
				style={{
					transform: humanOrbit.initial,
					willChange: active ? "transform" : undefined,
				}}
				transition={active ? motionConfig.transition : { duration: 0 }}
			>
				{human({
					scale: active ? humanOrbit.scales : 1,
					transition: active ? motionConfig.transition : { duration: 0 },
				})}
			</motion.span>
		</span>
	);
}
