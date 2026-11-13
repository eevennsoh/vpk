"use client";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import CrossIcon from "@atlaskit/icon/core/cross";
import { motion } from "motion/react";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { resolveFloatingRovoButtonPlacement } from "./geometry";
import { FLOATING_ROVO_BUTTON_MORPH_SPRING } from "./motion";
import type {
	FloatingRovoButtonPlacement,
	FloatingRovoButtonPositioning,
	FloatingRovoButtonSuggestion,
} from "./types";

export function FloatingRovoButtonNudge({
	suggestion,
	placement,
	positioning = "viewport",
	shouldReduceMotion = false,
}: Readonly<{
	suggestion: FloatingRovoButtonSuggestion;
	placement?: FloatingRovoButtonPlacement;
	positioning?: FloatingRovoButtonPositioning;
	shouldReduceMotion?: boolean;
}>) {
	const resolvedPlacement = resolveFloatingRovoButtonPlacement(placement);

	return (
		<motion.div
			key={suggestion.id}
			className={cn(
				"z-[510] flex w-fit max-w-[calc(100vw-112px)] origin-right items-center gap-1 overflow-hidden rounded-lg p-1 text-text-inverse",
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
			style={{
				...(placement
					? {
							right: `calc(${resolvedPlacement.right} + 60px)`,
							bottom: `calc(${resolvedPlacement.bottom} + 4px)`,
						}
					: {}),
				backgroundColor: token("color.background.neutral.bold"),
				boxShadow: token("elevation.shadow.overlay"),
				transformOrigin: "right center",
				willChange: "transform, opacity",
				backfaceVisibility: "hidden",
			}}
		>
			<button
				aria-label={suggestion.ariaLabel ?? suggestion.label}
				className="flex min-h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-sm leading-5 font-medium text-text-inverse transition-colors duration-normal ease-out hover:bg-white/10 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none active:bg-white/15"
				onClick={suggestion.onSelect}
				type="button"
			>
				{suggestion.icon ?? <AiAgentIcon color={token("color.icon.inverse")} label="" size="small" />}
				<span className="min-w-0 truncate">{suggestion.label}</span>
			</button>
			{suggestion.onDismiss ? (
				<button
					aria-label={`Dismiss ${suggestion.label}`}
					className="flex size-8 shrink-0 items-center justify-center rounded-md text-icon-inverse transition-colors duration-normal ease-out hover:bg-white/10 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none active:bg-white/15"
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
	);
}
