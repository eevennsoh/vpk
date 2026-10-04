import type { Transition } from "motion/react";
import { motionEase } from "@/lib/motion";

export const METADATA_CONTENT_COLLAPSE_DURATION_MS = 200;
export const METADATA_CONTENT_EXPAND_DURATION_MS = 250;

export const METADATA_CONTENT_COLLAPSE_TRANSITION: Transition = {
	duration: METADATA_CONTENT_COLLAPSE_DURATION_MS / 1000,
	ease: motionEase.in,
};

export const METADATA_CONTENT_EXPAND_TRANSITION: Transition = {
	duration: METADATA_CONTENT_EXPAND_DURATION_MS / 1000,
	ease: motionEase.inOut,
};

export const METADATA_CONTENT_REDUCED_MOTION_TRANSITION: Transition = { duration: 0 };
