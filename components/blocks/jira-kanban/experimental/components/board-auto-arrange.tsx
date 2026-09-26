"use client";

import AiSparkleIcon from "@atlaskit/icon/core/ai-sparkle";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { ShimmerWave } from "@/components/ui-custom/shimmer-wave";
import { RovoGeneration } from "@/components/ui-custom/rovo-generation";

export function BoardAutoArrangeAction({ ready, onArrange }: Readonly<{ ready: boolean; onArrange: () => void }>) {
	const reduceMotion = useReducedMotion();
	return (
		<Button aria-label={ready ? "Auto arrange" : "Preparing auto arrange"} aria-keyshortcuts="Enter" variant="ghost" size="compact" disabled={!ready} onClick={onArrange}>
			<span aria-hidden className="relative flex size-4 shrink-0 items-center justify-center">
				<AnimatePresence initial={false}>
					<motion.span key={ready ? "sparkle" : "spinner"} className="absolute inset-0 flex items-center justify-center"
						initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.1 } }}
						transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.4, 1, 0.6, 1] }} style={{ willChange: "transform, opacity" }}>
						{ready ? <Icon render={<AiSparkleIcon label="" size="small" />} /> : <Spinner size="sm" variant="inherit" />}
					</motion.span>
				</AnimatePresence>
			</span>
			{ready && !reduceMotion ? <span aria-hidden><ShimmerWave as="span" baseColor="var(--ds-text)" baseGradientColor={["var(--color-orange-300)", "var(--color-lime-400)", "var(--color-blue-600)", "var(--color-purple-500)"]}
				duration={0.4} spread={3} xDistance={0} yDistance={-1} zDistance={0} rotateYDistance={0} scaleDistance={1.04}
				transition={{ repeat: 0, ease: [0.4, 0, 0, 1] }}>Auto arrange</ShimmerWave></span> : <span>Auto arrange</span>}
			<Kbd aria-label="Return">Return</Kbd>
		</Button>
	);
}

export function BoardAutoArrangeBadge({ count, title }: Readonly<{ count: number | undefined; title: string }>) {
	const reduceMotion = useReducedMotion();
	return count !== undefined && count > 0 ? (
		<motion.div role="status" data-auto-arrange-count={count} aria-label={`${count} card${count === 1 ? "" : "s"} to arrange in ${title}`}
			className="flex shrink-0" initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.4, 1, 0.6, 1] }} style={{ willChange: "transform, opacity" }}>
			<RovoGeneration.Highlight className="inline-flex"><Badge max={false}>{count}</Badge></RovoGeneration.Highlight>
		</motion.div>
	) : null;
}
