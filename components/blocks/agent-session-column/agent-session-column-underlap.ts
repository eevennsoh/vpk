import type { Transition } from "motion/react";

/** duration-normal + ease-out-practical — shadow arriving as columns underlap. */
export const AGENT_SESSION_UNDERLAP_SHADOW_ENTER: Transition = {
	duration: 0.15,
	ease: [0.4, 1, 0.6, 1],
};

/** duration-fast + ease-in — shadow leaving as scroll returns to rest. */
export const AGENT_SESSION_UNDERLAP_SHADOW_EXIT: Transition = {
	duration: 0.1,
	ease: [0.6, 0, 0.8, 0.6],
};

export const AGENT_SESSION_UNDERLAP_SHADOW_REDUCED: Transition = {
	duration: 0,
};
