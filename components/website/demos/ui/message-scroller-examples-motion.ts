"use client";

import { motion } from "motion/react";
import { motionDuration, motionEase } from "@/lib/motion";
import { MessageScrollerItem } from "@/components/ui/message-scroller";

export const MotionMessageScrollerItem = motion.create(MessageScrollerItem);

/** shadcn's default entrance (`MESSAGE_ANIMATIONS["slide-up"]`) on VPK motion tokens. */
export const slideUpEntrance = {
	initial: { opacity: 0, y: 10 },
	animate: { opacity: 1, y: 0 },
	transition: { duration: motionDuration.slow, ease: motionEase.out },
} as const;
