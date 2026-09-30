import type { Transition } from "motion/react";
import { motionEase } from "@/lib/motion";

/** duration-normal + ease-out-practical — shadow arriving as columns underlap. */
export const AGENT_SESSION_UNDERLAP_SHADOW_ENTER: Transition = {
	duration: 0.15,
	ease: motionEase.outPractical,
};

/** duration-fast + ease-in — shadow leaving as scroll returns to rest. */
export const AGENT_SESSION_UNDERLAP_SHADOW_EXIT: Transition = {
	duration: 0.1,
	ease: motionEase.in,
};

export const AGENT_SESSION_UNDERLAP_SHADOW_REDUCED: Transition = {
	duration: 0,
};
