"use client";

import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { FloatingRovoButtonPersistentBar } from "./types";
import { motionEase } from "@/lib/motion";

export function FloatingRovoButtonPersistentBarRail({
	bar,
	side,
	shouldReduceMotion,
}: Readonly<{
	bar: FloatingRovoButtonPersistentBar;
	side: "top" | "bottom";
	shouldReduceMotion: boolean;
}>) {
	const singleAction = bar.items.length === 1;
	// Tuck the bar slightly toward the button as it leaves/enters so the motion
	// reads as "snapping out of / back into" the button rather than a flat fade.
	const tuckOffset = side === "top" ? 10 : -10;
	// Centering rides on `x: "-50%"`; it must stay constant across every variant
	// so Motion never animates the horizontal offset (it owns the transform).
	const railVariants = shouldReduceMotion
		? {
			hidden: { opacity: 0, x: "-50%" as const },
			visible: { opacity: 1, x: "-50%" as const, transition: { duration: 0 } },
			exit: { opacity: 0, x: "-50%" as const, transition: { duration: 0 } },
		}
		: {
			hidden: { opacity: 0, scale: 0.9, x: "-50%" as const, y: tuckOffset },
			visible: {
				opacity: 1,
				scale: 1,
				x: "-50%" as const,
				y: 0,
				transition: {
					type: "spring" as const,
					bounce: 0,
					visualDuration: 0.26,
					delayChildren: 0.06,
					staggerChildren: 0.05,
				},
			},
			exit: {
				opacity: 0,
				scale: 0.88,
				x: "-50%" as const,
				y: tuckOffset,
				transition: { duration: 0.12, ease: motionEase.in },
			},
		};
	const itemVariants = shouldReduceMotion
		? {
			hidden: { opacity: 0 },
			visible: { opacity: 1, transition: { duration: 0 } },
		}
		: {
			hidden: { opacity: 0, scale: 0.5 },
			visible: {
				opacity: 1,
				scale: 1,
				transition: { type: "spring" as const, bounce: 0.3, visualDuration: 0.3 },
			},
		};

	return (
		<motion.div
			key="floating-rovo-button-persistent-bar"
			role="toolbar"
			aria-orientation="vertical"
			aria-label={bar.ariaLabel ?? "Rovo quick actions"}
			className={cn(
				"pointer-events-auto absolute left-1/2 z-[505] flex cursor-default flex-col items-center gap-1 rounded-2xl",
				singleAction ? null : "bg-surface-raised p-2",
				side === "top" ? "bottom-full mb-3" : "top-full mt-3",
			)}
			variants={railVariants}
			initial="hidden"
			animate="visible"
			exit="exit"
			style={{
				boxShadow: singleAction ? undefined : token("elevation.shadow.overlay"),
				transformOrigin: side === "top" ? "center bottom" : "center top",
				willChange: "transform, opacity",
			}}
		>
			<TooltipProvider delay={0}>
				{bar.items.map((item) => {
					const actionButton = (
						<motion.button
							key={item.id}
							aria-label={item.ariaLabel}
							className={cn(
								"relative flex items-center justify-center text-icon transition-colors duration-normal ease-out focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none disabled:cursor-default disabled:text-icon-disabled",
								singleAction ? "size-12 rounded-2xl bg-surface-raised" : "size-8 rounded-xl",
								singleAction ? "enabled:active:bg-surface-raised-pressed" : "enabled:hover:bg-bg-neutral-subtle-hovered enabled:active:bg-bg-neutral-subtle-pressed",
							)}
							variants={itemVariants}
							onClick={item.onClick}
							disabled={!item.onClick}
							type="button"
							whileHover={singleAction && item.onClick && !shouldReduceMotion ? { scale: 1.1 } : undefined}
							style={{ willChange: "transform, opacity", boxShadow: singleAction ? token("elevation.shadow.overlay") : undefined }}
						>
							{item.icon}
							{item.indicator ? (
								<span
									aria-hidden="true"
									className="absolute top-1.5 right-1.5 size-2 rounded-full bg-bg-information ring-2 ring-surface-raised"
								/>
							) : null}
						</motion.button>
					);

					return item.tooltipLabel ? (
						<Tooltip key={item.id}>
							<TooltipTrigger render={actionButton} />
							<TooltipContent side="left" positionerClassName="z-[520]">{item.tooltipLabel}</TooltipContent>
						</Tooltip>
					) : actionButton;
				})}
			</TooltipProvider>
		</motion.div>
	);
}
