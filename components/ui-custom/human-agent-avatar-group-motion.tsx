"use client";

import { useId, useRef } from "react";
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useInView,
	useIsPresent,
	type Transition,
} from "motion/react";

import { AvatarGroup, type AvatarGroupProps } from "@/components/ui/avatar";
import type { HumanAgentAvatarMotionProps } from "@/components/ui-custom/human-agent-avatar-motion";
import { resolveHumanAgentAvatarMotion } from "@/components/ui-custom/human-agent-avatar-motion-config";
import { useHumanAgentAvatarGroupCycle } from "@/components/ui-custom/use-human-agent-avatar-group-cycle";

const PX_TO_GROUP_SIZE: Record<number, NonNullable<AvatarGroupProps["size"]>> = {
	12: "xxs",
	16: "xs",
	24: "sm",
};

function GroupComposition({
	grouped,
	agent,
	human,
	agentFirst,
	agentSize,
	humanSize,
	positions,
	label,
	transition,
}: Readonly<
	Pick<
		HumanAgentAvatarMotionProps,
		"agent" | "human" | "agentFirst" | "agentSize" | "humanSize" | "label" | "positions"
	> & { grouped: boolean; transition: Transition }
>) {
	const present = useIsPresent();
	const groupSize = Math.min(agentSize, humanSize);
	const positionClassName = grouped ? undefined : "absolute";
	const slotPositions: Partial<HumanAgentAvatarMotionProps["positions"]> = grouped ? {} : positions;
	const willChange = transition.duration === 0 ? undefined : "transform";
	const humanAvatar = (
		<motion.span
			aria-hidden="true"
			className={positionClassName}
			data-avatar-role="human"
			key="human"
			layoutId="human"
			transition={{ layout: transition }}
			style={{ ...slotPositions.human, willChange }}
		>
			{human(undefined, grouped ? groupSize : undefined)}
		</motion.span>
	);
	const agentAvatar = (
		<motion.span
			aria-hidden="true"
			className={positionClassName}
			data-avatar-role="agent"
			key="agent"
			layoutId="agent"
			transition={{ layout: transition }}
			style={{ ...slotPositions.agent, willChange }}
		>
			{agent(grouped ? groupSize : undefined, grouped ? false : agentSize < humanSize)}
		</motion.span>
	);
	const avatars = agentFirst
		? [agentAvatar, humanAvatar]
		: [humanAvatar, agentAvatar];
	return (
		<motion.span
			aria-hidden={present ? undefined : true}
			className="absolute inset-0 flex items-center justify-center"
			exit={{ opacity: 0 }}
			transition={{
				duration: transition.duration === 0 ? 0 : 0.1,
				ease: [0.6, 0, 0.8, 0.6],
			}}
		>
			{grouped ? (
				<AvatarGroup label={label} size={PX_TO_GROUP_SIZE[groupSize]}>
					{avatars}
				</AvatarGroup>
			) : (
				avatars
			)}
		</motion.span>
	);
}

export function HumanAgentAvatarGroupMotion({
	options,
	className,
	label,
	animate = true,
	composition,
	onAnimationComplete,
	...props
}: HumanAgentAvatarMotionProps) {
	const id = useId();
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref);
	const config = resolveHumanAgentAvatarMotion(options);
	const active = !config.pauseWhenOffscreen || inView;
	const cycled = useHumanAgentAvatarGroupCycle(
		config,
		active && animate,
		composition === undefined ? undefined : composition === "horizontal-group",
		onAnimationComplete,
	);
	const grouped = animate ? cycled : composition === "horizontal-group";
	const transition: Transition = {
		duration: active && animate ? config.durationMs / 1000 : 0,
		ease: [...config.ease],
	};

	return (
		<LayoutGroup id={id}>
			<span
				aria-label={grouped ? undefined : label}
				className={className}
				data-slot="human-agent-avatar"
				data-animated={animate ? "true" : "false"}
				data-animation-variant="horizontal-group"
				data-composition={grouped ? "group" : "compact"}
				ref={ref}
				role={grouped ? undefined : "img"}
			>
				<AnimatePresence initial={false}>
					<GroupComposition
						{...props}
						label={label}
						key={grouped ? "group" : "compact"}
						grouped={grouped}
						transition={transition}
					/>
				</AnimatePresence>
			</span>
		</LayoutGroup>
	);
}
