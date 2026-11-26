"use client";

import type { ComponentProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ScrambleText as MotionPlusScrambleText } from "motion-plus/react";

export function ScrambleText({ children, className }: Readonly<ComponentProps<typeof MotionPlusScrambleText>>) {
	const reduceMotion = useReducedMotion();
	return <motion.span animate={{ opacity: 1 }} className={className} initial={reduceMotion ? false : { opacity: 0 }} key={children}>{children}</motion.span>;
}

export function useTicker(): never {
	throw new Error("Ticker is unavailable without Motion+.");
}
