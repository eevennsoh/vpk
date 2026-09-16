import { cubicBezier, type Transition } from "motion/react";

import {
	resolveHumanAgentAvatarMotion,
	type HumanAgentAvatarMotionOptions,
} from "@/components/ui-custom/human-agent-avatar-motion-config";

export function createHumanAgentAvatarOrbitMotion(
	options?: Partial<HumanAgentAvatarMotionOptions>,
) {
	const config = resolveHumanAgentAvatarMotion(options);
	const duration = config.durationMs / 1000;
	const between = config.betweenTurnsMs / 1000;
	const cycle = 2 * duration + between + config.repeatDelayMs / 1000;
	const samples = Math.max(64, Math.ceil(config.durationMs / 6.25));
	const ease = cubicBezier(...config.ease);
	const forward = Array.from({ length: samples }, (_, index) =>
		ease((index + 1) / samples),
	);
	const transition: Transition = {
		duration: cycle,
		delay: config.initialDelayMs / 1000,
		// The path contains one complete easing curve per turn; native interpolation stays linear.
		ease: "linear",
		times: [
			0,
			...forward.map((_, index) => (duration * (index + 1)) / samples),
			duration + between,
			...forward.map(
				(_, index) => duration + between + (duration * (index + 1)) / samples,
			),
			cycle,
		].map((time) => time / cycle),
		repeat: config.repeat === "infinite" ? Infinity : config.repeat,
	};
	return {
		config,
		forward,
		progress: [0, ...forward, 1, ...forward.map((value) => 1 - value), 0],
		transition,
		key: JSON.stringify(config),
	};
}

/** Sample a rounded, clockwise arc with no midpoint corner or easing restart. */
export function humanAgentAvatarOrbit(
	frameSize: number,
	baseSize: number,
	targetSizePx: number,
	startsTopLeft: boolean,
	motion: ReturnType<typeof createHumanAgentAvatarOrbitMotion>,
	topLeftInset = 0,
	bottomRightInset = 0,
) {
	const targetSize =
		baseSize + (targetSizePx - baseSize) * motion.config.scaleAmount;
	const point = (progress: number, returning: boolean) => {
		const size = returning
			? targetSize + (baseSize - targetSize) * progress
			: baseSize + (targetSize - baseSize) * progress;
		const topLeft = returning ? !startsTopLeft : startsTopLeft;
		// A Bézier arc with its interior controls at the outer corner.
		// It rounds the corner while staying in the frame and keeping the identities apart.
		const bend = progress ** motion.config.curvature;
		const opposite = 1 - (1 - progress) ** motion.config.curvature;
		const x = motion.config.direction === "clockwise" ? opposite : bend;
		const y = motion.config.direction === "clockwise" ? bend : opposite;
		const offset = frameSize - size - topLeftInset - bottomRightInset;
		return `translate(${topLeftInset + (topLeft ? x : 1 - x) * offset}px, ${topLeftInset + (topLeft ? y : 1 - y) * offset}px) scale(${size / baseSize})`;
	};
	const initial = point(0, false);
	const swapped = point(1, false);
	return {
		initial,
		scales: motion.progress.map(
			(progress) => (baseSize + (targetSize - baseSize) * progress) / baseSize,
		),
		transforms: [
			initial,
			...motion.forward.map((progress) => point(progress, false)),
			swapped,
			...motion.forward.map((progress) => point(progress, true)),
			initial,
		],
	};
}
