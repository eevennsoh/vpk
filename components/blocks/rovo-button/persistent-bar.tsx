"use client";

import { motion, useIsPresent, usePresenceData } from "motion/react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { FloatingRovoButtonPersistentBar, FloatingRovoButtonPersistentBarItem } from "./types";
import { motionEase } from "@/lib/motion";

export function FloatingRovoButtonPersistentBarRail({
	bar,
	indicatorActionId,
	indicatorInFlight = false,
	onIndicatorPress,
	side,
	shouldReduceMotion,
}: Readonly<{
	bar: FloatingRovoButtonPersistentBar;
	indicatorActionId?: string;
	indicatorInFlight?: boolean;
	onIndicatorPress?: (button: DOMRect, dot: DOMRect | undefined, item: FloatingRovoButtonPersistentBarItem) => void;
	side: "top" | "bottom";
	shouldReduceMotion: boolean;
}>) {
	const isPresent = useIsPresent();
	const opensFromIndicator = usePresenceData() === true;
	const [tooltipItem, setTooltipItem] = useState<string | null>(null);
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

	if (!isPresent && opensFromIndicator) return null;

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
			initial={indicatorInFlight ? false : "hidden"}
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
							data-toolbar-action-id={item.id}
							className={cn(
								"relative flex items-center justify-center text-icon transition-colors duration-normal ease-out focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none disabled:cursor-default disabled:text-icon-disabled",
								singleAction ? "size-12 rounded-2xl bg-surface-raised" : "size-8 rounded-xl",
								singleAction ? "enabled:active:bg-surface-raised-pressed" : "enabled:hover:bg-bg-neutral-subtle-hovered enabled:active:bg-bg-neutral-subtle-pressed",
							)}
							variants={itemVariants}
							onClick={(event) => {
								setTooltipItem(null);
								if (item.id === indicatorActionId) {
									const dot = event.currentTarget.querySelector("[data-notification-dot]");
									onIndicatorPress?.(event.currentTarget.getBoundingClientRect(), dot?.getBoundingClientRect(), item);
								}
								item.onClick?.();
							}}
							disabled={!item.onClick}
							type="button"
							whileHover={!indicatorInFlight && singleAction && item.onClick && !shouldReduceMotion ? { scale: 1.1 } : undefined}
							style={{ willChange: "transform, opacity", boxShadow: singleAction ? token("elevation.shadow.overlay") : undefined }}
						>
							<span className="relative inline-flex shrink-0 items-center justify-center">
								{item.icon}
								{item.indicator && !(indicatorInFlight && item.id === indicatorActionId && bar.panelTransition === "dot") ? (
									<span
										aria-hidden="true"
										className="absolute top-0 right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-info ring-2 ring-surface-raised"
										data-notification-dot
									/>
								) : null}
							</span>
						</motion.button>
					);

					return item.tooltipLabel ? (
						<Tooltip key={item.id} open={!indicatorInFlight && tooltipItem === item.id} onOpenChange={(open) => setTooltipItem((current) => open ? item.id : current === item.id ? null : current)}>
							<TooltipTrigger render={actionButton} />
							<TooltipContent side="left" positionerClassName="z-[520]">{item.tooltipLabel}</TooltipContent>
						</Tooltip>
					) : actionButton;
				})}
			</TooltipProvider>
		</motion.div>
	);
}
