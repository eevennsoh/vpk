"use client";

import { useId, useRef, type ReactNode, type CSSProperties } from "react";
import { avatarHexagonPoints } from "@/components/ui/avatar-hexagon";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";

import {
	humanAgentAvatarOrbit,
	createHumanAgentAvatarOrbitMotion,
} from "@/components/ui-custom/human-agent-avatar-orbit";

import { humanAgentAvatarSizeSwapProgress, resolveHumanAgentAvatarTargets, type HumanAgentAvatarMotionOptions } from "@/components/ui-custom/human-agent-avatar-motion-config";

import { HumanAgentAvatarGroupMotion } from "@/components/ui-custom/human-agent-avatar-group-motion";

export type HumanAgentAvatarMotionProps = Readonly<{
	agent: (sizePx?: number) => ReactNode;
	human: (sizePx?: number) => ReactNode;
	agentFirst: boolean;
	frameSize: number;
	agentSize: number;
	humanSize: number;
	positions: { agent: CSSProperties; human: CSSProperties };
	cutout: CSSProperties;
	topLeftInset: number;
	bottomRightInset: number;
	className: string;
	label: string;
	options?: Partial<HumanAgentAvatarMotionOptions>;
	animate?: boolean;
	composition?: "compact" | "horizontal-group";
	groupSizePx?: 12 | 16 | 24;
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
	const maskId = useId().replaceAll(":", "");
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
	const agentInFront = motionConfig.progress.map((progress) => (progress < sizeSwapAt ? agentStartZIndex : agentEndZIndex) === 2);
	const relativeTransforms = (back: typeof agentOrbit.poses, front: typeof agentOrbit.poses) => back.map((pose, index) => {
		const other = front[index];
		return `translate(${(other.x - pose.x) / pose.scale}px, ${(other.y - pose.y) / pose.scale}px) scale(${other.scale / pose.scale})`;
	});
	const humanRelative = relativeTransforms(agentOrbit.poses, humanOrbit.poses);
	const agentRelative = relativeTransforms(humanOrbit.poses, agentOrbit.poses);
	const hexagonPoints = avatarHexagonPoints().map(({ xPercent, yPercent, xPixels, yPixels }) => `${xPercent * agentSize / 100 + xPixels},${yPercent * agentSize / 100 + yPixels}`).join(" ");
	return (
		<span
			aria-label={label}
			className={cn(className, "isolate")}
			data-animated="true"
			data-slot="human-agent-avatar"
			ref={ref}
			role="img"
		>
			<svg aria-hidden="true" className="absolute size-0" focusable="false">
				<defs>
					<mask id={`${maskId}-agent`} maskUnits="userSpaceOnUse" x="-50" y="-50" width="150" height="150">
						<rect x="-50" y="-50" width="150" height="150" fill="white" />
						<motion.g key={`agent-mask:${motionConfig.key}`} initial={false} animate={active ? { transform: humanRelative, opacity: agentInFront.map((front) => front ? 0 : 1) } : { transform: humanRelative[0], opacity: agentFirst ? 1 : 0 }} style={{ originX: 0, originY: 0, transformBox: "view-box" }} transition={active ? motionConfig.transition : { duration: 0 }}>
							<circle cx={humanSize / 2} cy={humanSize / 2} r={humanSize / 2 + 1.5} fill="black" />
						</motion.g>
					</mask>
					<mask id={`${maskId}-human`} maskUnits="userSpaceOnUse" x="-50" y="-50" width="150" height="150">
						<rect x="-50" y="-50" width="150" height="150" fill="white" />
						<motion.g key={`human-mask:${motionConfig.key}`} initial={false} animate={active ? { transform: agentRelative, opacity: agentInFront.map((front) => front ? 1 : 0) } : { transform: agentRelative[0], opacity: agentFirst ? 0 : 1 }} style={{ originX: 0, originY: 0, transformBox: "view-box" }} transition={active ? motionConfig.transition : { duration: 0 }}>
							<polygon points={hexagonPoints} fill="black" stroke="black" strokeWidth="3" strokeLinejoin="round" />
						</motion.g>
					</mask>
				</defs>
			</svg>
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
					maskImage: `url(#${maskId}-agent)`,
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
					maskImage: `url(#${maskId}-human)`,
					willChange: active ? "transform" : undefined,
				}}
				transition={active ? motionConfig.transition : { duration: 0 }}
			>
				{human()}
			</motion.span>
		</span>
	);
}
