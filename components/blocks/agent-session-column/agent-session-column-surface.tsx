"use client";

import { motion, type Transition } from "motion/react";
import type { ReactNode } from "react";

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

export function AgentSessionColumnSurface({
	borderColor,
	boxShadow,
	children,
	className,
	hidden = false,
	marginBlock,
	transition,
}: Readonly<{
	borderColor: string;
	boxShadow: string;
	children: ReactNode;
	className: string;
	hidden?: boolean;
	marginBlock: number;
	transition: Transition;
}>) {
	return (
		<motion.div
			aria-hidden={hidden || undefined}
			className={className}
			data-agent-session-column-surface=""
			inert={hidden || undefined}
			animate={{
				boxShadow,
				marginBottom: marginBlock,
				marginTop: marginBlock,
			}}
			initial={false}
			style={{ borderColor }}
			transition={transition}
		>
			{children}
		</motion.div>
	);
}
