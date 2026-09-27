"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { AgentSessionColumnCountMorph } from "@/components/blocks/agent-session-column/agent-session-column-count-swap";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { AnimatedIcon } from "@/components/ui-custom/animated-icon";
import { ShimmerWave } from "@/components/ui-custom/shimmer-wave";
import { RovoGeneration } from "@/components/ui-custom/rovo-generation";
import { getShimmerWaveEndTime } from "@/components/ui-custom/lib/shimmer-wave-timing";

const AUTO_ARRANGE_LABEL = "Auto arrange";
const WAVE_DURATION = 1; // Give the full sparkle sequence time to play and return to rest.
const WAVE_SPREAD = 3;
const DETECTION_DURATION = getShimmerWaveEndTime(AUTO_ARRANGE_LABEL, WAVE_DURATION, WAVE_SPREAD);
const COUNTER_ENTER = { duration: 0.15, ease: [0.4, 1, 0.6, 1] as const }; // duration-normal + ease-out-practical
const COUNTER_EXIT = { duration: 0.1, ease: [0.6, 0, 0.8, 0.6] as const }; // duration-fast + ease-in
const COUNTER_TRACE_DURATION = 0.6; // duration-slowest
const COUNTER_TRACE_DELAY = 0.4; // duration-slower: let the header's snappy count morph settle first.

function AutoArrangeSparkle({ play }: Readonly<{ play: boolean }>) {
	const [phase, setPhase] = useState<"playing" | "returning" | "static">(play ? "playing" : "static");
	const handleReplayReturn = useCallback(() => setPhase("returning"), []);
	const handleReplayComplete = useCallback(() => setPhase("static"), []);
	return (
		<span className="flex size-3" data-auto-arrange-sparkle-phase={play ? phase : "static"}>
			<AnimatedIcon name="ai-sparkle" size={12} className="text-icon-subtle" singleColor={false} replayOnHover={false} replayOnFocus={false}
				playOnMount={play} replayDuration={DETECTION_DURATION} onReplayReturn={handleReplayReturn} onReplayComplete={handleReplayComplete} />
		</span>
	);
}

export function BoardAutoArrangeAction({ ready, available = true, onArrange }: Readonly<{ ready: boolean; available?: boolean; onArrange: () => void }>) {
	const reduceMotion = useReducedMotion();
	if (!available) return null;
	return (
		<Button aria-label={ready ? "Auto arrange" : "Preparing auto arrange"} aria-keyshortcuts="Meta+Enter Control+Enter" variant="ghost" size="default" disabled={!ready} onClick={onArrange}>
			<span aria-hidden className="relative flex size-4 shrink-0 items-center justify-center">
				<AnimatePresence initial={false}>
					<motion.span key={ready || !available ? "sparkle" : "spinner"} className="absolute inset-0 flex items-center justify-center"
						initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.1 } }}
						transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.4, 1, 0.6, 1] }} style={{ willChange: "transform, opacity" }}>
						{ready || !available ? <AutoArrangeSparkle play={ready && !reduceMotion} /> : <Spinner size="sm" variant="inherit" />}
					</motion.span>
				</AnimatePresence>
			</span>
			{ready && !reduceMotion ? <span aria-hidden data-auto-arrange-shimmer><ShimmerWave as="span" baseColor="var(--ds-text)" baseGradientColor={["var(--color-orange-300)", "var(--color-lime-400)", "var(--color-blue-600)", "var(--color-purple-500)"]}
				duration={WAVE_DURATION} spread={WAVE_SPREAD} xDistance={0} yDistance={-1} zDistance={0} rotateYDistance={0} scaleDistance={1.04}
				transition={{ repeat: 0, ease: [0.4, 0, 0, 1] }}>{AUTO_ARRANGE_LABEL}</ShimmerWave></span> : <span>{AUTO_ARRANGE_LABEL}</span>}
			<KbdGroup aria-label="Command Enter"><Kbd>Cmd</Kbd><Kbd>Return</Kbd></KbdGroup>
		</Button>
	);
}

export function BoardAutoArrangeBadge({ count, title }: Readonly<{ count: number | undefined; title: string }>) {
	const reduceMotion = useReducedMotion();
	return (
		<AnimatePresence>
			{count !== undefined && count > 0 ? (
				<motion.div key="counter" role="status" data-auto-arrange-count={count} aria-label={`${count} card${count === 1 ? "" : "s"} to arrange in ${title}`}
					className="flex shrink-0" initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.8, transition: { ...COUNTER_EXIT, duration: reduceMotion ? 0 : COUNTER_EXIT.duration } }}
					transition={{ ...COUNTER_ENTER, duration: reduceMotion ? 0 : COUNTER_ENTER.duration }} style={{ willChange: "transform, opacity" }}>
					<RovoGeneration.Highlight className="inline-flex" duration={COUNTER_TRACE_DURATION} delay={COUNTER_TRACE_DELAY} playToken={count}>
						<Badge max={false}><span aria-hidden="true"><AgentSessionColumnCountMorph count={count} /></span></Badge>
					</RovoGeneration.Highlight>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
