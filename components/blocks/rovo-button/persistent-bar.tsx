"use client";

import { AnimatePresence, motion, useIsPresent, usePresenceData } from "motion/react";
import { useEffect, useEffectEvent, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { FloatingRovoButtonPersistentBar, FloatingRovoButtonPersistentBarItem } from "./types";
import { motionDuration, motionEase } from "@/lib/motion";

/** How long a nudge keeps its tooltip open before it steps back. */
const NUDGE_MS = 3200;

export function FloatingRovoButtonPersistentBarRail({
	appearAtRest = false,
	bar,
	indicatorActionId,
	indicatorInFlight = false,
	onIndicatorPress,
	onSettled,
	side,
	shouldReduceMotion,
}: Readonly<{
	/** Mount already in place, skipping the entrance, and report settled straight away. */
	appearAtRest?: boolean;
	bar: FloatingRovoButtonPersistentBar;
	indicatorActionId?: string;
	indicatorInFlight?: boolean;
	onIndicatorPress?: (button: DOMRect, dot: DOMRect | undefined, item: FloatingRovoButtonPersistentBarItem) => void;
	/** The rail has landed at rest, so its actions can be measured as the place panels open from and close into. */
	onSettled?: () => void;
	side: "top" | "bottom";
	shouldReduceMotion: boolean;
}>) {
	const isPresent = useIsPresent();
	const opensFromIndicator = usePresenceData() === true;
	const [tooltipItem, setTooltipItem] = useState<string | null>(null);
	// Nudges already shown, seeded from mount so a remounted rail never repeats one.
	const [seenNudges, setSeenNudges] = useState<Readonly<Record<string, number | undefined>>>(() => Object.fromEntries(bar.items.map((item) => [item.id, item.nudge])));
	const [nudgedItem, setNudgedItem] = useState<string | null>(null);
	// The dot pops in when it first appears, but returns silently after it flew into a panel and back.
	const [dotPops, setDotPops] = useState(true);
	const freshNudge = bar.items.find((item) => item.nudge && item.nudge !== seenNudges[item.id]);
	if (freshNudge) {
		setSeenNudges((seen) => ({ ...seen, [freshNudge.id]: freshNudge.nudge }));
		setTooltipItem(freshNudge.id);
		setNudgedItem(freshNudge.id);
	}
	if (indicatorInFlight && dotPops) setDotPops(false);
	else if (!indicatorInFlight && !dotPops && !bar.items.some((item) => item.indicator)) setDotPops(true);
	useEffect(() => {
		if (!nudgedItem) return undefined;
		const timer = window.setTimeout(() => {
			setTooltipItem((current) => current === nudgedItem ? null : current);
			setNudgedItem(null);
		}, NUDGE_MS);
		return () => window.clearTimeout(timer);
	}, [nudgedItem]);
	// With no entrance there is no animation to complete, so a rail that appears at rest says so as it mounts.
	const settleOnMount = useEffectEvent(() => {
		if (appearAtRest) onSettled?.();
	});
	useEffect(() => settleOnMount(), []);
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
			initial={indicatorInFlight || appearAtRest ? false : "hidden"}
			animate="visible"
			exit="exit"
			onAnimationComplete={(definition) => { if (definition === "visible") onSettled?.(); }}
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
							aria-busy={item.busy || undefined}
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
								<AnimatePresence>
									{item.indicator && !(indicatorInFlight && item.id === indicatorActionId && bar.panelTransition === "dot") ? (
										<motion.span
											animate={{ scale: 1, opacity: 1, transition: { type: "spring", visualDuration: 0.34, bounce: 0.5 } }}
											aria-hidden="true"
											className="absolute top-0 right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-info ring-2 ring-surface-raised"
											data-notification-dot
											exit={indicatorInFlight ? { opacity: 0, transition: { duration: 0 } } : { scale: 0, opacity: 0, transition: { duration: motionDuration.fast, ease: motionEase.in } }}
											initial={dotPops && !shouldReduceMotion ? { scale: 0, opacity: 0 } : false}
											style={{ willChange: "transform, opacity" }}
										/>
									) : null}
								</AnimatePresence>
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
