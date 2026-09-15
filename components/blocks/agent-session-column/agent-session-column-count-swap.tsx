"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, type Transition } from "motion/react";

import { MonitorIcon } from "@/components/ui/vpk-icons";
import TextMorphing from "@/components/visual/text-morphing";
import type { TextMorphConfig } from "@/components/visual/text-morphing/data";

// Keep the number visible through brief gaps between arrival batches.
// Each increase restarts this window before the local icon returns.
const COUNT_SETTLE_MS = 4_000;

const SWAP_ENTER: Transition = { duration: 0.15, ease: [0.4, 1, 0.6, 1] }; // duration-normal + ease-out-practical
const SWAP_EXIT: Transition = { duration: 0.1, ease: [0.6, 0, 0.8, 0.6] }; // duration-fast + ease-in
const SWAP_REDUCED: Transition = { duration: 0 };

/** Both column presentations roll the same digit slots when the session total changes. */
const HEAD_COUNT_MORPH: TextMorphConfig = {
	variant: "slots",
	animation: "snappy",
	driftX: 0,
	driftY: 0,
	trend: 0,
	stagger: 0.02,
	initial: false,
	autoSize: true,
};

export function AgentSessionColumnCountMorph({ count }: Readonly<{ count: number }>) {
	return <TextMorphing config={HEAD_COUNT_MORPH} text={String(count)} />;
}

export function useRisingSessionCount(count: number): boolean {
	const previousCount = useRef(count);
	const [risingCount, setRisingCount] = useState<number | null>(null);

	useLayoutEffect(() => {
		const increased = count > previousCount.current;
		previousCount.current = count;
		if (!increased) {
			setRisingCount(null);
			return undefined;
		}

		setRisingCount(count);
		const timeoutId = window.setTimeout(() => setRisingCount(null), COUNT_SETTLE_MS);
		return () => window.clearTimeout(timeoutId);
	}, [count]);

	return risingCount === count;
}

export function AgentSessionColumnCountSwap({
	children,
	reducedMotion,
	rising,
}: Readonly<{
	children: ReactNode;
	reducedMotion: boolean | null;
	rising: boolean;
}>) {
	return (
		<span className="grid h-full w-full place-items-center">
			<motion.span
				animate={{
					opacity: rising ? 1 : 0,
					transform: reducedMotion ? "none" : rising ? "translateY(0px)" : "translateY(-4px)",
				}}
				className="col-start-1 row-start-1 flex items-center justify-center"
				data-agent-session-column-number=""
				initial={false}
				transition={reducedMotion ? SWAP_REDUCED : rising ? SWAP_ENTER : SWAP_EXIT}
			>
				{children}
			</motion.span>
			<motion.span
				animate={{
					opacity: rising ? 0 : 1,
					transform: reducedMotion ? "none" : rising ? "translateY(4px)" : "translateY(0px)",
				}}
				className="col-start-1 row-start-1 flex items-center justify-center text-icon-subtle"
				data-agent-session-column-local-icon=""
				initial={false}
				transition={reducedMotion ? SWAP_REDUCED : rising ? SWAP_EXIT : SWAP_ENTER}
			>
				<MonitorIcon label="" size="small" />
			</motion.span>
		</span>
	);
}
