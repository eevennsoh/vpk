"use client";

import type { ReactElement } from "react";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function CopyFeedbackIcon({ copied, idleIcon, className }: Readonly<{
	copied: boolean;
	idleIcon: ReactElement;
	className?: string;
}>) {
	const reduceMotion = useReducedMotion();
	return (
		<span aria-hidden className={cn("grid size-4 shrink-0 place-items-center", className)}>
			<Icon className={cn("col-start-1 row-start-1 text-icon-subtle transition-opacity duration-fast ease-out-practical", copied ? "opacity-0" : "opacity-100")} render={idleIcon} />
			<motion.span
				className="col-start-1 row-start-1 grid size-4 place-items-center text-icon-success [&_svg]:text-icon-success!"
				initial={false}
				animate={{ opacity: copied ? 1 : 0, transform: copied ? "scale(1)" : "scale(0.35)" }}
				transition={{
					transform: { duration: reduceMotion ? 0 : copied ? motionDuration.normal : motionDuration.fast, ease: copied ? motionEase.inOut : motionEase.in },
					opacity: { duration: reduceMotion ? 0 : motionDuration.xxshort, delay: reduceMotion || copied ? 0 : motionDuration.fast, ease: motionEase.linear },
				}}
				style={{ willChange: "transform, opacity" }}
			>
				<Icon render={<StatusSuccessIcon label="" size="small" />} />
			</motion.span>
		</span>
	);
}
