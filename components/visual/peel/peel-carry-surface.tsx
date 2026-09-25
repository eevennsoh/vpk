"use client";

import { useRef } from "react";

import type { PeelSurfaceProps } from "./peel-surface";
import { usePeelCarryMotion } from "./use-peel-carry-motion";

/** Gaussian side falloff, matching the paper shader's 20%-wide edge beam. */
const EDGE_MASK = "linear-gradient(to right, #000 0%, rgb(0 0 0 / .94) 5%, rgb(0 0 0 / .78) 10%, rgb(0 0 0 / .57) 15%, rgb(0 0 0 / .37) 20%, rgb(0 0 0 / .21) 25%, rgb(0 0 0 / .11) 30%, rgb(0 0 0 / .05) 35%, transparent 50%)";

/** Paper's carry pose on the existing DOM face, with a stable fusion sensor. */
export function PeelCarrySurface({ children, flashColor, poseReady, reducedMotion, ...motion }: Readonly<Pick<PeelSurfaceProps, "children" | "active" | "flashColor" | "pointerX" | "pointerY" | "pointerDirection" | "pointerOriginX" | "tuning"> & { poseReady: boolean; reducedMotion: boolean }>) {
	const frameRef = useRef<HTMLDivElement>(null);
	const paintRef = useRef<HTMLDivElement>(null);
	const leftLightRef = useRef<HTMLSpanElement>(null);
	const rightLightRef = useRef<HTMLSpanElement>(null);
	// Keep the sensor and light clips mounted throughout pickup; only pose
	// physics wait for the host's actual animation-completion signal.
	usePeelCarryMotion({ ...motion, active: motion.active && poseReady, reducedMotion, frameRef, paintRef, leftLightRef, rightLightRef });
	return (
		<div className="pointer-events-none relative w-fit max-w-full" data-session-carry-frame="" data-session-fusion-chip={motion.active ? "" : undefined} ref={frameRef}>
			<div className="relative w-fit max-w-full" data-session-carry-paint="" ref={paintRef} style={{ transform: "rotateY(0rad) rotateZ(0rad)" }}>
				{children}
				{motion.active && flashColor && !reducedMotion ? (
					<span aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-lg dark:opacity-50" data-session-carry-light-surface="">
						<span className="absolute inset-0" data-session-carry-light="left" ref={leftLightRef} style={{ backgroundColor: flashColor, maskImage: EDGE_MASK, opacity: 0 }} />
						<span className="absolute inset-0" data-session-carry-light="right" ref={rightLightRef} style={{ backgroundColor: flashColor, maskImage: EDGE_MASK.replace("to right", "to left"), opacity: 0 }} />
					</span>
				) : null}
			</div>
		</div>
	);
}
