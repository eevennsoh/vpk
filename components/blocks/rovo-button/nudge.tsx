"use client";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import CrossIcon from "@atlaskit/icon/core/cross";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconTile } from "@/components/ui/icon-tile";
import { motionDuration } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { resolveFloatingRovoButtonPlacement } from "./geometry";
import { FLOATING_ROVO_BUTTON_MORPH_SPRING } from "./motion";
import type {
	FloatingRovoButtonPlacement,
	FloatingRovoButtonPositioning,
	FloatingRovoButtonSuggestion,
} from "./types";

const SONNER_STACK_EASING = [0.25, 0.1, 0.25, 1] as const;

/**
 * Sonner-style countdown for one suggestion: paused while the stack is
 * expanded, resumed with the remaining time, and cancelled on unmount.
 */
function NudgeAutoDismiss({ delayMs, onDismiss, paused }: Readonly<{ delayMs: number; onDismiss: () => void; paused: boolean }>) {
	const remainingRef = useRef(delayMs);
	const dismiss = useEffectEvent(onDismiss);
	useEffect(() => {
		if (paused) return;
		const startedAt = Date.now();
		const timer = window.setTimeout(() => dismiss(), remainingRef.current);
		return () => {
			window.clearTimeout(timer);
			remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
		};
	}, [paused]);
	return null;
}

export function FloatingRovoButtonNudge({
	suggestions,
	placement,
	opensDialog = false,
	positioning = "viewport",
	shouldReduceMotion = false,
}: Readonly<{
	suggestions: readonly FloatingRovoButtonSuggestion[];
	placement?: FloatingRovoButtonPlacement;
	opensDialog?: boolean;
	positioning?: FloatingRovoButtonPositioning;
	shouldReduceMotion?: boolean;
}>) {
	const resolvedPlacement = resolveFloatingRovoButtonPlacement(placement);
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const stackRef = useRef<HTMLDivElement>(null);
	const [cardWidths, setCardWidths] = useState<Record<string, number>>({});
	const expanded = hovered || focused;
	const stackHeight = expanded ? 40 + (suggestions.length - 1) * 54 : 40;
	const contentTransition = shouldReduceMotion ? "none" : "color var(--duration-normal) var(--ease-out), background-color var(--duration-normal) var(--ease-out), opacity var(--duration-slow) ease";
	const frontWidth = cardWidths[suggestions.at(-1)?.id ?? ""];

	useLayoutEffect(() => {
		const cards = stackRef.current?.querySelectorAll<HTMLElement>("[data-nudge-id]");
		if (!cards) return;
		const measure = () => {
			const widths: Record<string, number> = {};
			cards.forEach((card) => { if (card.dataset.nudgeId) widths[card.dataset.nudgeId] = card.offsetWidth; });
			setCardWidths((current) => Object.keys(widths).length === Object.keys(current).length
				&& Object.keys(widths).every((id) => widths[id] === current[id]) ? current : widths);
		};
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		cards.forEach((card) => observer.observe(card));
		return () => observer.disconnect();
	}, [suggestions]);

	return (
		<motion.div
			aria-label="Rovo suggestions"
			role="region"
			className={cn(
				"z-[510] w-fit max-w-[calc(100vw-112px)] origin-right",
				positioning === "container" ? "absolute" : "fixed",
				placement ? null : "right-[84px] bottom-7",
			)}
			initial={shouldReduceMotion ? false : { opacity: 0, scaleX: 0.24, x: 52 }}
			animate={{ opacity: 1, scaleX: 1, x: 0 }}
			exit={shouldReduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scaleX: 0.24, x: 52 }}
			transition={{
				opacity: { duration: 0.12, ease: [0, 0, 0.2, 1] },
				// Shares the button's morph spring so the pill reads as being pushed
				// out of the button rather than animating on its own clock.
				scaleX: FLOATING_ROVO_BUTTON_MORPH_SPRING,
				x: FLOATING_ROVO_BUTTON_MORPH_SPRING,
			}}
			onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(true); }}
			onPointerLeave={() => setHovered(false)}
			onPointerDownCapture={() => setFocused(false)}
			onFocusCapture={(event) => setFocused(event.target.matches(":focus-visible"))}
			onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
			style={{
				...(placement
					? {
							right: `calc(${resolvedPlacement.right} + 60px)`,
							bottom: `calc(${resolvedPlacement.bottom} + 4px)`,
						}
					: {}),
				transformOrigin: "right center",
				willChange: "transform, opacity",
				backfaceVisibility: "hidden",
			}}
		>
			{suggestions.map((suggestion) => suggestion.autoDismissMs !== undefined && suggestion.onDismiss
				? <NudgeAutoDismiss delayMs={suggestion.autoDismissMs} key={suggestion.id} onDismiss={suggestion.onDismiss} paused={expanded} />
				: null)}
			<div ref={stackRef} className="relative grid w-max max-w-full grid-cols-[minmax(0,1fr)] items-end" style={{ width: expanded ? undefined : frontWidth }}>
				<div aria-hidden className="col-start-1 row-start-1" style={{ height: stackHeight }} />
				<AnimatePresence initial={false}>
			{[...suggestions].reverse().map((suggestion, index) => (
			<motion.div
				key={suggestion.id}
				data-nudge-id={suggestion.id}
				initial={shouldReduceMotion ? false : { opacity: 0, y: 40 }}
				animate={{ opacity: expanded || index < 3 ? 1 : 0, y: expanded ? -index * 54 : -Math.min(index, 2) * 14 }}
				exit={{ opacity: 0, y: shouldReduceMotion ? 0 : expanded ? -(index * 54 + 40) : index > 0 ? 16 : -40 }}
				transition={{ duration: shouldReduceMotion ? 0 : motionDuration.slow, ease: SONNER_STACK_EASING }}
				inert={!expanded && index > 0 ? true : undefined}
				className={cn(
					"relative col-start-1 row-start-1 flex w-max max-w-[calc(100vw-112px)] items-center justify-self-end gap-1 rounded-lg p-1 text-text-inverse",
					!expanded && index > 0 ? "pointer-events-none" : null,
				)}
				style={{ zIndex: suggestions.length - index }}
			>
			<motion.div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 rounded-lg"
				initial={false}
				animate={{
					x: !expanded && frontWidth ? -frontWidth * Math.min(index, 2) * 0.025 : 0,
					scaleX: !expanded && frontWidth && cardWidths[suggestion.id]
						? frontWidth / cardWidths[suggestion.id] * (1 - Math.min(index, 2) * 0.05)
						: 1,
					scaleY: expanded ? 1 : 1 - Math.min(index, 2) * 0.05,
				}}
				transition={{ duration: shouldReduceMotion ? 0 : motionDuration.slow, ease: SONNER_STACK_EASING }}
				style={{
					backgroundColor: !expanded && index > 0
						? token(index === 1 ? "color.background.neutral.bold.hovered" : "color.background.neutral.bold.pressed")
						: token("color.background.neutral.bold"),
					boxShadow: token("elevation.shadow.overlay"),
					originX: 1,
					originY: 0.5,
				}}
			/>
			<button
				aria-haspopup={opensDialog ? "dialog" : undefined}
				aria-label={suggestion.ariaLabel ?? suggestion.label}
				className={cn("relative flex min-h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-sm leading-5 font-medium text-text-inverse hover:bg-white/10 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none active:bg-white/15", !expanded && index > 0 ? "opacity-0" : null)}
				style={{ transition: contentTransition }}
				onClick={suggestion.onSelect}
				type="button"
			>
				{suggestion.icon ?? <IconTile as="span" aria-hidden className="text-icon-inverse" icon={<AiAgentIcon color={token("color.icon.inverse")} label="" size="small" />} label="" size="xxsmall" variant="transparent" />}
				<span className="min-w-0 truncate">{suggestion.label}</span>
			</button>
			{suggestion.onDismiss ? (
				<button
					aria-label={`Dismiss ${suggestion.label}`}
					className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-md text-icon-inverse hover:bg-white/10 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none active:bg-white/15", !expanded && index > 0 ? "opacity-0" : null)}
					style={{ transition: contentTransition }}
					onClick={(event) => {
						event.stopPropagation();
						suggestion.onDismiss?.();
					}}
					type="button"
				>
					<CrossIcon color={token("color.icon.inverse")} label="" size="small" />
				</button>
			) : null}
			</motion.div>
			))}
				</AnimatePresence>
			</div>
		</motion.div>
	);
}
