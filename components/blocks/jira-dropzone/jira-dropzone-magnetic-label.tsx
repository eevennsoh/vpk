"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { MagneticProximityValues } from "@/components/ui-custom/hooks/use-magnetic-proximity";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export function JiraDropzoneMagneticLabel({ children, className, magnet, pinned = false }: Readonly<{
	children: ReactNode;
	className?: string;
	magnet: MagneticProximityValues;
	pinned?: boolean;
}>) {
	const shouldReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const stationary = pinned || shouldReduceMotion;
	return <motion.span
		className={cn("inline-block will-change-transform", className)}
		data-jira-dropzone-magnetic-label=""
		style={{ x: stationary ? 0 : magnet.labelX, y: stationary ? 0 : magnet.labelY }}
	>{children}</motion.span>;
}
