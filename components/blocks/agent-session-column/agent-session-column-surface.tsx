"use client";

import { motion, type Transition } from "motion/react";
import type { ReactNode } from "react";

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
