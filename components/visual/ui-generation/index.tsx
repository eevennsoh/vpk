"use client";

import { useEffectEvent, useLayoutEffect, useRef, type Key, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import { SKIP_ATTRIBUTE } from "./measure";
import { GENERATION_DEFAULTS, startGeneration } from "./run";

export { GENERATION_DEFAULTS as UI_GENERATION_DEFAULTS } from "./run";
export { SKIP_ATTRIBUTE as UI_GENERATION_SKIP_ATTRIBUTE } from "./measure";

export interface UIGenerationProps {
	/** The real UI. The drawing is measured from it, so it must be rendered at its final size. */
	readonly children: ReactNode;
	/** Change it to play the build again, for example when new data arrives. The build also plays on mount. */
	readonly playKey?: Key;
	/** ms of drawing; the whole build is about `duration × 1.09`. Keep it between 1600 and 3600. */
	readonly duration?: number;
	/** ms before the build starts, to stagger several elements. */
	readonly delay?: number;
	/** Most parts traced; the largest are kept. */
	readonly maxParts?: number;
	/** Key elements (interactive boxes first, then the largest) that get guides, handles and a size label. */
	readonly keys?: number;
	/** Called once the real UI is fully in, or at once under reduced motion. */
	readonly onComplete?: () => void;
	readonly className?: string;
}

/**
 * Plays an "agent is generating this" build over its children: a dot field,
 * construction guides, the dotted outline and every part traced from the
 * children's own layout, then the real UI wiped in behind a scan line.
 *
 * Under reduced motion the drawing is skipped and the UI is shown as is.
 */
export function UIGeneration({
	children,
	playKey,
	duration = GENERATION_DEFAULTS.duration,
	delay = GENERATION_DEFAULTS.delay,
	maxParts = GENERATION_DEFAULTS.maxParts,
	keys = GENERATION_DEFAULTS.keys,
	onComplete,
	className,
}: Readonly<UIGenerationProps>) {
	const contentRef = useRef<HTMLDivElement>(null);
	const overlayRef = useRef<HTMLDivElement>(null);
	const reduceMotion = useReducedMotion() === true;

	// Options are read when a build starts; changing them mid-build does not restart it.
	const start = useEffectEvent(() => {
		const content = contentRef.current;
		const overlay = overlayRef.current;
		if (!content || !overlay) return undefined;
		return startGeneration(content, overlay, { duration, delay, maxParts, keys, onDone: onComplete });
	});
	const complete = useEffectEvent(() => onComplete?.());

	// Layout effect: the content is hidden before the first paint, so it never flashes in.
	useLayoutEffect(() => {
		if (reduceMotion) {
			complete();
			return undefined;
		}
		return start();
	}, [playKey, reduceMotion]);

	return (
		<div className={cn("relative w-fit", className)}>
			<div ref={contentRef}>{children}</div>
			<div
				ref={overlayRef}
				aria-hidden
				{...{ [SKIP_ATTRIBUTE]: "" }}
				className="pointer-events-none absolute inset-0 z-10 overflow-visible select-none"
			/>
		</div>
	);
}

export default UIGeneration;
